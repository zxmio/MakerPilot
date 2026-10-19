import { createMockEl } from '@test/helpers/MockElement';
import { setIcon } from 'obsidian';

import type { TodoItem } from '@/core/tools/todo';
import { renderTodoWriteContent } from '@/features/chat/rendering/tools/todoContent';

jest.mock('obsidian', () => ({
  setIcon: jest.fn(),
}));

describe('todoContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('renderTodoWriteContent', () => {
    it('should render todo items with status icons and text', () => {
      const container = createMockEl();
      const todos: TodoItem[] = [
        { status: 'completed', content: 'Task 1', activeForm: 'Doing Task 1' },
        { status: 'in_progress', content: 'Task 2', activeForm: 'Doing Task 2' },
        { status: 'pending', content: 'Task 3', activeForm: 'Doing Task 3' },
      ];

      renderTodoWriteContent(container as unknown as HTMLElement, { todos });

      // A progress bar leads the list: one of three tasks completed.
      const progress = container._children[0];
      expect(progress.getAttribute('role')).toBe('progressbar');
      expect([progress.getAttribute('aria-valuenow'), progress.getAttribute('aria-valuemax')]).toEqual(['1', '3']);
      expect(container._children.length).toBe(4);
      expect(setIcon).toHaveBeenCalledTimes(3);

      const expected = [
        { status: 'completed', icon: 'circle-check', text: 'Task 1' },
        { status: 'in_progress', icon: 'loader-circle', text: 'Doing Task 2' },
        { status: 'pending', icon: 'circle', text: 'Task 3' },
      ];
      expected.forEach(({ status, icon, text }, index) => {
        const item = container._children[index + 1];
        expect(item.hasClass(`claudian-todo-${status}`)).toBe(true);
        expect(setIcon).toHaveBeenNthCalledWith(index + 1, item._children[0], icon);
        expect(item._children[1].textContent).toBe(text);
      });
    });

    it('should clear container before rendering', () => {
      const container = createMockEl();
      container.createDiv({ text: 'old content' });

      renderTodoWriteContent(container as unknown as HTMLElement, {
        todos: [{ status: 'completed', content: 'New', activeForm: 'New' }],
      });

      // Old content cleared; the progress bar and the one task remain.
      expect(container._children.length).toBe(2);
    });

    it('should handle empty todos array', () => {
      const container = createMockEl();
      renderTodoWriteContent(container as unknown as HTMLElement, { todos: [] });
      expect(container._children.length).toBe(0);
    });

    it('should set aria-hidden on status icon', () => {
      const container = createMockEl();
      renderTodoWriteContent(container as unknown as HTMLElement, {
        todos: [{ status: 'completed', content: 'Task', activeForm: 'Task' }],
      });

      const item = container._children[1];
      const icon = item._children[0];
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
