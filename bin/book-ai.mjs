#!/usr/bin/env node
import { startServer } from '../src/server.mjs';
import { runInteractiveWizard } from '../src/wizard.mjs';
import { downloadKokoroWeights } from '../src/tts/downloader.mjs';
import { loadConfig } from '../src/config.mjs';

const args = process.argv.slice(2);

async function main() {
  if (args.includes('init') || args.includes('--init')) {
    await runInteractiveWizard();
    process.exit(0);
  }

  if (args.includes('download') || args.includes('--download')) {
    console.log('[book-ai] Downloading Kokoro-82M ONNX weights from Hugging Face...');
    await downloadKokoroWeights(console.log);
    console.log('[book-ai] All weights downloaded successfully.');
    process.exit(0);
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📚 book-ai — Zero-Config Local AI Companion for BookReader

Usage:
  npx @ude-ai/book-ai [command] [options]

Commands:
  (default)            Start the local AI & TTS server with auto-pairing
  init                 Run the interactive provider & voice setup wizard
  download             Download Kokoro-82M ONNX model weights from Hugging Face

Options:
  --port, -p <number>  Port to listen on (default: auto in range 28280-28289)
  --host <string>      Host to bind to (default: 127.0.0.1)
  --help, -h           Show this help message
`);
    process.exit(0);
  }

  let explicitPort = null;
  let explicitHost = null;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
      explicitPort = parseInt(args[++i], 10);
    } else if (args[i] === '--host' && args[i + 1]) {
      explicitHost = args[++i];
    }
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║             📚 book-ai v1.0.0 is Starting...               ║
║  Local AI & Neural Voice Engine for Reading Applications  ║
╚════════════════════════════════════════════════════════════╝
`);

  try {
    const instance = await startServer({ port: explicitPort, host: explicitHost });
    console.log(`[✓] Listening on:     ${instance.url}`);
    console.log(`[✓] Dedicated Port:   ${instance.port} (Auto-selected from 28280-28289)`);
    console.log(`[✓] Security Guard:   Strict Origin validation & Token Handshake enabled`);
    console.log(`[✓] Ready for BookReader! Auto-pairing active.`);
    console.log(`\nPress Ctrl+C to stop.\n`);

    const cleanup = () => {
      console.log('\n[book-ai] Shutting down gracefully...');
      instance.server.close(() => process.exit(0));
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } catch (err) {
    console.error('[book-ai] Failed to start server:', err.message);
    process.exit(1);
  }
}

main();
