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
  const steps = (Array.from(history.children) as HTMLElement[]).filter(isStep);
  if (steps.length === 0) return;
  const summary = header.createSpan({ cls: 'claudian-work-summary', attr: { 'aria-hidden': 'true' } });
  summary.createSpan({
    cls: 'claudian-work-step-count',
    text: steps.length === 1 ? t('chat.workedStep') : t('chat.workedSteps', { count: String(steps.length) }),
  });
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
export function getLiveWorkHistory(contentEl: HTMLElement): HTMLElement {
  let wrapper = findLiveWork(contentEl);
  if (!wrapper) {
    wrapper = contentEl.createDiv({ cls: `claudian-work ${LIVE_CLASS}` });
    contentEl.insertBefore(wrapper, contentEl.firstChild);
    const header = wrapper.createEl('button', { cls: 'claudian-work-header', text: t('chat.zen.working') });
    const history = wrapper.createDiv({
      cls: 'claudian-work-history', attr: { id: `claudian-live-work-${nextLiveId++}` },
    });
    setupDisclosureButton(header, history);
    history.hidden = false;
    header.setAttribute('aria-expanded', 'true');
    // One running indicator per response: an already visible one moves into the header.
    const indicator = (Array.from(contentEl.children) as HTMLElement[])
      .find(child => child.classList.contains(INDICATOR_CLASS));
    if (indicator) placeIndicatorInHeader(header, indicator);
  }
  const history = wrapper.querySelector<HTMLElement>(':scope > .claudian-work-history')!;
  for (let next = wrapper.nextElementSibling; next;) {
    const following = next.nextElementSibling;
    if (!next.classList.contains(INDICATOR_CLASS)) history.appendChild(next);
    next = following;
  }
  return history;
}

/** The header of a streaming response's live work disclosure, where its running indicator belongs. */
export function getLiveWorkHeader(contentEl: HTMLElement): HTMLElement | null {
  return findLiveWork(contentEl)?.querySelector<HTMLElement>(':scope > .claudian-work-header') ?? null;
}

/** The header already says the response is working; the indicator adds its timer, hidden from the header's name. */
export function placeIndicatorInHeader(header: HTMLElement, indicator: HTMLElement): void {
  indicator.setAttribute('aria-hidden', 'true');
  header.appendChild(indicator);
}

/** Recounts a streaming response's steps in its live header, if it has one. */
export function refreshLiveWorkSummary(contentEl: HTMLElement | null): void {
  const wrapper = contentEl ? findLiveWork(contentEl) : null;
  if (!wrapper) return;
  const header = wrapper.querySelector<HTMLElement>(':scope > .claudian-work-header');
  const history = wrapper.querySelector<HTMLElement>(':scope > .claudian-work-history');
  if (header && history) renderStepSummary(header, history, isLiveStepFailed);
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
  const indicator = wrapper.querySelector<HTMLElement>(`.${INDICATOR_CLASS}`);
  if (indicator) {
    indicator.removeAttribute('aria-hidden');
    contentEl.appendChild(indicator);
  }
  wrapper.remove();
}
