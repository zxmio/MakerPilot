import { testDate } from '@test/helpers/testClock';

import { formatSessionDate, sessionStatusText } from '@/features/chat/session-manager/SessionStatusPresentation';
import { setLocale } from '@/i18n/i18n';

describe('formatSessionDate', () => {
  it('should return time format for today', () => {
    const now = testDate();

    expect(formatSessionDate(now.getTime(), now)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('should return month/day format for a past date', () => {
    const now = testDate();
    const pastDate = testDate({ days: -400 });
    const result = formatSessionDate(pastDate.getTime(), now);

    expect(result).toContain(String(pastDate.getDate()));
    expect(result).not.toMatch(/^\d{2}:\d{2}$/);
  });

  it('shows the time for yesterday, which its own group already names', () => {
    const now = testDate();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    expect(formatSessionDate(yesterday.getTime(), now)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('shows the weekday within the past week', () => {
    const now = testDate();
    const earlier = new Date(now);
    earlier.setDate(earlier.getDate() - 4);

    expect(formatSessionDate(earlier.getTime(), now))
      .toBe(earlier.toLocaleDateString(undefined, { weekday: 'short' }));
  });
});

describe('sessionStatusText', () => {
  const closed = { openState: 'closed' as const, isRunning: false, attention: null };

  it('labels running and unread sessions in the interface language', () => {
    const now = testDate().getTime();
    const unread = { ...closed, attention: { kind: 'review' as const, outcome: 'completed' as const, since: now } };
    expect(sessionStatusText({ ...closed, isRunning: true }, now, true)).toBe('Running');
    expect(sessionStatusText(unread, now, true)).toBe('Unread');
    setLocale('zh-CN');
    try {
      expect(sessionStatusText({ ...closed, isRunning: true }, now, true)).toBe('运行中');
      expect(sessionStatusText(unread, now, true)).toBe('未读');
    } finally {
      setLocale('en');
    }
  });
});
