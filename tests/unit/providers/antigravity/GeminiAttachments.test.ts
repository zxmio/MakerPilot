import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { testDate } from '@test/helpers/testClock';

import type { Conversation, ImageAttachment } from '@/core/types';
import { antigravityHistory } from '@/providers/antigravity/AntigravityHistory';
import { decodeGeminiImageReference, stageGeminiImage } from '@/providers/antigravity/GeminiAttachments';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN9sAAAAASUVORK5CYII=';
const image: ImageAttachment = { id: 'picture', name: '../../unsafe-name.png', mediaType: 'image/png', source: 'paste', data: png, size: Buffer.from(png, 'base64').length };
let vault: string;
beforeEach(async () => { vault = await mkdtemp(join(tmpdir(), 'makerpilot-images-')); });
afterEach(async () => { await rm(vault, { recursive: true, force: true }); });

it('stores image bytes separately and restores them for history, rewind and forks', async () => {
  const file = await stageGeminiImage(vault, image);
  expect(file).toMatch(/attachments\/[a-f0-9]{64}\.png$/u);
  expect(await readFile(file)).toEqual(Buffer.from(png, 'base64'));
  const now = testDate().getTime();
  const conversation: Conversation = { id: 'chat', providerId: 'antigravity', title: 'Image', sessionId: 'native', createdAt: now, lastActivityAt: now, messages: [{ id: 'u', role: 'user', content: 'Describe it', timestamp: now, images: [image] }] };
  const state = antigravityHistory.buildPersistedProviderState!(conversation);
  expect(JSON.stringify(state)).not.toContain(png);
  const restored = await antigravityHistory.hydrateConversationHistory({ ...conversation, messages: [], providerState: state }, vault);
  expect(restored.messages?.[0].images?.[0].data).toBe(png);
  // A newly created fork hydrates live messages before their storage projection is read back.
  const forkState = await antigravityHistory.buildForkProviderState('native', 'checkpoint', state);
  const fork = await antigravityHistory.hydrateConversationHistory({ ...conversation, sessionId: null, providerState: forkState }, vault);
  expect(fork.messages?.[0].images?.[0].data).toBe(png);
  const savedFork = antigravityHistory.buildPersistedProviderState!({ ...conversation, messages: fork.messages!, providerState: forkState });
  expect(JSON.stringify(savedFork)).not.toContain(png);
  const reopenedFork = await antigravityHistory.hydrateConversationHistory({ ...conversation, messages: [], providerState: savedFork }, vault);
  expect(reopenedFork.messages?.[0].images?.[0].data).toBe(png);
  await writeFile(file, 'tampered');
  await expect(antigravityHistory.hydrateConversationHistory({ ...conversation, messages: [], providerState: state }, vault)).rejects.toThrow(/integrity|changed/iu);
});

it('rejects forged types, traversal references and invalid bytes', async () => {
  expect(decodeGeminiImageReference({ id: 'x', name: 'x', mediaType: 'image/png', digest: '../secret' })).toBeNull();
  await expect(stageGeminiImage(vault, { ...image, data: Buffer.from('not a png').toString('base64') })).rejects.toThrow(/format/iu);
});
