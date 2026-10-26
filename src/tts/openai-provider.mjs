/**
 * OpenAI-compatible and Fish Audio speech API provider.
 */

export async function synthesizeViaOpenAiSpeech({
  baseUrl = 'https://api.openai.com/v1',
  apiKey,
  model = 'tts-1',
  input,
  voice = 'alloy',
  speed = 1.0,
}) {
  if (!apiKey) {
    throw new Error('API key not configured for OpenAI Speech provider.');
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/audio/speech`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      voice,
      speed,
      response_format: 'wav',
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Speech API returned HTTP ${res.status}: ${errorText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
