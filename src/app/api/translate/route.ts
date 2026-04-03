import { NextRequest, NextResponse } from 'next/server';
import { appConfig } from '../../../../app.config';

const { translate } = appConfig;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { texts, targetLang } = body as {
      texts: string[];
      targetLang: string;
    };

    if (
      !Array.isArray(texts) ||
      texts.length === 0 ||
      typeof targetLang !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 },
      );
    }

    // Don't translate if target is the source
    if (targetLang === translate.sourceLocale) {
      return NextResponse.json({ translations: texts });
    }

    if (!translate.apiKey) {
      return NextResponse.json(
        { error: 'Translation service not configured' },
        { status: 503 },
      );
    }

    // Enforce max chars
    const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
    if (totalChars > translate.maxChars) {
      return NextResponse.json(
        { error: 'Text too long for translation' },
        { status: 413 },
      );
    }

    const params = new URLSearchParams({
      key: translate.apiKey,
    });

    const response = await fetch(`${translate.apiUrl}?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: texts,
        source: translate.sourceLocale,
        target: targetLang,
        format: 'text',
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Google Translate API error:', response.status, errBody);
      return NextResponse.json(
        { error: 'Translation failed' },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      data: { translations: { translatedText: string }[] };
    };

    const translations = data.data.translations.map(
      (t) => t.translatedText,
    );

    return NextResponse.json({ translations });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
