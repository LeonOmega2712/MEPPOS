import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { LocationManagerComponent } from './location-manager';
import { LocationService } from '../../../../core/services/location.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import type { Location } from '../../../../core/models';

const LOC_1: Location = {
  id: 1,
  name: 'Mesa 1',
  type: 'table',
  active: true,
  displayOrder: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
};

const LOC_2: Location = {
  id: 2,
  name: 'Mesa 2',
  type: 'table',
  active: true,
  displayOrder: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
};

function makeDrop(previousIndex: number, currentIndex: number): CdkDragDrop<Location[]> {
  return {
    previousIndex,
    currentIndex,
    item: {} as any,
    container: {} as any,
    previousContainer: {} as any,
    isPointerOverContainer: true,
    distance: { x: 0, y: 0 },
    dropPoint: { x: 0, y: 0 },
    event: {} as any,
  };
}

describe('LocationManagerComponent', () => {
  let fixture: ComponentFixture<LocationManagerComponent>;
  let component: LocationManagerComponent;

  let locationsData: ReturnType<typeof signal<Location[] | null>>;

  let createLocationSubject: Subject<Location>;
  let updateLocationSubject: Subject<Location>;
  let deleteLocationSubject: Subject<void>;
  let reorderSubject: Subject<void>;

  let locationServiceMock: any;
  let toastServiceMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirmDialogServiceMock: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    locationsData = signal<Location[] | null>(null);
    createLocationSubject = new Subject();
    updateLocationSubject = new Subject();
    deleteLocationSubject = new Subject();
    reorderSubject = new Subject();

    locationServiceMock = {
      locations: locationsData.asReadonly(),
      locationsLoading: signal(false).asReadonly(),
      locationsRevalidating: signal(false).asReadonly(),
      locationsError: signal<unknown>(null).asReadonly(),
      ensureLocations: vi.fn(),
      refreshLocations: vi.fn(),
      setLocationsData: vi.fn(),
      createLocation: vi.fn().mockReturnValue(createLocationSubject.asObservable()),
      updateLocation: vi.fn().mockReturnValue(updateLocationSubject.asObservable()),
      deleteLocation: vi.fn().mockReturnValue(deleteLocationSubject.asObservable()),
      reorderLocations: vi.fn().mockReturnValue(reorderSubject.asObservable()),
    };

    toastServiceMock = { success: vi.fn(), error: vi.fn() };
    confirmDialogServiceMock = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [LocationManagerComponent],
      providers: [
        { provide: LocationService, useValue: locationServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: ConfirmDialogService, useValue: confirmDialogServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('calls ensureLocations()', () => {
      expect(locationServiceMock.ensureLocations).toHaveBeenCalledTimes(1);
    });
  });

  // ─── typeLabels ───────────────────────────────────────────────────────────

  describe('typeLabels', () => {
    it('maps "table" to "Mesa"', () => {
      expect(component.typeLabels['table']).toBe('Mesa');
    });

    it('maps "bar" to "Barra"', () => {
      expect(component.typeLabels['bar']).toBe('Barra');
    });
  });

  // ─── hasDraftChanges ─────────────────────────────────────────────────────

  describe('hasDraftChanges()', () => {
    describe('for "new" location', () => {
      it('returns false when name is empty', () => {
        component.newLocation = { name: '', type: 'table' };
        expect(component.hasDraftChanges('new')).toBe(false);
      });

      it('returns true when name is non-empty', () => {
        component.newLocation = { name: 'Mesa 3', type: 'table' };
        expect(component.hasDraftChanges('new')).toBe(true);
      });

      it('returns false for whitespace-only name', () => {
        component.newLocation = { name: '   ', type: 'table' };
        expect(component.hasDraftChanges('new')).toBe(false);
      });
    });

    describe('for existing location', () => {
      beforeEach(() => {
        locationsData.set([LOC_1]);
        TestBed.flushEffects();
      });

      it('returns false when draft matches original', () => {
        expect(component.hasDraftChanges(LOC_1.id)).toBe(false);
      });

      it('returns true when name has changed', () => {
        component.drafts[LOC_1.id].name = 'Mesa Modificada';
        expect(component.hasDraftChanges(LOC_1.id)).toBe(true);
      });

      it('returns true when type has changed', () => {
        component.drafts[LOC_1.id].type = 'bar';
        expect(component.hasDraftChanges(LOC_1.id)).toBe(true);
      });

      it('returns false for unknown id (no original or draft)', () => {
        expect(component.hasDraftChanges(999)).toBe(false);
      });
    });
  });

  // ─── createLocation ───────────────────────────────────────────────────────

  describe('createLocation()', () => {
    it('is a no-op when name is empty', () => {
      component.newLocation = { name: '', type: 'table' };
      component.createLocation();
      expect(locationServiceMock.createLocation).not.toHaveBeenCalled();
    });

    it('is a no-op when name is whitespace-only', () => {
      component.newLocation = { name: '   ', type: 'table' };
      component.createLocation();
      expect(locationServiceMock.createLocation).not.toHaveBeenCalled();
    });

    it('calls createLocation with trimmed name and correct type', () => {
      component.newLocation = { name: '  Mesa 3  ', type: 'bar' };
      component.createLocation();
      expect(locationServiceMock.createLocation).toHaveBeenCalledWith({ name: 'Mesa 3', type: 'bar' });
    });

    it('defaults to type "table"', () => {
      component.newLocation = { name: 'Mesa 3', type: 'table' };
      component.createLocation();
      expect(locationServiceMock.createLocation).toHaveBeenCalledWith({ name: 'Mesa 3', type: 'table' });
    });

    it('sets saving to "new" while in-flight', () => {
      component.newLocation = { name: 'Mesa 3', type: 'table' };
      component.createLocation();
      expect(component.saving()).toBe('new');
    });

    it('resets form and calls refreshLocations on success', () => {
      component.newLocation = { name: 'Mesa 3', type: 'table' };
      component.createLocation();

      createLocationSubject.next({ ...LOC_1, name: 'Mesa 3' });
      createLocationSubject.complete();

      expect(component.saving()).toBeNull();
      expect(component.newLocation.name).toBe('');
      expect(component.newLocation.type).toBe('table');
      expect(locationServiceMock.refreshLocations).toHaveBeenCalledTimes(1);
      expect(toastServiceMock.success).toHaveBeenCalledWith('Ubicación creada');
    });

    it('resets saving and shows error toast on failure', () => {
      component.newLocation = { name: 'Mesa 3', type: 'table' };
      component.createLocation();

      createLocationSubject.error(new Error('Server error'));

      expect(component.saving()).toBeNull();
      expect(toastServiceMock.error).toHaveBeenCalledWith('Error al crear ubicación');
    });
  });

  // ─── onDrop ───────────────────────────────────────────────────────────────

  describe('onDrop()', () => {
    beforeEach(() => {
      locationsData.set([LOC_1, LOC_2]);
      TestBed.flushEffects();
    });

    it('does nothing when previousIndex equals currentIndex', () => {
      component.onDrop(makeDrop(0, 0));

      expect(locationServiceMock.setLocationsData).not.toHaveBeenCalled();
      expect(locationServiceMock.reorderLocations).not.toHaveBeenCalled();
    });

    it('calls setLocationsData with optimistically reordered list', () => {
      component.onDrop(makeDrop(0, 1));

      expect(locationServiceMock.setLocationsData).toHaveBeenCalledTimes(1);
      const updatedLocations: Location[] = locationServiceMock.setLocationsData.mock.calls[0][0];
      expect(updatedLocations[0].id).toBe(LOC_2.id);
      expect(updatedLocations[1].id).toBe(LOC_1.id);
    });

    it('calls reorderLocations with the new ID order', () => {
      component.onDrop(makeDrop(0, 1));

      expect(locationServiceMock.reorderLocations).toHaveBeenCalledWith([LOC_2.id, LOC_1.id]);
    });

    it('sets reordering to true while request is in-flight', () => {
      component.onDrop(makeDrop(0, 1));
      expect(component.reordering()).toBe(true);
    });

    it('clears reordering on success', () => {
      component.onDrop(makeDrop(0, 1));
      reorderSubject.next();
      reorderSubject.complete();
      expect(component.reordering()).toBe(false);
    });

    it('refreshes locations and clears reordering on error', () => {
      component.onDrop(makeDrop(0, 1));
      reorderSubject.error(new Error('Reorder failed'));

      expect(component.reordering()).toBe(false);
      expect(locationServiceMock.refreshLocations).toHaveBeenCalledTimes(1);
    });
  });

  // ─── hasUnsavedChanges / discardChanges ───────────────────────────────────

  describe('hasUnsavedChanges()', () => {
    it('returns false when no location is expanded', () => {
      component.expandedLocationId.set(null);
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('returns true when expanded location has unsaved changes', () => {
      locationsData.set([LOC_1]);
      TestBed.flushEffects();
      component.expandedLocationId.set(LOC_1.id);
      component.drafts[LOC_1.id].name = 'Changed';

      expect(component.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('discardChanges()', () => {
    it('resets the draft to original values and clears expandedLocationId', () => {
      locationsData.set([LOC_1]);
      TestBed.flushEffects();
      component.expandedLocationId.set(LOC_1.id);
      component.drafts[LOC_1.id].name = 'Changed';

      component.discardChanges();

      expect(component.drafts[LOC_1.id].name).toBe(LOC_1.name);
      expect(component.expandedLocationId()).toBeNull();
    });

    it('does nothing when no location is expanded', () => {
      component.expandedLocationId.set(null);
      component.discardChanges();
      expect(component.expandedLocationId()).toBeNull();
    });
  });

  // ─── deactivateLocation cleanup (issue #51) ──────────────────────────────

  describe('deactivateLocation() cleanup', () => {
    beforeEach(() => {
      locationsData.set([LOC_1, LOC_2]);
      TestBed.flushEffects();
    });

    it('clears expandedLocationId and resets draft after success, so opening another row does not trigger the unsaved-changes dialog', async () => {
      component.expandedLocationId.set(LOC_1.id);
      component.drafts[LOC_1.id].name = 'Edited but not saved';

      await component.deactivateLocation(LOC_1);
      deleteLocationSubject.next();
      deleteLocationSubject.complete();

      expect(component.expandedLocationId()).toBeNull();
      expect(component.hasDraftChanges(LOC_1.id)).toBe(false);

      await component.onCollapseToggle(new Event('click'), LOC_2.id);

      expect(confirmDialogServiceMock.confirm).toHaveBeenCalledTimes(1);
      expect(component.expandedLocationId()).toBe(LOC_2.id);
    });

    it('does NOT clear expanded state on error', async () => {
      component.expandedLocationId.set(LOC_1.id);
      component.drafts[LOC_1.id].name = 'Edited';

      await component.deactivateLocation(LOC_1);
      deleteLocationSubject.error(new Error('boom'));

      expect(component.expandedLocationId()).toBe(LOC_1.id);
      expect(component.hasDraftChanges(LOC_1.id)).toBe(true);
    });
  });

  describe('permanentDeleteLocation() cleanup', () => {
    it('clears expandedInactiveId after success', async () => {
      const inactive: Location = { ...LOC_1, id: 5, active: false };
      locationsData.set([inactive]);
      TestBed.flushEffects();
      component.expandedInactiveId.set(inactive.id);
      confirmDialogServiceMock.confirm.mockResolvedValueOnce(true);

      await component.permanentDeleteLocation(inactive);
      deleteLocationSubject.next();
      deleteLocationSubject.complete();

      expect(component.expandedInactiveId()).toBeNull();
      expect(component.drafts[inactive.id]).toBeUndefined();
    });
  });

  // ─── computed signals ─────────────────────────────────────────────────────

  describe('activeLocations / inactiveLocations computed', () => {
    it('separates active from inactive locations', () => {
      const inactive: Location = { ...LOC_1, id: 3, active: false, displayOrder: 2 };
      locationsData.set([LOC_1, LOC_2, inactive]);
      TestBed.flushEffects();

      expect(component.activeLocations()).toHaveLength(2);
      expect(component.inactiveLocations()).toHaveLength(1);
    });

    it('sorts active locations by displayOrder ascending', () => {
      const high: Location = { ...LOC_1, id: 3, displayOrder: 10 };
      locationsData.set([high, LOC_2, LOC_1]);
      TestBed.flushEffects();

      expect(component.activeLocations()[0].displayOrder).toBe(0);
      expect(component.activeLocations()[1].displayOrder).toBe(1);
      expect(component.activeLocations()[2].displayOrder).toBe(10);
    });
  });
});
