import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductManagerComponent } from './product-manager';
import { ProductService, type ProductsWithCategories } from '../../../../core/services/product.service';
import { CategoryService } from '../../../../core/services/category.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import type { Product, Category } from '../../../../core/models';

const CAT_A: Category = {
  id: 10,
  name: 'Mariscos',
  description: null,
  basePrice: null,
  image: null,
  displayOrder: 0,
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  _count: { products: 2 },
};

const PROD_1: Product = {
  id: 1,
  categoryId: CAT_A.id,
  name: 'Camarón al ajillo',
  description: null,
  price: 100,
  image: null,
  displayOrder: 0,
  customizable: false,
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  category: { id: CAT_A.id, name: CAT_A.name, basePrice: null },
};

const PROD_2: Product = { ...PROD_1, id: 2, name: 'Pulpo', displayOrder: 1 };

describe('ProductManagerComponent — issue #51 cleanup', () => {
  let fixture: ComponentFixture<ProductManagerComponent>;
  let component: ProductManagerComponent;

  let productsData: ReturnType<typeof signal<ProductsWithCategories | null>>;
  let categoriesData: ReturnType<typeof signal<Category[] | null>>;
  let deleteSubject: Subject<void>;

  let productServiceMock: any;
  let categoryServiceMock: any;
  let toastServiceMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let confirmDialogServiceMock: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    productsData = signal<ProductsWithCategories | null>(null);
    categoriesData = signal<Category[] | null>([CAT_A]);
    deleteSubject = new Subject();

    productServiceMock = {
      productsData: productsData.asReadonly(),
      productsLoading: signal(false).asReadonly(),
      productsRevalidating: signal(false).asReadonly(),
      productsError: signal<unknown>(null).asReadonly(),
      ensureProducts: vi.fn(),
      refreshProducts: vi.fn(),
      createProduct: vi.fn().mockReturnValue(new Subject().asObservable()),
      updateProduct: vi.fn().mockReturnValue(new Subject().asObservable()),
      deleteProduct: vi.fn().mockReturnValue(deleteSubject.asObservable()),
      reorderProducts: vi.fn().mockReturnValue(new Subject().asObservable()),
    };

    categoryServiceMock = { categories: categoriesData.asReadonly() };

    toastServiceMock = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    confirmDialogServiceMock = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ProductManagerComponent],
      providers: [
        { provide: ProductService, useValue: productServiceMock },
        { provide: CategoryService, useValue: categoryServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: ConfirmDialogService, useValue: confirmDialogServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('deactivateProduct() cleanup', () => {
    beforeEach(() => {
      productsData.set({ products: [PROD_1, PROD_2], categories: [CAT_A] });
      TestBed.flushEffects();
    });

    it('clears expandedProductId and resets draft after success, so opening another row does not trigger the unsaved-changes dialog', async () => {
      component.expandedProductId.set(PROD_1.id);
      component.drafts[PROD_1.id].name = 'Edited but not saved';

      await component.deactivateProduct(PROD_1);
      deleteSubject.next();
      deleteSubject.complete();

      expect(component.expandedProductId()).toBeNull();
      expect(component.hasDraftChanges(PROD_1.id)).toBe(false);

      await component.onCollapseToggle(new Event('click'), PROD_2.id);

      expect(confirmDialogServiceMock.confirm).toHaveBeenCalledTimes(1);
      expect(component.expandedProductId()).toBe(PROD_2.id);
    });

    it('does NOT clear expanded state on error', async () => {
      component.expandedProductId.set(PROD_1.id);
      component.drafts[PROD_1.id].name = 'Edited';

      await component.deactivateProduct(PROD_1);
      deleteSubject.error(new Error('boom'));

      expect(component.expandedProductId()).toBe(PROD_1.id);
      expect(component.hasDraftChanges(PROD_1.id)).toBe(true);
    });
  });

  describe('permanentDeleteProduct() cleanup', () => {
    it('clears expandedInactiveProductId after success', async () => {
      const inactive: Product = { ...PROD_1, id: 5, active: false };
      productsData.set({ products: [inactive], categories: [CAT_A] });
      TestBed.flushEffects();
      component.expandedInactiveProductId.set(inactive.id);

      await component.permanentDeleteProduct(inactive);
      deleteSubject.next();
      deleteSubject.complete();

      expect(component.expandedInactiveProductId()).toBeNull();
      expect(component.drafts[inactive.id]).toBeUndefined();
    });
  });
});
