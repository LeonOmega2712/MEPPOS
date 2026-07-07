import { Component, computed, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { LocationService } from '../../../../core/services/location.service';
import type { Location } from '../../../../core/models';

export type LocationSelection = { locationId: number } | { takeout: true };

@Component({
  selector: 'app-location-picker',
  imports: [],
  templateUrl: './location-picker.html',
  styleUrl: './location-picker.css',
})
export class LocationPickerComponent implements OnInit {
  private readonly locationService = inject(LocationService);

  @Input() folioLabel = '';
  @Output() confirmed = new EventEmitter<LocationSelection>();
  @Output() back = new EventEmitter<void>();

  readonly loading = this.locationService.locationsLoading;
  private readonly locationsSignal = this.locationService.locations;

  selected = signal<LocationSelection | null>(null);

  tables = computed(() =>
    (this.locationsSignal() ?? [])
      .filter((l) => l.active && l.type === 'table')
      .sort((a, b) => b.displayOrder - a.displayOrder)
  );

  bars = computed(() =>
    (this.locationsSignal() ?? [])
      .filter((l) => l.active && l.type === 'bar')
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  ngOnInit(): void {
    this.locationService.ensureLocations();
  }

  isOccupied(location: Location): boolean {
    return location.type === 'table' && !!location.occupied;
  }

  isSelected(location: Location): boolean {
    const sel = this.selected();
    return !!sel && 'locationId' in sel && sel.locationId === location.id;
  }

  isTakeoutSelected(): boolean {
    const sel = this.selected();
    return !!sel && 'takeout' in sel;
  }

  selectLocation(location: Location): void {
    if (this.isOccupied(location)) return;
    this.selected.set({ locationId: location.id });
  }

  selectTakeout(): void {
    this.selected.set({ takeout: true });
  }

  confirmLabel(): string {
    const sel = this.selected();
    if (!sel) return 'Confirmar';
    if ('takeout' in sel) return 'Confirmar para llevar';
    const location = this.tables().concat(this.bars()).find((l) => l.id === sel.locationId);
    return location ? `Confirmar ${location.name}` : 'Confirmar';
  }

  confirm(): void {
    const sel = this.selected();
    if (!sel) return;
    this.confirmed.emit(sel);
  }

  goBack(): void {
    this.back.emit();
  }
}
