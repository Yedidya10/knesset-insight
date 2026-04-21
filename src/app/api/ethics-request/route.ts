import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appConfig } from '../../../../app.config';

const ethicsRequestSchema = z.object({
  memberId: z.coerce.number().int().positive(),
  memberName: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  sourceUrl: z.string().url().max(1000).optional().or(z.literal('')),
  pageUrl: z.string().max(500).optional(),
  locale: z.string().max(5).optional(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  const limit = appConfig.ethicsRequest.rateLimitPerHour;
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= limit) return false;
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
    console.error('[ethics-request] GITHUB_BUG_REPORT_TOKEN is not set');
    return NextResponse.json({ error: 'server_config' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = ethicsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { memberId, memberName, description, sourceUrl, pageUrl, locale } =
    parsed.data;

  const { owner, repo } = appConfig.ethicsRequest.github;

  const bodyParts = [
    `## Subject MK`,
    `- **Name:** ${memberName}`,
    `- **Member ID:** ${memberId}`,
    ``,
    `## Description`,
    description,
  ];
  if (sourceUrl) bodyParts.push('', `## Source`, sourceUrl);
  if (pageUrl) bodyParts.push('', `**Submitted from:** ${pageUrl}`);
  if (locale) bodyParts.push(`**Locale:** ${locale}`);
  bodyParts.push('', '---', '*Submitted via ethics-request form*');

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
        title: `[Ethics Request] ${memberName}`,
        body: bodyParts.join('\n'),
        labels: ['ethics-request', 'integrity'],
      }),
    },
  );

  if (!issueRes.ok) {
    const errText = await issueRes.text();
    console.error(`[ethics-request] GitHub issue creation failed: ${errText}`);
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
