import type { ComposerInfoRow } from '@/features/chat/composer/ComposerInfoRow';
import type { LinkedContentPresentation } from '@/features/chat/linked-content/LinkedContentPresentation';
import { t } from '@/i18n/i18n';

/** Presents Linked content as a chip in the composer info row, inside the input box. */
export class LinkedContentChip {
  constructor(
    private readonly infoRow: ComposerInfoRow,
    private readonly onActivate: () => void,
    private readonly onRemove: () => void,
  ) {}

  /**
   * Shows the linked content, or, when nothing is linked but a note is open, a one-click
   * offer to link that note again.
   */
  render(
    content: LinkedContentPresentation | null,
    removable: boolean,
    openNote?: { readonly name: string; readonly link: () => void },
  ): void {
    if (!content) {
      this.infoRow.setLinkedContent(openNote ? {
        label: t('chat.linkedContent.linkOpenNote', { name: openNote.name }),
        icon: 'link',
        ariaLabel: t('chat.linkedContent.linkOpenNoteLabel', { name: openNote.name }),
        suggested: true,
        onActivate: openNote.link,
      } : null);
      return;
    }
    this.infoRow.setLinkedContent({
      label: content.missing ? `${content.label} · ${t('chat.linkedContent.missing')}` : content.label,
      icon: content.icon,
      ariaLabel: content.missing
        ? t('chat.linkedContent.missingPath', { path: content.path })
        : t('chat.linkedContent.path', { path: content.path }),
      missing: content.missing,
      onActivate: this.onActivate,
      ...(removable ? { onRemove: this.onRemove } : {}),
    });
  }

  destroy(): void {
    this.infoRow.setLinkedContent(null);
  }
}
