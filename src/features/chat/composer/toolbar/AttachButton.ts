import { setIcon } from 'obsidian';

import { t } from '@/i18n/i18n';

export interface AttachButtonActions {
  /** Whether the selected destination accepts image attachments. */
  canAttachImages(): boolean;
  /** Copies picked files into the vault and references their paths. */
  uploadFiles(files: readonly File[]): void;
  addImages(files: readonly File[]): void;
  /** Starts an @-mention, which opens the existing vault file suggestions. */
  startMention(): void;
}

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

let attachMenuSequence = 0;

interface AttachMenuItem {
  readonly icon: string;
  readonly label: string;
  readonly disabled?: boolean;
  run(): void;
}

/**
 * The toolbar's leading "+": a popover, opening above the button, of the ways to
 * add context — upload a file into the vault, attach an image, or mention a vault file.
 */
export class AttachButton {
  readonly #anchorEl: HTMLElement;
  readonly #buttonEl: HTMLButtonElement;
  readonly #menuId = `claudian-attach-menu-${++attachMenuSequence}`;
  #menuEl: HTMLElement | null = null;
  readonly #items: () => AttachMenuItem[];
  readonly #dismiss = (event: PointerEvent): void => {
    if (!this.#anchorEl.contains(event.target as Node)) this.close(false);
  };

  constructor(parentEl: HTMLElement, actions: AttachButtonActions) {
    this.#anchorEl = parentEl.createDiv({ cls: 'claudian-attach-anchor' });
    this.#buttonEl = this.#anchorEl.createEl('button', {
      cls: 'claudian-attach-btn',
      attr: {
        type: 'button', 'aria-label': t('chat.composer.attach'),
        'aria-haspopup': 'menu', 'aria-expanded': 'false',
      },
    });
    setIcon(this.#buttonEl, 'plus');
    this.#buttonEl.addEventListener('click', () => {
      if (this.#menuEl) this.close(false);
      else this.#open();
    });

    const uploadPicker = this.#createPicker(files => actions.uploadFiles(files));
    const imagePicker = this.#createPicker(files => actions.addImages(files), IMAGE_ACCEPT);
    this.#items = () => [
      {
        icon: 'upload', label: t('chat.composer.uploadFile'),
        run: () => uploadPicker.click(),
      },
      {
        icon: 'image', label: t('chat.composer.attachImage'),
        disabled: !actions.canAttachImages(), run: () => imagePicker.click(),
      },
      {
        icon: 'at-sign', label: t('chat.composer.mentionFile'),
        run: () => actions.startMention(),
      },
    ];
  }

  /** Closes the popover; returns focus to the button when the user dismissed it from inside. */
  close(focusButton: boolean): void {
    if (!this.#menuEl) return;
    this.#menuEl.remove();
    this.#menuEl = null;
    this.#buttonEl.setAttribute('aria-expanded', 'false');
    this.#buttonEl.removeAttribute('aria-controls');
    this.#anchorEl.ownerDocument.removeEventListener('pointerdown', this.#dismiss, true);
    if (focusButton) this.#buttonEl.focus();
  }

  #createPicker(onPick: (files: File[]) => void, accept?: string): HTMLInputElement {
    const pickerEl = this.#anchorEl.createEl('input', {
      cls: 'claudian-attach-picker',
      attr: { type: 'file', multiple: '', tabindex: '-1', 'aria-hidden': 'true', ...(accept ? { accept } : {}) },
    });
    pickerEl.addEventListener('change', () => {
      const files = Array.from(pickerEl.files ?? []);
      // Clearing lets the same file be chosen again.
      pickerEl.value = '';
      if (files.length > 0) onPick(files);
    });
    return pickerEl;
  }

  #open(): void {
    const menuEl = this.#anchorEl.createDiv({
      cls: 'claudian-attach-menu',
      attr: { id: this.#menuId, role: 'menu', 'aria-label': t('chat.composer.attach') },
    });
    this.#menuEl = menuEl;
    for (const item of this.#items()) {
      const itemEl = menuEl.createEl('button', {
        cls: 'claudian-attach-menu-item',
        attr: { type: 'button', role: 'menuitem', tabindex: '-1' },
      });
      if (item.disabled) itemEl.setAttribute('aria-disabled', 'true');
      const iconEl = itemEl.createSpan({ cls: 'claudian-attach-menu-icon', attr: { 'aria-hidden': 'true' } });
      setIcon(iconEl, item.icon);
      itemEl.createSpan({ cls: 'claudian-attach-menu-label', text: item.label });
      itemEl.addEventListener('click', () => {
        if (item.disabled) return;
        this.close(false);
        item.run();
      });
    }
    menuEl.addEventListener('keydown', event => this.#handleKeydown(event));
    this.#buttonEl.setAttribute('aria-expanded', 'true');
    this.#buttonEl.setAttribute('aria-controls', this.#menuId);
    this.#anchorEl.ownerDocument.addEventListener('pointerdown', this.#dismiss, true);
    this.#menuItems()[0]?.focus();
  }

  #menuItems(): HTMLElement[] {
    return Array.from(this.#menuEl?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  #handleKeydown(event: KeyboardEvent): void {
    const items = this.#menuItems();
    const index = items.indexOf(event.target as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Tab') {
      this.close(false);
    }
  }
}
