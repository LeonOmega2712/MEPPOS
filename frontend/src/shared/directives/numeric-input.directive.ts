import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  inject,
} from '@angular/core';

export type NumericInputMode = 'integer' | 'decimal';

@Directive({
  selector: 'input[appNumericInput]',
  standalone: true,
})
export class NumericInputDirective {
  @Input() mode: NumericInputMode = 'decimal';
  @Input() maxDecimals = 2;

  private readonly host = inject<ElementRef<HTMLInputElement>>(ElementRef);

  private get min(): number | null {
    const raw = this.host.nativeElement.min;
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const navigationKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Enter',
      'Escape',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (navigationKeys.includes(event.key)) return;

    if (['e', 'E', '+', '-'].includes(event.key)) {
      event.preventDefault();
      return;
    }

    if (event.key === ',') {
      event.preventDefault();
      return;
    }

    if (event.key === '.') {
      if (this.mode !== 'decimal' || this.maxDecimals <= 0) {
        event.preventDefault();
        return;
      }
      if (this.host.nativeElement.value.includes('.')) {
        event.preventDefault();
      }
      return;
    }

    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      return;
    }

    if (this.mode === 'decimal') {
      const value = this.host.nativeElement.value;
      const dotIndex = value.indexOf('.');
      if (dotIndex >= 0) {
        const decimals = value.length - dotIndex - 1;
        const cursor = this.cursorPosition();
        if (cursor === null || cursor > dotIndex) {
          if (decimals >= this.maxDecimals && !this.hasSelection()) {
            event.preventDefault();
          }
        }
      }
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const raw = event.clipboardData?.getData('text') ?? '';
    event.preventDefault();
    this.applySanitizedInsert(raw);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    const raw = event.dataTransfer?.getData('text') ?? '';
    event.preventDefault();
    this.applySanitizedInsert(raw);
  }

  @HostListener('compositionend')
  onCompositionEnd(): void {
    const input = this.host.nativeElement;
    const sanitized = this.sanitize(input.value);
    if (input.value !== sanitized) {
      this.commitValue(sanitized);
    }
  }

  private applySanitizedInsert(text: string): void {
    const input = this.host.nativeElement;
    const fragment = this.sanitizeFragment(text);
    if (!fragment) return;

    const supportsSelection = input.type !== 'number';
    let next: string;
    if (supportsSelection) {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      next = this.sanitize(
        input.value.slice(0, start) + fragment + input.value.slice(end)
      );
    } else {
      next = this.sanitize(input.value + fragment);
    }
    this.commitValue(next);
  }

  private commitValue(value: string): void {
    const input = this.host.nativeElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private sanitize(text: string): string {
    if (this.mode === 'integer') {
      const digits = text.replace(/\D/g, '');
      return this.applyMin(digits);
    }
    const cleaned = text.replace(/[^\d.]/g, '');
    if (this.maxDecimals <= 0) {
      return this.applyMin(cleaned.replace(/\./g, ''));
    }
    const firstDot = cleaned.indexOf('.');
    if (firstDot < 0) return this.applyMin(cleaned);
    const intPart = cleaned.slice(0, firstDot);
    const decPart = cleaned
      .slice(firstDot + 1)
      .replace(/\./g, '')
      .slice(0, this.maxDecimals);
    return this.applyMin(`${intPart}.${decPart}`);
  }

  private sanitizeFragment(text: string): string {
    if (this.mode === 'integer') return text.replace(/\D/g, '');
    return text.replace(/[^\d.]/g, '');
  }

  private applyMin(value: string): string {
    if (value === '' || value === '.') return value;
    if (this.min === null) return value;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return value;
    return numeric < this.min ? String(this.min) : value;
  }

  private cursorPosition(): number | null {
    try {
      return this.host.nativeElement.selectionStart;
    } catch {
      return null;
    }
  }

  private hasSelection(): boolean {
    const input = this.host.nativeElement;
    try {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      return start !== null && end !== null && start !== end;
    } catch {
      return false;
    }
  }
}
