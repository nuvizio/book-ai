import { synthesizeKokoro, getKokoroVoices } from './kokoro-provider.mjs';
import { synthesizeViaOpenAiSpeech } from './openai-provider.mjs';
import { validatePcmWav } from './wav-utils.mjs';

const OPENAI_VOICES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

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

  // 1. OpenAI Speech API
  const isOpenAiVoice = OPENAI_VOICES.has(voice);
  const isOpenAiModel = model.startsWith('tts-1');

  if (isOpenAiVoice || isOpenAiModel) {
    if (!config?.tts?.openaiSpeechApiKey) {
      throw new Error(`OpenAI speech requested for voice "${voice}", but no openaiSpeechApiKey is configured in ~/.book-ai/config.json.`);
    }

    const audioBuffer = await synthesizeViaOpenAiSpeech({
      baseUrl: config.tts.openaiSpeechBaseUrl,
      apiKey: config.tts.openaiSpeechApiKey,
      model: isOpenAiModel ? model : 'tts-1',
      input: cleanText,
      voice,
      speed,
    });

    validatePcmWav(audioBuffer);
    return audioBuffer;
  }

  // 2. Real Kokoro-82M Neural Synthesis
  const kokoroVoices = new Set(getKokoroVoices().map((v) => v.id));
  if (kokoroVoices.has(voice) || model === 'kokoro') {
    const audioBuffer = await synthesizeKokoro({ text: cleanText, voice, speed });
    const meta = validatePcmWav(audioBuffer);
    console.log(`[book-ai:tts] Synthesized neural Kokoro WAV: ${meta.sampleRate}Hz, ${meta.numChannels}ch, ${meta.bitsPerSample}-bit (${audioBuffer.length} bytes)`);
    return audioBuffer;
  }

  // 3. Unknown voice / engine: fail explicitly with exact root cause
  throw new Error(`Unsupported voice "${voice}" and model "${model}". Supported voices: ${[...kokoroVoices].join(', ')}.`);
}
