/** @jest-environment jsdom */

import { GEMINI_ICON } from '@/providers/antigravity/GeminiIcon';
import {
  createProviderIconSvg,
  OPENAI_PROVIDER_ICON,
  OPENCODE_PROVIDER_ICON,
  PI_PROVIDER_ICON,
} from '@/shared/icons';

describe('createProviderIconSvg', () => {
  afterEach(() => document.body.replaceChildren());

  it('keeps each Gemini instance bound to its own gradients when another menu is hidden or removed', () => {
    const source = JSON.stringify(GEMINI_ICON);
    const hiddenMenu = document.createElement('div');
    hiddenMenu.style.display = 'none';
    document.body.appendChild(hiddenMenu);
    createProviderIconSvg(GEMINI_ICON, { parent: hiddenMenu });
    const visible = createProviderIconSvg(GEMINI_ICON, { parent: document.body });
    const assertLocalGradients = () => {
      const fills = Array.from(visible.querySelectorAll('path'))
        .map(path => /^url\(#(.+)\)$/u.exec(path.getAttribute('fill') ?? '')?.[1])
        .filter((id): id is string => !!id);
      expect(fills).toHaveLength(3);
      for (const id of fills) {
        const resolved = document.getElementById(id);
        expect(resolved?.closest('svg')).toBe(visible);
      }
    };
    assertLocalGradients();
    hiddenMenu.remove();
    assertLocalGradients();
    // Re-rendering another toolbar cannot steal the visible icon's paint servers.
    createProviderIconSvg(GEMINI_ICON, { parent: document.body });
    assertLocalGradients();
    expect(JSON.stringify(GEMINI_ICON)).toBe(source);
  });
  it('keeps the local Gemini icon colors and gradient definitions', () => {
    const svg = createProviderIconSvg(GEMINI_ICON, { parent: document.body });
    expect(svg.querySelectorAll('linearGradient')).toHaveLength(3);
    expect(svg.querySelectorAll('stop').length).toBeGreaterThan(3);
    const paths = Array.from(svg.querySelectorAll('path'));
    expect(paths).toHaveLength(4);
    expect(paths.some(path => path.getAttribute('fill') === 'currentColor')).toBe(false);
    const gradients = paths.flatMap(path => /^url\(#(.+)\)$/u.exec(path.getAttribute('fill') ?? '')?.[1] ?? []);
    expect(gradients).toHaveLength(3);
    for (const id of gradients) expect(svg.querySelector(`[id="${id}"]`)).not.toBeNull();
  });

  it('renders path-based provider icons with currentColor fill', () => {
    const svg = createProviderIconSvg(OPENAI_PROVIDER_ICON, {
      className: 'test-icon',
      height: 12,
      parent: document.body,
      width: 12,
    });

    expect(svg.getAttribute('viewBox')).toBe(OPENAI_PROVIDER_ICON.viewBox);
    expect(svg.getAttribute('width')).toBe('12');
    expect(svg.getAttribute('height')).toBe('12');
    expect(svg.classList.contains('claudian-provider-icon')).toBe(true);
    expect(svg.classList.contains('test-icon')).toBe(true);

    const path = svg.querySelector('path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('fill')).toBe('currentColor');
  });

  it('renders composite provider icons with theme variants', () => {
    const svg = createProviderIconSvg(OPENCODE_PROVIDER_ICON, {
      dataProvider: 'opencode',
      height: 18,
      parent: document.body,
      width: 18,
    });

    expect(svg.getAttribute('data-provider')).toBe('opencode');
    expect(svg.getAttribute('viewBox')).toBe(OPENCODE_PROVIDER_ICON.viewBox);
    expect(svg.querySelector('.claudian-provider-icon-variant--light')).not.toBeNull();
    expect(svg.querySelector('.claudian-provider-icon-variant--dark')).not.toBeNull();
  });

  it('renders the Pi provider icon as currentColor composite paths', () => {
    const svg = createProviderIconSvg(PI_PROVIDER_ICON, {
      dataProvider: 'pi',
      parent: document.body,
    });

    expect(svg.getAttribute('viewBox')).toBe('0 0 800 800');
    const paths = Array.from(svg.querySelectorAll('path'));
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute('fill-rule')).toBe('evenodd');
    expect(paths.every(path => path.getAttribute('fill') === 'currentColor')).toBe(true);
  });
});
