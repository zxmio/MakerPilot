import { accessSync, constants, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { Setting } from 'obsidian';

import { normalizeConfiguredCLIPath } from '../../core/process/cliPath';
import { runProcessProbe } from '../../core/process/ProcessProbe';
import { CachedProviderCLIResolver } from '../../core/providers/cli/CachedProviderCLIResolver';
import { probeCLIInstallation } from '../../core/providers/cli/CLIInstallationProbe';
import { ProviderModelCatalogController } from '../../core/providers/models/ProviderModelCatalog';
import { getRuntimeEnvironmentText } from '../../core/providers/providerEnvironment';
import type { ProviderHost } from '../../core/providers/ProviderHost';
import { ProviderSettingsCoordinator } from '../../core/providers/ProviderSettingsCoordinator';
import type { ProviderWorkspaceServices } from '../../core/providers/types';
import { renderCLIInstallationSetting } from '../../shared/settings/CLIInstallationSetting';
import { renderEnvironmentSettingsSection } from '../../shared/settings/EnvironmentSettingsSection';
import { renderProviderModelsSection } from '../../shared/settings/ProviderModelsSection';
import { getVaultPath } from '../../utils/path';
import { buildAntigravityEnv } from './AntigravityExecutionBackend';
import { type AntigravityModel, getAntigravitySettings, parseAntigravityModels, updateAntigravitySettings } from './settings';

export function createAntigravityWorkspace(host: ProviderHost): ProviderWorkspaceServices {
  const cliResolver = new CachedProviderCLIResolver({
    binaryName: 'agy', providerId: 'antigravity',
    getSettingsProjection: settings => ({ cliPathsByHost: getAntigravitySettings(settings).cliPathsByHost, legacyCliPath: getAntigravitySettings(settings).cliPath, environmentText: getRuntimeEnvironmentText(settings, 'antigravity') }),
  });
  let discovered: AntigravityModel[] | null = null;
  const catalog = new ProviderModelCatalogController({
    host, providerId: 'antigravity', providerName: 'Gemini',
    read: (settings = host.settings) => {
      const current = getAntigravitySettings(settings);
      return { enabled: current.enabled, models: discovered ?? current.selectedModels, selectedIds: current.visibleModels, aliases: current.modelAliases };
    },
    update(settings, patch) {
      const current = getAntigravitySettings(settings);
      const ids = patch.visibleModels ?? current.visibleModels;
      const models = new Map([...current.selectedModels, ...(discovered ?? [])].map(model => [model.id, model]));
      updateAntigravitySettings(settings, { ...patch, selectedModels: ids.flatMap(id => models.has(id) ? [models.get(id)!] : []) });
    },
    discover: async signal => {
      const command = cliResolver.resolveFromSettings(host.settings);
      if (!command) throw new Error('Install Antigravity CLI and sign in with agy in a terminal first.');
      const output = await runProcessProbe({ command, args: ['models'], cwd: getVaultPath(host.app) ?? process.cwd(), env: buildAntigravityEnv(host.settings, command) }, 30_000);
      if (signal.aborted) return { changed: false };
      if (output === null) throw new Error('Could not read Antigravity models. Run agy models in a terminal to check login and network access.');
      const models = parseAntigravityModels(output);
      if (!models.length) throw new Error('Antigravity returned no models. Check the CLI version and account access.');
      discovered = models;
      await host.mutateSettings(settings => {
        const current = getAntigravitySettings(settings);
        const previous = new Map(current.selectedModels.map(model => [model.id, model]));
        for (const model of models) previous.set(model.id, model);
        updateAntigravitySettings(settings, { selectedModels: current.visibleModels.flatMap(id => previous.has(id) ? [previous.get(id)!] : []) });
      });
      return { changed: true };
    },
  });
  const unregister = host.executionLifecycleRegistry.registerTransitionHook('antigravity', {
    beforeTransition: async () => { catalog.beginTransition(); await catalog.quiesce(); },
    afterTransition: async () => { cliResolver.reset(); discovered = null; catalog.endTransition(); },
  });
  return {
    cliResolver, modelCatalog: catalog,
    settingsTabRenderer: { render(container, context) {
      const hostname = host.storage.installationKey;
      const warning = container.createDiv({ attr: { role: 'status' } });
      new Setting(container).setName('Google account').setDesc('Uses your existing Google sign-in through the official CLI. Run agy in a terminal to sign in. No API key is required.');
      renderCLIInstallationSetting({
        container, cliName: 'Antigravity CLI', name: 'CLI path',
        getValue: () => getAntigravitySettings(host.settings).cliPathsByHost[hostname] ?? '',
        placeholder: '/path/to/agy', validate: value => {
          if (!value.trim()) return null;
          const path = normalizeConfiguredCLIPath(value.trim());
          if (!isAbsolute(path)) return 'Choose an absolute CLI path.';
          try {
            if (!statSync(path).isFile()) return 'Choose a CLI executable file.';
            accessSync(path, process.platform === 'win32' ? constants.R_OK : constants.X_OK);
            return null;
          } catch { return 'The CLI path does not exist or is not executable.'; }
        },
        onChange: async value => {
          await host.applyProviderRuntimeSettings(['antigravity'], settings => {
            const paths = { ...getAntigravitySettings(settings).cliPathsByHost };
            if (value.trim()) paths[hostname] = value.trim(); else delete paths[hostname];
            updateAntigravitySettings(settings, { cliPathsByHost: paths });
          }, () => cliResolver.reset());
        },
        inspect: async () => probeCLIInstallation({ path: cliResolver.resolveFromSettings(host.settings), configuredPath: getAntigravitySettings(host.settings).cliPathsByHost[hostname] ?? '', args: ['--version'], env: buildAntigravityEnv(host.settings, cliResolver.resolveFromSettings(host.settings) ?? '') }),
        enablement: {
          name: 'Enable Gemini', getValue: () => getAntigravitySettings(host.settings).enabled,
          onChange: async enabled => {
            let accepted = false;
            await host.runProviderExecutionTransition(['antigravity'], async () => host.mutateSettings(settings => { accepted = ProviderSettingsCoordinator.applyProviderEnablement(settings, 'antigravity', enabled); }));
            warning.setText(accepted ? '' : 'At least one provider must remain enabled.');
            context.notifyProviderModelOptionsChanged('antigravity');
          },
        },
      });
      new Setting(container).setName('Models').setHeading();
      const models = renderProviderModelsSection(container, 'antigravity', 'Gemini', catalog);
      new Setting(container).setName('Permissions and supported features').setDesc('CLI rules is the default: actions requiring interactive approval are denied by the CLI. Other permission modes require explicit selection. Images are read through native file tools. Conversation rewind and forks replay the selected history in a new session; files are not reverted. Effort uses the model picker slider. Restricted auxiliary operations are unavailable.');
      renderEnvironmentSettingsSection({ container, plugin: host, scope: 'provider:antigravity', heading: 'Environment', name: 'Custom variables', desc: 'Optional CLI environment overrides. Google authentication remains managed by the CLI.', placeholder: 'PATH=/path/to/bin' });
      return models;
    } },
    async dispose() { unregister(); await catalog.dispose(); },
  };
}
