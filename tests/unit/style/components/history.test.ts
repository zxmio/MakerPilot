/** @jest-environment jsdom */

import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('History menu styles', () => {
  it('keeps the archive switch reachable at the bottom of a long list', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync(path.resolve('src/style/components/history.css'), 'utf8');
    document.head.appendChild(style);
    const menu = document.body.appendChild(document.createElement('div'));
    menu.className = 'claudian-history-menu claudian-nav-dropup-menu visible';
    const list = menu.appendChild(document.createElement('div'));
    list.className = 'claudian-history-list';
    const control = list.appendChild(document.createElement('div'));
    control.className = 'claudian-history-archive-control';

    // The list fills what the bounded menu leaves below the search field instead of its own fixed height,
    // so its end is never cut off by the menu.
    expect(getComputedStyle(menu).display).toBe('flex');
    expect(getComputedStyle(menu).flexDirection).toBe('column');
    expect(getComputedStyle(list).maxHeight).toBe('none');
    expect(getComputedStyle(list).minHeight).toBe('0');
    // Switching between active and archived sessions stays in view while the list scrolls.
    expect(getComputedStyle(control).position).toBe('sticky');
    expect(getComputedStyle(control).bottom).toBe('0px');
  });
});
