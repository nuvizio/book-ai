/**
 * Local OpenAI-compatible server provider (Ollama, LM Studio, vLLM).
 */

export async function isServerReachable(baseUrl) {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/version`, {
      signal: AbortSignal.timeout(1000),
    });
    return res.ok;
  } catch {
    try {
      const res2 = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/models`, {
        signal: AbortSignal.timeout(1000),
      });
      return res2.ok;
    } catch {
      return false;
    }
  }
}

export async function queryLocalServer(baseUrl, model, messages) {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      messages,
      temperature: 0.7,
      stream: false,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    throw new Error(`Local server returned HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}
