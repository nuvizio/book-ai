import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { MODELS_DIR } from '../config.mjs';

// HuggingFace CDN sources for Kokoro-82M ONNX model and voices
export const KOKORO_ONNX_URL = 'https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v0_19.onnx';
export const KOKORO_VOICES_URL = 'https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/voices.json';

export function isModelDownloaded(filename) {
  const target = path.join(MODELS_DIR, filename);
  return fs.existsSync(target) && fs.statSync(target).size > 1024;
}

export function areKokoroWeightsReady() {
  return isModelDownloaded('kokoro-v0_19.onnx') && isModelDownloaded('voices.json');
}

/**
 * Download a file with redirect follow and progress callback.
 */
export function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    function get(currentUrl) {
      const client = currentUrl.startsWith('https:') ? https : http;
      client.get(currentUrl, (res) => {
        // Handle HTTP Redirects (301, 302, 307, 308)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }

        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          file.write(chunk);
          if (onProgress && totalBytes > 0) {
            onProgress(downloadedBytes, totalBytes);
          }
        });

        res.on('end', () => {
          file.end();
          resolve(destPath);
        });

        res.on('error', (err) => {
          file.close();
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    get(url);
  });
}

/**
 * Download Kokoro ONNX model and voices dictionary to ~/.book-ai/models/
 */
export async function downloadKokoroWeights(logger = console.log) {
  const onnxPath = path.join(MODELS_DIR, 'kokoro-v0_19.onnx');
  const voicesPath = path.join(MODELS_DIR, 'voices.json');

  if (!isModelDownloaded('voices.json')) {
    logger('Downloading Kokoro-82M voices index (voices.json)...');
    await downloadFile(KOKORO_VOICES_URL, voicesPath);
    logger('  [✓] voices.json downloaded.');
  }

  if (!isModelDownloaded('kokoro-v0_19.onnx')) {
    logger('Downloading Kokoro-82M ONNX model weights (~330MB)...');
    let lastPct = 0;
    await downloadFile(KOKORO_ONNX_URL, onnxPath, (current, total) => {
      const pct = Math.floor((current / total) * 100);
      if (pct >= lastPct + 10) {
        lastPct = pct;
        const mbDone = (current / 1024 / 1024).toFixed(1);
        const mbTotal = (total / 1024 / 1024).toFixed(1);
        logger(`  Progress: ${pct}% (${mbDone} MB / ${mbTotal} MB)`);
      }
    });
    logger('  [✓] kokoro-v0_19.onnx downloaded successfully.');
  }

  return { onnxPath, voicesPath };
}
