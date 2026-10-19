import { AntigravityStreamParser } from '@/providers/antigravity/AntigravityStreamParser';

describe('Antigravity native stream', () => {
  it('streams deltas without duplicating the final response', () => {
    const parser = new AntigravityStreamParser();
    expect(parser.parse({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'OK' } })).toContainEqual({ type: 'text_delta', text: 'OK' });
    expect(parser.parse({ event: 'result', result: { status: 'SUCCESS', response: 'OK\n', conversation_id: 'session-a' } })).toContainEqual({ type: 'text_delta', text: '\n' });
    expect(parser.result).toEqual({ ok: true, sessionId: 'session-a', error: undefined });
  });
});

describe('native tool outcomes', () => {
  it('preserves tool input and explicit failure instead of treating DONE as success', () => {
    const parser = new AntigravityStreamParser();
    const events = parser.parse({ event: 'step_update', step_update: { step_type: 'tool', step_index: 4, state: 'DONE', tool_info: { name: 'write_to_file', parameters: { TargetFile: '/tmp/note.md', CodeContent: 'hello' }, error: { type: 'permission_denied', message: 'Denied by CLI rules' } } } });
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_started', input: { TargetFile: '/tmp/note.md', CodeContent: 'hello' } }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_completed', isError: true, content: 'Denied by CLI rules' }));
  });
  it('does not upgrade an error with a partial answer to success', () => {
    const parser = new AntigravityStreamParser();
    parser.parse({ event: 'result', result: { status: 'ERROR', response: 'partial', error: 'Quota exhausted' } });
    expect(parser.result).toEqual(expect.objectContaining({ ok: false, error: 'Quota exhausted' }));
  });
  it('ignores late events and duplicate results', () => {
    const parser = new AntigravityStreamParser();
    parser.parse({ event: 'result', result: { status: 'SUCCESS', response: 'OK' } });
    expect(parser.parse({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'late' } })).toEqual([]);
  });
});
