import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationPickerComponent } from './location-picker';
import { LocationService } from '../../../../core/services/location.service';
import type { Location } from '../../../../core/models';

const TABLE_1: Location = {
  id: 1,
  name: 'Mesa 1',
  type: 'table',
  active: true,
  displayOrder: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
  occupied: false,
};

const TABLE_2_OCCUPIED: Location = {
  id: 2,
  name: 'Mesa 2',
  type: 'table',
  active: true,
  displayOrder: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
  occupied: true,
};

const BAR_1: Location = {
  id: 3,
  name: 'Barra',
  type: 'bar',
  active: true,
  displayOrder: 2,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
};

describe('LocationPickerComponent', () => {
  let fixture: ComponentFixture<LocationPickerComponent>;
  let component: LocationPickerComponent;
  let locationsData: ReturnType<typeof signal<Location[] | null>>;
  let locationServiceMock: any;

  beforeEach(async () => {
    locationsData = signal<Location[] | null>([TABLE_1, TABLE_2_OCCUPIED, BAR_1]);
    locationServiceMock = {
      locations: locationsData,
      locationsLoading: signal(false),
      ensureLocations: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LocationPickerComponent],
      providers: [{ provide: LocationService, useValue: locationServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('separates tables and bars, sorting tables from highest to lowest', () => {
    expect(component.tables().map((t) => t.id)).toEqual([2, 1]);
    expect(component.bars().map((b) => b.id)).toEqual([3]);
  });

  it('marks occupied tables and blocks selection', () => {
    expect(component.isOccupied(TABLE_2_OCCUPIED)).toBe(true);
    component.selectLocation(TABLE_2_OCCUPIED);
    expect(component.isSelected(TABLE_2_OCCUPIED)).toBe(false);
  });

  it('selects a free table', () => {
    component.selectLocation(TABLE_1);
    expect(component.isSelected(TABLE_1)).toBe(true);
    expect(component.confirmLabel()).toBe('Confirmar Mesa 1');
  });

  it('selects takeout', () => {
    component.selectTakeout();
    expect(component.isTakeoutSelected()).toBe(true);
    expect(component.confirmLabel()).toBe('Confirmar para llevar');
  });

  it('emits confirmed with the selection', () => {
    const spy = vi.fn();
    component.confirmed.subscribe(spy);
    component.selectLocation(TABLE_1);
    component.confirm();
    expect(spy).toHaveBeenCalledWith({ locationId: 1 });
  });

  it('does not emit confirmed without a selection', () => {
    const spy = vi.fn();
    component.confirmed.subscribe(spy);
    component.confirm();
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits back', () => {
    const spy = vi.fn();
    component.back.subscribe(spy);
    component.goBack();
    expect(spy).toHaveBeenCalled();
  });
});
