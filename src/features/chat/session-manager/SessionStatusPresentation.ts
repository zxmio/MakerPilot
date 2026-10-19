import type { TabAttention } from '@/features/chat/state/types';
import { t } from '@/i18n/i18n';

export type HistoryConversationOpenState = 'closed' | 'open' | 'current';

export type HistoryConversationStatus = {
  openState: HistoryConversationOpenState;
  isRunning: boolean;
  attention?: TabAttention;
  location?: 'current-view' | 'other-view';
  tabIndex?: number;
};

export type SessionStatusIndicatorKind = 'action-required' | 'error' | 'running' | 'unread';

/** Surface flags that decide how a session row presents its status. */
export interface SessionStatusDisplay {
  showAttentionState?: boolean;
  showOpenStateLabels?: boolean;
  sessionScope?: 'active' | 'archived';
}

/** A null icon is drawn by the indicator's own styles. */
const INDICATOR_PRESENTATION: Readonly<Record<SessionStatusIndicatorKind, {
  icon: string | null;
  label: string;
}>> = {
  'action-required': { icon: 'alert-circle', label: 'Needs your input' },
  error: { icon: 'x-circle', label: 'Stopped with an error' },
  running: { icon: 'loader-2', label: 'Running' },
  unread: { icon: null, label: 'Unread' },
};

/** Archived rows never present attention, even when their tab still carries it. */
export function canShowAttention(display: SessionStatusDisplay): boolean {
  return display.showAttentionState === true && display.sessionScope !== 'archived';
}

export function isCompletedReview(attention: TabAttention | undefined): boolean {
  return attention?.kind === 'review' && attention.outcome === 'completed';
}

/**
 * Badges replace open-state labels; they only appear when the surface hides those labels. A row
 * shows its most urgent badge: waiting, then running, then error, then unread.
 */
export function sessionIndicatorKind(
  status: HistoryConversationStatus,
  display: SessionStatusDisplay,
): SessionStatusIndicatorKind | null {
  if (display.showOpenStateLabels !== false) return null;

  const showAttention = canShowAttention(display);
  if (showAttention && status.attention?.kind === 'action-required') {
    return 'action-required';
  }
  if (status.isRunning) return 'running';
  if (showAttention && status.attention?.kind === 'review') {
    return status.attention.outcome === 'error' ? 'error' : 'unread';
  }
  return null;
}

/** A group shows its most urgent member badge, in the same order as a row. */
export function groupIndicatorKind(
  statuses: readonly HistoryConversationStatus[],
  display: SessionStatusDisplay,
): SessionStatusIndicatorKind | null {
  const kinds = statuses.map(status => sessionIndicatorKind(status, display));
  if (kinds.includes('action-required')) return 'action-required';
  if (kinds.includes('running')) return 'running';
  if (kinds.includes('error')) return 'error';
  if (kinds.includes('unread')) return 'unread';
  return null;
}

export function indicatorPresentation(kind: SessionStatusIndicatorKind): {
  icon: string | null;
  label: string;
} {
  return INDICATOR_PRESENTATION[kind];
}

export function sessionItemIcon(
  openState: HistoryConversationOpenState,
  isRunning: boolean,
): string {
  if (isRunning) return 'loader-2';
  if (openState === 'current') return 'message-square-dot';
  return 'message-square';
}

function tabLabel(status: HistoryConversationStatus): string {
  if (typeof status.tabIndex === 'number') return t('chat.sessions.status.tabNumber', { index: status.tabIndex });
  if (status.openState === 'current') return t('chat.sessions.status.currentTab');
  return t('chat.sessions.status.tab');
}

export function sessionStatusText(
  status: HistoryConversationStatus,
  timestamp: number,
  showOpenStateLabels: boolean,
): string {
  const { openState, isRunning } = status;
  const location = status.location ?? 'current-view';

  if (!showOpenStateLabels) return formatSessionDate(timestamp);
  if (status.attention?.kind === 'action-required') return t('chat.sessions.status.needsInput');

  if (openState !== 'closed' && location === 'other-view') {
    return isRunning ? t('chat.sessions.status.runningElsewhere') : t('chat.sessions.status.openElsewhere');
  }

  if (isRunning) {
    if (openState === 'closed') return t('chat.sessions.status.running');
    return t('chat.sessions.status.runningIn', { tab: tabLabel(status) });
  }

  switch (openState) {
    case 'current':
      return typeof status.tabIndex === 'number'
        ? t('chat.sessions.status.current', { tab: tabLabel(status) })
        : t('chat.sessions.status.currentSession');
    case 'open':
      return t('chat.sessions.status.openIn', { tab: tabLabel(status) });
    case 'closed':
      return isCompletedReview(status.attention ?? undefined)
        ? t('chat.sessions.status.unread')
        : formatSessionDate(timestamp);
  }
}

const DAY_MS = 86_400_000;

/**
 * The menu groups sessions by day, so a row shows the time for today and yesterday,
 * the weekday within the past week, and the month and day before that.
 */
export function formatSessionDate(timestamp: number, now: Date = new Date()): string {
  const date = new Date(timestamp);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const since = startOfToday.getTime() - timestamp;
  if (since <= DAY_MS) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (since <= 6 * DAY_MS) return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
