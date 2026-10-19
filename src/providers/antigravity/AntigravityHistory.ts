import type { ProviderConversationHistoryService } from '../../core/providers/types';
import type { ChatMessage } from '../../core/types';
import { decodeGeminiImageReference, referenceGeminiImage, restoreGeminiImage } from './GeminiAttachments';
import { isRecord } from './settings';

/** Durable display projection. Image bytes are stored separately, never in metadata. */
export function decodeAntigravityMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(message => {
    if (!isRecord(message) || typeof message.id !== 'string' || !['user', 'assistant'].includes(String(message.role)) || typeof message.content !== 'string' || typeof message.timestamp !== 'number' || !Number.isFinite(message.timestamp)) return [];
    return [{
      id: message.id, role: message.role as 'user' | 'assistant', content: message.content, timestamp: message.timestamp,
      ...(message.role === 'user' ? { userMessageId: typeof message.userMessageId === 'string' ? message.userMessageId : `gemini-user-${message.id}` } : { assistantMessageId: typeof message.assistantMessageId === 'string' ? message.assistantMessageId : `gemini-assistant-${message.id}` }),
      ...(typeof message.displayContent === 'string' ? { displayContent: message.displayContent } : {}),
      ...(typeof message.completedAt === 'number' ? { completedAt: message.completedAt } : {}),
      ...(typeof message.linkedContentPath === 'string' ? { linkedContentPath: message.linkedContentPath } : {}),
    }];
  });
}
export const antigravityHistory: ProviderConversationHistoryService = {
  hydrateConversationHistory: async (input, vaultPath) => {
    const messages = decodeAntigravityMessages(input.messages.length ? input.messages : input.providerState?.messages);
    const images = isRecord(input.providerState?.imageRefs) ? input.providerState.imageRefs : {};
    for (const message of messages) {
      // New forks hydrate from live messages before reloading their persisted projection.
      const liveImages = input.messages.find(row => row.id === message.id)?.images;
      const references = liveImages?.length ? liveImages.map(referenceGeminiImage) : images[message.id];
      if (!Array.isArray(references) || !vaultPath) continue;
      message.images = [];
      for (const value of references) {
        const reference = decodeGeminiImageReference(value);
        if (reference) message.images.push(await restoreGeminiImage(vaultPath, reference));
      }
    }
    return { messages };
  },
  resolveSessionIdForConversation: input => input?.providerState?.replayRequired ? null : input?.sessionId ?? null,
  isPendingForkConversation: input => !!input.providerState?.forkSource,
  buildForkProviderState: (sourceSessionId, resumeAt) => ({ replayRequired: true, forkSource: { sessionId: sourceSessionId, resumeAt } }),
  buildPersistedProviderState: (input, options) => {
    const messages = decodeAntigravityMessages(options?.preserveProviderState ? input.providerState?.messages : input.messages);
    const previous = isRecord(input.providerState?.imageRefs) ? input.providerState.imageRefs : {};
    const imageRefs: Record<string, unknown> = {};
    for (const message of messages) {
      const live = input.messages.find(row => row.id === message.id);
      const stored = previous[message.id];
      if (live?.images?.length) imageRefs[message.id] = live.images.flatMap(image => { try { return [referenceGeminiImage(image)]; } catch { return []; } });
      else if (Array.isArray(stored)) imageRefs[message.id] = stored.flatMap(value => decodeGeminiImageReference(value) ?? []);
    }
    return {
      messages, ...(Object.keys(imageRefs).length ? { imageRefs } : {}),
      ...(input.providerState?.replayRequired ? { replayRequired: true } : {}),
      ...(isRecord(input.providerState?.forkSource) ? { forkSource: { sessionId: input.providerState.forkSource.sessionId, resumeAt: input.providerState.forkSource.resumeAt } } : {}),
    };
  },
};
