import { spawn, spawnSync } from 'node:child_process';

export function isCommandAvailable(cmd) {
  const check = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(check, [cmd], { stdio: 'ignore', timeout: 2000 }).status === 0;
}
export function detectInstalledClis() {
  return ['agy', 'claude', 'codex', 'gemini'].filter(isCommandAvailable);
}

function runCli(command, args, input, timeout = 90000) {
  if (!isCommandAvailable(command)) return Promise.resolve(null);
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'ignore'], detached: process.platform !== 'win32' });
    let output = '', stopped = false, killTimer;
    const stop = () => {
      stopped = true;
      try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch {}
      killTimer = setTimeout(() => { try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {} }, 2000);
      killTimer.unref();
    };
    const timer = setTimeout(stop, timeout);
    child.stdout.on('data', chunk => { if (!stopped) { output += chunk; if (Buffer.byteLength(output) > 1024 * 1024) stop(); } });
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); clearTimeout(killTimer); resolve(null); });
    child.on('close', code => { clearTimeout(timer); if (!stopped) clearTimeout(killTimer); resolve(code === 0 && !stopped && output.trim() ? output.trim() : null); });
    child.stdin.end(input);
  });
}

export function extractCodexMessage(output) {
  const messages = [];
  for (const line of output.split('\n')) {
    try {
      const event = JSON.parse(line);
      if (event.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') messages.push(event.item.text);
    } catch {}
  }
  return messages.at(-1) || null;
}
export async function queryClaudeCli(prompt) { return runCli('claude', ['-p'], prompt); }
export async function queryAgyCli(model, prompt) { return runCli('agy', ['-p', prompt], undefined); }
export async function queryCodexCli(prompt) {
  const output = await runCli('codex', ['exec', '--sandbox', 'read-only', '--json', '-'], prompt);
  return output ? extractCodexMessage(output) : null;
}
