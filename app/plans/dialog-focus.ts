// Keeps keyboard focus inside a modal dialog (docs/11 Dialogs). Pure so the wrap rule is testable.

/**
 * Where Tab or Shift+Tab should go from `current` among `count` focusable elements.
 * Returns the index to focus, or null when the browser's normal move stays inside the dialog.
 * `current` is -1 when focus is outside the dialog, which always pulls focus back in.
 */
export function nextFocusIndex(count: number, current: number, shift: boolean): number | null {
  if (count <= 0) return null;
  if (current < 0) return shift ? count - 1 : 0;
  if (shift && current === 0) return count - 1;
  if (!shift && current === count - 1) return 0;
  return null;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Applies the wrap rule to a Tab key event inside `dialog`. */
export function trapTab(event: KeyboardEvent, dialog: HTMLElement): void {
  if (event.key !== "Tab") return;
  const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
  const next = nextFocusIndex(items.length, items.indexOf(document.activeElement as HTMLElement), event.shiftKey);
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
}
