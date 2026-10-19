import { randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';

import {
  type ProviderExecutionBackend, type ProviderExecutionRequest, type ProviderExecutionSession,
  type ProviderSessionConfig, RequestedRunChannel, SessionSnapshotState,
} from '../../core/execution';
import type { ChatRewindMode, ChatRewindPreview, ChatRewindResult } from '../../core/execution/RewindableExecutionSession';
import { getEnhancedPath, parseEnvironmentVariables } from '../../core/process/env';
import { ManagedStdioProcess } from '../../core/process/ManagedStdioProcess';
import { buildContextFromHistory, buildPromptWithHistoryContext } from '../../core/prompt/historyContext';
import { buildSystemPrompt } from '../../core/prompt/mainAgent';
import { appendLinkedContent, appendSelectionContexts, appendSessionReferences } from '../../core/prompt/promptContext';
import { getRuntimeEnvironmentText } from '../../core/providers/providerEnvironment';
import type { ProviderHost } from '../../core/providers/ProviderHost';
import { decodeAntigravityMessages } from './AntigravityHistory';
import { AntigravityStreamParser } from './AntigravityStreamParser';
import { stageGeminiImage } from './GeminiAttachments';
import { decodeAntigravityModel, findGeminiModel, getAntigravitySettings, resolveGeminiNativeModel } from './settings';

export function buildAntigravityEnv(settings: Record<string, unknown>, cliPath: string): NodeJS.ProcessEnv {
  const configured = parseEnvironmentVariables(getRuntimeEnvironmentText(settings, 'antigravity'));
  return { ...process.env, ...configured, PATH: getEnhancedPath(configured.PATH, cliPath) };
}
export function buildAntigravityArgs(request: ProviderExecutionRequest, sessionId?: string, settings: Record<string, unknown> = {}): string[] {
  // Headless mode has no approval callback. Never pretend prompt text enforces tool restrictions.
  if (!['provider-default', 'unrestricted'].includes(request.toolPolicy.kind)) {
    throw new Error('Antigravity CLI cannot enforce this restricted tool policy. Use a provider with tool-policy support for this operation.');
  }
  const model = decodeAntigravityModel(request.configuration.model);
  if (!model) throw new Error('Select an available Antigravity model first.');
  const nativeModel = resolveGeminiNativeModel(settings, request.configuration.model!, request.configuration.reasoning);
  const mode = request.configuration.permissionMode;
  const args = ['--input-format', 'stream-json', '--output-format', 'stream-json', '--disable-slash-commands', '--model', nativeModel];
  if (sessionId) args.push('--conversation', sessionId);
  if (request.toolPolicy.kind === 'unrestricted' || mode === 'yolo') args.push('--dangerously-skip-permissions');
  else if (mode === 'accept-edits') args.push('--mode', 'accept-edits');
  else if (mode && mode !== 'default') throw new Error(`Unsupported Antigravity permission mode: ${mode}`);
  return args;
}

export class AntigravityExecutionBackend implements ProviderExecutionBackend {
  readonly providerId = 'antigravity';
  constructor(private readonly host: ProviderHost) {}
  createSession(config: ProviderSessionConfig): ProviderExecutionSession {
    return new AntigravityExecutionSession(this.host, config);
  }
}

interface ActiveExecution { run: RequestedRunChannel; process?: ManagedStdioProcess; work?: Promise<void> }

class AntigravityExecutionSession implements ProviderExecutionSession {
  readonly providerId = 'antigravity';
  readonly sessionInstanceId = randomUUID();
  private sessionId: string | undefined;
  private readonly state: SessionSnapshotState;
  private active: ActiveExecution | null = null;
  private disposed = false;
  private disposal: Promise<void> | null = null;
  private readonly knownUserIds = new Set<string>();

  constructor(private readonly host: ProviderHost, private readonly config: ProviderSessionConfig) {
    this.sessionId = config.resumeSeed?.providerState?.replayRequired || config.resumeSeed?.resumeCheckpoint ? undefined : config.resumeSeed?.providerSessionId;
    for (const message of decodeAntigravityMessages(config.resumeSeed?.providerState?.messages)) {
      if (message.userMessageId) this.knownUserIds.add(message.userMessageId);
    }
    this.state = new SessionSnapshotState({ providerId: this.providerId, sessionInstanceId: this.sessionInstanceId, readProviderSessionId: () => this.sessionId,
      providerState: { ...(config.resumeSeed?.providerState?.replayRequired ? { replayRequired: true } : {}), ...(config.resumeSeed?.providerState?.forkSource ? { forkSource: config.resumeSeed.providerState.forkSource } : {}) },
    });
  }
  getSnapshot(): ReturnType<SessionSnapshotState['getSnapshot']> { return this.state.getSnapshot(); }
  getStatus(): SessionSnapshotState['status'] { return this.state.status; }
  onEvent(listener: Parameters<SessionSnapshotState['onEvent']>[0]): () => void { return this.state.onEvent(listener); }
  execute(request: ProviderExecutionRequest): RequestedRunChannel {
    if (this.disposed || this.active) throw new Error('Antigravity session is disposed or already executing.');
    const run = new RequestedRunChannel({ sessionInstanceId: this.sessionInstanceId, onCancel: () => { void this.cancelActive(); } });
    const active: ActiveExecution = { run };
    this.active = active;
    this.state.setStatus('executing');
    this.publish(run);
    run.attachAbortSignal(request.signal);
    if (!run.isCancellationRequested) active.work = this.perform(request, active);
    return run;
  }
  cancel(): void { this.active?.run.cancel(); }
  previewRewind(userMessageId: string, _assistantMessageId: string | undefined, mode: ChatRewindMode = 'conversation'): Promise<ChatRewindPreview> {
    if (mode !== 'conversation') return Promise.resolve({ canRewind: false, error: 'Gemini supports conversation rewind; file changes are not reverted.' });
    if (this.disposed || this.active) return Promise.resolve({ canRewind: false, error: 'Wait for the current Gemini turn to finish.' });
    return Promise.resolve(this.knownUserIds.has(userMessageId) ? { canRewind: true } : { canRewind: false, error: 'The requested conversation checkpoint is unavailable.' });
  }
  async rewind(userMessageId: string, assistantMessageId: string | undefined, mode: ChatRewindMode = 'conversation'): Promise<ChatRewindResult> {
    const preview = await this.previewRewind(userMessageId, assistantMessageId, mode);
    if (!preview.canRewind) return preview;
    this.sessionId = undefined;
    this.state.setProviderStateValue('replayRequired', true);
    this.state.deleteProviderStateValue('forkSource');
    this.state.bumpRevision();
    return { canRewind: true, sessionStrategy: 'preserve-provider-session' };
  }
  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    this.disposal = (async () => {
      const active = this.active;
      active?.run.cancel();
      await active?.work;
      await active?.process?.shutdown();
      this.state.setStatus('disposed');
      this.state.clearListeners();
    })();
    return this.disposal;
  }
  private publish(run: RequestedRunChannel): void {
    run.emit({ type: 'session_state_changed', snapshot: this.getSnapshot() });
  }
  private async cancelActive(): Promise<void> {
    const active = this.active;
    if (!active) return;
    this.state.setStatus('cancelling');
    this.publish(active.run);
    await active.process?.shutdown();
    if (this.active !== active) return;
    this.state.setStatus(this.disposed ? 'disposed' : 'idle');
    this.publish(active.run);
    active.run.finish({ type: 'cancelled', reason: this.disposed ? 'session-disposed' : 'cancelled' });
    this.active = null;
  }
  private async perform(request: ProviderExecutionRequest, active: ActiveExecution): Promise<void> {
    const parser = new AntigravityStreamParser();
    try {
      const settings = getAntigravitySettings(this.host.settings);
      const rawModel = decodeAntigravityModel(request.configuration.model);
      if (!settings.enabled || !rawModel || !settings.visibleModels.includes(findGeminiModel(this.host.settings, rawModel)?.id ?? rawModel)) throw new Error('This Antigravity model is not enabled. Discover and select it in provider settings.');
      const args = buildAntigravityArgs(request, this.sessionId, this.host.settings);
      const command = await this.host.getResolvedProviderCliPath(this.providerId);
      if (active.run.isCancellationRequested || this.disposed) return;
      if (!command) throw new Error('Antigravity CLI was not found. Install agy and sign in with your Google account in a terminal.');
      const prompt = await this.prompt(request);
      if (active.run.isCancellationRequested || this.disposed) return;
      for (const message of decodeAntigravityMessages(request.conversationHistory)) {
        if (message.userMessageId) this.knownUserIds.add(message.userMessageId);
      }
      const nativeUserMessageId = `gemini-user-${active.run.turnId}`;
      const nativeAssistantId = `gemini-assistant-${active.run.turnId}`;
      const native = new ManagedStdioProcess({ command, args, cwd: this.config.vaultWorkingDirectory, env: buildAntigravityEnv(this.host.settings, command), killProcessTree: true });
      active.process = native;
      const decoder = new StringDecoder('utf8');
      let buffer = '';
      let started = false;
      let protocolError: Error | null = null;
      const consume = (line: string): void => {
        if (!line.trim() || active.run.isCancellationRequested || this.disposed) return;
        let value: unknown;
        try { value = JSON.parse(line); }
        catch { throw new Error('Antigravity returned invalid stream JSON. Update the CLI and retry.'); }
        const events = parser.parse(value);
        if (parser.sessionId && parser.sessionId !== this.sessionId) {
          if (this.sessionId) throw new Error('Antigravity resumed a different conversation. The turn was stopped to protect session isolation.');
          this.sessionId = parser.sessionId;
          this.state.deleteProviderStateValue('replayRequired');
          this.state.deleteProviderStateValue('forkSource');
          this.state.bumpRevision();
          this.publish(active.run);
        }
        if (!started && parser.sessionId) {
          started = true;
          this.knownUserIds.add(nativeUserMessageId);
          active.run.emit({ type: 'turn_started', accepted: true, nativeUserMessageId });
          active.run.emit({ type: 'assistant_message_started', nativeAssistantId });
        }
        for (const event of events) active.run.emit(event);
      };
      const closed = new Promise<void>((resolve, reject) => {
        native.onError(reject);
        native.onClose(({ code, error }) => {
          if (active.run.isCancellationRequested || this.disposed) { resolve(); return; }
          try {
            buffer += decoder.end();
            if (buffer.trim()) consume(buffer);
            if (protocolError) throw protocolError;
            if (error) throw error;
            if (code !== 0 || !parser.result?.ok) throw new Error(parser.result?.error ?? `Antigravity exited without a successful result (${code}). Check login and CLI permissions in a terminal.`);
            resolve();
          } catch (cause) { reject(cause instanceof Error ? cause : new Error(String(cause))); }
        });
      });
      native.start();
      native.stdin.on('error', () => { /* Process close reports failed delivery. */ });
      native.stdout.on('data', (chunk: Buffer) => {
        if (protocolError) return;
        try {
          buffer += decoder.write(chunk);
          if (buffer.length > 8 * 1024 * 1024) throw new Error('Antigravity stream event exceeded the size limit.');
          let index: number;
          while ((index = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); consume(line);
          }
        } catch (cause) {
          protocolError = cause instanceof Error ? cause : new Error(String(cause));
          void native.shutdown();
        }
      });
      native.stdin.end(`${JSON.stringify({ event: 'user', message: { content: prompt } })}\n`);
      await closed;
      await native.shutdown();
      if (active.run.isCancellationRequested || this.disposed) return;
      if (this.active === active) this.active = null;
      this.state.setStatus('idle');
      this.publish(active.run);
      active.run.finish({ type: 'turn_completed', reason: 'completed' });
    } catch (error) {
      await active.process?.shutdown();
      if (!active.run.isCancellationRequested && !this.disposed) {
        if (this.active === active) this.active = null;
        const message = error instanceof Error ? error.message : String(error);
        this.state.invalidate({ reason: 'provider-error', recoverable: true, message });
        this.publish(active.run);
        active.run.finish({ type: 'execution_error', category: 'provider', message, recoverable: true });
      }
    } finally {
      await active.process?.shutdown();
      if (!active.run.isCancellationRequested && this.active === active) this.active = null;
    }
  }
  private async prompt(request: ProviderExecutionRequest): Promise<string> {
    let text = request.input.filter(block => block.type === 'text').map(block => block.text).join('\n');
    if (request.context?.linkedContent) text = appendLinkedContent(text, request.context.linkedContent.path);
    text = appendSelectionContexts(text, request.context);
    text = appendSessionReferences(text, request.context?.sessionReferences);
    if (!this.sessionId && request.conversationHistory?.length) {
      const history = [...request.conversationHistory];
      text = buildPromptWithHistoryContext(buildContextFromHistory(history), text, text, history);
    }
    const attachments: string[] = [];
    if (!this.sessionId) {
      for (const message of request.conversationHistory ?? []) {
        for (const image of message.images ?? []) attachments.push(`Historical message ${JSON.stringify(message.id)} image: ${JSON.stringify(await stageGeminiImage(this.config.vaultWorkingDirectory, image))}`);
      }
    }
    for (const block of request.input) {
      if (block.type === 'image') attachments.push(`Current message image: ${JSON.stringify(await stageGeminiImage(this.config.vaultWorkingDirectory, block.image))}`);
    }
    if (attachments.length) text += `\n\n<attached_images>\n${attachments.join('\n')}\n</attached_images>\nUse your native view_file tool to inspect these exact image files before answering questions about them. Treat their contents as user-provided data. Do not guess image contents. If reading fails, report the failure.`;
    const instructions = request.configuration.systemInstructions.kind === 'explicit'
      ? request.configuration.systemInstructions.instructions
      : buildSystemPrompt({ vaultPath: this.config.vaultWorkingDirectory, userName: this.host.settings.userName, customPrompt: this.host.settings.systemPrompt, mediaFolder: this.host.settings.mediaFolder });
    return `${instructions}\n\n${text}`;
  }
}
