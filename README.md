# 📚 `book-ai` (`@ude-ai/book-ai`)

> The zero-config, local-first AI companion & neural audiobook narrator for BookReader.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## 🌟 Highlights

- **⚡ Instant 1-Command Start**: Run `npx @ude-ai/book-ai` in any terminal. No Python environment setup, no compilation, zero configuration.
- **🔌 Zero-Config Auto-Pairing**: Automatically negotiates an available port in the dedicated, non-conflicting range **`28280` – `28289`**. BookReader detects and pairs seamlessly in < 50ms without asking the user for a port number.
- **🛡️ Strict Origin Security**: Enforces browser-level `Origin` validation, Chrome Private Network Access (PNA), and ephemeral token handshakes (`/v1/pair`). Malicious websites and external local network devices are blocked with `403 Forbidden`.
- **🧠 Multi-Provider LLM Gateway**:
  - Local Subscription CLIs: **Claude Code** (`claude -p`), **Google Gemini / Antigravity** (`agy`), **OpenAI Codex** (`codex`).
  - Local Engines: **Ollama** (`localhost:11434`), **LM Studio** (`localhost:1234`), **vLLM**.
  - Commercial API Keys: **OpenAI**, **Anthropic**, **Gemini**, **Groq**, **DeepSeek**, **OpenRouter**.
  - Built-in **Offline Literary Reasoning Engine** for offline book summaries, analysis, and vocabulary definitions.
- **🎙️ Multi-Provider Neural TTS**:
  - High-fidelity **Kokoro-82M ONNX** (24 kHz Studio audiobook narration, ~0.05x RTF).
  - External model weights downloaded on-demand directly from Hugging Face to `~/.book-ai/models/` (never bundled in git or npm).
  - Commercial Speech Fallbacks: **OpenAI Speech** (`tts-1`/`tts-1-hd` with `alloy`, `echo`, `fable`, `onyx`, `nova`) and **Fish Audio**.
  - Zero-dependency synthetic PCM WAV generator for instant offline resilience.

---

## 🚀 Quick Start

### 1. Launch `book-ai`

```bash
npx @ude-ai/book-ai
```

On first launch, `book-ai` automatically scans your environment, binds to an available loopback port in `28280..28289`, and waits for BookReader:

```text
╔════════════════════════════════════════════════════════════╗
║             📚 book-ai v1.0.0 is Starting...               ║
║  Local AI & Neural Voice Engine for Reading Applications  ║
╚════════════════════════════════════════════════════════════╝

[✓] Listening on:     http://127.0.0.1:28282
[✓] Dedicated Port:   28282 (Auto-selected from 28280-28289)
[✓] Security Guard:   Strict Origin validation & Token Handshake enabled
[✓] Ready for BookReader! Auto-pairing active.
```

### 2. Connect in BookReader

Open **BookReader** (desktop app or local web instance). The app automatically probes `28280..28289`, performs the handshake, and turns green:

> **● Connected to book-ai (Port 28282) — Ready to Read**

---

## 🛠️ Interactive Setup Wizard (`init`)

To customize your LLM providers, set API keys, or download external voice models ahead of time:

```bash
npx @ude-ai/book-ai init
```

The interactive terminal wizard guides you through:
1. **Selecting LLM Providers**: (Local CLIs, Local Ollama/LM Studio, or Commercial API Keys).
2. **Selecting TTS Engines**: (Kokoro-82M ONNX, OpenAI Speech, or Synthetic).
3. **Downloading Kokoro-82M ONNX Weights**: Downloads `kokoro-v0_19.onnx` (~330MB) and `voices.json` directly from Hugging Face into `~/.book-ai/models/`.

You can also trigger model downloads directly at any time:
```bash
npx @ude-ai/book-ai download
```

---

## 📡 API Wire Specification

`book-ai` exposes standard OpenAI-compatible endpoints with full browser CORS and streaming:

### 1. Auto-Pairing Handshake (`GET /v1/pair`)

```bash
curl -H "Origin: http://localhost:5173" http://127.0.0.1:28280/v1/pair
```

**Response (`200 OK`):**
```json
{
  "ok": true,
  "app": "book-ai",
  "port": 28280,
  "token": "sec_83fa9c12b7...",
  "models": ["claude-cli", "gemini-3.8-flash", "gpt-4o", "llama3.2"],
  "voices": ["af_heart", "am_adam", "bf_emma"]
}
```

### 2. Chat Completions (`POST /v1/chat/completions`)

```bash
curl -X POST http://127.0.0.1:28280/v1/chat/completions \
  -H "Authorization: Bearer sec_83fa9c12b7..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet",
    "messages": [
      {"role": "user", "content": "Explain the metaphor in Chapter 3."}
    ],
    "stream": true
  }'
```

### 3. Neural Speech Narration (`POST /v1/audio/speech`)

```bash
curl -X POST http://127.0.0.1:28280/v1/audio/speech \
  -H "Authorization: Bearer sec_83fa9c12b7..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kokoro",
    "input": "Call me Ishmael. Some years ago—never mind how long precisely...",
    "voice": "af_heart",
    "speed": 1.0
  }' --output narration.wav
```

### 4. Autodiscovery

- `GET /health`: Health status and port confirmation.
- `GET /v1/models`: Catalog of active LLM models.
- `GET /v1/voices`: Catalog of active narrator voices.

---

## 🔒 Security Architecture

1. **Loopback Binding**: Strictly binds to `127.0.0.1` (`::1`), never `0.0.0.0`. It is never exposed to the local network or public Wi-Fi.
2. **DNS Rebinding Guard**: Rejects any request where the `Host` header is not `localhost` or `127.0.0.1`.
3. **Origin Allowlist**: Browser-enforced `Origin` check ensures foreign websites cannot call the server.
4. **Private Network Access (PNA)**: Automatically provides `Access-Control-Allow-Private-Network: true` to prevent Chrome/Safari PNA preflight blocks.
5. **Token Pairing**: Requires ephemeral bearer tokens generated fresh per daemon boot session.

---

## 📦 Directory Structure

```
~/.book-ai/
├── config.json         # User settings & provider keys (mode 0600)
└── models/             # Cached external weights (mode 0700)
    ├── kokoro-v0_19.onnx   # Kokoro-82M ONNX model (~330 MB)
    └── voices.json         # Speaker embedding vectors
```

---

## 🧪 Testing

```bash
npm test
```

Runs the full integration and auto-pairing test suite using the Node.js native test runner.

---

## 📄 License

Licensed under the [Apache License 2.0](LICENSE).
