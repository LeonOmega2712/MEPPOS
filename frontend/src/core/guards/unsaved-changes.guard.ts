import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { ConfirmDialogService } from '../services/confirm-dialog.service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
  discardChanges(): void;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
  if (!component.hasUnsavedChanges()) return true;

  const confirmDialogService = inject(ConfirmDialogService);
  const confirmed = await confirmDialogService.confirm({
    message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
  });

  if (confirmed) {
    component.discardChanges();
    return true;
  }

  return false;
};
