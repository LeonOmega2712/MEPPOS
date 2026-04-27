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
import { CategoryService } from '../../../../core/services/category.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon';
import { CurrencyInputDirective } from '../../../../shared/directives/currency-input.directive';
import type { Category, CategoryDraft, CreateCategoryPayload, UpdateCategoryPayload } from '../../../../core/models';

@Component({
  selector: 'app-category-manager',
  imports: [FormsModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, IconComponent, CurrencyInputDirective],
  templateUrl: './category-manager.html',
  styleUrl: '../../../../shared/styles/manager.css',
})
export class CategoryManagerComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  readonly loading = this.categoryService.categoriesLoading;
  readonly revalidating = this.categoryService.categoriesRevalidating;
  readonly error = this.categoryService.categoriesError;
  private readonly categories = this.categoryService.categories;

  saving = signal<number | 'new' | null>(null);
  reordering = signal(false);
  dragHeight = signal(0);
  expandedCategoryId = signal<number | 'new' | null>(null);
  expandedInactiveId = signal<number | null>(null);

  activeCategories = computed(() =>
    (this.categories() ?? [])
      .filter((c) => c.active)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  inactiveCategories = computed(() =>
    (this.categories() ?? [])
      .filter((c) => !c.active)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  drafts: Record<number, CategoryDraft> = {};
  newCategory: CreateCategoryPayload = this.emptyCategory();

  constructor() {
    effect(() => {
      const items = this.categories();
      if (!items) return;
      untracked(() => {
        const ids = new Set(items.map((c) => c.id));
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
    this.categoryService.ensureCategories();
  }

  refresh(): void {
    this.categoryService.refreshCategories();
  }

  createCategory(): void {
    if (!this.newCategory.name.trim()) return;
    if (!this.isValidDraftPrice(this.newCategory.basePrice)) return;

    const inactive = this.inactiveCategories().find(
      (c) => c.name.toLowerCase() === this.newCategory.name.trim().toLowerCase()
    );

    if (inactive) {
      this.saving.set('new');
      const payload: UpdateCategoryPayload = {
        name: this.newCategory.name.trim(),
        description: this.newCategory.description?.trim() || null,
        basePrice: this.toNumberOrNull(this.newCategory.basePrice),
        image: this.newCategory.image?.trim() || null,
        active: true,
      };
      this.categoryService.updateCategory(inactive.id, payload).subscribe({
        next: () => {
          this.newCategory = this.emptyCategory();
          this.saving.set(null);
          this.toastService.info(`Categoría "${inactive.name}" reactivada`);
          this.categoryService.refreshCategories();
        },
        error: () => {
          this.toastService.error('Error al reactivar categoría');
          this.saving.set(null);
        },
      });
      return;
    }

    this.saving.set('new');
    const payload = this.buildCreatePayload();
    this.categoryService.createCategory(payload).subscribe({
      next: () => {
        this.newCategory = this.emptyCategory();
        this.saving.set(null);
        this.toastService.success('Categoría creada');
        this.categoryService.refreshCategories();
      },
      error: () => {
        this.toastService.error('Error al crear categoría');
        this.saving.set(null);
      },
    });
  }

  saveCategory(category: Category): void {
    const draft = this.drafts[category.id];
    if (!draft) return;
    if (!this.isValidDraftPrice(draft.basePrice)) return;
    this.saving.set(category.id);
    const payload: UpdateCategoryPayload = {
      name: draft.name,
      description: draft.description,
      basePrice: this.toNumberOrNull(draft.basePrice),
      image: draft.image,
    };
    this.categoryService.updateCategory(category.id, payload).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Categoría actualizada');
        this.categoryService.refreshCategories();
      },
      error: () => {
        this.toastService.error('Error al actualizar categoría');
        this.saving.set(null);
      },
    });
  }

  hasUnsavedChanges(): boolean {
    const expandedId = this.expandedCategoryId();
    if (expandedId === null) return false;
    return this.hasDraftChanges(expandedId);
  }

  discardChanges(): void {
    const expandedId = this.expandedCategoryId();
    if (expandedId !== null) {
      this.resetDraft(expandedId);
      this.expandedCategoryId.set(null);
    }
  }

  async onCollapseToggle(event: Event, categoryId: number | 'new'): Promise<void> {
    event.preventDefault();

    const currentExpandedId = this.expandedCategoryId();
    const isCurrentlyExpanded = currentExpandedId === categoryId;

    if (isCurrentlyExpanded) {
      if (categoryId !== 'new' && this.hasDraftChanges(categoryId)) {
        const confirmed = await this.confirmDialogService.confirm({
          message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
        });
        if (!confirmed) return;
        this.resetDraft(categoryId);
      }
      this.expandedCategoryId.set(null);
    } else {
      if (currentExpandedId !== null) {
        if (this.hasDraftChanges(currentExpandedId)) {
          const confirmed = await this.confirmDialogService.confirm({
            message: 'Hay cambios sin guardar en otra categoría. ¿Desea descartarlos?',
          });
          if (!confirmed) return;
          this.resetDraft(currentExpandedId);
        }
      }
      this.expandedCategoryId.set(categoryId);
    }
  }

  hasDraftChanges(categoryId: number | 'new'): boolean {
    if (categoryId === 'new') {
      return this.hasNewCategoryChanges();
    }
    const original = (this.categories() ?? []).find((c) => c.id === categoryId);
    const draft = this.drafts[categoryId];
    if (!original || !draft) return false;
    return (
      draft.name !== original.name ||
      (draft.description ?? '') !== (original.description ?? '') ||
      this.toNumberOrNull(draft.basePrice) !== this.toNumberOrNull(original.basePrice) ||
      (draft.image ?? '') !== (original.image ?? '')
    );
  }

  resetDraft(categoryId: number | 'new'): void {
    if (categoryId === 'new') {
      this.resetNewCategory();
      return;
    }
    const original = (this.categories() ?? []).find((c) => c.id === categoryId);
    if (original) {
      this.drafts[categoryId] = this.toDraft(original);
    }
  }

  onDragHandleDown(event: PointerEvent): void {
    const row = (event.target as HTMLElement).closest('[cdkDrag]');
    if (row) this.dragHeight.set(row.getBoundingClientRect().height);
  }

  onDrop(event: CdkDragDrop<Category[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const items = [...this.activeCategories()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);

    const updatedItems = items.map((cat, index) => ({ ...cat, displayOrder: index }));
    this.categoryService.setCategoriesData([...updatedItems, ...this.inactiveCategories()]);

    const categoryIds = items.map((c) => c.id);
    this.reordering.set(true);

    this.categoryService.reorderCategories(categoryIds).subscribe({
      next: () => {
        this.reordering.set(false);
        this.toastService.success('Orden actualizado');
      },
      error: () => {
        this.reordering.set(false);
        this.toastService.error('Error al actualizar orden');
        this.categoryService.refreshCategories();
      },
    });
  }

  async deactivateCategory(category: Category): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Desactivar categoría',
      message: `Se desactivará "${category.name}" y todos sus productos. ¿Desea continuar?`,
      confirmText: 'Desactivar',
    });
    if (!confirmed) return;
    this.saving.set(category.id);
    this.categoryService.deleteCategory(category.id).subscribe({
      next: () => {
        this.saving.set(null);
        this.clearDraftAndCollapse(category.id);
        this.toastService.success('Categoría desactivada');
        this.categoryService.refreshCategories();
      },
      error: () => {
        this.toastService.error('Error al desactivar categoría');
        this.saving.set(null);
      },
    });
  }

  reactivateCategory(category: Category): void {
    this.saving.set(category.id);
    this.categoryService.updateCategory(category.id, { active: true }).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Categoría reactivada');
        this.categoryService.refreshCategories();
      },
      error: () => {
        this.toastService.error('Error al reactivar categoría');
        this.saving.set(null);
      },
    });
  }

  async permanentDeleteCategory(category: Category): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Eliminar categoría permanentemente',
      message: `Esta acción es irreversible. Se eliminará "${category.name}" y todos sus productos de forma permanente. Escriba el nombre de la categoría para confirmar:`,
      confirmText: 'Eliminar',
      requireInput: category.name,
    });
    if (!confirmed) return;
    this.saving.set(category.id);
    this.categoryService.deleteCategory(category.id, true).subscribe({
      next: () => {
        this.saving.set(null);
        this.clearDraftAndCollapse(category.id);
        this.toastService.success('Categoría eliminada permanentemente');
        this.categoryService.refreshCategories();
      },
      error: () => {
        this.toastService.error('Error al eliminar categoría');
        this.saving.set(null);
      },
    });
  }

  hasNewCategoryChanges(): boolean {
    return (
      !!this.newCategory.name.trim() ||
      !!this.newCategory.description?.trim() ||
      this.toNumberOrNull(this.newCategory.basePrice) != null ||
      !!this.newCategory.image?.trim()
    );
  }

  isValidDraftPrice(value: unknown): boolean {
    const price = this.toNumberOrNull(value);
    return price === null || price >= 0;
  }

  resetNewCategory(): void {
    this.newCategory = this.emptyCategory();
  }

  private clearDraftAndCollapse(categoryId: number): void {
    delete this.drafts[categoryId];
    if (this.expandedCategoryId() === categoryId) this.expandedCategoryId.set(null);
    if (this.expandedInactiveId() === categoryId) this.expandedInactiveId.set(null);
  }

  private emptyCategory(): CreateCategoryPayload {
    return { name: '', description: '' };
  }

  private buildCreatePayload(): CreateCategoryPayload {
    const payload: CreateCategoryPayload = {
      name: this.newCategory.name.trim(),
    };
    if (this.newCategory.description?.trim()) {
      payload.description = this.newCategory.description.trim();
    }
    const basePrice = this.toNumberOrNull(this.newCategory.basePrice);
    if (basePrice != null && basePrice > 0) {
      payload.basePrice = basePrice;
    }
    if (this.newCategory.image?.trim()) {
      payload.image = this.newCategory.image.trim();
    }
    return payload;
  }

  private toDraft(category: Category): CategoryDraft {
    return {
      name: category.name,
      description: category.description ?? '',
      basePrice: category.basePrice,
      image: category.image ?? '',
    };
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
}
