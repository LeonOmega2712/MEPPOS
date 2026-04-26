import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryManagerComponent } from './category-manager';
import { CategoryService } from '../../../../core/services/category.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import type { Category } from '../../../../core/models';

const CAT_1: Category = {
  id: 1,
  name: 'Mariscos',
  description: null,
  basePrice: null,
  image: null,
  displayOrder: 0,
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  _count: { products: 0 },
};

const CAT_2: Category = { ...CAT_1, id: 2, name: 'Bebidas', displayOrder: 1 };

describe('CategoryManagerComponent — issue #51 cleanup', () => {
  let fixture: ComponentFixture<CategoryManagerComponent>;
  let component: CategoryManagerComponent;

  let categoriesData: ReturnType<typeof signal<Category[] | null>>;
  let deleteSubject: Subject<void>;
  let categoryServiceMock: any;
  let toastServiceMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let confirmDialogServiceMock: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    categoriesData = signal<Category[] | null>(null);
    deleteSubject = new Subject();

    categoryServiceMock = {
      categories: categoriesData.asReadonly(),
      categoriesLoading: signal(false).asReadonly(),
      categoriesRevalidating: signal(false).asReadonly(),
      categoriesError: signal<unknown>(null).asReadonly(),
      ensureCategories: vi.fn(),
      refreshCategories: vi.fn(),
      setCategoriesData: vi.fn(),
      createCategory: vi.fn().mockReturnValue(new Subject().asObservable()),
      updateCategory: vi.fn().mockReturnValue(new Subject().asObservable()),
      deleteCategory: vi.fn().mockReturnValue(deleteSubject.asObservable()),
      reorderCategories: vi.fn().mockReturnValue(new Subject().asObservable()),
    };

    toastServiceMock = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    confirmDialogServiceMock = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [CategoryManagerComponent],
      providers: [
        { provide: CategoryService, useValue: categoryServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: ConfirmDialogService, useValue: confirmDialogServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('deactivateCategory() cleanup', () => {
    beforeEach(() => {
      categoriesData.set([CAT_1, CAT_2]);
      TestBed.flushEffects();
    });

    it('clears expandedCategoryId and resets draft after success, so opening another row does not trigger the unsaved-changes dialog', async () => {
      component.expandedCategoryId.set(CAT_1.id);
      component.drafts[CAT_1.id].name = 'Edited but not saved';

      await component.deactivateCategory(CAT_1);
      deleteSubject.next();
      deleteSubject.complete();

      expect(component.expandedCategoryId()).toBeNull();
      expect(component.hasDraftChanges(CAT_1.id)).toBe(false);

      await component.onCollapseToggle(new Event('click'), CAT_2.id);

      expect(confirmDialogServiceMock.confirm).toHaveBeenCalledTimes(1);
      expect(component.expandedCategoryId()).toBe(CAT_2.id);
    });

    it('does NOT clear expanded state on error', async () => {
      component.expandedCategoryId.set(CAT_1.id);
      component.drafts[CAT_1.id].name = 'Edited';

      await component.deactivateCategory(CAT_1);
      deleteSubject.error(new Error('boom'));

      expect(component.expandedCategoryId()).toBe(CAT_1.id);
      expect(component.hasDraftChanges(CAT_1.id)).toBe(true);
    });
  });

  describe('permanentDeleteCategory() cleanup', () => {
    it('clears expandedInactiveId after success', async () => {
      const inactive: Category = { ...CAT_1, id: 5, active: false };
      categoriesData.set([inactive]);
      TestBed.flushEffects();
      component.expandedInactiveId.set(inactive.id);

      await component.permanentDeleteCategory(inactive);
      deleteSubject.next();
      deleteSubject.complete();

      expect(component.expandedInactiveId()).toBeNull();
      expect(component.drafts[inactive.id]).toBeUndefined();
    });
  });
});
