import { Component, viewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { CurrencyInputDirective } from './currency-input.directive';

@Component({
  imports: [FormsModule, CurrencyInputDirective],
  template: `<input #el type="text" appCurrencyInput [(ngModel)]="value" />`,
})
class HostComponent {
  value: number | null = null;
  inputRef = viewChild.required<ElementRef<HTMLInputElement>>('el');
}

async function setup(initial: number | null = null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.value = initial;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const input = fixture.componentInstance.inputRef().nativeElement;
  return { fixture, input };
}

function typeChar(input: HTMLInputElement, ch: string): void {
  input.value = input.value + ch;
  input.setSelectionRange(input.value.length, input.value.length);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function typeCharAt(input: HTMLInputElement, ch: string, position: number): void {
  const value = input.value;
  input.value = value.slice(0, position) + ch + value.slice(position);
  input.setSelectionRange(position + 1, position + 1);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function backspaceAt(input: HTMLInputElement, position: number): void {
  const value = input.value;
  input.value = value.slice(0, position - 1) + value.slice(position);
  input.setSelectionRange(position - 1, position - 1);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function pressDeleteOrBackspace(
  input: HTMLInputElement,
  key: 'Delete' | 'Backspace',
  position: number,
): KeyboardEvent {
  input.setSelectionRange(position, position);
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  input.dispatchEvent(event);
  if (!event.defaultPrevented) {
    const targetIndex = key === 'Backspace' ? position - 1 : position;
    if (targetIndex >= 0 && targetIndex < input.value.length) {
      input.value = input.value.slice(0, targetIndex) + input.value.slice(targetIndex + 1);
      const newCursor = key === 'Backspace' ? targetIndex : position;
      input.setSelectionRange(newCursor, newCursor);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  return event;
}

function pasteRaw(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function backspace(input: HTMLInputElement): void {
  input.value = input.value.slice(0, -1);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('CurrencyInputDirective', () => {
  describe('writeValue (model → display)', () => {
    it('renders empty for null', async () => {
      const { input } = await setup(null);
      expect(input.value).toBe('');
    });

    it('renders 12.34 for value 12.34', async () => {
      const { input } = await setup(12.34);
      expect(input.value).toBe('12.34');
    });

    it('renders empty for 0 (no value entered)', async () => {
      const { input } = await setup(0);
      expect(input.value).toBe('');
    });

    it('renders 0.50 for value 0.5', async () => {
      const { input } = await setup(0.5);
      expect(input.value).toBe('0.50');
    });
  });

  describe('typing (cents-rolling)', () => {
    it('rolls digits in from the right: "1" → "0.01"', async () => {
      const { input } = await setup(null);
      typeChar(input, '1');
      expect(input.value).toBe('0.01');
    });

    it('progresses through 0.01 → 0.12 → 1.23 → 12.34', async () => {
      const { fixture, input } = await setup(null);
      typeChar(input, '1');
      expect(input.value).toBe('0.01');
      typeChar(input, '2');
      expect(input.value).toBe('0.12');
      typeChar(input, '3');
      expect(input.value).toBe('1.23');
      typeChar(input, '4');
      expect(input.value).toBe('12.34');
      await fixture.whenStable();
      expect(fixture.componentInstance.value).toBe(12.34);
    });

    it('places caret at end after typing at end', async () => {
      const { input } = await setup(null);
      typeChar(input, '1');
      typeChar(input, '2');
      expect(input.selectionStart).toBe(input.value.length);
      expect(input.selectionEnd).toBe(input.value.length);
    });

    it('preserves caret position when typing in the middle', async () => {
      const { input } = await setup(12.34);
      // value: "12.34", cursor between "1" and "2" → position 1
      typeCharAt(input, '5', 1);
      expect(input.value).toBe('152.34');
      // caret should now sit right after the "5" the user typed → position 2
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
    });

    it('lets the user type repeatedly at the same logical position', async () => {
      const { input } = await setup(12.34);
      typeCharAt(input, '5', 1); // 12.34 → 152.34, caret at 2
      typeCharAt(input, '6', 2); // 152.34 → 1562.34, caret at 3
      expect(input.value).toBe('1562.34');
      expect(input.selectionStart).toBe(3);
    });

    it('preserves caret position after backspace in the middle', async () => {
      const { input } = await setup(123.45);
      // value: "123.45", cursor between "2" and "3" → position 2
      backspaceAt(input, 2);
      expect(input.value).toBe('13.45');
      // there was 1 digit left of cursor → caret at position 1 (after "1")
      expect(input.selectionStart).toBe(1);
    });

    it('places caret at end when typing into empty input', async () => {
      const { input } = await setup(null);
      typeCharAt(input, '5', 0);
      expect(input.value).toBe('0.05');
      expect(input.selectionStart).toBe(input.value.length);
    });

    it('places caret right after typed digit when typing at the very start of an existing value', async () => {
      const { input } = await setup(12.34);
      // value: "12.34", cursor at start (position 0)
      typeCharAt(input, '5', 0);
      expect(input.value).toBe('512.34');
      expect(input.selectionStart).toBe(1);
    });

    it('caps at MAX_CENTS for absurd inputs', async () => {
      const { input } = await setup(null);
      pasteRaw(input, '99999999999');
      expect(input.value).toBe('999999.99');
    });
  });

  describe('paste sanitization', () => {
    it('extracts digits from messy text and re-formats', async () => {
      const { input } = await setup(null);
      pasteRaw(input, 'abc12.50xyz');
      expect(input.value).toBe('12.50');
    });

    it('emits null for non-digit-only paste', async () => {
      const { fixture, input } = await setup(null);
      pasteRaw(input, 'abcdef');
      await fixture.whenStable();
      expect(input.value).toBe('');
      expect(fixture.componentInstance.value).toBeNull();
    });

    it('emits 12.5 for paste of "12.50"', async () => {
      const { fixture, input } = await setup(null);
      pasteRaw(input, '12.50');
      await fixture.whenStable();
      expect(fixture.componentInstance.value).toBe(12.5);
    });
  });

  describe('backspace (clearing)', () => {
    it('rolls digits out: "12.34" → "1.23" → "0.12" → "0.01" → ""', async () => {
      const { fixture, input } = await setup(12.34);
      backspace(input);
      expect(input.value).toBe('1.23');
      backspace(input);
      expect(input.value).toBe('0.12');
      backspace(input);
      expect(input.value).toBe('0.01');
      backspace(input);
      expect(input.value).toBe('');
      await fixture.whenStable();
      expect(fixture.componentInstance.value).toBeNull();
    });

    it('select-all + backspace clears to null', async () => {
      const { fixture, input } = await setup(45.67);
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      expect(input.value).toBe('');
      expect(fixture.componentInstance.value).toBeNull();
    });
  });

  describe('Delete / Backspace at non-digit positions (ATM-style fallback)', () => {
    it('Delete on the "." drops the leftmost digit (1.56 → 0.56)', async () => {
      const { fixture, input } = await setup(1.56);
      // value: "1.56", cursor between "1" and "." → position 1 (on the ".")
      const event = pressDeleteOrBackspace(input, 'Delete', 1);
      expect(event.defaultPrevented).toBe(true);
      expect(input.value).toBe('0.56');
      await fixture.whenStable();
      expect(fixture.componentInstance.value).toBe(0.56);
    });

    it('Delete from the end keeps shrinking from the left (12.34 → 2.34 → 0.34 → 0.04 → empty)', async () => {
      const { fixture, input } = await setup(12.34);
      pressDeleteOrBackspace(input, 'Delete', input.value.length);
      expect(input.value).toBe('2.34');
      pressDeleteOrBackspace(input, 'Delete', input.value.length);
      expect(input.value).toBe('0.34');
      pressDeleteOrBackspace(input, 'Delete', input.value.length);
      expect(input.value).toBe('0.04');
      pressDeleteOrBackspace(input, 'Delete', input.value.length);
      expect(input.value).toBe('');
      await fixture.whenStable();
      expect(fixture.componentInstance.value).toBeNull();
    });

    it('reproduces the original bug scenario: 1234.56 + Delete×6 from position 1', async () => {
      const { input } = await setup(1234.56);
      pressDeleteOrBackspace(input, 'Delete', 1);
      expect(input.value).toBe('134.56');
      pressDeleteOrBackspace(input, 'Delete', 1);
      expect(input.value).toBe('14.56');
      pressDeleteOrBackspace(input, 'Delete', 1);
      expect(input.value).toBe('1.56');
      pressDeleteOrBackspace(input, 'Delete', 1);
      expect(input.value).toBe('0.56');
      pressDeleteOrBackspace(input, 'Delete', input.value.length);
      expect(input.value).toBe('0.06');
      pressDeleteOrBackspace(input, 'Delete', input.value.length);
      expect(input.value).toBe('');
    });

    it('Backspace on the "." drops the rightmost digit (1.56 → 0.15)', async () => {
      const { fixture, input } = await setup(1.56);
      // value: "1.56", cursor between "." and "5" → position 2 (Backspace targets ".")
      const event = pressDeleteOrBackspace(input, 'Backspace', 2);
      expect(event.defaultPrevented).toBe(true);
      expect(input.value).toBe('0.15');
      await fixture.whenStable();
      expect(fixture.componentInstance.value).toBe(0.15);
    });

    it('Backspace at the very start shrinks from the right (12.34 → 1.23)', async () => {
      const { input } = await setup(12.34);
      pressDeleteOrBackspace(input, 'Backspace', 0);
      expect(input.value).toBe('1.23');
    });

    it('Delete on a digit defers to the browser (preserves middle-edit behavior)', async () => {
      const { input } = await setup(12.34);
      const event = pressDeleteOrBackspace(input, 'Delete', 1);
      expect(event.defaultPrevented).toBe(false);
      expect(input.value).toBe('1.34');
    });

    it('Backspace on a digit defers to the browser (preserves middle-edit behavior)', async () => {
      const { input } = await setup(12.34);
      const event = pressDeleteOrBackspace(input, 'Backspace', 2);
      expect(event.defaultPrevented).toBe(false);
      expect(input.value).toBe('1.34');
    });
  });

  describe('ngModel integration', () => {
    it('writes back to the model on every change', async () => {
      const { fixture, input } = await setup(null);
      typeChar(input, '5');
      await fixture.whenStable();
      expect(fixture.componentInstance.value).toBe(0.05);
      typeChar(input, '0');
      await fixture.whenStable();
      expect(fixture.componentInstance.value).toBe(0.5);
    });

    it('reflects programmatic writeValue calls on the directive', async () => {
      const { fixture, input } = await setup(null);
      const directive = fixture.debugElement
        .query(By.directive(CurrencyInputDirective))
        .injector.get(CurrencyInputDirective);
      directive.writeValue(99.99);
      expect(input.value).toBe('99.99');
      directive.writeValue(null);
      expect(input.value).toBe('');
    });
  });
});
