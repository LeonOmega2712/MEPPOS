import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { IconComponent } from '../icon';

@Component({
  selector: 'app-confirm-dialog',
  imports: [FormsModule, IconComponent],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialogComponent {
  protected readonly dialogService = inject(ConfirmDialogService);
}
