import type { ProviderExecutionRequest } from '@/core/execution';
import { buildAntigravityArgs } from '@/providers/antigravity/AntigravityExecutionBackend';
import { antigravityProviderRegistration } from '@/providers/antigravity/registration';
import { getAntigravitySettings } from '@/providers/antigravity/settings';

const settings = { providerConfigs: { antigravity: { enabled: true, visibleModels: ['gemini-test-high', 'gemini-test-low', 'gemini-test-medium'], selectedModels: [
  { id: 'gemini-test-high', name: 'Gemini Test (High)' },
  { id: 'gemini-test-low', name: 'Gemini Test (Low)' },
  { id: 'gemini-test-medium', name: 'Gemini Test (Medium)' },
] } } };

it('consolidates discovered variants into one model and exposes the common effort control', () => {
  expect(getAntigravitySettings(settings).visibleModels).toEqual(['gemini-test']);
  const policy = antigravityProviderRegistration.modelPolicy;
  expect(policy.getModelOptions(settings)).toEqual([{ value: 'antigravity/gemini-test', label: 'Gemini Test' }]);
  expect(policy.getReasoningOptions('antigravity/gemini-test', settings).map(option => option.value)).toEqual(['low', 'medium', 'high']);
});

it('routes each explicit effort to its exact native model and rejects unavailable effort', () => {
  const request = { input: [], configuration: { model: 'antigravity/gemini-test', reasoning: 'low', systemInstructions: { kind: 'provider-default' } }, toolPolicy: { kind: 'provider-default' }, signal: new AbortController().signal } as ProviderExecutionRequest;
  expect(buildAntigravityArgs(request, undefined, settings)).toContain('gemini-test-low');
  expect(() => buildAntigravityArgs({ ...request, configuration: { ...request.configuration, reasoning: 'max' } }, undefined, settings)).toThrow(/effort/i);
});
