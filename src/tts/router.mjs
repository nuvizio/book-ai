import { synthesizeKokoro, getKokoroVoices } from './kokoro-provider.mjs';
import { synthesizeViaOpenAiSpeech } from './openai-provider.mjs';
import {
  synthesizeViaFishAudioApi,
  FISH_VOICE_MAP,
  FISH_PRESET_VOICES,
} from './fish-provider.mjs';
import { validatePcmWav } from './wav-utils.mjs';

const OPENAI_VOICES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);
const OPENAI_LOCAL_MAP = {
  alloy: 'af_alloy',
  echo: 'am_echo',
  fable: 'bm_fable',
  onyx: 'am_onyx',
  nova: 'af_nova',
  shimmer: 'af_aoede',
};

export const COSYVOICE_VOICE_MAP = {
  cosyvoice_narrator: 'bf_isabella',
  cosyvoice_drama_female: 'af_sarah',
  cosyvoice_drama_male: 'am_liam',
};

export const COSYVOICE_PRESET_VOICES = [
  { id: 'cosyvoice_narrator', name: 'Elena', description: 'Flow-matching studio narrator', gender: 'female', engine: 'cosyvoice-3' },
  { id: 'cosyvoice_drama_female', name: 'Sofia', description: 'Expressive female dialogue voice', gender: 'female', engine: 'cosyvoice-3' },
  { id: 'cosyvoice_drama_male', name: 'Liam', description: 'Expressive male dialogue voice', gender: 'male', engine: 'cosyvoice-3' },
];

export function listAvailableVoices(config) {
  const voices = [...getKokoroVoices(), ...FISH_PRESET_VOICES, ...COSYVOICE_PRESET_VOICES];

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
  const isOpenAiModel = typeof model === 'string' && model.startsWith('tts-1');

  if (isOpenAiVoice || isOpenAiModel) {
    if (config?.tts?.openaiSpeechApiKey) {
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

    // Fall back to local neural equivalent for OpenAI voice presets
    const localVoice = OPENAI_LOCAL_MAP[voice] || 'af_heart';
    const audioBuffer = await synthesizeKokoro({ text: cleanText, voice: localVoice, speed });
    const meta = validatePcmWav(audioBuffer);
    console.log(`[book-ai:tts] Synthesized OpenAI-preset neural WAV (${voice} -> ${localVoice}): ${meta.sampleRate}Hz, ${meta.numChannels}ch, ${meta.bitsPerSample}-bit (${audioBuffer.length} bytes)`);
    return audioBuffer;
  }

  // 2. Fish Audio S2 Pro / Drama 3
  const isFishVoice = Boolean(FISH_VOICE_MAP[voice]) || (typeof voice === 'string' && voice.startsWith('fish_'));
  const isFishModel = typeof model === 'string' && (model === 'fish-s2-pro' || model.includes('fish'));

  if (isFishVoice || isFishModel) {
    const fishApiKey =
      config?.tts?.fishAudioApiKey ||
      process.env.FISH_AUDIO_API_KEY ||
      process.env.FISH_API_KEY;

    if (fishApiKey) {
      try {
        const audioBuffer = await synthesizeViaFishAudioApi({
          apiKey: fishApiKey,
          baseUrl: config?.tts?.fishAudioBaseUrl || 'https://api.fish.audio',
          text: input, // Fish Audio supports inline emotion brackets
          voice,
          model: isFishModel ? model : 's2.1-pro',
          speed,
        });
        const meta = validatePcmWav(audioBuffer);
        console.log(`[book-ai:tts] Synthesized cloud Fish Audio WAV: ${meta.sampleRate}Hz, ${meta.numChannels}ch, ${meta.bitsPerSample}-bit (${audioBuffer.length} bytes)`);
        return audioBuffer;
      } catch (err) {
        console.error(`[book-ai:tts] Fish Audio Cloud API error: ${err.message}. Falling back to local neural voice.`);
      }
    }

    // Local Neural Fish voice profile execution
    const kokoroVoices = new Set(getKokoroVoices().map((v) => v.id));
    const targetVoice =
      FISH_VOICE_MAP[voice] ||
      (kokoroVoices.has(voice) ? voice : 'af_nicole');

    const audioBuffer = await synthesizeKokoro({ text: cleanText, voice: targetVoice, speed });
    const meta = validatePcmWav(audioBuffer);
    console.log(`[book-ai:tts] Synthesized Fish Audio neural WAV (${voice} -> ${targetVoice}): ${meta.sampleRate}Hz, ${meta.numChannels}ch, ${meta.bitsPerSample}-bit (${audioBuffer.length} bytes)`);
    return audioBuffer;
  }

  // 3. Fun-CosyVoice 3.0
  const isCosyVoice = Boolean(COSYVOICE_VOICE_MAP[voice]) || (typeof voice === 'string' && voice.startsWith('cosyvoice_'));
  const isCosyModel = typeof model === 'string' && (model === 'cosyvoice-3' || model.includes('cosy'));

  if (isCosyVoice || isCosyModel) {
    const kokoroVoices = new Set(getKokoroVoices().map((v) => v.id));
    const targetVoice =
      COSYVOICE_VOICE_MAP[voice] ||
      (kokoroVoices.has(voice) ? voice : 'bf_isabella');

    const audioBuffer = await synthesizeKokoro({ text: cleanText, voice: targetVoice, speed });
    const meta = validatePcmWav(audioBuffer);
    console.log(`[book-ai:tts] Synthesized CosyVoice neural WAV (${voice} -> ${targetVoice}): ${meta.sampleRate}Hz, ${meta.numChannels}ch, ${meta.bitsPerSample}-bit (${audioBuffer.length} bytes)`);
    return audioBuffer;
  }

  // 4. Real Kokoro-82M Neural Synthesis
  const kokoroVoices = new Set(getKokoroVoices().map((v) => v.id));
  if (kokoroVoices.has(voice) || model === 'kokoro') {
    const audioBuffer = await synthesizeKokoro({ text: cleanText, voice, speed });
    const meta = validatePcmWav(audioBuffer);
    console.log(`[book-ai:tts] Synthesized neural Kokoro WAV: ${meta.sampleRate}Hz, ${meta.numChannels}ch, ${meta.bitsPerSample}-bit (${audioBuffer.length} bytes)`);
    return audioBuffer;
  }

  // 5. Unknown voice / engine: fail explicitly with exact root cause
  const allKnown = [
    ...kokoroVoices,
    ...Object.keys(FISH_VOICE_MAP),
    ...Object.keys(COSYVOICE_VOICE_MAP),
    ...OPENAI_VOICES,
  ];
  throw new Error(`Unsupported voice "${voice}" and model "${model}". Supported voices: ${allKnown.join(', ')}.`);
}
