import { setIcon } from 'obsidian';

import type { QueuedMessage } from '@/features/chat/state/types';
import { t } from '@/i18n/i18n';

/** Input queued behind the running turn; a pending steer shows in the transcript instead. */
export interface QueueStripView {
  message: QueuedMessage;
  canSteer: boolean;
}

export interface QueueStripActions {
  steer(): void;
  edit(): void;
  discard(): void;
}

/** Renders the follow-up attached to the top of the composer; the queue owns every action. */
export function renderQueueStrip(el: HTMLElement, view: QueueStripView | null, actions: QueueStripActions): void {
  el.empty();
  if (!view) {
    el.removeClass('claudian-visible-flex');
    el.addClass('claudian-hidden');
    return;
  }

  el.createSpan({ cls: 'claudian-input-queue-strip-tag', text: t('chat.composer.queued') });
  el.createSpan({
    cls: 'claudian-queue-indicator-text',
    text: formatQueuedMessagePreview(view.message),
  });

  const actionsEl = el.createDiv({ cls: 'claudian-queue-indicator-actions' });

  if (view.canSteer) {
    const steerButton = actionsEl.createEl('button', {
      cls: 'claudian-queue-indicator-action',
      text: t('chat.composer.steerNow'),
    });
    steerButton.setAttribute('type', 'button');
    steerButton.addEventListener('click', (event) => {
      event.stopPropagation();
      actions.steer();
    });
  }

  createIconButton(actionsEl, 'pencil', t('chat.composer.editQueued')).addEventListener('click', (event) => {
    event.stopPropagation();
    actions.edit();
  });
  createIconButton(actionsEl, 'trash-2', t('chat.composer.discardQueued')).addEventListener('click', (event) => {
    event.stopPropagation();
    actions.discard();
  });

  el.addClass('claudian-visible-flex');
  el.removeClass('claudian-hidden');
}

function formatQueuedMessagePreview(message: QueuedMessage): string {
  const rawContent = (message.content || message.turnRequest.draftContent || '').trim();
  const preview = rawContent.length > 40
    ? rawContent.slice(0, 40) + '...'
    : rawContent;
  if ((message.turnRequest.images?.length ?? 0) > 0) {
    return preview ? `${preview} [images]` : '[images]';
  }
  return preview;
}

function createIconButton(parentEl: HTMLElement, icon: string, label: string): HTMLElement {
  const button = parentEl.createEl('button', {
    cls: 'claudian-queue-indicator-icon-action',
    attr: {
      'aria-label': label,
      type: 'button',
    },
  });
  setIcon(button, icon);
  return button;
}
