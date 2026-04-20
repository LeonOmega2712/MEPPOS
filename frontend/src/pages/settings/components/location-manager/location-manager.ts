import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
  CdkDragPlaceholder,
  moveItemInArray,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { LocationService } from '../../../../core/services/location.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon';
import type {
  Location,
  LocationDraft,
  CreateLocationPayload,
} from '../../../../core/models';

@Component({
  selector: 'app-location-manager',
  imports: [FormsModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, IconComponent],
  templateUrl: './location-manager.html',
  styleUrl: '../../../../shared/styles/manager.css',
})
export class LocationManagerComponent implements OnInit {
  private readonly locationService = inject(LocationService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  readonly loading = this.locationService.locationsLoading;
  readonly revalidating = this.locationService.locationsRevalidating;
  readonly error = this.locationService.locationsError;
  private readonly locationsSignal = this.locationService.locations;

  saving = signal<number | 'new' | null>(null);
  reordering = signal(false);
  dragHeight = signal(0);
  expandedLocationId = signal<number | 'new' | null>(null);
  expandedInactiveId = signal<number | null>(null);

  activeLocations = computed(() =>
    (this.locationsSignal() ?? [])
      .filter((l) => l.active)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  inactiveLocations = computed(() =>
    (this.locationsSignal() ?? [])
      .filter((l) => !l.active)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  drafts: Record<number, LocationDraft> = {};
  newLocation: CreateLocationPayload = this.emptyLocation();

  readonly typeLabels: Record<string, string> = { table: 'Mesa', bar: 'Barra' };

  constructor() {
    effect(() => {
      const items = this.locationsSignal();
      if (!items) return;
      untracked(() => {
        const ids = new Set(items.map((l) => l.id));
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
    this.locationService.ensureLocations();
  }

  refresh(): void {
    this.locationService.refreshLocations();
  }

  createLocation(): void {
    if (!this.newLocation.name.trim()) return;
    this.saving.set('new');
    const payload: CreateLocationPayload = {
      name: this.newLocation.name.trim(),
      type: this.newLocation.type,
    };
    this.locationService.createLocation(payload).subscribe({
      next: () => {
        this.newLocation = this.emptyLocation();
        this.saving.set(null);
        this.toastService.success('Ubicación creada');
        this.locationService.refreshLocations();
      },
      error: () => {
        this.toastService.error('Error al crear ubicación');
        this.saving.set(null);
      },
    });
  }

  saveLocation(location: Location): void {
    const draft = this.drafts[location.id];
    if (!draft) return;
    this.saving.set(location.id);
    this.locationService.updateLocation(location.id, { name: draft.name, type: draft.type }).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Ubicación actualizada');
        this.locationService.refreshLocations();
      },
      error: () => {
        this.toastService.error('Error al actualizar ubicación');
        this.saving.set(null);
      },
    });
  }

  async deactivateLocation(location: Location): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Desactivar ubicación',
      message: `Se desactivará "${location.name}". ¿Desea continuar?`,
      confirmText: 'Desactivar',
    });
    if (!confirmed) return;
    this.saving.set(location.id);
    this.locationService.deleteLocation(location.id).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Ubicación desactivada');
        this.locationService.refreshLocations();
      },
      error: () => {
        this.toastService.error('Error al desactivar ubicación');
        this.saving.set(null);
      },
    });
  }

  reactivateLocation(location: Location): void {
    this.saving.set(location.id);
    this.locationService.updateLocation(location.id, { active: true }).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Ubicación reactivada');
        this.locationService.refreshLocations();
      },
      error: () => {
        this.toastService.error('Error al reactivar ubicación');
        this.saving.set(null);
      },
    });
  }

  async permanentDeleteLocation(location: Location): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Eliminar ubicación permanentemente',
      message: `Esta acción es irreversible. Escriba el nombre de la ubicación para confirmar:`,
      confirmText: 'Eliminar',
      requireInput: location.name,
    });
    if (!confirmed) return;
    this.saving.set(location.id);
    this.locationService.deleteLocation(location.id, true).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Ubicación eliminada permanentemente');
        this.locationService.refreshLocations();
      },
      error: () => {
        this.toastService.error('Error al eliminar ubicación');
        this.saving.set(null);
      },
    });
  }

  onDragHandleDown(event: PointerEvent): void {
    const row = (event.target as HTMLElement).closest('[cdkDrag]');
    if (row) this.dragHeight.set(row.getBoundingClientRect().height);
  }

  onDrop(event: CdkDragDrop<Location[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const items = [...this.activeLocations()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    const updated = items.map((loc, index) => ({ ...loc, displayOrder: index }));
    this.locationService.setLocationsData([...updated, ...this.inactiveLocations()]);
    this.reordering.set(true);
    this.locationService.reorderLocations(items.map((l) => l.id)).subscribe({
      next: () => {
        this.reordering.set(false);
        this.toastService.success('Orden actualizado');
      },
      error: () => {
        this.reordering.set(false);
        this.toastService.error('Error al actualizar orden');
        this.locationService.refreshLocations();
      },
    });
  }

  hasUnsavedChanges(): boolean {
    const id = this.expandedLocationId();
    if (id === null) return false;
    return this.hasDraftChanges(id);
  }

  discardChanges(): void {
    const id = this.expandedLocationId();
    if (id !== null) {
      this.resetDraft(id);
      this.expandedLocationId.set(null);
    }
  }

  async onCollapseToggle(event: Event, locationId: number | 'new'): Promise<void> {
    event.preventDefault();
    const current = this.expandedLocationId();
    const isExpanded = current === locationId;

    if (isExpanded) {
      if (locationId !== 'new' && this.hasDraftChanges(locationId)) {
        const confirmed = await this.confirmDialogService.confirm({
          message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
        });
        if (!confirmed) return;
        this.resetDraft(locationId);
      }
      this.expandedLocationId.set(null);
    } else {
      if (current !== null && this.hasDraftChanges(current)) {
        const confirmed = await this.confirmDialogService.confirm({
          message: 'Hay cambios sin guardar en otra ubicación. ¿Desea descartarlos?',
        });
        if (!confirmed) return;
        this.resetDraft(current);
      }
      this.expandedLocationId.set(locationId);
    }
  }

  hasDraftChanges(locationId: number | 'new'): boolean {
    if (locationId === 'new') return !!this.newLocation.name.trim();
    const original = (this.locationsSignal() ?? []).find((l) => l.id === locationId);
    const draft = this.drafts[locationId];
    if (!original || !draft) return false;
    return draft.name !== original.name || draft.type !== original.type;
  }

  resetDraft(locationId: number | 'new'): void {
    if (locationId === 'new') { this.newLocation = this.emptyLocation(); return; }
    const original = (this.locationsSignal() ?? []).find((l) => l.id === locationId);
    if (original) this.drafts[locationId] = this.toDraft(original);
  }

  private toDraft(location: Location): LocationDraft {
    return { name: location.name, type: location.type };
  }

  private emptyLocation(): CreateLocationPayload {
    return { name: '', type: 'table' };
  }
}
