/**
 * Direct API Key provider for commercial endpoints.
 */

export async function queryCommercialApi({ provider, apiKey, model, messages }) {
  if (!apiKey) {
    throw new Error(`API key required for ${provider}`);
  }

  let baseUrl = 'https://api.openai.com/v1';
  let headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === 'anthropic') {
    baseUrl = 'https://api.anthropic.com/v1';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  } else if (provider === 'gemini') {
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
  } else if (provider === 'groq') {
    baseUrl = 'https://api.groq.com/openai/v1';
  } else if (provider === 'deepseek') {
    baseUrl = 'https://api.deepseek.com/v1';
  } else if (provider === 'openrouter') {
    baseUrl = 'https://openrouter.ai/api/v1';
  }

  const endpoint = `${baseUrl}/chat/completions`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`${provider} returned HTTP ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}
