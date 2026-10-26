import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SYSTEM_VOICES = [
  { id: 'system-samantha', name: 'Samantha (System Female)', gender: 'female', engine: 'system' },
  { id: 'system-alex', name: 'Alex (System Male)', gender: 'male', engine: 'system' },
  { id: 'system-daniel', name: 'Daniel (System British)', gender: 'male', engine: 'system' },
  { id: 'system-karen', name: 'Karen (System Australian)', gender: 'female', engine: 'system' },
];

export function isSystemTtsAvailable() {
  if (process.platform === 'darwin') {
    const res = spawnSync('which', ['say'], { stdio: 'ignore' });
    return res.status === 0;
  }
  if (process.platform === 'linux') {
    const res = spawnSync('which', ['espeak-ng'], { stdio: 'ignore' });
    return res.status === 0;
  }
  return false;
}

export function synthesizeSystemSpeech({ text, voice = 'af_heart', speed = 1.0 }) {
  if (!text || !text.trim()) return null;

  if (process.platform === 'darwin') {
    // Map Kokoro / generic voice names to suitable macOS voices
    let macVoice = 'Samantha';
    const vLower = (voice || '').toLowerCase();
    if (vLower.includes('adam') || vLower.includes('alex') || vLower.includes('michael') || vLower.includes('male')) {
      macVoice = 'Alex';
    } else if (vLower.includes('emma') || vLower.includes('daniel') || vLower.includes('british')) {
      macVoice = 'Daniel';
    } else if (vLower.includes('karen') || vLower.includes('australian')) {
      macVoice = 'Karen';
    }

    // Rate: macOS say default is ~175 words per minute
    const wpm = Math.max(80, Math.min(350, Math.round(175 * speed)));

    const rnd = Math.random().toString(36).slice(2, 9);
    const tmpAiff = path.join(os.tmpdir(), `book_ai_say_${rnd}.aiff`);
    const tmpWav = path.join(os.tmpdir(), `book_ai_say_${rnd}.wav`);

    try {
      const sayRes = spawnSync('say', ['-v', macVoice, '-r', String(wpm), '-o', tmpAiff, text], {
        encoding: 'utf-8',
        timeout: 30000,
      });

      if (sayRes.status === 0 && fs.existsSync(tmpAiff)) {
        spawnSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16', tmpAiff, tmpWav], {
          timeout: 15000,
        });

        if (fs.existsSync(tmpWav)) {
          const buffer = fs.readFileSync(tmpWav);
          try { fs.unlinkSync(tmpAiff); } catch {}
          try { fs.unlinkSync(tmpWav); } catch {}
          return buffer;
        }
      }
    } catch (err) {
      console.warn('[book-ai] macOS say error:', err.message);
    } finally {
      try { if (fs.existsSync(tmpAiff)) fs.unlinkSync(tmpAiff); } catch {}
      try { if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav); } catch {}
    }
  }

  return null;
}
