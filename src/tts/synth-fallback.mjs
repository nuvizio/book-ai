/**
 * Zero-dependency synthetic audio wave synthesizer.
 * Generates 24kHz 16-bit PCM WAV audio for offline reading when weights are downloading or offline.
 */

export const SYNTHETIC_VOICES = [
  { id: 'af_heart', name: 'Heart (Warm Female)', gender: 'female', engine: 'kokoro' },
  { id: 'af_bella', name: 'Bella (Clear Female)', gender: 'female', engine: 'kokoro' },
  { id: 'af_sky', name: 'Sky (Light Female)', gender: 'female', engine: 'kokoro' },
  { id: 'am_adam', name: 'Adam (Deep Male)', gender: 'male', engine: 'kokoro' },
  { id: 'am_michael', name: 'Michael (Analytical Male)', gender: 'male', engine: 'kokoro' },
  { id: 'bf_emma', name: 'Emma (British Female)', gender: 'female', engine: 'kokoro' },
];

export function generateSyntheticWav(text, voice = 'af_heart', speed = 1.0) {
  const sampleRate = 24000;
  const words = (text || '').trim().split(/\s+/);
  const durationSec = Math.max(0.5, (words.length / (140.0 * Math.max(0.2, speed))) * 60.0);
  const totalSamples = Math.floor(sampleRate * durationSec);
  const isFemale = voice.includes('af_') || voice.includes('bella') || voice.includes('sky') || voice.includes('emma');
  const baseF0 = isFemale ? 220.0 : 135.0;

  const dataSize = totalSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // Linear PCM
  buffer.writeUInt16LE(1, 22); // 1 channel (mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate (sampleRate * 2 bytes/sample)
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const env = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * Math.min(1.0, Math.max(0.0, i / totalSamples)))));
    const freqMod = baseF0 + 15.0 * Math.sin(2.0 * Math.PI * 3.0 * t);
    const val = (
      0.6 * Math.sin(2.0 * Math.PI * freqMod * t) +
      0.3 * Math.sin(2.0 * Math.PI * 2.0 * freqMod * t) +
      0.1 * Math.sin(2.0 * Math.PI * 3.0 * freqMod * t)
    ) * env;
    const sampleVal = Math.max(-32767, Math.min(32767, Math.floor(val * 24000)));
    buffer.writeInt16LE(sampleVal, offset);
    offset += 2;
  }

  return buffer;
}
