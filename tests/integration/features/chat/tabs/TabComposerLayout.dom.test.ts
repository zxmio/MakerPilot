/** @jest-environment jsdom */
import '@/providers';

import { holdResponse } from '@test/helpers/ConversationPorts';
import { installSessionRuntimePool } from '@test/helpers/features/chat/SessionRuntimePoolHarness';
import { createHarness, releaseSideChatHarnesses } from '@test/helpers/features/chat/SideChatDOMHarness';
import { fireEvent, waitFor, within } from '@testing-library/dom';
import { axe } from 'jest-axe';
import { App, Component, TFile } from 'obsidian';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import type { Conversation, UsageInfo } from '@/core/types';
import type { ChatFeatureHost } from '@/features/chat/ChatFeatureHost';
import { destroyTab } from '@/features/chat/tabs/TabLifecycle';
import { createTabRuntime } from '@/features/chat/tabs/TabRuntimeFactory';
import type { AssembledTabRuntime } from '@/features/chat/tabs/types';
import { VaultMentionDataProvider } from '@/shared/mention/VaultMentionDataProvider';

const originalResizeObserver = globalThis.ResizeObserver;
beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  globalThis.ResizeObserver = originalResizeObserver;
  jest.restoreAllMocks();
  await releaseSideChatHarnesses();
});

const note = Object.assign(new TFile(), {
  path: 'Notes/Plan.md', name: 'Plan.md', basename: 'Plan', extension: 'md',
});

let lastApp: App;

async function createTab(linkedContentPath?: string): Promise<AssembledTabRuntime> {
  const harness = createHarness();
  const app = new App();
  lastApp = app;
  Object.assign(app.vault.adapter, { basePath: '/vault' });
  Object.assign(app.vault, {
    on: () => ({}),
    offref: () => undefined,
    getAbstractFileByPath: (path: string) => (path === note.path ? note : null),
  });
  const conversation = {
    id: 'conversation-1', providerId: 'claude', selectedModel: 'claude-sonnet-4-5',
    sessionId: 'main-session', messages: harness.tab.state.messages,
    ...(linkedContentPath ? { linkedContentPath } : {}),
  } as Conversation;
  const plugin = {
    ...(harness.plugin as ChatFeatureHost),
    app,
    getCommittedSettings: () => plugin.settings,
    settings: {
      model: 'claude-sonnet-4-5', effortLevel: 'high', permissionMode: 'normal',
      providerConfigs: { claude: { enabled: true, visibleModels: ['claude-sonnet-4-5'],
        discoveredModels: [{ value: 'claude-sonnet-4-5', label: 'Sonnet', supportedEffortLevels: ['low', 'high'] }] } },
    },
    getActiveEnvironmentVariables: () => '',
    getConversationSummary: () => conversation,
    getConversationSync: () => conversation,
    getConversationList: () => [conversation],
  } as unknown as ChatFeatureHost;
  if (!plugin.sessionRuntimes) installSessionRuntimePool(plugin);
  const tab = await createTabRuntime({
    plugin,
    component: Object.assign(new Component(), { registerDomEvent: () => undefined, registerEvent: () => undefined }) as never,
    containerEl: document.body.appendChild(document.createElement('div')),
    conversation,
    getProviderCatalogConfig: () => null,
    isRuntimeLive: () => true,
    openConversation: async () => {}, startNewConversation: async () => {},
    mentionDataProvider: new VaultMentionDataProvider(app),
  });
  tab.state.messages = conversation.messages;
  return tab;
}

function infoRowOf(tab: AssembledTabRuntime): HTMLElement {
  // The linked note is a chip inside the input box, after the per-turn context and before the editor.
  const row = tab.dom.contextRowEl.nextElementSibling as HTMLElement | null;
  expect(row?.parentElement).toBe(tab.dom.inputWrapper);
  expect(row?.nextElementSibling).toBe(tab.dom.inputEl);
  return row!;
}

const usage = (percentage: number): UsageInfo => ({
  model: 'claude-sonnet-4-5', inputTokens: percentage * 2000, cacheCreationInputTokens: 0, cacheReadInputTokens: 0,
  contextTokens: percentage * 2000, contextWindow: 200000, percentage,
});

it('attaches a queued follow-up to the top of the input box, under the tab bar', async () => {
  const tab = await createTab();
  try {
    const box = within(tab.dom.inputWrapper);
    expect(box.queryByRole('button', { name: 'Discard queued message' })).toBeNull();

    jest.spyOn(ProviderRegistry, 'getCapabilities').mockReturnValue({
      ...ProviderRegistry.getCapabilities('claude'), supportsTurnSteer: true,
    });
    const releaseTurn = holdResponse(tab.session.turns);
    tab.controllers.inputController.queue.enqueue({
      content: 'also add a created date', turnRequest: { text: 'also add a created date' },
    });

    const strip = tab.dom.queueIndicatorEl;
    expect(strip.parentElement).toBe(tab.dom.inputWrapper);
    expect(tab.dom.inputWrapper.firstElementChild).toBe(strip);
    expect(tab.dom.navRowEl.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strip.classList.contains('claudian-hidden')).toBe(false);
    expect(within(strip).getByText('Queued')).toBeDefined();
    expect(within(strip).getByText('also add a created date')).toBeDefined();
    expect(box.getByRole('button', { name: 'Steer Now' })).toBeDefined();
    expect(box.getByRole('button', { name: 'Discard queued message' })).toBeDefined();
    expect(await axe(strip)).toHaveNoViolations();

    fireEvent.click(box.getByRole('button', { name: 'Edit queued message' }));
    expect(tab.state.queuedMessage).toBeNull();
    expect(strip.classList.contains('claudian-hidden')).toBe(true);
    expect(box.queryByRole('button', { name: 'Edit queued message' })).toBeNull();
    expect(tab.dom.inputEl.value).toBe('also add a created date');
    await releaseTurn();
  } finally {
    await destroyTab(tab);
  }
});

it('shows the linked note as a chip inside the input box', async () => {
  const tab = await createTab(note.path);
  try {
    const row = infoRowOf(tab);
    const info = within(row);
    const linked = info.getByRole('button', { name: 'Linked content: Notes/Plan.md' });
    expect(linked.textContent).toBe('Plan');
    // Locked after the first message: shown, activatable, not removable.
    expect(info.queryByRole('button', { name: /^Remove/ })).toBeNull();
    // The per-turn context tray stays separate from the linked note.
    expect(within(tab.dom.contextRowEl).queryByRole('button', { name: /Linked content/ })).toBeNull();

    tab.state.usage = usage(42);
    expect(info.queryByRole('progressbar')).toBeNull();
    expect(await axe(row)).toHaveNoViolations();
  } finally {
    await destroyTab(tab);
  }
});

it('shows context usage in the toolbar next to the model picker', async () => {
  const tab = await createTab();
  try {
    const row = infoRowOf(tab);

    tab.state.usage = usage(42);
    const toolbar = tab.dom.inputWrapper.querySelector<HTMLElement>(':scope > .claudian-input-toolbar')!;
    const meter = within(toolbar).getByRole('progressbar', { name: 'Context usage: 42% · 84k / 200k' });
    const modelAnchor = toolbar.querySelector('.claudian-toolbar-chip-anchor--model');
    expect(modelAnchor?.nextElementSibling).toBe(meter);
    expect(within(row).queryByRole('progressbar')).toBeNull();
  } finally {
    await destroyTab(tab);
  }
});

it('opens an attach popover above the toolbar start for uploading, images and vault mentions', async () => {
  jest.spyOn(ProviderRegistry, 'getCapabilities').mockReturnValue({
    ...ProviderRegistry.getCapabilities('claude'), supportsImageAttachments: true,
  });
  const tab = await createTab();
  try {
    const toolbar = tab.dom.inputWrapper.querySelector<HTMLElement>(':scope > .claudian-input-toolbar')!;
    const attach = within(toolbar).getByRole('button', { name: 'Add attachment' });
    expect(toolbar.firstElementChild?.contains(attach)).toBe(true);
    expect(attach.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(attach);
    const menu = within(toolbar).getByRole('menu', { name: 'Add attachment' });
    expect(attach.getAttribute('aria-expanded')).toBe('true');
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      expect.stringContaining('Upload file'),
      expect.stringContaining('Add image'),
      expect.stringContaining('Mention a vault file'),
    ]);
    expect(await axe(toolbar.firstElementChild as HTMLElement)).toHaveNoViolations();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(within(toolbar).queryByRole('menu')).toBeNull();

    // Uploading copies the file into the vault's attachment folder and references its path.
    const app = lastApp as unknown as { vault: Record<string, unknown>; fileManager: Record<string, unknown> };
    const createBinary = jest.fn(async () => undefined);
    Object.assign(app.vault, { createBinary });
    app.fileManager = { getAvailablePathForAttachment: jest.fn(async (name: string) => `Attachments/${name}`) };
    const uploadPicker = toolbar.querySelector<HTMLInputElement>('input[type="file"]:not([accept])')!;
    const report = new File([new Uint8Array([1, 2, 3])], 'report.pdf', { type: 'application/pdf' });
    Object.defineProperty(report, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });
    Object.defineProperty(uploadPicker, 'files', { configurable: true, value: [report] });
    fireEvent.change(uploadPicker);
    await waitFor(() => expect(tab.dom.inputEl.value).toContain('[[Attachments/report.pdf|report.pdf]]'));
    expect(createBinary).toHaveBeenCalledWith('Attachments/report.pdf', expect.any(ArrayBuffer));

    // Images still go to the model as image attachments.
    const imagePicker = toolbar.querySelector<HTMLInputElement>('input[type="file"][accept]')!;
    const image = new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' });
    Object.defineProperty(image, 'arrayBuffer', { value: async () => new Uint8Array([137, 80, 78, 71]).buffer });
    Object.defineProperty(imagePicker, 'files', { configurable: true, value: [image] });
    fireEvent.change(imagePicker);
    await waitFor(() => expect(tab.ui.imageContextManager.getAttachedImages()
      .map(attachment => [attachment.name, attachment.source])).toEqual([['shot.png', 'file']]));

    fireEvent.click(attach);
    fireEvent.click(within(toolbar).getByRole('menuitem', { name: /Mention a vault file/ }));
    expect(tab.dom.inputEl.value.endsWith('@')).toBe(true);
    expect(within(toolbar).queryByRole('menu')).toBeNull();
  } finally {
    await destroyTab(tab);
  }
});
