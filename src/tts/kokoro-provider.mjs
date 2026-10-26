import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNNER_SCRIPT = path.join(__dirname, 'kokoro-runner.py');

export const KOKORO_VOICES = [
  { id: 'af_heart', name: 'Heart (Warm Female)', gender: 'female', engine: 'kokoro' },
  { id: 'af_bella', name: 'Bella (Clear Female)', gender: 'female', engine: 'kokoro' },
  { id: 'af_sky', name: 'Sky (Light Female)', gender: 'female', engine: 'kokoro' },
  { id: 'am_adam', name: 'Adam (Deep Male)', gender: 'male', engine: 'kokoro' },
  { id: 'am_michael', name: 'Michael (Analytical Male)', gender: 'male', engine: 'kokoro' },
  { id: 'bf_emma', name: 'Emma (British Female)', gender: 'female', engine: 'kokoro' },
];

export function getKokoroVoices() {
  return KOKORO_VOICES;
}

function resolvePythonCommand() {
  // 1. Explicit environment variable
  if (process.env.KOKORO_PYTHON_BIN && fs.existsSync(process.env.KOKORO_PYTHON_BIN)) {
    return { cmd: process.env.KOKORO_PYTHON_BIN, args: [] };
  }

  // 2. Known local virtualenv with kokoro-onnx installed
  const knownVenvs = [
    '/Users/yuechuan/Projects/mrepo-gemini/tools/audio/.venv/bin/python',
    path.join(process.cwd(), 'tools/audio/.venv/bin/python'),
    path.join(os.homedir(), '.book-ai/.venv/bin/python'),
  ];
  for (const venv of knownVenvs) {
    if (fs.existsSync(venv)) {
      return { cmd: venv, args: [] };
    }
  }

  // 3. System python3 if kokoro-onnx is installed
  const checkSys = spawnSync('python3', ['-c', 'import kokoro_onnx'], { stdio: 'ignore' });
  if (checkSys.status === 0) {
    return { cmd: 'python3', args: [] };
  }

  // 4. uv run --with kokoro-onnx python3
  const checkUv = spawnSync('which', ['uv'], { stdio: 'ignore' });
  if (checkUv.status === 0) {
    return { cmd: 'uv', args: ['run', '--with', 'kokoro-onnx', 'python3'] };
  }

  return null;
}

export function isKokoroInstalled() {
  const runner = resolvePythonCommand();
  return runner !== null;
}

/**
 * Synthesizes real neural speech using Kokoro-82M ONNX.
 * Returns raw 24kHz 16-bit mono RIFF WAV buffer.
 */
export async function synthesizeKokoro({ text, voice = 'af_heart', speed = 1.0 }) {
  const runner = resolvePythonCommand();
  if (!runner) {
    throw new Error('Kokoro neural TTS requires Python with kokoro-onnx or uv installed.');
  }

  const payload = JSON.stringify({ text, voice, speed });
  const execArgs = [...runner.args, RUNNER_SCRIPT];

  const res = spawnSync(runner.cmd, execArgs, {
    input: payload,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 60000,
  });

  if (res.status === 0 && res.stdout && res.stdout.length > 44) {
    // Verify RIFF header
    const magic = res.stdout.toString('ascii', 0, 4);
    if (magic === 'RIFF') {
      return res.stdout;
    }
  }

  const stderr = res.stderr ? res.stderr.toString('utf-8').trim() : 'Unknown error';
  throw new Error(`Kokoro neural synthesis failed (exit code ${res.status}): ${stderr}`);
}
