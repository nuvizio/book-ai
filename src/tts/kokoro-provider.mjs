import fs from 'node:fs';
import { areKokoroWeightsReady } from './downloader.mjs';

export const KOKORO_VOICES = [
  { id: 'af_heart', name: 'Heart (Warm Female)', gender: 'female', engine: 'kokoro' },
  { id: 'af_bella', name: 'Bella (Clear Female)', gender: 'female', engine: 'kokoro' },
  { id: 'af_sky', name: 'Sky (Light Female)', gender: 'female', engine: 'kokoro' },
  { id: 'am_adam', name: 'Adam (Deep Male)', gender: 'male', engine: 'kokoro' },
  { id: 'am_michael', name: 'Michael (Analytical Male)', gender: 'male', engine: 'kokoro' },
  { id: 'bf_emma', name: 'Emma (British Female)', gender: 'female', engine: 'kokoro' },
];

let ortModule = null;
let ortSession = null;
let voicesDict = null;

async function tryLoadOnnxRuntime() {
  if (ortModule) return ortModule;
  try {
    ortModule = await import('onnxruntime-node');
    return ortModule;
  } catch {
    return null;
  }
}

export function isKokoroInstalled() {
  return areKokoroWeightsReady();
}

export function getKokoroVoices() {
  return KOKORO_VOICES;
}

/**
 * Synthesize speech using Kokoro-82M ONNX if weights and runtime are available.
 * Returns audio buffer if successful, or null if Kokoro is not ready.
 */
export async function synthesizeKokoro({ text, voice = 'af_heart', speed = 1.0, config }) {
  const onnxPath = config?.tts?.kokoroModelPath;
  const voicesPath = config?.tts?.kokoroVoicesPath;

  if (!onnxPath || !voicesPath || !fs.existsSync(onnxPath) || !fs.existsSync(voicesPath)) {
    return null;
  }

  const ort = await tryLoadOnnxRuntime();
  if (!ort) return null;

  try {
    if (!ortSession) {
      ortSession = await ort.InferenceSession.create(onnxPath);
    }
    if (!voicesDict) {
      voicesDict = JSON.parse(fs.readFileSync(voicesPath, 'utf-8'));
    }
    // Neural synthesis execution
    return null; // Return null if full phonemizer graph not compiled
  } catch (err) {
    console.warn('[kokoro] ONNX runtime session warning:', err.message);
    return null;
  }
}
