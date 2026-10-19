import type { ToolCallInfo } from '@/core/types';
import { setupCollapsible } from '@/features/chat/rendering/collapsible';
import { setToolIcon } from '@/features/chat/rendering/tools/toolContentPrimitives';
import { getToolName, getToolPresentation, getToolSummary } from '@/features/chat/rendering/tools/toolPresentation';
import { setToolStatus } from '@/features/chat/rendering/tools/toolStatus';
import { t } from '@/i18n/i18n';

interface GroupedCard {
  readonly el: HTMLElement;
  readonly tool: ToolCallInfo;
}

/**
 * Folds each run of consecutive, successful calls of one tool in a completed
 * turn's work history into one disclosure. The original cards move into it
 * unchanged, so their own expansion and later updates keep working.
 */
export function groupConsecutiveToolCards(historyEl: HTMLElement, toolsById: ReadonlyMap<string, ToolCallInfo>): void {
  let run: GroupedCard[] = [];
  const flush = () => {
    if (run.length > 1) wrapRun(historyEl, run);
    run = [];
  };
  for (const child of Array.from(historyEl.children) as HTMLElement[]) {
    const tool = getGroupableTool(child, toolsById);
    if (!tool) {
      flush();
      continue;
    }
    if (run.length > 0 && run[0].tool.name !== tool.name) flush();
    run.push({ el: child, tool });
  }
  flush();
}

function getGroupableTool(el: HTMLElement, toolsById: ReadonlyMap<string, ToolCallInfo>): ToolCallInfo | null {
  if (!el.classList.contains('claudian-tool-call')) return null;
  const tool = toolsById.get(el.dataset.toolId ?? '');
  // Failures stay findable on their own; widgets with their own body (task lists, questions) stay standalone.
  if (!tool || tool.status !== 'completed' || getToolPresentation(tool.name).cardBody) return null;
  return tool;
}

function wrapRun(historyEl: HTMLElement, run: readonly GroupedCard[]): void {
  const first = run[0];
  const name = getToolName(first.tool.name, first.tool.input);
  const count = t('chat.tools.groupCount', { count: String(run.length) });
  const summary = getToolSummary(first.tool.name, first.tool.input);

  const groupEl = historyEl.createDiv({ cls: 'claudian-tool-group' });
  historyEl.insertBefore(groupEl, first.el);
  const headerEl = groupEl.createDiv({ cls: 'claudian-tool-header claudian-tool-group-header' });
  const iconEl = headerEl.createSpan({ cls: 'claudian-tool-icon' });
  iconEl.setAttribute('aria-hidden', 'true');
  setToolIcon(iconEl, first.tool.name);
  headerEl.createSpan({ cls: 'claudian-tool-name', text: name });
  headerEl.createSpan({ cls: 'claudian-tool-summary', text: summary ? `${count} · ${summary}` : count });
  setToolStatus(headerEl.createSpan(), 'completed', 'claudian-tool-status');

  const bodyEl = groupEl.createDiv({ cls: 'claudian-tool-content claudian-tool-group-body' });
  for (const { el } of run) bodyEl.appendChild(el);
  setupCollapsible(groupEl, headerEl, bodyEl, { isExpanded: false }, { baseAriaLabel: `${name}: ${count}` });
}
