#!/usr/bin/env node
/**
 * Standalone Unsloth/OpenAI-compatible transcription diagnostic.
 *
 * Run:
 *   UNSLOTH_API_KEY='sk-unsloth-...' npx tsx scripts/test-unsloth-transcription.ts
 *
 * Optional:
 *   UNSLOTH_BASE_URL (default https://unsloth.fvsg.mqu.it/v1)
 *   UNSLOTH_MODEL    (if unset/empty, the model field is omitted)
 *   UNSLOTH_LANGUAGE (default en)
 *   UNSLOTH_RESPONSE_FORMAT (default verbose_json)
 *
 * Audio files are read from ./audio by default; pass a directory or files as args.
 * The API key is never printed. The script is diagnostic-only and stores nothing.
 */
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = (process.env['UNSLOTH_BASE_URL'] ?? 'https://unsloth.fvsg.mqu.it/v1').replace(/\/$/, '');
const token = process.env['UNSLOTH_API_KEY'] ?? '';
const model = (process.env['UNSLOTH_MODEL'] ?? '').trim();
const language = (process.env['UNSLOTH_LANGUAGE'] ?? 'en').trim();
const responseFormat = (process.env['UNSLOTH_RESPONSE_FORMAT'] ?? 'verbose_json').trim();
const args = process.argv.slice(2);
const audioTypes = new Map([
  ['.webm', 'audio/webm'],
  ['.wav', 'audio/wav'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.m4a', 'audio/mp4'],
  ['.flac', 'audio/flac'],
]);

if (!token) {
  console.error('Missing UNSLOTH_API_KEY. Example:\n  UNSLOTH_API_KEY=\'sk-unsloth-...\' npx tsx scripts/test-unsloth-transcription.ts');
  process.exit(2);
}

function collectFiles(inputs: string[]): string[] {
  if (inputs.length === 0) inputs = [path.resolve('audio')];
  const files: string[] = [];
  for (const input of inputs) {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved)) continue;
    if (fs.statSync(resolved).isDirectory()) {
      for (const name of fs.readdirSync(resolved).sort()) {
        const file = path.join(resolved, name);
        if (fs.statSync(file).isFile() && audioTypes.has(path.extname(name).toLowerCase())) files.push(file);
      }
    } else if (audioTypes.has(path.extname(resolved).toLowerCase())) {
      files.push(resolved);
    }
  }
  return files;
}

function safeMessage(body: string): string {
  try {
    const data = JSON.parse(body) as { error?: { message?: unknown } | string; message?: unknown; detail?: unknown };
    const message = typeof data.error === 'object' && data.error !== null ? data.error.message : typeof data.error === 'string' ? data.error : data.message ?? data.detail;
    if (typeof message === 'string') return message.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, 1000);
  } catch { /* not JSON */ }
  return body.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, 500);
}

async function transcribe(file: string): Promise<boolean> {
  const started = Date.now();
  const bytes = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const mimeType = audioTypes.get(ext) ?? 'application/octet-stream';
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), path.basename(file));
  if (model !== '') form.append('model', model);
  if (language !== '') form.append('language', language);
  if (responseFormat !== '') form.append('response_format', responseFormat);
  if (responseFormat === 'verbose_json') form.append('timestamp_granularities[]', 'segment');

  console.log(`\n--- ${path.basename(file)} (${bytes.byteLength} bytes, ${mimeType})`);
  console.log(`POST ${baseUrl}/audio/transcriptions | model=${model || '(omitted; server default)'} | language=${language || '(omitted)'} | response_format=${responseFormat || '(omitted)'}`);
  try {
    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    const elapsed = Date.now() - started;
    const body = await response.text();
    console.log(`service reached: yes | HTTP ${response.status} | ${response.headers.get('content-type') ?? 'no content-type'} | ${elapsed} ms`);
    if (!response.ok) {
      console.log(`provider error: ${safeMessage(body)}`);
      return false;
    }
    let data: unknown;
    try { data = JSON.parse(body); } catch {
      console.log(`invalid JSON response: ${safeMessage(body)}`);
      return false;
    }
    const payload = data as { text?: unknown; segments?: { start?: number; end?: number; text?: unknown }[] };
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    console.log(`transcript length: ${text.length}`);
    console.log(`transcript: ${text || '(empty)'}`);
    if (Array.isArray(payload.segments)) {
      for (const segment of payload.segments) {
        console.log(`[${Number(segment.start ?? 0).toFixed(1)}s - ${Number(segment.end ?? 0).toFixed(1)}s] ${String(segment.text ?? '')}`);
      }
    }
    return text.length > 0;
  } catch (error) {
    const elapsed = Date.now() - started;
    const name = error instanceof Error ? error.name : 'unknown';
    const code = (error as { code?: unknown }).code;
    console.log(`service reached: no | ${elapsed} ms | ${name}${typeof code === 'string' ? ` (${code})` : ''} | ${error instanceof Error ? error.message : 'unknown error'}`);
    return false;
  }
}

async function main(): Promise<void> {
  const files = collectFiles(args);
  if (files.length === 0) {
    console.error('No audio files found. Create ./audio or pass a directory/file path.');
    process.exit(2);
  }
  let failures = 0;
  for (const file of files) {
    if (!(await transcribe(file))) failures += 1;
  }
  console.log(`\nSummary: ${files.length - failures}/${files.length} transcribed successfully.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
