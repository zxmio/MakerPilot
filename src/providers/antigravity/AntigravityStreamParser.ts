import type { RequestedRunEvent } from '../../core/execution/RequestedRunChannel';
import { isRecord } from './settings';

/** Google native stream-json protocol; no OAuth credentials leave the CLI. */
export class AntigravityStreamParser {
  result: { ok: boolean; sessionId?: string; error?: string } | null = null;
  sessionId: string | undefined;
  private responseText = '';
  private readonly tools = new Set<string>();
  private readonly completedTools = new Set<string>();

  parse(value: unknown): RequestedRunEvent[] {
    if (!isRecord(value) || this.result) return [];
    if (value.event === 'init') {
      if (typeof value.conversation_id === 'string') this.sessionId = value.conversation_id;
      return [];
    }
    if (value.event === 'result' && isRecord(value.result)) {
      const result = value.result;
      if (typeof result.conversation_id === 'string') this.sessionId = result.conversation_id;
      const ok = result.status === 'SUCCESS';
      this.result = {
        ok, sessionId: this.sessionId,
        error: ok ? undefined : typeof result.error === 'string' ? result.error : `Antigravity returned ${typeof result.status === 'string' ? result.status : 'an unknown status'}.`,
      };
      const response = typeof result.response === 'string' ? result.response : '';
      // The final response repeats streamed text. Preserve only a missing suffix.
      if (response.startsWith(this.responseText)) {
        const suffix = response.slice(this.responseText.length);
        return suffix ? [{ type: 'text_delta', text: suffix }] : [];
      }
      return this.responseText || !response ? [] : [{ type: 'text_delta', text: response }];
    }
    if (value.event !== 'step_update' || !isRecord(value.step_update)) return [];
    const step = value.step_update;
    if (step.step_type === 'agent_response' && typeof step.text_delta === 'string') {
      this.responseText += step.text_delta;
      return [{ type: 'text_delta', text: step.text_delta }];
    }
    if (step.step_type !== 'tool' || !isRecord(step.tool_info)) return [];
    const info = step.tool_info;
    // Step identity is authoritative; never merge concurrent anonymous tools by name.
    if (typeof step.step_index !== 'number' || !Number.isInteger(step.step_index)) return [];
    const toolCallId = `agy-step-${step.step_index}`;
    const toolScope = { kind: 'main' } as const;
    const events: RequestedRunEvent[] = [];
    const input = isRecord(info.parameters) ? info.parameters : {};
    const nativeName = typeof info.name === 'string' ? info.name : typeof step.tool_name === 'string' ? step.tool_name : 'tool';
    const aliases: Record<string, string> = { run_command: 'Bash', view_file: 'Read', write_to_file: 'Write', replace_file_content: 'Edit', multi_replace_file_content: 'Edit', grep_search: 'Grep', list_dir: 'LS' };
    if (!this.tools.has(toolCallId)) {
      this.tools.add(toolCallId);
      events.push({ type: 'tool_started', toolCallId, toolScope, name: aliases[nativeName] ?? nativeName, input });
    }
    if (step.state === 'DONE' && !this.completedTools.has(toolCallId)) {
      this.completedTools.add(toolCallId);
      const error = isRecord(info.error) ? info.error : null;
      events.push({
        type: 'tool_completed', toolCallId, toolScope, isError: !!error,
        content: error && typeof error.message === 'string' ? error.message : typeof info.output === 'string' ? info.output : '',
      });
    }
    return events;
  }
}
