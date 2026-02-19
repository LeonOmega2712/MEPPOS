import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
  styleUrl: './product-manager.css',
})
export class ProductManagerComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal<number | 'new' | null>(null);
  reordering = signal<number | null>(null);
  dragHeight = signal(0);
  expandedCategoryId = signal<number | null>(null);
  expandedProductId = signal<number | 'new' | null>(null);
  expandedInactiveProductId = signal<number | null>(null);

  activeCategories = computed(() =>
    this.categories()
      .filter((c) => c.active)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

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

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    if (this.products().length === 0) {
      this.loading.set(true);
    }
    this.productService.getProducts().subscribe({
      next: ({ products, categories }) => {
        this.products.set(products);
        this.categories.set(categories);
        this.initDrafts(products);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Error al cargar productos');
        this.loading.set(false);
      },
    });
  }

  createProduct(): void {
    if (!this.newProduct.name.trim() || !this.newProduct.categoryId) return;

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
          this.loadProducts();
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
        this.loadProducts();
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
        this.loadProducts();
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
        this.loadProducts();
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
        this.loadProducts();
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
        this.loadProducts();
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

    // Optimistically update UI
    const updatedItems = items.map((prod, index) => ({ ...prod, displayOrder: index }));
    const otherProducts = this.products().filter((p) => p.categoryId !== categoryId);
    this.products.set([...otherProducts, ...updatedItems]);

    // Extract ordered IDs for backend
    const productIds = items.map(p => p.id);

    this.reordering.set(categoryId);

    // Single API call with transaction
    this.productService.reorderProducts(categoryId, productIds).subscribe({
      next: () => {
        this.reordering.set(null);
        this.toastService.success('Orden actualizado');
      },
      error: () => {
        this.reordering.set(null);
        this.toastService.error('Error al actualizar orden');
        this.loadProducts();
      },
    });
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
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

  private initDrafts(products: Product[]): void {
    this.drafts = {};
    for (const prod of products) {
      this.drafts[prod.id] = this.toDraft(prod);
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

  resetNewProduct(): void {
    this.newProduct = this.emptyProduct();
  }

  getEffectivePrice(product: Product): number | null {
    const price = product.price ?? product.category.basePrice;
    return this.toNumber(price);
  }

  private toNumber(value: unknown): number | null {
    if (value == null) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
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
      // Closing the current collapse
      if (productId !== 'new' && this.hasDraftChanges(productId)) {
        const confirmed = await this.confirmDialogService.confirm({
          message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
        });
        if (!confirmed) return;
        this.resetDraft(productId);
      }
      this.expandedProductId.set(null);
    } else {
      // Opening a new collapse
      if (currentExpandedId !== null) {
        // Check if current expanded has unsaved changes
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
}
