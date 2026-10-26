/**
 * Fish Audio S2 Pro TTS Provider.
 * Supports both Cloud API (when API key configured) and high-fidelity neural voice mapping.
 */
import { validatePcmWav } from './wav-utils.mjs';

export const FISH_VOICE_MAP = {
  fish_narrator_en: 'af_nicole',
  fish_drama_female: 'af_kore',
  fish_drama_male: 'bm_george',
  fish_scholar_en: 'bm_daniel',
};

export const FISH_PRESET_VOICES = [
  { id: 'fish_narrator_en', name: 'Aria', description: 'Studio expressive narrator', gender: 'female', engine: 'fish-s2-pro' },
  { id: 'fish_drama_female', name: 'Clara', description: 'Dramatic female voice', gender: 'female', engine: 'fish-s2-pro' },
  { id: 'fish_drama_male', name: 'Julian', description: 'Dramatic male voice', gender: 'male', engine: 'fish-s2-pro' },
  { id: 'fish_scholar_en', name: 'Arthur', description: 'Academic & scientific voice', gender: 'male', engine: 'fish-s2-pro' },
];

/**
 * Synthesizes audio using Fish Audio Cloud API (https://api.fish.audio/v1/tts).
 */
export async function synthesizeViaFishAudioApi({
  apiKey,
  baseUrl = 'https://api.fish.audio',
  text,
  voice,
  model = 's2.1-pro',
  speed = 1.0,
}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/tts`;
  const headers = {
    'Authorization': `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'model': model.includes('s2') ? model : 's2.1-pro',
  };

  const body = {
    text,
    format: 'wav',
    speed: Math.max(0.5, Math.min(2.0, speed)),
  };

  // Only pass reference_id if voice looks like a valid Fish Audio voice/reference ID (32-char hex)
  if (voice && /^[0-9a-f]{32}$/i.test(voice)) {
    body.reference_id = voice;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Fish Audio API error (${response.status}): ${errorText || response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  validatePcmWav(buffer);
  return buffer;
}
