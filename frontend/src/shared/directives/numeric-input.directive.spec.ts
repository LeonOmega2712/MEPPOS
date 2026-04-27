import { Component, viewChild, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NumericInputDirective, type NumericInputMode } from './numeric-input.directive';

@Component({
  imports: [NumericInputDirective],
  template: `
    <input
      #el
      type="text"
      [attr.min]="min"
      appNumericInput
      [mode]="mode"
      [maxDecimals]="maxDecimals"
    />
  `,
})
class HostComponent {
  mode: NumericInputMode = 'decimal';
  maxDecimals = 2;
  min: string | null = null;
  inputRef = viewChild.required<ElementRef<HTMLInputElement>>('el');
}

function setup(overrides: Partial<HostComponent> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  Object.assign(fixture.componentInstance, overrides);
  fixture.detectChanges();
  const input = fixture.componentInstance.inputRef().nativeElement;
  return { fixture, input };
}

function pressKey(input: HTMLInputElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
  input.dispatchEvent(event);
  return event;
}

function paste(input: HTMLInputElement, text: string): Event {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text' ? text : '') },
  });
  input.dispatchEvent(event);
  return event;
}

describe('NumericInputDirective', () => {
  describe('keydown filtering', () => {
    it('allows digits in both modes', () => {
      const { input } = setup({ mode: 'integer' });
      const event = pressKey(input, '5');
      expect(event.defaultPrevented).toBe(false);
    });

    it('blocks letters', () => {
      const { input } = setup();
      expect(pressKey(input, 'a').defaultPrevented).toBe(true);
      expect(pressKey(input, 'Z').defaultPrevented).toBe(true);
    });

    it('blocks scientific notation and signs', () => {
      const { input } = setup();
      for (const key of ['e', 'E', '+', '-']) {
        expect(pressKey(input, key).defaultPrevented).toBe(true);
      }
    });

    it('blocks comma in both modes', () => {
      const { input } = setup({ mode: 'decimal' });
      expect(pressKey(input, ',').defaultPrevented).toBe(true);
    });

    it('blocks period in integer mode', () => {
      const { input } = setup({ mode: 'integer' });
      expect(pressKey(input, '.').defaultPrevented).toBe(true);
    });

    it('allows period in decimal mode when none present', () => {
      const { input } = setup({ mode: 'decimal' });
      expect(pressKey(input, '.').defaultPrevented).toBe(false);
    });

    it('blocks second period in decimal mode', () => {
      const { input } = setup({ mode: 'decimal' });
      input.value = '12.';
      expect(pressKey(input, '.').defaultPrevented).toBe(true);
    });

    it('blocks digits past maxDecimals at end of value', () => {
      const { input } = setup({ mode: 'decimal', maxDecimals: 2 });
      input.value = '1.23';
      input.setSelectionRange(input.value.length, input.value.length);
      expect(pressKey(input, '4').defaultPrevented).toBe(true);
    });

    it('allows navigation and editing keys', () => {
      const { input } = setup();
      for (const key of ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'Home']) {
        expect(pressKey(input, key).defaultPrevented).toBe(false);
      }
    });

    it('does not block keys combined with modifiers (copy/paste shortcuts)', () => {
      const { input } = setup();
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('paste sanitization', () => {
    let input: HTMLInputElement;

    beforeEach(() => {
      ({ input } = setup({ mode: 'decimal', maxDecimals: 2 }));
    });

    it('extracts digits and one period from messy text', () => {
      const event = paste(input, 'abc12.5xyz');
      expect(event.defaultPrevented).toBe(true);
      expect(input.value).toBe('12.5');
    });

    it('drops empty paste without changing value', () => {
      input.value = '7';
      paste(input, 'abc');
      expect(input.value).toBe('7');
    });

    it('limits decimals to maxDecimals', () => {
      paste(input, '3.14159');
      expect(input.value).toBe('3.14');
    });

    it('keeps only the first period when multiple are pasted', () => {
      paste(input, '1.2.3');
      expect(input.value).toBe('1.23');
    });

    it('sanitizes integer mode by stripping all non-digits', () => {
      const setupResult = setup({ mode: 'integer' });
      paste(setupResult.input, 'a1b2.5c');
      expect(setupResult.input.value).toBe('125');
    });

    it('dispatches an input event so ngModel updates', () => {
      let count = 0;
      input.addEventListener('input', () => count++);
      paste(input, '7.5');
      expect(count).toBe(1);
    });
  });

  describe('compositionend (IME)', () => {
    it('sanitizes value committed by an IME', () => {
      const { input } = setup({ mode: 'decimal' });
      input.value = '12abc.5';
      input.dispatchEvent(new CompositionEvent('compositionend'));
      expect(input.value).toBe('12.5');
    });

    it('leaves clean values untouched', () => {
      const { input } = setup({ mode: 'decimal' });
      input.value = '12.5';
      input.dispatchEvent(new CompositionEvent('compositionend'));
      expect(input.value).toBe('12.5');
    });
  });

  describe('min handling', () => {
    it('clamps pasted value below the host min attribute', () => {
      const { input } = setup({ mode: 'integer', min: '5' });
      paste(input, '2');
      expect(input.value).toBe('5');
    });

    it('keeps value when above min', () => {
      const { input } = setup({ mode: 'integer', min: '5' });
      paste(input, '10');
      expect(input.value).toBe('10');
    });
  });
});
