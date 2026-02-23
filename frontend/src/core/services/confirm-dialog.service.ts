import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  requireInput?: string;
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

  private resolver: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    this.title.set(options.title ?? 'Atención');
    this.message.set(options.message);
    this.confirmText.set(options.confirmText ?? 'Confirmar');
    this.cancelText.set(options.cancelText ?? 'Cancelar');
    this.requireInput.set(options.requireInput ?? '');
    this.inputValue.set('');
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
