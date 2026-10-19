import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';

export interface AntigravityModel { id: string; name: string; variants?: Array<{ id: string; effort: string }> }
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

export function groupGeminiModels(models: AntigravityModel[]): AntigravityModel[] {
  const groups = new Map<string, AntigravityModel>();
  for (const model of models) {
    const match = /^(gemini-.+)-(low|medium|high|xhigh|max)$/u.exec(model.id);
    const label = / \((Low|Medium|High|XHigh|Max)\)$/iu.exec(model.name);
    const id = match && label ? match[1] : model.id;
    const row = groups.get(id) ?? { id, name: match && label ? model.name.slice(0, -label[0].length) : model.name };
    const variants = [...(row.variants ?? []), ...(model.variants ?? []), ...(match && label ? [{ id: model.id, effort: match[2] }] : [])];
    if (variants.length) row.variants = [...new Map(variants.map(v => [v.effort, v])).values()].sort((a, b) => EFFORTS.indexOf(a.effort) - EFFORTS.indexOf(b.effort));
    groups.set(id, row);
  }
  return [...groups.values()];
}

export function findGeminiModel(settings: Record<string, unknown>, model: string): AntigravityModel | undefined {
  const raw = decodeAntigravityModel(model) ?? model;
  return getAntigravitySettings(settings).selectedModels.find(row => row.id === raw || row.variants?.some(v => v.id === raw));
}

export function resolveGeminiNativeModel(settings: Record<string, unknown>, model: string, reasoning?: string | null): string {
  const raw = decodeAntigravityModel(model) ?? model;
  const found = findGeminiModel(settings, model);
  if (!found?.variants?.length) {
    if (reasoning) throw new Error('The selected Gemini model does not advertise that effort. Refresh its model catalog.');
    return raw;
  }
  const effort = reasoning ?? found.variants.find(v => v.id === raw)?.effort ?? 'high';
  const variant = found.variants.find(v => v.effort === effort);
  if (!variant) throw new Error(`Gemini effort ${effort} is unavailable for ${found.name}.`);
  return variant.id;
}
export interface AntigravitySettings {
  enabled: boolean;
  cliPathsByHost: Record<string, string>;
  cliPath: string;
  visibleModels: string[];
  selectedModels: AntigravityModel[];
  modelAliases: Record<string, string>;
  environmentHash: string;
  environmentVariables: string;
}
export const DEFAULT_ANTIGRAVITY_SETTINGS: AntigravitySettings = {
  enabled: false, cliPathsByHost: {}, cliPath: '', visibleModels: [], selectedModels: [], modelAliases: {}, environmentHash: '', environmentVariables: '',
};
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function strings(value: unknown): Record<string, string> {
  return isRecord(value) ? Object.fromEntries(Object.entries(value).filter((pair): pair is [string, string] => typeof pair[1] === 'string')) : {};
}
export function decodeModels(value: unknown): AntigravityModel[] {
  if (!Array.isArray(value)) return [];
  const result = new Map<string, AntigravityModel>();
  for (const model of value) {
    if (isRecord(model) && typeof model.id === 'string' && model.id.trim() && typeof model.name === 'string') {
      const variants = Array.isArray(model.variants) ? model.variants.filter((v): v is { id: string; effort: string } => isRecord(v) && typeof v.id === 'string' && typeof v.effort === 'string' && EFFORTS.includes(v.effort)).map(v => ({ id: v.id, effort: v.effort })) : [];
      result.set(model.id, { id: model.id, name: model.name, ...(variants.length ? { variants } : {}) });
    }
  }
  return [...result.values()];
}
export function getAntigravitySettings(settings: Record<string, unknown>): AntigravitySettings {
  const value = getProviderConfig(settings, 'antigravity');
  const storedIds = Array.isArray(value.visibleModels)
    ? [...new Set(value.visibleModels.filter((id): id is string => typeof id === 'string' && !!id.trim()))] : [];
  const models = groupGeminiModels(decodeModels(value.selectedModels));
  const visibleModels = [...new Set(storedIds.map(id => models.find(model => model.variants?.some(v => v.id === id))?.id ?? id))];
  return {
    enabled: value.enabled === true,
    cliPathsByHost: strings(value.cliPathsByHost),
    cliPath: typeof value.cliPath === 'string' ? value.cliPath.trim() : '',
    visibleModels,
    selectedModels: models.filter(model => visibleModels.includes(model.id)),
    modelAliases: strings(value.modelAliases),
    environmentHash: typeof value.environmentHash === 'string' ? value.environmentHash : '',
    environmentVariables: typeof value.environmentVariables === 'string' ? value.environmentVariables : '',
  };
}
export function updateAntigravitySettings(settings: Record<string, unknown>, patch: Partial<AntigravitySettings>): void {
  setProviderConfig(settings, 'antigravity', { ...getProviderConfig(settings, 'antigravity'), ...getAntigravitySettings(settings), ...patch });
}
export function decodeAntigravityModel(model: string | undefined): string | null {
  return model?.startsWith('antigravity/') && model.length > 12 ? model.slice(12) : null;
}
export function parseAntigravityModels(output: string): AntigravityModel[] {
  const models: AntigravityModel[] = [];
  for (const line of output.split(/\r?\n/u)) {
    const match = /^([^\s]+)\t(.+)$/u.exec(line.trim());
    if (match) models.push({ id: match[1], name: match[2].trim() });
  }
  return groupGeminiModels(decodeModels(models));
}
