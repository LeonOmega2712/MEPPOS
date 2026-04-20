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
import { ProductService } from '../../../../core/services/product.service';
import { CategoryService } from '../../../../core/services/category.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon';
import type {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
  ProductDraft,
  Category
} from '../../../../core/models';

@Component({
  selector: 'app-product-manager',
  standalone: true,
  imports: [FormsModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, IconComponent],
  templateUrl: './product-manager.html',
  styleUrl: '../../../../shared/styles/manager.css',
})
export class ProductManagerComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  readonly loading = this.productService.productsLoading;
  readonly revalidating = this.productService.productsRevalidating;
  readonly error = this.productService.productsError;
  private readonly productsData = this.productService.productsData;

  private readonly optimisticProducts = signal<Product[] | null>(null);

  readonly products = computed<Product[]>(
    () => this.optimisticProducts() ?? this.productsData()?.products ?? []
  );

  readonly activeCategories = computed(() =>
    (this.categoryService.categories() ?? this.productsData()?.categories ?? [])
      .filter((c: Category) => c.active)
      .sort((a: Category, b: Category) => a.displayOrder - b.displayOrder)
  );

  saving = signal<number | 'new' | null>(null);
  reordering = signal<number | null>(null);
  dragHeight = signal(0);
  expandedCategoryId = signal<number | null>(null);
  expandedProductId = signal<number | 'new' | null>(null);
  expandedInactiveProductId = signal<number | null>(null);

  productsByCategory = computed(() => {
    const grouped = new Map<number, Product[]>();
    this.activeCategories().forEach((category) => {
      const categoryProducts = this.products()
        .filter((p) => p.active && p.categoryId === category.id)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      grouped.set(category.id, categoryProducts);
    });
    return grouped;
  });

  inactiveProducts = computed(() =>
    this.products()
      .filter((p) => !p.active)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  drafts: Record<number, ProductDraft> = {};
  newProduct: CreateProductPayload = this.emptyProduct();

  constructor() {
    effect(() => {
      const items = this.productsData()?.products;
      if (!items) return;
      untracked(() => {
        const ids = new Set(items.map((p) => p.id));
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
    this.productService.ensureProducts();
  }

  refresh(): void {
    this.productService.refreshProducts();
  }

  createProduct(): void {
    if (!this.newProduct.name.trim() || !this.newProduct.categoryId) return;
    if (!this.isValidDraftPrice(this.newProduct.price)) return;

    const inactive = this.inactiveProducts().find(
      (p) => p.name.toLowerCase() === this.newProduct.name.trim().toLowerCase()
    );

    if (inactive) {
      this.saving.set('new');
      const payload: UpdateProductPayload = {
        categoryId: this.newProduct.categoryId,
        name: this.newProduct.name.trim(),
        description: this.newProduct.description?.trim() || null,
        price: this.toNumberOrNull(this.newProduct.price),
        image: this.newProduct.image?.trim() || null,
        customizable: this.newProduct.customizable,
        active: true,
      };
      this.productService.updateProduct(inactive.id, payload).subscribe({
        next: () => {
          this.newProduct = this.emptyProduct();
          this.saving.set(null);
          this.toastService.info(`Producto "${inactive.name}" reactivado`);
          this.productService.refreshProducts();
        },
        error: () => {
          this.toastService.error('Error al reactivar producto');
          this.saving.set(null);
        },
      });
      return;
    }

    this.saving.set('new');
    const payload = this.buildCreatePayload();
    this.productService.createProduct(payload).subscribe({
      next: () => {
        this.newProduct = this.emptyProduct();
        this.saving.set(null);
        this.toastService.success('Producto creado');
        this.productService.refreshProducts();
      },
      error: (err) => {
        const message = err.error?.error === 'Category not found'
          ? 'La categoría seleccionada no existe'
          : 'Error al crear producto';
        this.toastService.error(message);
        this.saving.set(null);
      },
    });
  }

  saveProduct(product: Product): void {
    const draft = this.drafts[product.id];
    if (!draft) return;
    if (!this.isValidDraftPrice(draft.price)) return;

    this.saving.set(product.id);
    const payload: UpdateProductPayload = {
      categoryId: draft.categoryId,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price: this.toNumberOrNull(draft.price),
      image: draft.image.trim() || null,
      customizable: draft.customizable,
    };

    this.productService.updateProduct(product.id, payload).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Producto actualizado');
        this.productService.refreshProducts();
      },
      error: (err) => {
        const message = err.error?.error === 'Category not found'
          ? 'La categoría seleccionada no existe'
          : 'Error al actualizar producto';
        this.toastService.error(message);
        this.saving.set(null);
      },
    });
  }

  async deactivateProduct(product: Product): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Desactivar producto',
      message: `Se desactivará "${product.name}". ¿Desea continuar?`,
      confirmText: 'Desactivar',
    });
    if (!confirmed) return;

    this.saving.set(product.id);
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Producto desactivado');
        this.productService.refreshProducts();
      },
      error: () => {
        this.toastService.error('Error al desactivar producto');
        this.saving.set(null);
      },
    });
  }

  async permanentDeleteProduct(product: Product): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Eliminar producto permanentemente',
      message: `Esta acción es irreversible. Se eliminará "${product.name}" de forma permanente. Escriba el nombre del producto para confirmar:`,
      confirmText: 'Eliminar',
      requireInput: product.name,
    });
    if (!confirmed) return;

    this.saving.set(product.id);
    this.productService.deleteProduct(product.id, true).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Producto eliminado permanentemente');
        this.productService.refreshProducts();
      },
      error: () => {
        this.toastService.error('Error al eliminar producto');
        this.saving.set(null);
      },
    });
  }

  reactivateProduct(product: Product): void {
    this.saving.set(product.id);
    this.productService.updateProduct(product.id, { active: true }).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Producto reactivado');
        this.productService.refreshProducts();
      },
      error: () => {
        this.toastService.error('Error al reactivar producto');
        this.saving.set(null);
      },
    });
  }

  onDragHandleDown(event: PointerEvent): void {
    const row = (event.target as HTMLElement).closest('[cdkDrag]');
    if (row) this.dragHeight.set(row.getBoundingClientRect().height);
  }

  onDrop(event: CdkDragDrop<Product[]>, categoryId: number): void {
    if (event.previousIndex === event.currentIndex) return;

    const items = [...this.productsByCategory().get(categoryId)!];
    moveItemInArray(items, event.previousIndex, event.currentIndex);

    const updatedItems = items.map((prod, index) => ({ ...prod, displayOrder: index }));
    const otherProducts = this.products().filter((p) => p.categoryId !== categoryId);
    this.optimisticProducts.set([...otherProducts, ...updatedItems]);

    const productIds = items.map((p) => p.id);
    this.reordering.set(categoryId);

    this.productService.reorderProducts(categoryId, productIds).subscribe({
      next: () => {
        this.reordering.set(null);
        this.toastService.success('Orden actualizado');
        this.optimisticProducts.set(null);
      },
      error: () => {
        this.reordering.set(null);
        this.toastService.error('Error al actualizar orden');
        this.optimisticProducts.set(null);
        this.productService.refreshProducts();
      },
    });
  }

  hasUnsavedChanges(): boolean {
    const expandedId = this.expandedProductId();
    if (expandedId === null) return false;
    return this.hasDraftChanges(expandedId);
  }

  discardChanges(): void {
    const expandedId = this.expandedProductId();
    if (expandedId !== null) {
      this.resetDraft(expandedId);
      this.expandedProductId.set(null);
    }
  }

  async onCategoryToggle(event: Event, categoryId: number): Promise<void> {
    event.preventDefault();

    if (this.hasUnsavedChanges()) {
      const confirmed = await this.confirmDialogService.confirm({
        message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
      });
      if (!confirmed) return;
      this.discardChanges();
    }

    const isCurrentlyExpanded = this.expandedCategoryId() === categoryId;
    this.expandedProductId.set(null);
    this.expandedCategoryId.set(isCurrentlyExpanded ? null : categoryId);
  }

  async onCollapseToggle(event: Event, productId: number | 'new'): Promise<void> {
    event.preventDefault();

    const currentExpandedId = this.expandedProductId();
    const isCurrentlyExpanded = currentExpandedId === productId;

    if (isCurrentlyExpanded) {
      if (productId !== 'new' && this.hasDraftChanges(productId)) {
        const confirmed = await this.confirmDialogService.confirm({
          message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
        });
        if (!confirmed) return;
        this.resetDraft(productId);
      }
      this.expandedProductId.set(null);
    } else {
      if (currentExpandedId !== null) {
        if (this.hasDraftChanges(currentExpandedId)) {
          const confirmed = await this.confirmDialogService.confirm({
            message: 'Hay cambios sin guardar en otro producto. ¿Desea descartarlos?',
          });
          if (!confirmed) return;
          this.resetDraft(currentExpandedId);
        }
      }
      this.expandedProductId.set(productId);
    }
  }

  hasDraftChanges(productId: number | 'new'): boolean {
    if (productId === 'new') {
      return this.hasNewProductChanges();
    }
    const original = this.products().find((p) => p.id === productId);
    const draft = this.drafts[productId];
    if (!original || !draft) return false;
    return (
      draft.categoryId !== original.categoryId ||
      draft.name !== original.name ||
      (draft.description ?? '') !== (original.description ?? '') ||
      this.toNumberOrNull(draft.price) !== this.toNumberOrNull(original.price) ||
      (draft.image ?? '') !== (original.image ?? '') ||
      draft.customizable !== original.customizable
    );
  }

  resetDraft(productId: number | 'new'): void {
    if (productId === 'new') {
      this.resetNewProduct();
      return;
    }
    const original = this.products().find((p) => p.id === productId);
    if (original) {
      this.drafts[productId] = this.toDraft(original);
    }
  }

  hasNewProductChanges(): boolean {
    return (
      !!this.newProduct.name.trim() ||
      !!this.newProduct.description?.trim() ||
      this.toNumberOrNull(this.newProduct.price) != null ||
      !!this.newProduct.image?.trim() ||
      !!this.newProduct.customizable
    );
  }

  isValidDraftPrice(value: unknown): boolean {
    const price = this.toNumberOrNull(value);
    return price === null || price >= 0;
  }

  resetNewProduct(): void {
    this.newProduct = this.emptyProduct();
  }

  getEffectivePrice(product: Product): number | null {
    const price = product.price ?? product.category.basePrice;
    return this.toNumber(price);
  }

  private emptyProduct(): CreateProductPayload {
    return {
      categoryId: 0,
      name: '',
      description: '',
    };
  }

  private buildCreatePayload(): CreateProductPayload {
    const payload: CreateProductPayload = {
      categoryId: this.newProduct.categoryId,
      name: this.newProduct.name.trim(),
    };
    if (this.newProduct.description?.trim()) {
      payload.description = this.newProduct.description.trim();
    }
    const price = this.toNumberOrNull(this.newProduct.price);
    if (price != null && price > 0) {
      payload.price = price;
    }
    if (this.newProduct.image?.trim()) {
      payload.image = this.newProduct.image.trim();
    }
    if (this.newProduct.customizable) {
      payload.customizable = this.newProduct.customizable;
    }
    return payload;
  }

  private toDraft(product: Product): ProductDraft {
    return {
      categoryId: product.categoryId,
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      image: product.image ?? '',
      customizable: product.customizable,
    };
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  private toNumber(value: unknown): number | null {
    if (value == null) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
}
