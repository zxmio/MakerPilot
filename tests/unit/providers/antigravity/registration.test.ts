import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { setLocale } from '@/i18n/i18n';

it('resolves Gemini permission labels in the interface language without changing mode values', () => {
  const ui = ProviderRegistry.getChatUIConfig('antigravity');
  const english = ui.getPermissionModeOptions?.({}) ?? [];
  setLocale('zh-CN');
  try {
    const translated = ui.getPermissionModeOptions?.({}) ?? [];
    expect(translated.map(option => option.label)).toEqual(['CLI 规则', '接受编辑', 'YOLO']);
    expect(translated.map(option => option.value)).toEqual(english.map(option => option.value));
    expect(translated.map(option => option.description)).toEqual(['沿用 CLI 的权限规则', '自动接受所有文件编辑', '无需询问，允许所有操作']);
    expect(translated[2].bypassesApprovals).toBe(true);
  } finally {
    setLocale('en');
  }
  expect(ui.getPermissionModeOptions?.({})).toEqual(english);
});
