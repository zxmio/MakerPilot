import { getInstallationKey } from '../../core/device/InstallationKey';
import { parseEnvironmentVariables } from '../../core/process/env';
import { NOOP_TASK_RESULT_INTERPRETER } from '../../core/providers/NoopTaskResultInterpreter';
import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import { getRuntimeEnvironmentText } from '../../core/providers/providerEnvironment';
import { createRuntimeInputFingerprint } from '../../core/providers/settings/RuntimeInputFingerprint';
import type { ProviderChatUIConfig, ProviderModelPolicy, ProviderModule } from '../../core/providers/types';
import type { Conversation } from '../../core/types';
import { t } from '../../i18n/i18n';
import { AntigravityExecutionBackend } from './AntigravityExecutionBackend';
import { antigravityHistory } from './AntigravityHistory';
import { createAntigravityWorkspace } from './AntigravityWorkspace';
import { GEMINI_ICON } from './GeminiIcon';
import { decodeAntigravityModel, findGeminiModel, getAntigravitySettings, isRecord, updateAntigravitySettings } from './settings';

const modelPolicy: ProviderModelPolicy = {
  permissionModes: { values: ['default', 'accept-edits', 'yolo'], fallbackValue: 'default', defaultValue: 'default' },
  getModelOptions(settings) {
    const config = getAntigravitySettings(settings);
    return config.visibleModels.flatMap(id => {
      const model = config.selectedModels.find(model => model.id === id);
      return model ? [{ value: `antigravity/${id}`, label: config.modelAliases[id] ?? model.name }] : [];
    });
  },
  getDefaultModel(settings) { return this.getModelOptions(settings)[0]?.value ?? null; },
  ownsModel: model => decodeAntigravityModel(model) !== null,
  supportsReasoningEffort: (model, settings) => !!findGeminiModel(settings, model)?.variants?.length,
  getReasoningOptions: (model, settings) => (findGeminiModel(settings, model)?.variants ?? []).map(v => ({ value: v.effort, label: v.effort[0].toUpperCase() + v.effort.slice(1) })),
  getDefaultReasoningValue: (model, settings) => {
    const variants = findGeminiModel(settings, model)?.variants ?? [];
    return variants.find(v => v.id === decodeAntigravityModel(model))?.effort
      ?? variants.find(v => v.effort === 'high')?.effort ?? variants[0]?.effort ?? '';
  },
  isDefaultModel: () => false,
  applyModelDefaults(model, settings) {
    if (isRecord(settings)) { settings.model = model; settings.effortLevel = modelPolicy.getDefaultReasoningValue(model, settings); }
  },
  applyModelProjectionDefaults(model, settings) {
    if (isRecord(settings) && !settings.effortLevel) settings.effortLevel = modelPolicy.getDefaultReasoningValue(model, settings);
  },
  normalizeAvailableModelSelection(model, settings) {
    const found = findGeminiModel(settings, model);
    return found ? `antigravity/${found.id}` : model;
  },
  normalizeModelVariant: model => model.trim(),
  getCustomModelIds: () => new Set(),
};
const chatUIConfig: ProviderChatUIConfig = {
  ...modelPolicy,
  getPermissionModeOptions: () => [
    { value: 'default', label: t('chat.permissionMode.antigravity.cliRules'), description: t('chat.permissionMode.antigravity.cliRulesDesc') },
    { value: 'accept-edits', label: t('chat.permissionMode.antigravity.acceptEdits'), description: t('chat.permissionMode.antigravity.acceptEditsDesc') },
    { value: 'yolo', label: t('chat.permissionMode.antigravity.yolo'), bypassesApprovals: true, description: t('chat.permissionMode.antigravity.yoloDesc') },
  ],
  getModeSelector: () => null,
  getProviderIcon: () => GEMINI_ICON,
};

function invalidateSessions(conversations: Conversation[]): Conversation[] {
  return conversations.filter(conversation => {
    if (conversation.providerId !== 'antigravity' || !conversation.sessionId) return false;
    // Keep the local transcript for replay, but never resume across account/store changes.
    conversation.sessionId = null;
    return true;
  });
}
export const antigravityProviderRegistration: ProviderModule = {
  id: 'antigravity', displayName: 'Gemini', blankTabOrder: 13,
  capabilities: {
    providerId: 'antigravity', supportsNativeHistory: false, supportsEphemeralSessions: false,
    supportsRewind: true, supportsCodeRewind: false, supportsFork: true, supportsProviderCommands: false,
    supportsImageAttachments: true, reasoningControl: 'effort',
  },
  modelPolicy, chatUIConfig,
  isEnabled: settings => getAntigravitySettings(settings).enabled,
  setEnabled: (settings, enabled) => updateAntigravitySettings(settings, { enabled }),
  environmentKeyPatterns: [/^AGY_/iu, /^ANTIGRAVITY_/iu, /^GOOGLE_/iu, /^GEMINI_/iu],
  createExecutionBackend: host => new AntigravityExecutionBackend(host),
  historyService: antigravityHistory,
  taskResultInterpreter: NOOP_TASK_RESULT_INTERPRETER,
  settingsReconciler: {
    invalidateConversationSessions: invalidateSessions,
    reconcileModelWithEnvironment(settings, conversations) {
      const current = getAntigravitySettings(settings);
      if (!current.enabled) return { changed: false, invalidatedConversations: [] };
      const environmentText = getRuntimeEnvironmentText(settings, 'antigravity');
      const environmentHash = createRuntimeInputFingerprint({ environmentKeys: Object.keys(parseEnvironmentVariables(environmentText)), environmentText, additionalInputs: { cliPath: current.cliPathsByHost[getInstallationKey()] ?? current.cliPath } });
      if (current.environmentHash === environmentHash) return { changed: false, invalidatedConversations: [] };
      updateAntigravitySettings(settings, { environmentHash });
      return { changed: true, invalidatedConversations: current.environmentHash ? invalidateSessions(conversations) : [], sessionPolicy: 'invalidate' };
    },
  },
  settingsStorage: {
    hostScopedFields: ['cliPathsByHost'],
    normalizeStored(target, stored) {
      const previous = getProviderConfig(stored, 'antigravity');
      const config = getAntigravitySettings(stored);
      setProviderConfig(target, 'antigravity', { ...config });
      return Object.keys(previous).length > 0 && JSON.stringify(previous) !== JSON.stringify(config);
    },
  },
  workspace: { initialize: async ({ plugin }) => createAntigravityWorkspace(plugin) },
};
