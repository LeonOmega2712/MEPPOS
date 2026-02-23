import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { ConfirmDialogService } from '../services/confirm-dialog.service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
  discardChanges(): void;
  deactivateMessage?(): string;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
  if (!component.hasUnsavedChanges()) return true;

  const confirmDialogService = inject(ConfirmDialogService);
  const message = component.deactivateMessage?.() ?? 'Hay cambios sin guardar. ¿Desea descartarlos?';
  const confirmed = await confirmDialogService.confirm({ message });

  if (confirmed) {
    component.discardChanges();
    return true;
  }

  return false;
};
