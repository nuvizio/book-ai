import net from 'node:net';
import crypto from 'node:crypto';

export const PORT_RANGE = { start: 28280, end: 28289 };

export const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'tauri://localhost',
]);

/**
 * Finds the first free port in the dedicated block 28280..28289
 */
export async function findAvailablePort(start = PORT_RANGE.start, end = PORT_RANGE.end) {
  for (let port = start; port <= end; port++) {
    const isFree = await new Promise((resolve) => {
      const server = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => server.close(() => resolve(true)))
        .listen(port, '127.0.0.1');
    });
    if (isFree) return port;
  }
  throw new Error(`No available ports found between ${start} and ${end}`);
}

export function generateSessionToken() {
  return `sec_${crypto.randomBytes(20).toString('hex')}`;
}

export function applySecurityHeaders(res, origin, allowedOrigins = DEFAULT_ALLOWED_ORIGINS) {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (origin && (allowedOrigins.has(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}
