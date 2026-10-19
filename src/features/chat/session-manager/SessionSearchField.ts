import { setIcon } from 'obsidian';

export interface SessionSearchFieldOptions {
  readonly label: string;
  readonly value: string;
  onQuery(query: string): void;
  /** Escape outside IME composition; the field has already prevented the default. */
  onEscape(): void;
  onCompositionChange(composing: boolean): void;
}

/**
 * A session search input that reports a query only once IME composition commits,
 * so a list re-render never interrupts an input method.
 */
export function createSessionSearchField(
  parentEl: HTMLElement,
  options: SessionSearchFieldOptions,
): { fieldEl: HTMLElement; inputEl: HTMLInputElement } {
  const fieldEl = parentEl.createDiv({ cls: 'claudian-session-search-field' });
  const iconEl = fieldEl.createSpan({ cls: 'claudian-session-nav-icon' });
  setIcon(iconEl, 'search');
  const inputEl = fieldEl.createEl('input', {
    cls: 'claudian-session-search-input',
    attr: {
      type: 'search',
      autocomplete: 'off',
      placeholder: options.label,
      'aria-label': options.label,
    },
  });
  inputEl.value = options.value;

  let isComposing = false;
  let committedCompositionValue: string | null = null;
  inputEl.addEventListener('compositionstart', () => {
    isComposing = true;
    committedCompositionValue = null;
    options.onCompositionChange(true);
  });
  inputEl.addEventListener('compositionend', () => {
    isComposing = false;
    committedCompositionValue = inputEl.value;
    options.onCompositionChange(false);
    options.onQuery(inputEl.value);
    queueMicrotask(() => {
      committedCompositionValue = null;
    });
  });
  inputEl.addEventListener('input', (event) => {
    if (isComposing || (event as InputEvent | undefined)?.isComposing) return;
    // The input event that follows compositionend must not report the committed text twice.
    if (committedCompositionValue === inputEl.value) {
      committedCompositionValue = null;
      return;
    }
    committedCompositionValue = null;
    options.onQuery(inputEl.value);
  });
  inputEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (isComposing || event.isComposing) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    options.onEscape();
  });
  return { fieldEl, inputEl };
}
