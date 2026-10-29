/** Durable application sessions, independent of provider/CLI session semantics. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class SessionError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const validId = value => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,119}$/.test(value);
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class SessionStore {
  constructor(directory) {
    this.directory = directory;
    this.busy = new Set();
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  file(id) {
    if (!validId(id)) throw new SessionError('Invalid session ID');
    return path.join(this.directory, `${id}.json`);
  }
  read(id) {
    const file = this.file(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  write(session) {
    const file = this.file(session.id);
    const serialized = JSON.stringify(session);
    if (Buffer.byteLength(serialized) > 8 * 1024 * 1024) throw new SessionError('Session archive exceeds 8 MiB', 413);
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, serialized, { mode: 0o600, flag: 'wx' });
      const fd = fs.openSync(temporary, 'r');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, file);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  create(id) {
    const existing = this.read(id);
    if (existing) return existing;
    const session = { id, created: Date.now(), updated: Date.now(), messages: [], requests: {} };
    this.write(session); return session;
  }
  summary(session) {
    return { id: session.id, created: session.created, updated: session.updated, message_count: session.messages.length };
  }
  async complete(payload, run) {
    const { session_id: id, request_id: requestId, model, messages } = payload;
    this.file(id);
    if (!validId(requestId)) throw new SessionError('Session requests require a stable request_id');
    if (!Array.isArray(messages) || !messages.length || messages.length > 20) throw new SessionError('Invalid session messages');
    for (const m of messages) {
      if (!['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 100000) throw new SessionError('Invalid session message');
    }
    if (!messages.some(m => m.role === 'user')) throw new SessionError('A user message is required');
    if (this.busy.has(id)) throw new SessionError('Session has an active completion', 409);
    this.busy.add(id);
    try {
      const session = this.create(id);
      const requestHash = hash({ model, messages });
      const previous = session.requests[requestId];
      if (previous) {
        if (previous.hash !== requestHash) throw new SessionError('request_id was used for a different turn', 409);
        return { text: previous.text, session: this.summary(session), context: previous.context, replayed: true };
      }
      const system = messages.filter(m => m.role === 'system');
      const turns = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
      const history = [];
      let budget = 140000 - JSON.stringify(messages).length;
      for (let i = session.messages.length - 1; i >= 0; i--) {
        const item = session.messages[i];
        if (item.content.length > budget) break;
        history.unshift({ role: item.role, content: item.content }); budget -= item.content.length;
      }
      // The complete archive is retained. Context windowing is reported, never mislabeled as full-context replay.
      const context = { archived_messages: session.messages.length, replayed_messages: history.length };
      const text = await run({ model, messages: [...system, ...history, ...turns] });
      if (typeof text !== 'string' || !text.trim()) throw new SessionError('Provider returned no text', 502);
      session.messages.push(...turns.map(m => ({ ...m, request_id: requestId, created: Date.now() })), { role: 'assistant', content: text, request_id: requestId, created: Date.now() });
      session.updated = Date.now();
      session.requests[requestId] = { hash: requestHash, text, context };
      this.write(session);
      return { text, session: this.summary(session), context, replayed: false };
    } finally { this.busy.delete(id); }
  }
}
