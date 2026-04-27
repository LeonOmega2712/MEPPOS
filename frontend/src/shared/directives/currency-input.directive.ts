import {
  Directive,
  ElementRef,
  HostListener,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const MAX_CENTS = 99_999_999;

@Directive({
  selector: 'input[appCurrencyInput]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyInputDirective),
      multi: true,
    },
  ],
})
export class CurrencyInputDirective implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number | null): void {
    const cents = this.toCents(value);
    this.render(cents);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.host.nativeElement.disabled = isDisabled;
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const input = this.host.nativeElement;
    const value = input.value;
    if (!value) return;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    if (start !== end) return;

    const targetIndex = event.key === 'Backspace' ? start - 1 : start;
    if (targetIndex >= 0 && targetIndex < value.length && /\d/.test(value[targetIndex])) {
      return;
    }

    event.preventDefault();
    const cents = this.parseCents(value);
    if (cents === null) return;
    const next = event.key === 'Backspace'
      ? Math.floor(cents / 10)
      : this.dropLeftmostDigit(cents);
    const newCents = next > 0 ? next : null;
    this.render(newCents);
    this.onChange(newCents !== null ? newCents / 100 : null);
  }

  @HostListener('input')
  onInput(): void {
    const input = this.host.nativeElement;
    const raw = input.value;
    const cursor = input.selectionStart ?? raw.length;
    const digitsAfterCursor = raw.slice(cursor).replace(/\D/g, '').length;

    const cents = this.parseCents(raw);
    this.render(cents, digitsAfterCursor);
    this.onChange(cents !== null ? cents / 100 : null);
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  private render(cents: number | null, targetDigitsAfter?: number): void {
    const input = this.host.nativeElement;
    const display = cents !== null ? (cents / 100).toFixed(2) : '';
    input.value = display;
    if (!display) return;
    const position = this.caretPositionForDigitsAfter(display, targetDigitsAfter);
    try {
      input.setSelectionRange(position, position);
    } catch {
      /* type=number rejects selection ranges; ignore */
    }
  }

  private caretPositionForDigitsAfter(display: string, target?: number): number {
    if (target === undefined || target <= 0) return display.length;
    const totalDigits = display.replace(/\D/g, '').length;
    if (target >= totalDigits) return 0;
    let counted = 0;
    for (let i = display.length - 1; i >= 0; i--) {
      if (/\d/.test(display[i])) {
        counted++;
        if (counted === target) {
          let pos = i;
          while (pos > 0 && !/\d/.test(display[pos - 1])) pos--;
          return pos;
        }
      }
    }
    return display.length;
  }

  private toCents(value: number | null): number | null {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.min(Math.round(value * 100), MAX_CENTS);
  }

  private parseCents(value: string): number | null {
    const digits = value.replace(/\D/g, '');
    const parsed = digits ? Number(digits) : 0;
    return parsed > 0 ? Math.min(parsed, MAX_CENTS) : null;
  }

  private dropLeftmostDigit(cents: number): number {
    const digitsStr = String(cents).slice(1);
    return digitsStr ? Number(digitsStr) : 0;
  }
}
