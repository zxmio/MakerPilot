import { PassThrough } from 'node:stream';

import { testDate } from '@test/helpers/testClock';

import type { ProviderExecutionRequest, ProviderSessionConfig } from '@/core/execution';
import { isRewindableExecutionSession } from '@/core/execution/RewindableExecutionSession';
import type { ProviderHost } from '@/core/providers/ProviderHost';
import { AntigravityExecutionBackend, buildAntigravityArgs } from '@/providers/antigravity/AntigravityExecutionBackend';
import { antigravityHistory } from '@/providers/antigravity/AntigravityHistory';

const mockProcesses: any[] = [];
jest.mock('@/core/process/ManagedStdioProcess', () => ({
  ManagedStdioProcess: class {
    stdin = new PassThrough(); stdout = new PassThrough(); close: any; error: any; stopped = false;
    constructor(readonly options: any) { mockProcesses.push(this); }
    onError(listener: any) { this.error = listener; }
    onClose(listener: any) { this.close = listener; }
    start() {}
    async shutdown() { if (!this.stopped) { this.stopped = true; this.close?.({ code: 0 }); } }
    send(event: unknown) { this.stdout.write(`${JSON.stringify(event)}\n`); }
  },
}));
const request = (): ProviderExecutionRequest => ({
  input: [{ type: 'text', text: 'hello' }], configuration: { model: 'antigravity/gemini-live', systemInstructions: { kind: 'explicit', instructions: 'test instructions' } },
  toolPolicy: { kind: 'provider-default' }, signal: new AbortController().signal,
});
const config: ProviderSessionConfig = {
  lifecycle: 'persistent', nativePersistence: 'enabled', vaultWorkingDirectory: '/tmp/vault',
  interactionPort: { requestApproval: jest.fn(), askUserQuestion: jest.fn(), dismissInteraction: jest.fn() },
};
const host = (): ProviderHost => ({
  settings: { providerConfigs: { antigravity: { enabled: true, visibleModels: ['gemini-live'] } } },
  getResolvedProviderCliPath: async () => '/bin/agy',
} as unknown as ProviderHost);
async function tick(): Promise<void> { await Promise.resolve(); await Promise.resolve(); }

describe('Antigravity execution', () => {
  beforeEach(() => { mockProcesses.length = 0; });
  it('uses exact session IDs and never silently enables YOLO', () => {
    const args = buildAntigravityArgs(request(), 'session-a');
    expect(args).toEqual(expect.arrayContaining(['--conversation', 'session-a']));
    expect(args).not.toContain('--continue');
    expect(args).not.toContain('--dangerously-skip-permissions');
  });
  it.each(['passive', 'read-only', 'allow-list'] as const)('rejects unsupported %s restrictions before spawning', async kind => {
    const session = new AntigravityExecutionBackend(host()).createSession(config);
    const run = session.execute({ ...request(), toolPolicy: kind === 'allow-list' ? { kind, names: ['Read'] } : { kind } });
    const events = [];
    for await (const event of run.events) events.push(event);
    expect(events.at(-1)).toEqual(expect.objectContaining({ type: 'execution_error' }));
    expect(mockProcesses).toHaveLength(0);
    await session.dispose();
  });
  it('streams native output, persists the real ID, and resumes only that conversation', async () => {
    const session = new AntigravityExecutionBackend(host()).createSession(config);
    const run = session.execute(request());
    await tick();
    const native = mockProcesses[0];
    const sent = JSON.parse(native.stdin.read().toString());
    expect(sent.message.content).toContain('test instructions');
    native.send({ event: 'init', conversation_id: 'session-a' });
    native.send({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: '回答' } });
    native.send({ event: 'result', result: { status: 'SUCCESS', response: '回答', conversation_id: 'session-a' } });
    native.close({ code: 0 });
    const events = [];
    for await (const event of run.events) events.push(event);
    await tick();
    expect(events.filter(event => event.type === 'text_delta')).toEqual([expect.objectContaining({ text: '回答' })]);
    expect(events.at(-1)).toEqual(expect.objectContaining({ type: 'turn_completed' }));
    expect(session.getSnapshot().providerSessionId).toBe('session-a');
    const next = session.execute(request());
    await tick();
    expect(mockProcesses[1].options.args).toEqual(expect.arrayContaining(['--conversation', 'session-a']));
    next.cancel();
    for await (const event of next.events) { expect(event.scope.executionId).toBe(next.executionId); }
    await session.dispose();
  });
  it('does not report a truncated native response as success', async () => {
    const session = new AntigravityExecutionBackend(host()).createSession(config);
    const run = session.execute(request()); await tick();
    mockProcesses[0].send({ event: 'init', conversation_id: 'session-a' });
    mockProcesses[0].close({ code: 0 });
    const events = [];
    for await (const event of run.events) events.push(event);
    expect(events.at(-1)?.type).toBe('execution_error');
    await session.dispose();
  });
  it('cancels during CLI lookup without starting a process', async () => {
    let resolve!: (value: string) => void;
    const pendingHost = host(); pendingHost.getResolvedProviderCliPath = () => new Promise(r => { resolve = r; });
    const session = new AntigravityExecutionBackend(pendingHost).createSession(config);
    const run = session.execute(request()); run.cancel(); resolve('/bin/agy');
    const events = [];
    for await (const event of run.events) events.push(event);
    expect(events.at(-1)?.type).toBe('cancelled'); expect(mockProcesses).toHaveLength(0);
    await session.dispose();
  });
  it('rewinds conversation context without resuming the discarded native tail', async () => {
    const timestamp = testDate().getTime();
    const history = [{ id: 'u', role: 'user' as const, content: 'retained context', timestamp, userMessageId: 'gemini-user-old' }];
    const session = new AntigravityExecutionBackend(host()).createSession({ ...config, resumeSeed: { providerSessionId: 'old-native', providerState: { messages: history } } });
    expect(isRewindableExecutionSession(session)).toBe(true);
    if (!isRewindableExecutionSession(session)) throw new Error('Missing rewind capability');
    expect((await session.previewRewind('gemini-user-old', undefined, 'code-and-conversation')).canRewind).toBe(false);
    expect((await session.rewind('gemini-user-old', undefined, 'conversation')).canRewind).toBe(true);
    expect(session.getSnapshot().providerState).toMatchObject({ replayRequired: true });
    const run = session.execute({ ...request(), conversationHistory: history });
    await tick();
    const native = mockProcesses[0];
    expect(native.options.args).not.toContain('--conversation');
    expect(JSON.parse(native.stdin.read().toString()).message.content).toContain('retained context');
    native.send({ event: 'init', conversation_id: 'new-native' });
    native.send({ event: 'result', result: { status: 'SUCCESS', response: 'ok', conversation_id: 'new-native' } });
    native.close({ code: 0 });
    const events = [];
    for await (const event of run.events) events.push(event);
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'turn_started', nativeUserMessageId: expect.stringContaining('gemini-user-') }), expect.objectContaining({ type: 'assistant_message_started', nativeAssistantId: expect.stringContaining('gemini-assistant-') })]));
    expect(session.getSnapshot().providerSessionId).toBe('new-native');
    expect(session.getSnapshot().providerStateDeletes).toContain('replayRequired');
    await session.dispose();
  });
  it('forks into a fresh native session while leaving the source binding untouched', async () => {
    const source = { sessionId: 'source-native', providerId: 'antigravity', messages: [] };
    const state = await antigravityHistory.buildForkProviderState(source.sessionId, 'gemini-assistant-checkpoint');
    expect(antigravityHistory.resolveSessionIdForConversation({ ...source, providerState: state })).toBeNull();
    expect(antigravityHistory.resolveSessionIdForConversation(source)).toBe('source-native');
    const session = new AntigravityExecutionBackend(host()).createSession({ ...config, resumeSeed: { providerSessionId: source.sessionId, providerState: state } });
    const run = session.execute(request()); await tick();
    expect(mockProcesses[0].options.args).not.toContain('--conversation');
    run.cancel(); for await (const event of run.events) expect(event.scope.executionId).toBe(run.executionId);
    await session.dispose();
  });

});
