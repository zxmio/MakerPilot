import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import type { ImageAttachment, ImageMediaType } from '../../core/types';
import { isRecord } from './settings';

export interface GeminiImageReference {
  id: string;
  name: string;
  digest: string;
  mediaType: ImageMediaType;
}
const EXTENSIONS: Record<ImageMediaType, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const MAX_BYTES = 25 * 1024 * 1024;

function imageBytes(image: ImageAttachment): Buffer {
  if (!(Object.hasOwn(EXTENSIONS, image.mediaType)) || typeof image.data !== 'string' || image.data.length > MAX_BYTES * 1.4 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(image.data)) throw new Error('Invalid or oversized Gemini image attachment.');
  const bytes = Buffer.from(image.data, 'base64');
  const valid = image.mediaType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : image.mediaType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : image.mediaType === 'image/gif' ? /^GIF8[79]a$/u.test(bytes.subarray(0, 6).toString())
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!valid || bytes.length > MAX_BYTES) throw new Error('Gemini attachment bytes do not match the supported image format.');
  return bytes;
}
export function referenceGeminiImage(image: ImageAttachment): GeminiImageReference {
  return { id: image.id, name: image.name, digest: createHash('sha256').update(imageBytes(image)).digest('hex'), mediaType: image.mediaType };
}
export function decodeGeminiImageReference(value: unknown): GeminiImageReference | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.digest !== 'string' || !/^[a-f0-9]{64}$/u.test(value.digest) || typeof value.mediaType !== 'string' || !Object.hasOwn(EXTENSIONS, value.mediaType)) return null;
  return { id: value.id, name: value.name, digest: value.digest, mediaType: value.mediaType as ImageMediaType };
}
async function directory(vault: string, create: boolean): Promise<string> {
  const root = await realpath(vault);
  let current = root;
  for (const segment of ['.makerpilot', 'gemini', 'attachments']) {
    current = path.join(current, segment);
    if (create) await mkdir(current, { recursive: true, mode: 0o700 });
    const resolved = await realpath(current);
    if (!resolved.startsWith(root + path.sep)) throw new Error('Gemini attachment directory must remain inside the vault.');
    current = resolved;
  }
  return current;
}
export async function stageGeminiImage(vault: string, image: ImageAttachment): Promise<string> {
  const reference = referenceGeminiImage(image);
  const file = path.join(await directory(vault, true), `${reference.digest}.${EXTENSIONS[reference.mediaType]}`);
  try { await writeFile(file, imageBytes(image), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  const actual = await realpath(file);
  if (actual !== file || createHash('sha256').update(await readFile(file)).digest('hex') !== reference.digest) throw new Error('Gemini attachment integrity check failed.');
  return file;
}
export async function restoreGeminiImage(vault: string, reference: GeminiImageReference): Promise<ImageAttachment> {
  const file = path.join(await directory(vault, false), `${reference.digest}.${EXTENSIONS[reference.mediaType]}`);
  if (await realpath(file) !== file) throw new Error('Gemini attachment path was replaced.');
  const bytes = await readFile(file);
  if (bytes.length > MAX_BYTES || createHash('sha256').update(bytes).digest('hex') !== reference.digest) throw new Error('Gemini attachment is missing or changed.');
  return { id: reference.id, name: reference.name, mediaType: reference.mediaType, data: bytes.toString('base64'), size: bytes.length, source: 'file' };
}
