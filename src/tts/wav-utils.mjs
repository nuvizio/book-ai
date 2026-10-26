/**
 * Audio engineering utilities for validating and inspecting PCM WAV parameters.
 */

export function parseWavMetadata(buffer) {
  if (!buffer || buffer.length < 44) {
    return null;
  }

  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    return null;
  }

  // Find 'fmt ' chunk
  let offset = 12;
  let fmtFound = false;
  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let blockAlign = 0;
  let bitsPerSample = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      fmtFound = true;
      audioFormat = buffer.readUInt16LE(offset + 8);
      numChannels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      byteRate = buffer.readUInt32LE(offset + 16);
      blockAlign = buffer.readUInt16LE(offset + 20);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
      break;
    }
    offset += 8 + chunkSize;
  }

  if (!fmtFound) return null;

  const valid = audioFormat === 1 && (numChannels === 1 || numChannels === 2) && bitsPerSample === 16;
  return {
    valid,
    audioFormat,
    numChannels,
    sampleRate,
    byteRate,
    blockAlign,
    bitsPerSample,
  };
}

export function validatePcmWav(buffer) {
  const meta = parseWavMetadata(buffer);
  if (!meta || !meta.valid) {
    throw new Error(
      `Invalid audio parameters: expected 16-bit linear PCM WAV, got ${JSON.stringify(meta)}`
    );
  }
  return meta;
}
