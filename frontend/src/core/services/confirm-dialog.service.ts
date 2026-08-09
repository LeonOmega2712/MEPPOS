import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogSummaryLine {
  /** Primary label, e.g. the product name. */
  label: string;
  /** Secondary detail shown below the label, e.g. "1 → se elimina". */
  detail: string;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  requireInput?: string;
  cancelable?: boolean;
  /** Optional label/detail rows for reviewing changes (e.g. previous → new values) before confirming. */
  summaryLines?: ConfirmDialogSummaryLine[];
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly visible = signal(false);
  readonly title = signal('');
  readonly message = signal('');
  readonly confirmText = signal('Confirmar');
  readonly cancelText = signal('Cancelar');
  readonly requireInput = signal('');
  readonly inputValue = signal('');
  readonly cancelable = signal(true);
  readonly summaryLines = signal<ConfirmDialogSummaryLine[]>([]);

  private resolver: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    this.title.set(options.title ?? 'Atención');
    this.message.set(options.message);
    this.confirmText.set(options.confirmText ?? 'Confirmar');
    this.cancelText.set(options.cancelText ?? 'Cancelar');
    this.requireInput.set(options.requireInput ?? '');
    this.inputValue.set('');
    this.cancelable.set(options.cancelable ?? true);
    this.summaryLines.set(options.summaryLines ?? []);
    this.visible.set(true);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  accept(): void {
    this.visible.set(false);
    this.resolver?.(true);
    this.resolver = null;
  }

  cancel(): void {
    this.visible.set(false);
    this.resolver?.(false);
    this.resolver = null;
  }
}
