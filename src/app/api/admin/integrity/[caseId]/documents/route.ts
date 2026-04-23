import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { integrityCases, integrityDocuments } from '@/lib/db/schema';
import {
  uploadIntegrityDocument,
  deleteIntegrityDocument,
  getIntegrityDocumentUrl,
} from '@/lib/supabase/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * POST /api/admin/integrity/[caseId]/documents
 * Upload an official document for an integrity case. Admin-only.
 * Body: multipart/form-data with fields:
 *   - file: File (PDF / image)
 *   - title: string
 *   - docType: 'protocol' | 'ruling' | 'report' | 'indictment' | 'response' | 'other'
 *   - publishedAt?: string (ISO date)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const authorized = await isAdmin();
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { caseId: caseIdStr } = await params;
  const caseId = Number(caseIdStr);
  if (!Number.isFinite(caseId) || caseId <= 0) {
    return NextResponse.json({ error: 'invalid case id' }, { status: 400 });
  }

  // Verify case exists
  const [caseRow] = await db
    .select({ id: integrityCases.id })
    .from(integrityCases)
    .where(eq(integrityCases.id, caseId))
    .limit(1);

  if (!caseRow) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 413 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'unsupported_file_type' },
      { status: 415 },
    );
  }

  const titleRaw = formData.get('title');
  const title =
    typeof titleRaw === 'string' && titleRaw.trim()
      ? titleRaw.trim().slice(0, 500)
      : file.name;

  const docTypeRaw = formData.get('docType');
  const VALID_DOC_TYPES = [
    'protocol',
    'ruling',
    'report',
    'indictment',
    'response',
    'other',
  ];
  const docType =
    typeof docTypeRaw === 'string' && VALID_DOC_TYPES.includes(docTypeRaw)
      ? docTypeRaw
      : 'other';

  const publishedAtRaw = formData.get('publishedAt');
  const publishedAt =
    typeof publishedAtRaw === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(publishedAtRaw)
      ? publishedAtRaw
      : null;

  // Check SUPABASE_SERVICE_ROLE_KEY before attempting upload
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error: 'storage_not_configured',
        message:
          'SUPABASE_SERVICE_ROLE_KEY is not set. Get it from Supabase → Settings → API → service_role.',
      },
      { status: 503 },
    );
  }

  let storagePath: string;
  try {
    const buffer = await file.arrayBuffer();
    storagePath = await uploadIntegrityDocument(
      caseId,
      file.name,
      buffer,
      file.type,
    );
  } catch (err) {
    console.error('[integrity upload] storage error:', err);
    return NextResponse.json(
      { error: 'storage_upload_failed' },
      { status: 500 },
    );
  }

  const publicUrl = getIntegrityDocumentUrl(storagePath);

  const [inserted] = await db
    .insert(integrityDocuments)
    .values({
      caseId,
      docType,
      title,
      url: publicUrl,
      storagePath,
      publishedAt: publishedAt ?? undefined,
    })
    .returning();

  return NextResponse.json({ success: true, document: inserted });
}

/**
 * DELETE /api/admin/integrity/[caseId]/documents?docId=N
 * Remove a document record and its storage file. Admin-only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const authorized = await isAdmin();
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { caseId: caseIdStr } = await params;
  const caseId = Number(caseIdStr);
  if (!Number.isFinite(caseId) || caseId <= 0) {
    return NextResponse.json({ error: 'invalid case id' }, { status: 400 });
  }

  const docIdStr = req.nextUrl.searchParams.get('docId');
  const docId = Number(docIdStr);
  if (!Number.isFinite(docId) || docId <= 0) {
    return NextResponse.json({ error: 'invalid doc id' }, { status: 400 });
  }

  const [doc] = await db
    .select({
      id: integrityDocuments.id,
      storagePath: integrityDocuments.storagePath,
    })
    .from(integrityDocuments)
    .where(eq(integrityDocuments.id, docId))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Delete from storage if it was uploaded
  if (doc.storagePath && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await deleteIntegrityDocument(doc.storagePath);
    } catch (err) {
      console.warn(
        '[integrity delete] storage delete failed (continuing):',
        err,
      );
    }
  }

  await db.delete(integrityDocuments).where(eq(integrityDocuments.id, docId));

  return NextResponse.json({ success: true });
}

/**
 * GET /api/admin/integrity/[caseId]/documents
 * List documents for a case. Admin-only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const authorized = await isAdmin();
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { caseId: caseIdStr } = await params;
  const caseId = Number(caseIdStr);
  if (!Number.isFinite(caseId) || caseId <= 0) {
    return NextResponse.json({ error: 'invalid case id' }, { status: 400 });
  }

  const docs = await db
    .select()
    .from(integrityDocuments)
    .where(eq(integrityDocuments.caseId, caseId));

  return NextResponse.json({ documents: docs });
}
