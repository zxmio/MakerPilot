import type { ChatMessage } from '@/core/types';
import { type RegenerateDeps,regenerateResponse } from '@/features/chat/conversation/regenerate';

const prompt: ChatMessage = { id: 'u2', role: 'user', content: 'Second', timestamp: 3, userMessageId: 'native-u2' };
const transcript: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'First', timestamp: 1, userMessageId: 'native-u1' },
  { id: 'a1', role: 'assistant', content: 'First answer', timestamp: 2, assistantMessageId: 'native-a1' },
  prompt,
  { id: 'a2', role: 'assistant', content: 'Thinking', timestamp: 4 },
  { id: 'a3', role: 'assistant', content: 'Second answer', timestamp: 5, assistantMessageId: 'native-a3' },
];

function deps(overrides: Partial<RegenerateDeps> = {}): RegenerateDeps & { messages: ChatMessage[] } {
  const state = { messages: [...transcript] };
  return Object.assign(state, {
    getMessages: () => state.messages,
    capabilities: { supportsRewind: true, supportsConversationBranches: false },
    hasComposerDraft: () => false,
    // A completed rewind removes the prompt and its answer, returning the prompt to the composer.
    rewindConversation: jest.fn(async (id: string) => {
      state.messages = state.messages.slice(0, state.messages.findIndex(message => message.id === id));
    }),
    previewBranch: jest.fn(async () => undefined),
    hasBranchDraft: () => false,
    send: jest.fn(async () => undefined),
    notify: jest.fn(),
    ...overrides,
  });
}

describe('regenerateResponse', () => {
  it('rewinds to the prompt before the latest answer and sends it again', async () => {
    const d = deps();
    await regenerateResponse('a3', d);
    expect(d.rewindConversation).toHaveBeenCalledWith('u2');
    expect(d.send).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the rewind is declined or fails and the prompt stays', async () => {
    const d = deps({ rewindConversation: jest.fn(async () => undefined) });
    await regenerateResponse('a3', d);
    expect(d.send).not.toHaveBeenCalled();
  });

  it('leaves a draft in the composer untouched instead of overwriting it', async () => {
    const d = deps({ hasComposerDraft: () => true });
    await regenerateResponse('a3', d);
    expect(d.rewindConversation).not.toHaveBeenCalled();
    expect(d.notify).toHaveBeenCalledTimes(1);
  });

  it('regenerates only the latest answer', async () => {
    const d = deps();
    await regenerateResponse('a1', d);
    expect(d.rewindConversation).not.toHaveBeenCalled();
  });

  it('branches from the prompt where the provider branches instead of rewinding', async () => {
    let draft = false;
    const d = deps({
      capabilities: { supportsRewind: false, supportsConversationBranches: true },
      previewBranch: jest.fn(async () => { draft = true; }),
      hasBranchDraft: () => draft,
    });
    await regenerateResponse('a3', d);
    expect(d.previewBranch).toHaveBeenCalledWith('u2');
    expect(d.rewindConversation).not.toHaveBeenCalled();
    expect(d.send).toHaveBeenCalledTimes(1);
  });
});
