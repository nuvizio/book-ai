import { synthesizeKokoro, getKokoroVoices } from './kokoro-provider.mjs';
import { synthesizeViaOpenAiSpeech } from './openai-provider.mjs';
import { generateSyntheticWav, SYNTHETIC_VOICES } from './synth-fallback.mjs';

export function listAvailableVoices(config) {
  const voices = [...SYNTHETIC_VOICES];

  if (config?.tts?.openaiSpeechApiKey) {
    voices.push(
      { id: 'alloy', name: 'Alloy (OpenAI)', gender: 'neutral', engine: 'openai' },
      { id: 'echo', name: 'Echo (OpenAI)', gender: 'male', engine: 'openai' },
      { id: 'fable', name: 'Fable (OpenAI)', gender: 'male', engine: 'openai' },
      { id: 'onyx', name: 'Onyx (OpenAI)', gender: 'male', engine: 'openai' },
      { id: 'nova', name: 'Nova (OpenAI)', gender: 'female', engine: 'openai' },
      { id: 'shimmer', name: 'Shimmer (OpenAI)', gender: 'female', engine: 'openai' }
    );
  }

  return voices;
}

export async function handleSpeechRequest({ input, voice = 'af_heart', model = 'kokoro', speed = 1.0, config }) {
  if (!input || !input.trim()) {
    throw new Error('Missing input text for speech synthesis.');
  }

  const cleanText = input.replace(/\[[A-Za-z0-9_\s-]+\]/g, '').replace(/<\|[A-Za-z0-9_\s-]+\|>/g, '').trim();

  // 1. OpenAI / AI Vendor
  if (model.startsWith('tts-1') || voice === 'alloy' || voice === 'echo' || voice === 'onyx' || voice === 'nova') {
    if (config?.tts?.openaiSpeechApiKey) {
      return await synthesizeViaOpenAiSpeech({
        baseUrl: config.tts.openaiSpeechBaseUrl,
        apiKey: config.tts.openaiSpeechApiKey,
        model,
        input: cleanText,
        voice,
        speed,
      });
    }
  }

  // 2. Kokoro-82M ONNX
  try {
    return await synthesizeKokoro({ text: cleanText, voice, speed, config });
  } catch (err) {
    console.warn('[tts] Kokoro synthesis error, falling back to synthetic wav:', err.message);
  }

  // 3. Resilient fallback
  return generateSyntheticWav(cleanText, voice, speed);
}
