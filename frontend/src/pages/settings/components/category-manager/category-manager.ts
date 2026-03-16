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
import { CategoryService } from '../../../../core/services/category.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon';
import type { Category, CategoryDraft, CreateCategoryPayload, UpdateCategoryPayload } from '../../../../core/models';

@Component({
  selector: 'app-category-manager',
  imports: [FormsModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, IconComponent],
  templateUrl: './category-manager.html',
  styleUrl: '../../../../shared/styles/manager.css',
})
export class CategoryManagerComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal<number | 'new' | null>(null);
  reordering = signal(false);
  dragHeight = signal(0);
  expandedCategoryId = signal<number | 'new' | null>(null);
  expandedInactiveId = signal<number | null>(null);

  activeCategories = computed(() =>
    this.categories()
      .filter((c) => c.active)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  inactiveCategories = computed(() =>
    this.categories()
      .filter((c) => !c.active)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  drafts: Record<number, CategoryDraft> = {};
  newCategory: CreateCategoryPayload = this.emptyCategory();

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    if (this.categories().length === 0) {
      this.loading.set(true);
    }
    this.categoryService.getCategories().subscribe({
      next: (data) => {
        this.categories.set(data);
        this.initDrafts(data);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Error al cargar categorías');
        this.loading.set(false);
      },
    });
  }

  createCategory(): void {
    if (!this.newCategory.name.trim()) return;

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
          this.loadCategories();
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
        this.loadCategories();
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
        this.loadCategories();
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
      // Closing the current collapse
      if (categoryId !== 'new' && this.hasDraftChanges(categoryId)) {
        const confirmed = await this.confirmDialogService.confirm({
          message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
        });
        if (!confirmed) return;
        this.resetDraft(categoryId);
      }
      this.expandedCategoryId.set(null);
    } else {
      // Opening a new collapse
      if (currentExpandedId !== null) {
        // Check if current expanded has unsaved changes
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
    const original = this.categories().find((c) => c.id === categoryId);
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
    const original = this.categories().find((c) => c.id === categoryId);
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

    // Optimistically update UI
    const updatedItems = items.map((cat, index) => ({ ...cat, displayOrder: index }));
    this.categories.set([...updatedItems, ...this.inactiveCategories()]);

    const categoryIds = items.map(c => c.id);

    this.reordering.set(true);

    this.categoryService.reorderCategories(categoryIds).subscribe({
      next: () => {
        this.reordering.set(false);
        this.toastService.success('Orden actualizado');
      },
      error: () => {
        this.reordering.set(false);
        this.toastService.error('Error al actualizar orden');
        this.loadCategories();
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
        this.toastService.success('Categoría desactivada');
        this.loadCategories();
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
        this.loadCategories();
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
        this.toastService.success('Categoría eliminada permanentemente');
        this.loadCategories();
      },
      error: () => {
        this.toastService.error('Error al eliminar categoría');
        this.saving.set(null);
      },
    });
  }

  private initDrafts(categories: Category[]): void {
    this.drafts = {};
    for (const cat of categories) {
      this.drafts[cat.id] = this.toDraft(cat);
    }
  }

  private toDraft(category: Category): CategoryDraft {
    return {
      name: category.name,
      description: category.description ?? '',
      basePrice: category.basePrice,
      image: category.image ?? '',
    };
  }


  hasNewCategoryChanges(): boolean {
    return (
      !!this.newCategory.name.trim() ||
      !!this.newCategory.description?.trim() ||
      this.toNumberOrNull(this.newCategory.basePrice) != null ||
      !!this.newCategory.image?.trim()
    );
  }

  resetNewCategory(): void {
    this.newCategory = this.emptyCategory();
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

  private toNumberOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
}
