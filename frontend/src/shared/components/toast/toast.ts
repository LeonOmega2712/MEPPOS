import { Component, inject } from '@angular/core';
import { ToastService, type ToastType } from '../../../core/services/toast.service';

const ALERT_CLASS: Record<ToastType, string> = {
  success: 'alert alert-success',
  error: 'alert alert-error',
  warning: 'alert alert-warning',
  info: 'alert alert-info',
};

@Component({
  selector: 'app-toast',
  template: `
    <div class="toast toast-end toast-bottom z-50">
      @for (toast of toastService.toasts(); track toast.id) {
        <div [class]="alertClass[toast.type]">
          <span>{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);
  protected readonly alertClass = ALERT_CLASS;
}
