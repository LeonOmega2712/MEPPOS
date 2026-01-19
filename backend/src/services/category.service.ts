import { PrismaClient } from '@prisma/client';
import {
  CreateMenuCategoryInput,
  UpdateMenuCategoryInput,
  MenuCategoryFilterInput
} from '../validation/validation.schemas';

const prisma = new PrismaClient();

export class CategoryService {
  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get all categories (flat list)
   */
  async getAllCategories(filters?: MenuCategoryFilterInput) {
    const where: any = {};

    if (filters?.parentId !== undefined) {
      where.parentId = filters.parentId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return await prisma.menuCategory.findMany({
      where,
      include: {
        parent: true,
        _count: {
          select: {
            children: true,
            items: true
          }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  /**
   * Get category tree (hierarchical structure)
   */
  async getCategoryTree() {
    // Get all root categories (no parent)
    const rootCategories = await prisma.menuCategory.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    // Build tree recursively
    const tree = await Promise.all(
      rootCategories.map(cat => this.buildCategoryTree(cat.id))
    );

    return tree;
  }

  /**
   * Get a single category by ID
   */
  async getCategoryById(id: string) {
    const category = await prisma.menuCategory.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        },
        items: {
          where: { isActive: true },
          include: {
            variants: {
              where: { isActive: true },
              include: { variantType: true }
            }
          },
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: {
            children: true,
            items: true
          }
        }
      }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  /**
   * Get root categories (categories without parent)
   */
  async getRootCategories() {
    return await prisma.menuCategory.findMany({
      where: {
        parentId: null,
        isActive: true
      },
      include: {
        _count: {
          select: {
            children: true,
            items: true
          }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  // ============================================
  // CREATE OPERATIONS
  // ============================================

  /**
   * Create a new category
   */
  async createCategory(data: CreateMenuCategoryInput) {
    // Validate parent category if provided
    if (data.parentId) {
      const parent = await prisma.menuCategory.findUnique({
        where: { id: data.parentId }
      });

      if (!parent) {
        throw new Error('Parent category not found');
      }
    }

    return await prisma.menuCategory.create({
      data: {
        name: data.name,
        nameKey: data.nameKey,
        description: data.description,
        parentId: data.parentId,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true
      },
      include: {
        parent: true,
        _count: {
          select: {
            children: true,
            items: true
          }
        }
      }
    });
  }

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  /**
   * Update a category
   */
  async updateCategory(id: string, data: UpdateMenuCategoryInput) {
    const existingCategory = await prisma.menuCategory.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      throw new Error('Category not found');
    }

    // Prevent circular reference
    if (data.parentId === id) {
      throw new Error('A category cannot be its own parent');
    }

    // Validate parent category if provided
    if (data.parentId) {
      const parent = await prisma.menuCategory.findUnique({
        where: { id: data.parentId }
      });

      if (!parent) {
        throw new Error('Parent category not found');
      }

      // Check if new parent is a descendant (would create circular reference)
      const isDescendant = await this.isDescendant(id, data.parentId);
      if (isDescendant) {
        throw new Error('Cannot set a descendant category as parent (circular reference)');
      }
    }

    return await prisma.menuCategory.update({
      where: { id },
      data: {
        name: data.name,
        nameKey: data.nameKey,
        description: data.description,
        parentId: data.parentId,
        sortOrder: data.sortOrder,
        isActive: data.isActive
      },
      include: {
        parent: true,
        _count: {
          select: {
            children: true,
            items: true
          }
        }
      }
    });
  }

  // ============================================
  // DELETE OPERATIONS
  // ============================================

  /**
   * Delete a category (soft delete or hard delete)
   */
  async deleteCategory(id: string, hard = false) {
    const category = await prisma.menuCategory.findUnique({
      where: { id },
      include: {
        children: true,
        items: true
      }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Check if category has children or items
    if (category.children.length > 0) {
      throw new Error('Cannot delete category with subcategories. Delete or move subcategories first.');
    }

    if (category.items.length > 0) {
      throw new Error('Cannot delete category with items. Delete or move items first.');
    }

    if (hard) {
      // Hard delete
      await prisma.menuCategory.delete({
        where: { id }
      });
      return { message: 'Category deleted permanently' };
    } else {
      // Soft delete
      await prisma.menuCategory.update({
        where: { id },
        data: { isActive: false }
      });
      return { message: 'Category deactivated' };
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Build category tree recursively
   */
  private async buildCategoryTree(categoryId: string): Promise<any> {
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
      include: {
        items: {
          where: { isActive: true },
          include: {
            variants: {
              where: { isActive: true },
              include: { variantType: true },
              orderBy: { sortOrder: 'asc' }
            },
            ingredients: {
              include: { ingredient: true }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!category) {
      return null;
    }

    // Get children recursively
    const children = await prisma.menuCategory.findMany({
      where: {
        parentId: categoryId,
        isActive: true
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    const childrenTree = await Promise.all(
      children.map(child => this.buildCategoryTree(child.id))
    );

    return {
      ...category,
      children: childrenTree
    };
  }

  /**
   * Check if targetId is a descendant of categoryId
   */
  private async isDescendant(categoryId: string, targetId: string): Promise<boolean> {
    const children = await prisma.menuCategory.findMany({
      where: { parentId: categoryId },
      select: { id: true }
    });

    if (children.length === 0) {
      return false;
    }

    const childIds = children.map(c => c.id);

    if (childIds.includes(targetId)) {
      return true;
    }

    const descendantChecks = await Promise.all(
      childIds.map(id => this.isDescendant(id, targetId))
    );

    return descendantChecks.some(result => result);
  }

  /**
   * Get breadcrumb path for a category
   */
  async getCategoryPath(categoryId: string): Promise<any[]> {
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    if (!category.parentId) {
      return [category];
    }

    const parentPath = await this.getCategoryPath(category.parentId);
    return [...parentPath, category];
  }
}

export const categoryService = new CategoryService();