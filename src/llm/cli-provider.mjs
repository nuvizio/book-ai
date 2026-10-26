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
    const res = spawnSync('claude', ['-p', '--output-format', 'stream-json'], {
      input: prompt,
      encoding: 'utf-8',
      timeout: 30000,
    });
    if (res.status === 0 && res.stdout) {
      // Parse output or stream-json
      const lines = res.stdout.trim().split('\n');
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result || parsed.text) return parsed.result || parsed.text;
        } catch {
          // not json
        }
      }
      return res.stdout.trim();
    }
  } catch {
    // CLI query failed
  }
  return null;
}

export function queryAgyCli(model, prompt) {
  if (!isCommandAvailable('agy')) return null;
  const mLower = (model || '').toLowerCase();
  let targetModel = model;
  if (mLower.includes('claude') || mLower.includes('sonnet')) targetModel = 'claude-sonnet-5-5-high';
  else if (mLower.includes('gemini') || mLower.includes('flash')) targetModel = 'gemini-3.8-flash-high';

  try {
    const res = spawnSync('agy', ['--model', targetModel, '--print', prompt], {
      encoding: 'utf-8',
      timeout: 30000,
    });
    if (res.status === 0 && res.stdout) {
      return res.stdout.trim();
    }
  } catch {
    // CLI query failed
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
