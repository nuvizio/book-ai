import { detectInstalledClis, queryClaudeCli, queryAgyCli, queryCodexCli } from './cli-provider.mjs';
import { isServerReachable, queryLocalServer } from './server-provider.mjs';
import { queryCommercialApi } from './api-provider.mjs';
import { generateLiteraryFallback } from './fallback.mjs';

export const CATALOG_MODELS = [
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'google' },
  { id: 'gemini-4-argon', name: 'Gemini 4 Argon', provider: 'google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek' },
  { id: 'llama3.2', name: 'Llama 3.2 (Ollama)', provider: 'meta' },
  { id: 'book-ai-offline', name: 'Book-AI Offline Literary Engine', provider: 'local' },
];

export function listAvailableModels(config) {
  const models = [...CATALOG_MODELS];
  const clis = detectInstalledClis();
  for (const cli of clis) {
    models.unshift({ id: `${cli}-cli`, name: `${cli.toUpperCase()} CLI`, provider: 'local-cli' });
  }
  return models;
}

export async function handleChatCompletion({ model = 'claude-3-5-sonnet', messages = [], config }) {
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
  const mLower = (model || '').toLowerCase();

  // 0. Explicit Offline Request
  if (mLower === 'book-ai-offline') {
    return generateLiteraryFallback(model, prompt);
  }

  // 1. Direct Local CLI Routing
  if (mLower.includes('claude') || mLower === 'claude-cli') {
    const res = queryClaudeCli(prompt);
    if (res) return res;
  }
  if (mLower.includes('gemini') || mLower.includes('agy') || mLower === 'agy-cli') {
    const res = queryAgyCli(model, prompt);
    if (res) return res;
  }
  if (mLower.includes('codex') || mLower === 'codex-cli') {
    const res = queryCodexCli(prompt);
    if (res) return res;
  }

  // 2. Ollama / Local Server Routing
  const ollamaUrl = config?.llm?.ollamaBaseUrl || 'http://127.0.0.1:11434';
  if (await isServerReachable(ollamaUrl)) {
    try {
      const res = await queryLocalServer(ollamaUrl, model, messages);
      if (res) return res;
    } catch {
      // Try next
    }
  }

  // 3. API Key Routing
  const apiKeys = config?.llm?.apiKeys || {};
  if (mLower.includes('claude') && apiKeys.anthropic) {
    return await queryCommercialApi({ provider: 'anthropic', apiKey: apiKeys.anthropic, model, messages });
  }
  if (mLower.includes('gemini') && apiKeys.gemini) {
    return await queryCommercialApi({ provider: 'gemini', apiKey: apiKeys.gemini, model, messages });
  }
  if ((mLower.includes('gpt') || mLower.includes('o1') || mLower.includes('o3')) && apiKeys.openai) {
    return await queryCommercialApi({ provider: 'openai', apiKey: apiKeys.openai, model, messages });
  }
  if (mLower.includes('deepseek') && apiKeys.deepseek) {
    return await queryCommercialApi({ provider: 'deepseek', apiKey: apiKeys.deepseek, model, messages });
  }
  if (mLower.includes('groq') && apiKeys.groq) {
    return await queryCommercialApi({ provider: 'groq', apiKey: apiKeys.groq, model, messages });
  }

  // 4. Fallback to any installed local CLI before offline mock
  const claudeRes = queryClaudeCli(prompt);
  if (claudeRes) return claudeRes;

  const agyRes = queryAgyCli(model, prompt);
  if (agyRes) return agyRes;

  const codexRes = queryCodexCli(prompt);
  if (codexRes) return codexRes;

  // 5. Default: fallback to offline literary reasoning
  return generateLiteraryFallback(model, prompt);
}
