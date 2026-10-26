import { spawnSync } from 'node:child_process';

export function isCommandAvailable(cmd) {
  const check = process.platform === 'win32' ? 'where' : 'which';
  const res = spawnSync(check, [cmd], { stdio: 'ignore' });
  return res.status === 0;
}

export function detectInstalledClis() {
  const candidates = ['agy', 'claude', 'codex', 'gemini'];
  return candidates.filter(isCommandAvailable);
}

export function queryClaudeCli(prompt) {
  if (!isCommandAvailable('claude')) return null;
  try {
    const res = spawnSync('claude', ['-p'], {
      input: prompt,
      encoding: 'utf-8',
      timeout: 45000,
    });
    if (res.status === 0 && res.stdout && res.stdout.trim()) {
      return res.stdout.trim();
    }
  } catch (err) {
    console.warn('[book-ai] Claude CLI query error:', err.message);
  }
  return null;
}

export function queryAgyCli(model, prompt) {
  if (!isCommandAvailable('agy')) return null;
  try {
    const res = spawnSync('agy', ['-p', prompt], {
      encoding: 'utf-8',
      timeout: 45000,
    });
    if (res.status === 0 && res.stdout && res.stdout.trim()) {
      return res.stdout.trim();
    }
  } catch (err) {
    console.warn('[book-ai] agy CLI query error:', err.message);
  }
  return null;
}

export function queryCodexCli(prompt) {
  if (!isCommandAvailable('codex')) return null;
  try {
    const res = spawnSync('codex', ['exec', '--sandbox', 'read-only', '--json', '-'], {
      input: prompt,
      encoding: 'utf-8',
      timeout: 30000,
    });
    if (res.status === 0 && res.stdout) {
      return res.stdout.trim();
    }
  } catch {
    // Codex failed
  }
  return null;
}
