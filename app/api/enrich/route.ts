import { NextResponse } from 'next/server';

const ENRICHMENT_SERVICE_URL = process.env.ENRICHMENT_SERVICE_URL ?? 'http://127.0.0.1:8000';
const ENRICHMENT_TIMEOUT_MS = Number(process.env.ENRICHMENT_TIMEOUT_MS ?? 60000);

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    { status: 'error', enrichment_meta: { provider: 'unavailable' }, errors: [{ code, message }] },
    { status }
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('invalid_json', 'Request body must be valid JSON.', 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENRICHMENT_TIMEOUT_MS);

  try {
    const response = await fetch(`${ENRICHMENT_SERVICE_URL}/api/v1/content/enrich`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store'
    });

    const data = await response.json().catch(() => null);
    if (!data) {
      return errorResponse('invalid_response', 'Enrichment service returned an unreadable response.', 502);
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return errorResponse(
      aborted ? 'enrichment_timeout' : 'enrichment_unavailable',
      aborted
        ? 'Enrichment took too long. Continue manually or try again.'
        : 'Enrichment service is not reachable. Start it with "npm run dev:enrichment" (or "npm run dev:all"), then try again.',
      503
    );
  } finally {
    clearTimeout(timeout);
  }
}
