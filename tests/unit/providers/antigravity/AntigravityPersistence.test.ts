import { testDate } from '@test/helpers/testClock';

import type { Conversation } from '@/core/types';
import { antigravityHistory, decodeAntigravityMessages } from '@/providers/antigravity/AntigravityHistory';
import { antigravityProviderRegistration } from '@/providers/antigravity/registration';
import { getAntigravitySettings, parseAntigravityModels, updateAntigravitySettings } from '@/providers/antigravity/settings';

describe('Antigravity durable boundaries', () => {
  const timestamp = testDate().getTime();
  const conversation = (): Conversation => ({ id: 'chat', providerId: 'antigravity', title: 'Chat', createdAt: timestamp, lastActivityAt: timestamp, sessionId: 'native-session', messages: [{ id: 'user', role: 'user', content: 'Remember this note', timestamp }] });

  it('round-trips chat text without attaching binary image payloads to metadata', async () => {
    const original = conversation();
    Object.assign(original.messages[0], { images: [{ data: 'binary-image' }], unknown: 'untrusted' });
    const state = antigravityHistory.buildPersistedProviderState!(original);
    const reopened = { ...original, messages: [], providerState: JSON.parse(JSON.stringify(state)) };
    const patch = await antigravityHistory.hydrateConversationHistory(reopened, '/vault');
    expect(patch.messages).toEqual([expect.objectContaining({ id: 'user', role: 'user', content: 'Remember this note', timestamp, userMessageId: 'gemini-user-user' })]);
    expect(JSON.stringify(state)).not.toContain('binary-image');
    expect(reopened.messages).toEqual([]);
    expect(antigravityHistory.buildPersistedProviderState!(reopened, { preserveProviderState: true })).toEqual(state);
    expect(decodeAntigravityMessages([{ id: 'invalid', role: 'user', content: 'x', timestamp: NaN }, null])).toEqual([]);
  });

  it('ignores disabled configuration and retires only this provider binding on environment changes', () => {
    const settings: Record<string, unknown> = {};
    const reconciler = antigravityProviderRegistration.settingsReconciler!;
    expect(reconciler.reconcileModelWithEnvironment(settings, [])).toEqual({ changed: false, invalidatedConversations: [] });
    expect(settings).toEqual({});
    updateAntigravitySettings(settings, { enabled: true, environmentHash: 'previous-environment' });
    const own = conversation();
    const other = { ...conversation(), providerId: 'claude' };
    const result = reconciler.reconcileModelWithEnvironment(settings, [own, other]);
    expect(result.invalidatedConversations).toEqual([own]);
    expect(own.sessionId).toBeNull();
    expect(own.messages[0].content).toBe('Remember this note');
    expect(other.sessionId).toBe('native-session');
    expect(reconciler.reconcileModelWithEnvironment(settings, [own, other]).changed).toBe(false);
  });

  it('decodes native catalog output and retains metadata only for selected IDs', () => {
    const models = parseAntigravityModels('Fetching models...\ngemini-live-high\tGemini (High)\ngemini-live-low\tGemini (Low)\n');
    const settings: Record<string, unknown> = {};
    updateAntigravitySettings(settings, { visibleModels: ['gemini-live-high'], selectedModels: models });
    expect(getAntigravitySettings(settings).selectedModels).toEqual([{ id: 'gemini-live', name: 'Gemini', variants: [{ id: 'gemini-live-low', effort: 'low' }, { id: 'gemini-live-high', effort: 'high' }] }]);
    expect(antigravityProviderRegistration.modelPolicy.getModelOptions(settings)).toEqual([{ value: 'antigravity/gemini-live', label: 'Gemini' }]);
  });
});
