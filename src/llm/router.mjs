import { queryClaudeCli, queryAgyCli, queryCodexCli } from './cli-provider.mjs';
import { isServerReachable, queryLocalServer } from './server-provider.mjs';
import { queryCommercialApi } from './api-provider.mjs';

export const CATALOG_MODELS = [
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'google' },
  { id: 'gemini-4-argon', name: 'Gemini 4 Argon', provider: 'google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek' },
  { id: 'llama3.2', name: 'Llama 3.2 (Ollama)', provider: 'meta' },
];

export function listAvailableModels() {
  return [...CATALOG_MODELS];
}

export async function handleChatCompletion({ model = 'claude-3-5-sonnet', messages = [], config }) {
  if (!messages || messages.length === 0) {
    throw new Error('No messages provided for completion.');
  }

  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
  const mLower = (model || '').toLowerCase();
  const apiKeys = config?.llm?.apiKeys || {};

  // 1. Anthropic / Claude
  if (mLower.includes('claude') || mLower === 'claude-cli') {
    const cliRes = queryClaudeCli(prompt);
    if (cliRes) return cliRes;

    if (apiKeys.anthropic) {
      return await queryCommercialApi({ provider: 'anthropic', apiKey: apiKeys.anthropic, model, messages });
    }

    throw new Error(
      `Claude provider requested for model "${model}", but neither Claude CLI ('claude') is functional nor Anthropic API key is configured.`
    );
  }

  // 2. Google / Gemini
  if (mLower.includes('gemini') || mLower.includes('agy') || mLower === 'agy-cli') {
    const cliRes = queryAgyCli(model, prompt);
    if (cliRes) return cliRes;

    if (apiKeys.gemini) {
      return await queryCommercialApi({ provider: 'gemini', apiKey: apiKeys.gemini, model, messages });
    }

    throw new Error(
      `Gemini provider requested for model "${model}", but neither agy CLI ('agy') is functional nor Google Gemini API key is configured.`
    );
  }

  // 3. OpenAI Codex CLI
  if (mLower.includes('codex') || mLower === 'codex-cli') {
    const cliRes = queryCodexCli(prompt);
    if (cliRes) return cliRes;
    throw new Error(`Codex CLI provider requested for model "${model}", but 'codex' CLI is not available in PATH.`);
  }

  // 4. OpenAI API
  if (mLower.includes('gpt') || mLower.includes('o1') || mLower.includes('o3')) {
    if (apiKeys.openai) {
      return await queryCommercialApi({ provider: 'openai', apiKey: apiKeys.openai, model, messages });
    }
    throw new Error(`OpenAI model "${model}" requested, but no OpenAI API key is configured in ~/.book-ai/config.json.`);
  }

  // 5. DeepSeek
  if (mLower.includes('deepseek')) {
    if (apiKeys.deepseek) {
      return await queryCommercialApi({ provider: 'deepseek', apiKey: apiKeys.deepseek, model, messages });
    }
    throw new Error(`DeepSeek model "${model}" requested, but no DeepSeek API key is configured in ~/.book-ai/config.json.`);
  }

  // 6. Groq
  if (mLower.includes('groq')) {
    if (apiKeys.groq) {
      return await queryCommercialApi({ provider: 'groq', apiKey: apiKeys.groq, model, messages });
    }
    throw new Error(`Groq model "${model}" requested, but no Groq API key is configured in ~/.book-ai/config.json.`);
  }

  // 7. Ollama / Local Server
  const ollamaUrl = config?.llm?.ollamaBaseUrl || 'http://127.0.0.1:11434';
  if (await isServerReachable(ollamaUrl)) {
    return await queryLocalServer(ollamaUrl, model, messages);
  }

  // Explicit failure with actionable root cause
  throw new Error(
    `Unsupported or unconfigured model "${model}". Please configure the corresponding CLI or API key in ~/.book-ai/config.json.`
  );
}
