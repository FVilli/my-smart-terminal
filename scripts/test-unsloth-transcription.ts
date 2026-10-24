#!/usr/bin/env node
/**
 * Exact Unsloth/OpenAI SDK transcription example, applied to every audio file
 * in ./audio (or paths passed as arguments).
 *
 * Run:
 *   UNSLOTH_API_KEY='sk-unsloth-...' npx tsx scripts/test-unsloth-transcription.ts
 *
 * Optional:
 *   UNSLOTH_BASE_URL (default https://unsloth.fvsg.mqu.it)
 *   UNSLOTH_MODEL (default audio-cpp/audio.cpp-gguf/Parakeet-TDT-0.6B-v3-GGUF)
 *   UNSLOTH_LANGUAGE (default en)
 */
import fs from 'node:fs';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';

const BASE = (process.env['UNSLOTH_BASE_URL'] ?? 'https://unsloth.fvsg.mqu.it').replace(/\/$/, '');
const KEY = process.env['UNSLOTH_API_KEY'] ?? 'sk-unsloth-YOUR_KEY';
const MODEL = process.env['UNSLOTH_MODEL'] ?? 'audio-cpp/audio.cpp-gguf/Parakeet-TDT-0.6B-v3-GGUF';
const LANGUAGE = process.env['UNSLOTH_LANGUAGE'] ?? 'en';
const AUDIO_EXTENSIONS = new Set(['.webm', '.wav', '.mp3', '.ogg', '.m4a', '.flac']);

if (KEY === 'sk-unsloth-YOUR_KEY' || KEY.trim().length === 0) {
  console.error("Set UNSLOTH_API_KEY first, e.g. UNSLOTH_API_KEY='sk-unsloth-...' npx tsx scripts/test-unsloth-transcription.ts");
  process.exit(2);
}

const client = new OpenAI({ baseURL: BASE + '/v1', apiKey: KEY });
const redact = (value: string): string => value.replaceAll(KEY, '[redacted]').replace(/sk-[A-Za-z0-9._-]+/g, '[redacted]');

function audioFiles(inputs: string[]): string[] {
  if (inputs.length === 0) inputs = [path.resolve('audio')];
  const files: string[] = [];
  for (const input of inputs) {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved)) continue;
    if (fs.statSync(resolved).isDirectory()) {
      for (const name of fs.readdirSync(resolved).sort()) {
        const file = path.join(resolved, name);
        if (fs.statSync(file).isFile() && AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase())) files.push(file);
      }
    } else if (AUDIO_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
      files.push(resolved);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const files = audioFiles(process.argv.slice(2));
  if (files.length === 0) {
    console.error('No audio files found in ./audio. Put the three .webm files there or pass paths.');
    process.exit(2);
  }

  let failed = 0;
  for (const file of files) {
    const started = Date.now();
    console.log(`\n--- ${path.basename(file)} (${fs.statSync(file).size} bytes)`);
    try {
      const transcript = await client.audio.transcriptions.create({
        model: MODEL,
        file: await toFile(fs.readFileSync(file), path.basename(file)),
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        language: LANGUAGE,
      });
      console.log(`HTTP: success | ${Date.now() - started} ms | text length: ${(transcript.text ?? '').length}`);
      console.log(`transcript: ${transcript.text ?? '(empty)'}`);
      for (const segment of transcript.segments ?? []) {
        console.log(`[${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s] ${segment.text}`);
      }
      if ((transcript.text ?? '').trim().length === 0) failed += 1;
    } catch (error) {
      failed += 1;
      const status = (error as { status?: unknown }).status;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`HTTP: failed${typeof status === 'number' ? ` (${status})` : ''} | ${Date.now() - started} ms`);
      console.log(`error: ${redact(message)}`);
      const body = (error as { error?: unknown }).error;
      if (body !== undefined) console.log('provider details:', redact(JSON.stringify(body).slice(0, 2000)));
    }
  }
  console.log(`\nSummary: ${files.length - failed}/${files.length} files transcribed.`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
