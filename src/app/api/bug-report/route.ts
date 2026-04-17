import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appConfig } from '../../../../app.config';

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

const bugReportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z
    .enum([
      'ui',
      'data',
      'performance',
      'translation',
      'accessibility',
      'other',
    ])
    .optional(),
  pageUrl: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  locale: z.string().max(5).optional(),
});

// Simple in-memory rate limiter per IP (resets on redeploy)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  const limit = appConfig.bugReport.rateLimitPerHour;

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
  }

  const token = process.env.GITHUB_BUG_REPORT_TOKEN;
  if (!token) {
    console.error('[bug-report] GITHUB_BUG_REPORT_TOKEN is not set');
    return NextResponse.json({ error: 'server_config' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  // Parse text fields
  const rawFields = {
    title: formData.get('title'),
    description: formData.get('description'),
    category: formData.get('category') || undefined,
    pageUrl: formData.get('pageUrl') || undefined,
    userAgent: formData.get('userAgent') || undefined,
    locale: formData.get('locale') || undefined,
  };

  const parsed = bugReportSchema.safeParse(rawFields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { title, description, category, pageUrl, userAgent, locale } =
    parsed.data;

  // Process images
  const imageFiles: File[] = [];
  const maxImages = appConfig.bugReport.maxImages;
  const maxSize = appConfig.bugReport.maxImageSizeBytes;

  for (const entry of formData.getAll('images')) {
    if (!(entry instanceof File) || entry.size === 0) continue;

    if (imageFiles.length >= maxImages) {
      return NextResponse.json({ error: 'too_many_images' }, { status: 400 });
    }

    if (entry.size > maxSize) {
      return NextResponse.json({ error: 'image_too_large' }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(entry.type)) {
      return NextResponse.json(
        { error: 'invalid_image_type' },
        { status: 400 },
      );
    }

    imageFiles.push(entry);
  }

  // Upload images to GitHub (as issue comments can embed them)
  const { owner, repo } = appConfig.bugReport.github;
  const imageMarkdown: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Content = buffer.toString('base64');
    const rawExt = file.name.split('.').pop() || 'png';
    // Sanitize extension to prevent path traversal
    const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'png';
    const timestamp = Date.now();
    const path = `bug-reports/${timestamp}-${i}.${ext}`;

    // Upload file to repo
    const uploadRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `bug-report: upload screenshot ${i + 1}`,
          content: base64Content,
          branch: 'dev',
        }),
      },
    );

    if (uploadRes.ok) {
      const uploadData = (await uploadRes.json()) as {
        content?: { download_url?: string };
      };
      const downloadUrl = uploadData.content?.download_url;
      if (downloadUrl) {
        imageMarkdown.push(`![screenshot-${i + 1}](${downloadUrl})`);
      }
    } else {
      console.error(
        `[bug-report] Failed to upload image ${i}: ${uploadRes.status}`,
      );
    }
  }

  // Build issue body
  const labelMap: Record<string, string> = {
    ui: 'bug: ui',
    data: 'bug: data',
    performance: 'bug: performance',
    translation: 'bug: translation',
    accessibility: 'bug: a11y',
    other: 'bug',
  };

  const labels = ['user-report'];
  if (category && labelMap[category]) {
    labels.push(labelMap[category]);
  }

  const bodyParts = [`## Description\n\n${description}`];

  if (category) {
    bodyParts.push(`**Category:** ${category}`);
  }
  if (pageUrl) {
    bodyParts.push(`**Page:** ${pageUrl}`);
  }
  if (locale) {
    bodyParts.push(`**Locale:** ${locale}`);
  }
  if (userAgent) {
    bodyParts.push(`**User Agent:** \`${userAgent}\``);
  }

  if (imageMarkdown.length > 0) {
    bodyParts.push(`## Screenshots\n\n${imageMarkdown.join('\n\n')}`);
  }

  bodyParts.push(`---\n*Submitted automatically via bug report form*`);

  const issueBody = bodyParts.join('\n\n');

  // Create GitHub issue
  const issueRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `[User Report] ${title}`,
        body: issueBody,
        labels,
      }),
    },
  );

  if (!issueRes.ok) {
    const errText = await issueRes.text();
    console.error(`[bug-report] GitHub issue creation failed: ${errText}`);
    return NextResponse.json({ error: 'github_api' }, { status: 502 });
  }

  const issueData = (await issueRes.json()) as {
    html_url?: string;
    number?: number;
  };

  return NextResponse.json({
    success: true,
    issueUrl: issueData.html_url,
    issueNumber: issueData.number,
  });
}
