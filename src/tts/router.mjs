import { synthesizeKokoro, getKokoroVoices } from './kokoro-provider.mjs';
import { synthesizeViaOpenAiSpeech } from './openai-provider.mjs';
import { validatePcmWav } from './wav-utils.mjs';

export function listAvailableVoices(config) {
  const voices = [...getKokoroVoices()];

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

  let audioBuffer = null;

  // 1. OpenAI / AI Vendor
  if (model.startsWith('tts-1') || voice === 'alloy' || voice === 'echo' || voice === 'onyx' || voice === 'nova') {
    if (config?.tts?.openaiSpeechApiKey) {
      audioBuffer = await synthesizeViaOpenAiSpeech({
        baseUrl: config.tts.openaiSpeechBaseUrl,
        apiKey: config.tts.openaiSpeechApiKey,
        model,
        input: cleanText,
        voice,
        speed,
      });
    }
  }

  // 2. Real Kokoro-82M Neural Synthesis
  if (!audioBuffer) {
    audioBuffer = await synthesizeKokoro({ text: cleanText, voice, speed });
  }

  // 3. Validate PCM WAV audio parameters
  if (audioBuffer) {
    const meta = validatePcmWav(audioBuffer);
    console.log(`[book-ai:tts] Synthesized neural Kokoro WAV: ${meta.sampleRate}Hz, ${meta.numChannels}ch, ${meta.bitsPerSample}-bit (${audioBuffer.length} bytes)`);
    return audioBuffer;
  }

  throw new Error('No speech synthesis engine available.');
}
