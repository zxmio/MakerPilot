import { setupDisclosureButton } from '@/features/chat/rendering/collapsible';
import { t } from '@/i18n/i18n';

/** Rendered work steps; text blocks and notifications between them are not steps. */
const STEP_CLASSES = ['claudian-thinking-block', 'claudian-tool-call', 'claudian-write-edit-block', 'claudian-subagent-list'];
const MAX_STEP_DOTS = 12;
const LIVE_CLASS = 'claudian-work--live';
/** The live indicator stays the response's last line, outside the work it describes. */
const INDICATOR_CLASS = 'claudian-thinking';

// Live disclosure ids stay unique across every renderer sharing the document.
let nextLiveId = 0;

function isStep(el: Element): boolean {
  return STEP_CLASSES.some(cls => el.classList.contains(cls));
}

/**
 * Replaces a work header's "· N steps" and one dot per step (failures marked).
 * Visual only: the disclosure keeps its plain name, and the steps are listed inside it.
 */
export function renderStepSummary(header: HTMLElement, history: HTMLElement, isFailed: (step: HTMLElement) => boolean): void {
  header.querySelector(':scope > .claudian-work-summary')?.remove();
  const steps = stepsIn(history);
  if (steps.length === 0) return;
  const summary = header.createSpan({ cls: 'claudian-work-summary', attr: { 'aria-hidden': 'true' } });
  summary.createSpan({ cls: 'claudian-work-step-count', text: formatStepCount(steps.length) });
  appendStepDots(summary, steps, isFailed);
}

function stepsIn(history: HTMLElement): HTMLElement[] {
  return (Array.from(history.children) as HTMLElement[]).filter(isStep);
}

export function formatStepCount(count: number): string {
  return count === 1 ? t('chat.workedStep') : t('chat.workedSteps', { count: String(count) });
}

function appendStepDots(summary: HTMLElement, steps: readonly HTMLElement[], isFailed: (step: HTMLElement) => boolean): void {
  const dots = summary.createSpan({ cls: 'claudian-work-step-dots' });
  for (const step of steps.slice(-MAX_STEP_DOTS)) {
    dots.createSpan({ cls: isFailed(step) ? 'claudian-work-step-dot claudian-work-step-dot--error' : 'claudian-work-step-dot' });
  }
}

function findLiveWork(contentEl: HTMLElement): HTMLElement | null {
  return (Array.from(contentEl.children) as HTMLElement[])
    .find(child => child.classList.contains('claudian-work') && child.classList.contains(LIVE_CLASS)) ?? null;
}

/** A live card's failure shows in its own status, before the turn's tool records settle. */
function isLiveStepFailed(step: HTMLElement): boolean {
  return step.classList.contains('error')
    || step.querySelector(':scope > .claudian-tool-header .status-error, :scope > .claudian-subagent-header .status-error') !== null;
}

/**
 * The expanded work disclosure a streaming response grows its steps in, created on
 * first use as the content's first child. Everything already after it, except the live
 * indicator, moves inside: a later step proves earlier text was not the answer.
 */
export function getLiveWorkHistory(contentEl: HTMLElement, renderIcon?: (slot: HTMLElement) => void): HTMLElement {
  let wrapper = findLiveWork(contentEl);
  if (!wrapper) {
    wrapper = contentEl.createDiv({ cls: `claudian-work ${LIVE_CLASS}` });
    contentEl.insertBefore(wrapper, contentEl.firstChild);
    // Visible: the answering model's logo and the step dots. The count names the button for readers.
    const header = wrapper.createEl('button', { cls: 'claudian-work-header' });
    const iconSlot = header.createSpan({ cls: 'claudian-work-header-icon', attr: { 'aria-hidden': 'true' } });
    renderIcon?.(iconSlot);
    header.createSpan({ cls: 'claudian-work-header-label', text: t('chat.zen.working') });
    const history = wrapper.createDiv({
      cls: 'claudian-work-history', attr: { id: `claudian-live-work-${nextLiveId++}` },
    });
    setupDisclosureButton(header, history);
    history.hidden = false;
    header.setAttribute('aria-expanded', 'true');
  }
  const history = wrapper.querySelector<HTMLElement>(':scope > .claudian-work-history')!;
  for (let next = wrapper.nextElementSibling; next;) {
    const following = next.nextElementSibling;
    if (!next.classList.contains(INDICATOR_CLASS)) history.appendChild(next);
    next = following;
  }
  return history;
}

/** How many steps a streaming response has grown so far; zero without a live disclosure. */
export function countLiveSteps(contentEl: HTMLElement | null): number {
  const wrapper = contentEl ? findLiveWork(contentEl) : null;
  const history = wrapper?.querySelector<HTMLElement>(':scope > .claudian-work-history');
  return history ? stepsIn(history).length : 0;
}

/**
 * Names a streaming response's live header by its step count ("3 steps") with one dot per
 * step; the response's last line, not the header, says what is running now.
 */
export function refreshLiveWorkSummary(contentEl: HTMLElement | null): void {
  const wrapper = contentEl ? findLiveWork(contentEl) : null;
  if (!wrapper) return;
  const header = wrapper.querySelector<HTMLElement>(':scope > .claudian-work-header');
  const history = wrapper.querySelector<HTMLElement>(':scope > .claudian-work-history');
  if (!header || !history) return;
  const steps = stepsIn(history);
  if (steps.length === 0) return;
  header.querySelector(':scope > .claudian-work-header-label')?.setText(formatStepCount(steps.length));
  header.querySelector(':scope > .claudian-work-summary')?.remove();
  const dots = header.createSpan({ cls: 'claudian-work-summary claudian-work-summary--dots', attr: { 'aria-hidden': 'true' } });
  appendStepDots(dots, steps, isLiveStepFailed);
}

/**
 * Puts a live disclosure's contents back in its place, so completion folds the same
 * flat output that replay renders.
 */
export function unwrapLiveWork(contentEl: HTMLElement): void {
  const wrapper = findLiveWork(contentEl);
  if (!wrapper) return;
  const history = wrapper.querySelector<HTMLElement>(':scope > .claudian-work-history');
  for (const child of Array.from(history?.children ?? [])) contentEl.insertBefore(child, wrapper);
  wrapper.remove();
}
