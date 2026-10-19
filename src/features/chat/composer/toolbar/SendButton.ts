import { setIcon } from 'obsidian';

import { t } from '@/i18n/i18n';

export interface SendButtonActions {
  send(): void;
  stop(): void;
}

/** Sends the draft, or stops the selected destination's work while it has any. */
export class SendButton {
  readonly #buttonEl: HTMLButtonElement;
  readonly #actions: SendButtonActions;
  #stopMode: boolean | null = null;

  constructor(parentEl: HTMLElement, actions: SendButtonActions) {
    this.#actions = actions;
    this.#buttonEl = parentEl.createEl('button', { cls: 'claudian-send-btn', attr: { type: 'button' } });
    // A pointer press keeps the caret in the editor; keyboard users still reach the button by Tab.
    this.#buttonEl.addEventListener('mousedown', event => event.preventDefault());
    this.#buttonEl.addEventListener('click', () => {
      if (this.#stopMode) this.#actions.stop();
      else this.#actions.send();
    });
    this.setStopMode(false);
  }

  /** Mirrors whether the selected destination has cancellable work; the caller owns that state. */
  setStopMode(stop: boolean): void {
    if (stop === this.#stopMode) return;
    this.#stopMode = stop;
    this.#buttonEl.toggleClass('claudian-send-btn--stop', stop);
    this.#buttonEl.setAttribute('aria-label', stop ? t('chat.composer.stop') : t('chat.composer.send'));
    this.#buttonEl.empty();
    setIcon(this.#buttonEl, stop ? 'square' : 'arrow-up');
  }
}
