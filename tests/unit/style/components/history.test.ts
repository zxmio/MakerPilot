/** @jest-environment jsdom */

import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('History menu styles', () => {
  it('keeps the archive switch as a footer the list never covers', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync(path.resolve('src/style/components/history.css'), 'utf8');
    document.head.appendChild(style);
    const menu = document.body.appendChild(document.createElement('div'));
    menu.className = 'claudian-history-menu claudian-nav-dropup-menu visible';
    const list = menu.appendChild(document.createElement('div'));
    list.className = 'claudian-history-list';
    const footer = menu.appendChild(document.createElement('div'));
    footer.className = 'claudian-history-archive-control';

    // The list fills what the bounded menu leaves around the search field and the footer instead of a
    // fixed height of its own, so neither its end nor the footer is cut off by the menu.
    expect(getComputedStyle(menu).display).toBe('flex');
    expect(getComputedStyle(menu).flexDirection).toBe('column');
    expect(getComputedStyle(list).maxHeight).toBe('none');
    expect(getComputedStyle(list).minHeight).toBe('0');
    expect(getComputedStyle(footer).flexShrink).toBe('0');
  });
});
