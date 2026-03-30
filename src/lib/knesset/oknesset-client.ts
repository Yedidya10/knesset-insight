import { appConfig } from '../../../app.config';

const OKNESSET_BASE = appConfig.dataSources.oknessetData;

/**
 * Fetch a CSV file from Open Knesset and parse it into objects.
 * Uses the production.oknesset.org/pipelines/data endpoint.
 */
export async function fetchOKnessetCSV<T extends Record<string, string>>(
  path: string,
): Promise<T[]> {
  const url = `${OKNESSET_BASE}/${path}`;

  const response = await fetch(url, {
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(
      `Open Knesset fetch failed: ${response.status} ${response.statusText} — ${path}`,
    );
  }

  const text = await response.text();
  return parseCSV<T>(text);
}

/**
 * Simple CSV parser — handles quoted fields and newlines.
 */
function parseCSV<T extends Record<string, string>>(csv: string): T[] {
  const lines = csv.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const results: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j];
    }
    results.push(row as T);
  }

  return results;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Check if a remote CSV has been modified since last check.
 * Returns the new ETag/Last-Modified if changed, null if unchanged.
 */
export async function checkOKnessetModified(
  path: string,
  lastETag?: string,
): Promise<string | null> {
  const url = `${OKNESSET_BASE}/${path}`;

  const response = await fetch(url, {
    method: 'HEAD',
    next: { revalidate: 0 },
  });

  const etag = response.headers.get('etag');
  const lastModified = response.headers.get('last-modified');
  const currentTag = etag ?? lastModified ?? '';

  if (currentTag && currentTag === lastETag) {
    return null; // Not modified
  }

  return currentTag || new Date().toISOString();
}
