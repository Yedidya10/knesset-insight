/**
 * Supabase Storage helper for integrity documents.
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL      – project URL
 *   SUPABASE_SERVICE_ROLE_KEY     – service-role key (bypasses RLS, server-only)
 *
 * To get SUPABASE_SERVICE_ROLE_KEY: Supabase dashboard → Settings → API →
 * "service_role" key. Add it to .env.local.
 */

const BUCKET = 'integrity-documents';

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Get it from Supabase dashboard → Settings → API → service_role.',
    );
  }
  return key;
}

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return url;
}

/** Upload a file to the integrity-documents bucket. Returns the storage path. */
export async function uploadIntegrityDocument(
  caseId: number,
  filename: string,
  fileBuffer: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const serviceKey = getServiceRoleKey();
  const supabaseUrl = getSupabaseUrl();

  // Sanitize filename — keep only safe characters
  const safeFilename = filename
    .replace(/[^a-zA-Z0-9._\u0590-\u05FF-]/g, '_')
    .slice(0, 200);
  const storagePath = `${caseId}/${Date.now()}_${safeFilename}`;

  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': mimeType,
        'x-upsert': 'false',
      },
      body: fileBuffer,
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${errText}`);
  }

  return storagePath;
}

/** Delete a file from the integrity-documents bucket. */
export async function deleteIntegrityDocument(
  storagePath: string,
): Promise<void> {
  const serviceKey = getServiceRoleKey();
  const supabaseUrl = getSupabaseUrl();

  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Storage delete failed (${res.status}): ${errText}`);
  }
}

/** Build the public URL for a storage path. */
export function getIntegrityDocumentUrl(storagePath: string): string {
  const supabaseUrl = getSupabaseUrl();
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

/**
 * For an external URL, return a Google Docs Viewer embed URL.
 * Use this when you want to show an external PDF inline without downloading.
 */
export function buildViewerUrl(url: string): string {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
}
