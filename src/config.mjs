import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const CONFIG_DIR = path.join(os.homedir(), '.book-ai');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const MODELS_DIR = path.join(CONFIG_DIR, 'models');

export const DEFAULT_CONFIG = {
  version: '1.0.0',
  portRange: { start: 28280, end: 28289 },
  host: '127.0.0.1',
  llm: {
    enabledProviders: ['cli', 'ollama', 'fallback'],
    defaultModel: 'claude-3-5-sonnet',
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    lmStudioBaseUrl: 'http://127.0.0.1:1234',
    apiKeys: {
      openai: '',
      anthropic: '',
      gemini: '',
      groq: '',
      deepseek: '',
      openrouter: '',
    },
  },
  tts: {
    enabledProviders: ['kokoro', 'synthetic'],
    defaultVoice: 'af_heart',
    kokoroModelPath: path.join(MODELS_DIR, 'kokoro-v0_19.onnx'),
    kokoroVoicesPath: path.join(MODELS_DIR, 'voices.json'),
    openaiSpeechApiKey: '',
    openaiSpeechBaseUrl: 'https://api.openai.com/v1',
    fishAudioApiKey: '',
  },
  security: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:5173',
      'tauri://localhost',
    ],
  },
};

export function ensureDirectories() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadConfig() {
  ensureDirectories();
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm },
      tts: { ...DEFAULT_CONFIG.tts, ...parsed.tts },
      security: { ...DEFAULT_CONFIG.security, ...parsed.security },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config) {
  ensureDirectories();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}
