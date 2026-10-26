#!/usr/bin/env python3
"""
Kokoro-82M ONNX Speech Synthesizer Bridge.
Reads JSON request from stdin, writes standard 24kHz 16-bit mono RIFF WAV to stdout.
"""
import sys
import os
import json
import io
import wave
from pathlib import Path

def find_kokoro_assets():
    search_dirs = [
        Path.home() / ".cache" / "kokoro-onnx",
        Path.home() / ".book-ai" / "models",
    ]
    model_path = None
    voices_path = None
    espeak_path = None

    for d in search_dirs:
        if not d.exists():
            continue
        for candidate in ["kokoro-v1.0.int8.onnx", "kokoro-v1.0.onnx", "model.onnx"]:
            p = d / candidate
            if p.exists() and model_path is None:
                model_path = str(p)
        for candidate in ["voices-v1.0.bin", "voices.bin"]:
            p = d / candidate
            if p.exists() and voices_path is None:
                voices_path = str(p)
        p = d / "espeak-ng-data"
        if p.exists() and espeak_path is None:
            espeak_path = str(p)

    return model_path, voices_path, espeak_path

def main():
    try:
        import kokoro_onnx
        import numpy as np
    except ImportError as e:
        sys.stderr.write(f"KOKORO_ERROR: Missing python dependencies: {e}\n")
        sys.exit(1)

    try:
        req = json.loads(sys.stdin.read() or "{}")
    except Exception as e:
        sys.stderr.write(f"KOKORO_ERROR: Invalid input JSON: {e}\n")
        sys.exit(2)

    text = req.get("text", "").strip()
    voice = req.get("voice", "af_heart")
    speed = float(req.get("speed", 1.0))

    if not text:
        sys.stderr.write("KOKORO_ERROR: Empty text\n")
        sys.exit(3)

    model_path, voices_path, espeak_path = find_kokoro_assets()
    if not model_path or not voices_path:
        sys.stderr.write(f"KOKORO_ERROR: Model weights not found in ~/.cache/kokoro-onnx or ~/.book-ai/models\n")
        sys.exit(4)

    try:
        espeak_cfg = kokoro_onnx.EspeakConfig(data_path=espeak_path) if espeak_path else None
        kokoro = kokoro_onnx.Kokoro(
            model_path=model_path,
            voices_path=voices_path,
            espeak_config=espeak_cfg,
        )
        samples, sr = kokoro.create(text, voice=voice, speed=speed)
        
        # Convert float32 [-1, 1] to 16-bit signed PCM
        samples_int16 = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
        
        out_buf = io.BytesIO()
        with wave.open(out_buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(samples_int16.tobytes())

        wav_bytes = out_buf.getvalue()
        sys.stdout.buffer.write(wav_bytes)
        sys.stdout.buffer.flush()
    except Exception as e:
        sys.stderr.write(f"KOKORO_ERROR: Synthesis failed: {e}\n")
        sys.exit(5)

if __name__ == "__main__":
    main()
