import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadConfig, saveConfig } from './config.mjs';
import { downloadKokoroWeights, areKokoroWeightsReady } from './tts/downloader.mjs';
import { detectInstalledClis } from './llm/cli-provider.mjs';

export async function runInteractiveWizard() {
  const rl = readline.createInterface({ input, output });
  const config = loadConfig();

  console.log(`
╔════════════════════════════════════════════════════════════╗
║             📚 book-ai Interactive Setup Wizard            ║
║  Local AI & Neural Voice Engine for Reading Applications  ║
╚════════════════════════════════════════════════════════════╝
`);

  try {
    // 1. Detect environment
    const detectedClis = detectInstalledClis();
    console.log(`[🔍 Scanning Local Environment]`);
    if (detectedClis.length > 0) {
      console.log(`  ✓ Detected local CLIs: ${detectedClis.join(', ')}`);
    } else {
      console.log(`  ℹ No local subscription CLIs found in PATH.`);
    }

    // 2. Select LLM Providers
    console.log(`\n--- [1/3] LLM Providers Configuration ---`);
    console.log(`Available options:`);
    console.log(`  1) Local CLIs (Claude, Antigravity/agy, Codex)`);
    console.log(`  2) Local Engines (Ollama, LM Studio)`);
    console.log(`  3) Commercial API Keys (OpenAI, Anthropic, Gemini, Groq, DeepSeek)`);
    console.log(`  4) All of the above (Auto-fallback) [Default]`);

    const llmChoice = (await rl.question(`Select LLM setup [1-4, default: 4]: `)).trim() || '4';
    if (llmChoice === '1') {
      config.llm.enabledProviders = ['cli', 'fallback'];
    } else if (llmChoice === '2') {
      config.llm.enabledProviders = ['ollama', 'fallback'];
    } else if (llmChoice === '3') {
      config.llm.enabledProviders = ['api', 'fallback'];
    } else {
      config.llm.enabledProviders = ['cli', 'ollama', 'api', 'fallback'];
    }

    // Ask for API keys if API was chosen
    if (config.llm.enabledProviders.includes('api')) {
      const openAiKey = (await rl.question(`  (Optional) Enter OpenAI API Key (or press Enter to skip): `)).trim();
      if (openAiKey) config.llm.apiKeys.openai = openAiKey;

      const anthropicKey = (await rl.question(`  (Optional) Enter Anthropic API Key (or press Enter to skip): `)).trim();
      if (anthropicKey) config.llm.apiKeys.anthropic = anthropicKey;

      const geminiKey = (await rl.question(`  (Optional) Enter Gemini API Key (or press Enter to skip): `)).trim();
      if (geminiKey) config.llm.apiKeys.gemini = geminiKey;
    }

    // 3. Select TTS Providers
    console.log(`\n--- [2/3] TTS Voice Narration Configuration ---`);
    console.log(`Available options:`);
    console.log(`  1) Kokoro-82M ONNX (Local 24 kHz Neural Studio Narration) [Recommended]`);
    console.log(`  2) OpenAI Speech API (alloy, echo, fable, onyx, nova)`);
    console.log(`  3) Both Kokoro and OpenAI Speech with automatic fallback [Default]`);

    const ttsChoice = (await rl.question(`Select TTS setup [1-3, default: 3]: `)).trim() || '3';
    if (ttsChoice === '1') {
      config.tts.enabledProviders = ['kokoro', 'synthetic'];
    } else if (ttsChoice === '2') {
      config.tts.enabledProviders = ['openai', 'synthetic'];
      const speechKey = (await rl.question(`  Enter OpenAI API Key for Speech: `)).trim();
      if (speechKey) config.tts.openaiSpeechApiKey = speechKey;
    } else {
      config.tts.enabledProviders = ['kokoro', 'openai', 'synthetic'];
    }

    // 4. Model Weights Download Prompt
    console.log(`\n--- [3/3] External Model Download ---`);
    if (areKokoroWeightsReady()) {
      console.log(`  ✓ Kokoro-82M ONNX model weights already present in ~/.book-ai/models/`);
    } else if (config.tts.enabledProviders.includes('kokoro')) {
      const downloadNow = (await rl.question(`Download Kokoro-82M ONNX weights (~330MB) from Hugging Face now? [y/N]: `)).trim().toLowerCase();
      if (downloadNow === 'y' || downloadNow === 'yes') {
        console.log(`\nStarting model download from Hugging Face...`);
        await downloadKokoroWeights((msg) => console.log(msg));
      } else {
        console.log(`  ℹ Skipping download for now. Weights will download automatically on first speech request.`);
      }
    }

    // Save final config
    saveConfig(config);
    console.log(`\n[✓] Configuration successfully saved to ~/.book-ai/config.json\n`);
  } finally {
    rl.close();
  }
}
