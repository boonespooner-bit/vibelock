// Thin client for the backend generation proxy. The taste engine has already
// turned the locked profile + subject into `prompt` (see engine/prompt.ts); we
// just hand it to the server, which relays to Gemini and keeps the key secret.

export interface GenerateResult {
  image: string; // data: URI
  model: string;
  prompt: string;
}

export class GenerateError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function generateImage(prompt: string, signal?: AbortSignal): Promise<GenerateResult> {
  let res: Response;
  try {
    res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new GenerateError('network', 'Could not reach the generation server.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GenerateError(data?.error || 'error', data?.message || `Request failed (${res.status}).`);
  }
  return data as GenerateResult;
}

export interface Health {
  ok: boolean;
  hasKey: boolean;
  model: string;
}

// Lets the UI show whether real generation is wired up before the user tries.
export async function checkHealth(): Promise<Health | null> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}
