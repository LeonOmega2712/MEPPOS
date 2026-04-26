import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomExtraManagerComponent } from './custom-extra-manager';
import { CustomExtraService } from '../../../../core/services/custom-extra.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import type { CustomExtra } from '../../../../core/models';

const EXTRA_1: CustomExtra = {
  id: 1,
  name: 'Aguacate',
  defaultPrice: 15,
  active: true,
  createdBy: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
};

const EXTRA_2: CustomExtra = {
  id: 2,
  name: 'Limón',
  defaultPrice: 8,
  active: true,
  createdBy: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
};

describe('CustomExtraManagerComponent', () => {
  let fixture: ComponentFixture<CustomExtraManagerComponent>;
  let component: CustomExtraManagerComponent;

  let extrasData: ReturnType<typeof signal<CustomExtra[] | null>>;
  let createExtraSubject: Subject<CustomExtra>;
  let updateExtraSubject: Subject<CustomExtra>;
  let deleteExtraSubject: Subject<void>;

  let customExtraServiceMock: any;
  let toastServiceMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirmDialogServiceMock: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    extrasData = signal<CustomExtra[] | null>(null);
    createExtraSubject = new Subject();
    updateExtraSubject = new Subject();
    deleteExtraSubject = new Subject();

    customExtraServiceMock = {
      extras: extrasData.asReadonly(),
      extrasLoading: signal(false).asReadonly(),
      extrasRevalidating: signal(false).asReadonly(),
      extrasError: signal<unknown>(null).asReadonly(),
      ensureExtras: vi.fn(),
      refreshExtras: vi.fn(),
      createExtra: vi.fn().mockReturnValue(createExtraSubject.asObservable()),
      updateExtra: vi.fn().mockReturnValue(updateExtraSubject.asObservable()),
      deleteExtra: vi.fn().mockReturnValue(deleteExtraSubject.asObservable()),
    };

    toastServiceMock = { success: vi.fn(), error: vi.fn() };
    confirmDialogServiceMock = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [CustomExtraManagerComponent],
      providers: [
        { provide: CustomExtraService, useValue: customExtraServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: ConfirmDialogService, useValue: confirmDialogServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomExtraManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('calls ensureExtras on initialization', () => {
      expect(customExtraServiceMock.ensureExtras).toHaveBeenCalledTimes(1);
    });
  });

  // ─── formatPrice ─────────────────────────────────────────────────────────

  describe('formatPrice()', () => {
    it('returns "$15.00" when defaultPrice is 15', () => {
      expect(component.formatPrice(EXTRA_1)).toBe('$15.00');
    });

    it('formats decimal prices with two decimal places', () => {
      const extra: CustomExtra = { ...EXTRA_1, defaultPrice: 9.5 };
      expect(component.formatPrice(extra)).toBe('$9.50');
    });
  });

  // ─── parsePrice (via hasDraftChanges) ────────────────────────────────────

  describe('parsePrice() (private — tested through hasDraftChanges)', () => {
    it('treats empty string as null (differs from stored 8 → changed)', () => {
      extrasData.set([EXTRA_2]);
      TestBed.flushEffects();
      component.drafts[EXTRA_2.id].defaultPrice = '';
      expect(component.hasDraftChanges(EXTRA_2.id)).toBe(true);
    });

    it('treats non-numeric input as null (differs from stored 8 → changed)', () => {
      extrasData.set([EXTRA_2]);
      TestBed.flushEffects();
      component.drafts[EXTRA_2.id].defaultPrice = 'abc';
      expect(component.hasDraftChanges(EXTRA_2.id)).toBe(true);
    });

    it('treats negative input as null (differs from stored 8 → changed)', () => {
      extrasData.set([EXTRA_2]);
      TestBed.flushEffects();
      component.drafts[EXTRA_2.id].defaultPrice = '-5';
      expect(component.hasDraftChanges(EXTRA_2.id)).toBe(true);
    });
  });

  // ─── hasDraftChanges ─────────────────────────────────────────────────────

  describe('hasDraftChanges()', () => {
    describe('for "new" extra', () => {
      it('returns false when name and price are empty', () => {
        component.newExtra = { name: '', defaultPriceInput: '' };
        expect(component.hasDraftChanges('new')).toBe(false);
      });

      it('returns true when name is non-empty', () => {
        component.newExtra = { name: 'Test', defaultPriceInput: '' };
        expect(component.hasDraftChanges('new')).toBe(true);
      });

      it('returns true when price input is non-empty even if name is empty', () => {
        component.newExtra = { name: '', defaultPriceInput: '10' };
        expect(component.hasDraftChanges('new')).toBe(true);
      });

      it('returns false for whitespace-only name', () => {
        component.newExtra = { name: '   ', defaultPriceInput: '' };
        expect(component.hasDraftChanges('new')).toBe(false);
      });
    });

    describe('for existing extra', () => {
      beforeEach(() => {
        extrasData.set([EXTRA_1]);
        TestBed.flushEffects();
      });

      it('returns false when draft matches original', () => {
        expect(component.hasDraftChanges(EXTRA_1.id)).toBe(false);
      });

      it('returns true when name has changed', () => {
        component.drafts[EXTRA_1.id].name = 'Nuevo nombre';
        expect(component.hasDraftChanges(EXTRA_1.id)).toBe(true);
      });

      it('returns true when price has changed', () => {
        component.drafts[EXTRA_1.id].defaultPrice = '20';
        expect(component.hasDraftChanges(EXTRA_1.id)).toBe(true);
      });

      it('returns true when price is cleared (15 → null)', () => {
        component.drafts[EXTRA_1.id].defaultPrice = '';
        expect(component.hasDraftChanges(EXTRA_1.id)).toBe(true);
      });

      it('returns false for unknown id (no draft or original)', () => {
        expect(component.hasDraftChanges(999)).toBe(false);
      });
    });
  });

  // ─── createExtra ─────────────────────────────────────────────────────────

  describe('createExtra()', () => {
    it('is a no-op when name is empty', () => {
      component.newExtra = { name: '', defaultPriceInput: '' };
      component.createExtra();
      expect(customExtraServiceMock.createExtra).not.toHaveBeenCalled();
    });

    it('is a no-op when name is whitespace-only', () => {
      component.newExtra = { name: '   ', defaultPriceInput: '' };
      component.createExtra();
      expect(customExtraServiceMock.createExtra).not.toHaveBeenCalled();
    });

    it('is a no-op when price input is empty', () => {
      component.newExtra = { name: 'Sal', defaultPriceInput: '' };
      component.createExtra();
      expect(customExtraServiceMock.createExtra).not.toHaveBeenCalled();
    });

    it('is a no-op when price input is invalid/non-numeric', () => {
      component.newExtra = { name: 'Sal', defaultPriceInput: 'gratis' };
      component.createExtra();
      expect(customExtraServiceMock.createExtra).not.toHaveBeenCalled();
    });

    it('calls createExtra with trimmed name and defaultPrice', () => {
      component.newExtra = { name: '  Sal  ', defaultPriceInput: '5.50' };
      component.createExtra();
      expect(customExtraServiceMock.createExtra).toHaveBeenCalledWith({ name: 'Sal', defaultPrice: 5.5 });
    });

    it('sets saving to "new" while the request is in-flight', () => {
      component.newExtra = { name: 'Sal', defaultPriceInput: '3' };
      component.createExtra();
      expect(component.saving()).toBe('new');
    });

    it('resets form, saving, and calls refreshExtras on success', () => {
      component.newExtra = { name: 'Sal', defaultPriceInput: '3' };
      component.createExtra();

      createExtraSubject.next({ ...EXTRA_1, name: 'Sal', defaultPrice: 3 });
      createExtraSubject.complete();

      expect(component.saving()).toBeNull();
      expect(component.newExtra.name).toBe('');
      expect(component.newExtra.defaultPriceInput).toBe('');
      expect(customExtraServiceMock.refreshExtras).toHaveBeenCalledTimes(1);
      expect(toastServiceMock.success).toHaveBeenCalledWith('Extra creado');
    });

    it('resets saving and shows error toast on failure', () => {
      component.newExtra = { name: 'Sal', defaultPriceInput: '3' };
      component.createExtra();

      createExtraSubject.error(new Error('Network error'));

      expect(component.saving()).toBeNull();
      expect(toastServiceMock.error).toHaveBeenCalledWith('Error al crear extra');
      expect(customExtraServiceMock.refreshExtras).not.toHaveBeenCalled();
    });
  });

  // ─── saveExtra ────────────────────────────────────────────────────────────

  describe('saveExtra()', () => {
    beforeEach(() => {
      extrasData.set([EXTRA_1]);
      TestBed.flushEffects();
    });

    it('calls updateExtra with the correct id, name, and parsed price', () => {
      component.drafts[EXTRA_1.id].name = 'Aguacate Hass';
      component.drafts[EXTRA_1.id].defaultPrice = '20';
      component.saveExtra(EXTRA_1);

      expect(customExtraServiceMock.updateExtra).toHaveBeenCalledWith(EXTRA_1.id, {
        name: 'Aguacate Hass',
        defaultPrice: 20,
      });
    });

    it('is a no-op when price input is empty', () => {
      component.drafts[EXTRA_1.id].defaultPrice = '';
      component.saveExtra(EXTRA_1);

      expect(customExtraServiceMock.updateExtra).not.toHaveBeenCalled();
    });

    it('sets saving to the extra id while in-flight', () => {
      component.drafts[EXTRA_1.id].defaultPrice = '20';
      component.saveExtra(EXTRA_1);
      expect(component.saving()).toBe(EXTRA_1.id);
    });

    it('resets saving and calls refreshExtras on success', () => {
      component.drafts[EXTRA_1.id].defaultPrice = '20';
      component.saveExtra(EXTRA_1);
      updateExtraSubject.next(EXTRA_1);
      updateExtraSubject.complete();

      expect(component.saving()).toBeNull();
      expect(customExtraServiceMock.refreshExtras).toHaveBeenCalledTimes(1);
    });
  });

  // ─── hasUnsavedChanges / discardChanges ───────────────────────────────────

  describe('hasUnsavedChanges()', () => {
    it('returns false when no extra is expanded', () => {
      component.expandedExtraId.set(null);
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('returns false when "new" is expanded but form is empty', () => {
      component.expandedExtraId.set('new');
      component.newExtra = { name: '', defaultPriceInput: '' };
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('returns true when expanded extra has unsaved draft changes', () => {
      extrasData.set([EXTRA_1]);
      TestBed.flushEffects();
      component.expandedExtraId.set(EXTRA_1.id);
      component.drafts[EXTRA_1.id].name = 'Changed';

      expect(component.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('discardChanges()', () => {
    it('resets the draft to original and clears expandedExtraId', () => {
      extrasData.set([EXTRA_1]);
      TestBed.flushEffects();
      component.expandedExtraId.set(EXTRA_1.id);
      component.drafts[EXTRA_1.id].name = 'Changed';

      component.discardChanges();

      expect(component.drafts[EXTRA_1.id].name).toBe(EXTRA_1.name);
      expect(component.expandedExtraId()).toBeNull();
    });

    it('does nothing when no extra is expanded', () => {
      component.expandedExtraId.set(null);
      component.discardChanges();
      expect(component.expandedExtraId()).toBeNull();
    });
  });

  // ─── computed signals ─────────────────────────────────────────────────────

  describe('activeExtras / inactiveExtras computed', () => {
    it('separates active from inactive extras', () => {
      const inactive: CustomExtra = { ...EXTRA_1, id: 3, active: false };
      extrasData.set([EXTRA_1, EXTRA_2, inactive]);
      TestBed.flushEffects();

      expect(component.activeExtras()).toHaveLength(2);
      expect(component.inactiveExtras()).toHaveLength(1);
      expect(component.inactiveExtras()[0].id).toBe(3);
    });

    it('sorts active extras alphabetically by name', () => {
      extrasData.set([EXTRA_2, EXTRA_1]); // Limón, Aguacate — should sort to Aguacate, Limón
      TestBed.flushEffects();

      expect(component.activeExtras()[0].name).toBe('Aguacate');
      expect(component.activeExtras()[1].name).toBe('Limón');
    });
  });

  // ─── deactivateExtra cleanup (issue #51) ─────────────────────────────────

  describe('deactivateExtra() cleanup', () => {
    beforeEach(() => {
      extrasData.set([EXTRA_1, EXTRA_2]);
      TestBed.flushEffects();
    });

    it('clears expandedExtraId and resets draft after success, so opening another row does not trigger the unsaved-changes dialog', async () => {
      component.expandedExtraId.set(EXTRA_1.id);
      component.drafts[EXTRA_1.id].name = 'Edited but not saved';

      await component.deactivateExtra(EXTRA_1);
      deleteExtraSubject.next();
      deleteExtraSubject.complete();

      expect(component.expandedExtraId()).toBeNull();
      expect(component.hasDraftChanges(EXTRA_1.id)).toBe(false);

      await component.onCollapseToggle(new Event('click'), EXTRA_2.id);

      expect(confirmDialogServiceMock.confirm).toHaveBeenCalledTimes(1);
      expect(component.expandedExtraId()).toBe(EXTRA_2.id);
    });

    it('does NOT clear expanded state on error', async () => {
      component.expandedExtraId.set(EXTRA_1.id);
      component.drafts[EXTRA_1.id].name = 'Edited';

      await component.deactivateExtra(EXTRA_1);
      deleteExtraSubject.error(new Error('boom'));

      expect(component.expandedExtraId()).toBe(EXTRA_1.id);
      expect(component.hasDraftChanges(EXTRA_1.id)).toBe(true);
    });
  });

  describe('permanentDeleteExtra() cleanup', () => {
    it('clears expandedInactiveId after success', async () => {
      const inactive: CustomExtra = { ...EXTRA_1, id: 5, active: false };
      extrasData.set([inactive]);
      TestBed.flushEffects();
      component.expandedInactiveId.set(inactive.id);

      await component.permanentDeleteExtra(inactive);
      deleteExtraSubject.next();
      deleteExtraSubject.complete();

      expect(component.expandedInactiveId()).toBeNull();
      expect(component.drafts[inactive.id]).toBeUndefined();
    });
  });
});
