import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { ConfirmDialogService } from './confirm-dialog.service';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private swUpdate = inject(SwUpdate);
  private confirmDialog = inject(ConfirmDialogService);

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.promptUpdate());

    setInterval(() => this.swUpdate.checkForUpdate(), 6 * 60 * 60 * 1000);
  }

  private promptUpdate(): void {
    this.swUpdate.activateUpdate().then(() => {
      this.confirmDialog
        .confirm({
          title: 'Nueva versión disponible',
          message: 'La aplicación ha sido actualizada. Es necesario recargar para continuar.',
          confirmText: 'Actualizar ahora',
          cancelable: false,
        })
        .then(() => window.location.reload());
    });
  }
}
