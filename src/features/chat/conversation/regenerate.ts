import type { ProviderCapabilities } from '@/core/providers/types';
import { type ChatMessage, isCanonicalUserMessage } from '@/core/types';
import { t } from '@/i18n/i18n';

export interface RegenerateDeps {
  getMessages(): readonly ChatMessage[];
  readonly capabilities: Pick<ProviderCapabilities, 'supportsRewind' | 'supportsConversationBranches'>;
  hasComposerDraft(): boolean;
  /** Conversation-only rewind; on success the prompt leaves the transcript and returns to the composer. */
  rewindConversation(userMessageId: string): Promise<void>;
  /** Branch preview; on success the prompt waits in the composer for the next turn to commit it. */
  previewBranch(userMessageId: string): Promise<void>;
  hasBranchDraft(): boolean;
  /** Sends what the composer holds, as the user's own Send would. */
  send(): Promise<void>;
  notify(message: string): void;
}

/** Whether the provider has a way to take back a prompt's answer. */
export function canRegenerate(capabilities: RegenerateDeps['capabilities']): boolean {
  return capabilities.supportsRewind || capabilities.supportsConversationBranches === true;
}

/**
 * Asks again for the latest answer: takes the prompt before it back through the
 * provider's own rewind or branch, then resends it. Nothing is sent unless that
 * step completes, and a draft in the composer is never overwritten.
 */
export async function regenerateResponse(assistantMessageId: string, deps: RegenerateDeps): Promise<void> {
  const messages = deps.getMessages();
  const index = messages.findIndex(message => message.id === assistantMessageId);
  if (index < 0 || index !== messages.length - 1) return;
  const prompt = messages.slice(0, index).reverse().find(isCanonicalUserMessage);
  if (!prompt) return;
  if (deps.hasComposerDraft()) {
    deps.notify(t('chat.regenerate.clearDraft'));
    return;
  }

  if (deps.capabilities.supportsRewind) {
    await deps.rewindConversation(prompt.id);
    // A declined or failed rewind leaves the prompt in place.
    if (deps.getMessages().some(message => message.id === prompt.id)) return;
    await deps.send();
    return;
  }
  if (deps.capabilities.supportsConversationBranches) {
    await deps.previewBranch(prompt.id);
    if (deps.hasBranchDraft()) await deps.send();
  }
}
