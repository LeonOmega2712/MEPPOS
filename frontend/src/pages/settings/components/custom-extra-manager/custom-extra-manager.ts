import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomExtraService } from '../../../../core/services/custom-extra.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon';
import type { CustomExtra, CustomExtraDraft, CreateCustomExtraPayload } from '../../../../core/models';

@Component({
  selector: 'app-custom-extra-manager',
  imports: [FormsModule, IconComponent],
  templateUrl: './custom-extra-manager.html',
  styleUrl: '../../../../shared/styles/manager.css',
})
export class CustomExtraManagerComponent implements OnInit {
  private readonly customExtraService = inject(CustomExtraService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  readonly loading = this.customExtraService.extrasLoading;
  readonly revalidating = this.customExtraService.extrasRevalidating;
  readonly error = this.customExtraService.extrasError;
  private readonly extrasSignal = this.customExtraService.extras;

  saving = signal<number | 'new' | null>(null);
  expandedExtraId = signal<number | 'new' | null>(null);
  expandedInactiveId = signal<number | null>(null);

  activeExtras = computed(() =>
    (this.extrasSignal() ?? [])
      .filter((e) => e.active)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  inactiveExtras = computed(() =>
    (this.extrasSignal() ?? [])
      .filter((e) => !e.active)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  drafts: Record<number, CustomExtraDraft> = {};
  newExtra: { name: string; defaultPriceInput: string } = this.emptyExtra();

  constructor() {
    effect(() => {
      const items = this.extrasSignal();
      if (!items) return;
      untracked(() => {
        const ids = new Set(items.map((e) => e.id));
        for (const item of items) {
          if (!this.drafts[item.id] || !this.hasDraftChanges(item.id)) {
            this.drafts[item.id] = this.toDraft(item);
          }
        }
        for (const id of Object.keys(this.drafts)) {
          if (!ids.has(Number(id))) delete this.drafts[Number(id)];
        }
      });
    });
  }

  ngOnInit(): void {
    this.customExtraService.ensureExtras();
  }

  refresh(): void {
    this.customExtraService.refreshExtras();
  }

  createExtra(): void {
    if (!this.newExtra.name.trim()) return;
    const price = this.parsePrice(this.newExtra.defaultPriceInput);
    if (price === null) return;
    this.saving.set('new');
    const payload: CreateCustomExtraPayload = { name: this.newExtra.name.trim(), defaultPrice: price };

    this.customExtraService.createExtra(payload).subscribe({
      next: () => {
        this.newExtra = this.emptyExtra();
        this.saving.set(null);
        this.toastService.success('Extra creado');
        this.customExtraService.refreshExtras();
      },
      error: () => {
        this.toastService.error('Error al crear extra');
        this.saving.set(null);
      },
    });
  }

  saveExtra(extra: CustomExtra): void {
    const draft = this.drafts[extra.id];
    if (!draft) return;
    const price = this.parsePrice(draft.defaultPrice);
    if (price === null) return;
    this.saving.set(extra.id);
    this.customExtraService.updateExtra(extra.id, {
      name: draft.name,
      defaultPrice: price,
    }).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Extra actualizado');
        this.customExtraService.refreshExtras();
      },
      error: () => {
        this.toastService.error('Error al actualizar extra');
        this.saving.set(null);
      },
    });
  }

  async deactivateExtra(extra: CustomExtra): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Desactivar extra',
      message: `Se desactivará "${extra.name}". ¿Desea continuar?`,
      confirmText: 'Desactivar',
    });
    if (!confirmed) return;
    this.saving.set(extra.id);
    this.customExtraService.deleteExtra(extra.id).subscribe({
      next: () => {
        this.saving.set(null);
        this.clearDraftAndCollapse(extra.id);
        this.toastService.success('Extra desactivado');
        this.customExtraService.refreshExtras();
      },
      error: () => {
        this.toastService.error('Error al desactivar extra');
        this.saving.set(null);
      },
    });
  }

  reactivateExtra(extra: CustomExtra): void {
    this.saving.set(extra.id);
    this.customExtraService.updateExtra(extra.id, { active: true }).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Extra reactivado');
        this.customExtraService.refreshExtras();
      },
      error: () => {
        this.toastService.error('Error al reactivar extra');
        this.saving.set(null);
      },
    });
  }

  async permanentDeleteExtra(extra: CustomExtra): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Eliminar extra permanentemente',
      message: `Esta acción es irreversible. Escriba el nombre del extra para confirmar:`,
      confirmText: 'Eliminar',
      requireInput: extra.name,
    });
    if (!confirmed) return;
    this.saving.set(extra.id);
    this.customExtraService.deleteExtra(extra.id, true).subscribe({
      next: () => {
        this.saving.set(null);
        this.clearDraftAndCollapse(extra.id);
        this.toastService.success('Extra eliminado permanentemente');
        this.customExtraService.refreshExtras();
      },
      error: () => {
        this.toastService.error('Error al eliminar extra');
        this.saving.set(null);
      },
    });
  }

  hasUnsavedChanges(): boolean {
    const id = this.expandedExtraId();
    if (id === null) return false;
    return this.hasDraftChanges(id);
  }

  discardChanges(): void {
    const id = this.expandedExtraId();
    if (id !== null) {
      this.resetDraft(id);
      this.expandedExtraId.set(null);
    }
  }

  async onCollapseToggle(event: Event, extraId: number | 'new'): Promise<void> {
    event.preventDefault();
    const current = this.expandedExtraId();
    const isExpanded = current === extraId;

    if (isExpanded) {
      if (extraId !== 'new' && this.hasDraftChanges(extraId)) {
        const confirmed = await this.confirmDialogService.confirm({
          message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
        });
        if (!confirmed) return;
        this.resetDraft(extraId);
      }
      this.expandedExtraId.set(null);
    } else {
      if (current !== null && this.hasDraftChanges(current)) {
        const confirmed = await this.confirmDialogService.confirm({
          message: 'Hay cambios sin guardar en otro extra. ¿Desea descartarlos?',
        });
        if (!confirmed) return;
        this.resetDraft(current);
      }
      this.expandedExtraId.set(extraId);
    }
  }

  hasDraftChanges(extraId: number | 'new'): boolean {
    if (extraId === 'new') return !!this.newExtra.name.trim() || !!this.newExtra.defaultPriceInput.trim();
    const original = (this.extrasSignal() ?? []).find((e) => e.id === extraId);
    const draft = this.drafts[extraId];
    if (!original || !draft) return false;
    return (
      draft.name !== original.name ||
      this.parsePrice(draft.defaultPrice) !== this.toNumberOrNull(original.defaultPrice)
    );
  }

  isValidDraftPrice(value: string | undefined | null): boolean {
    return this.parsePrice(value ?? '') !== null;
  }

  resetDraft(extraId: number | 'new'): void {
    if (extraId === 'new') { this.newExtra = this.emptyExtra(); return; }
    const original = (this.extrasSignal() ?? []).find((e) => e.id === extraId);
    if (original) this.drafts[extraId] = this.toDraft(original);
  }

  formatPrice(extra: CustomExtra): string {
    return `$${(+extra.defaultPrice).toFixed(2)}`;
  }

  private clearDraftAndCollapse(extraId: number): void {
    delete this.drafts[extraId];
    if (this.expandedExtraId() === extraId) this.expandedExtraId.set(null);
    if (this.expandedInactiveId() === extraId) this.expandedInactiveId.set(null);
  }

  private parsePrice(value: string): number | null {
    const num = this.toNumberOrNull(value);
    return num !== null && num > 0 ? num : null;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  private toDraft(extra: CustomExtra): CustomExtraDraft {
    return {
      name: extra.name,
      defaultPrice: String(extra.defaultPrice),
    };
  }

  private emptyExtra(): { name: string; defaultPriceInput: string } {
    return { name: '', defaultPriceInput: '' };
  }
}
