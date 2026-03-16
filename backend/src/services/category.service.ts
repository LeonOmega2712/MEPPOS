import { closeDisplayOrderGaps } from '../lib/display-order';
import { prisma } from '../lib/prisma';
import { CreateCategoryDTO, UpdateCategoryDTO } from '../types/category.types';

export class CategoryService {
  /**
   * Get all categories
   */
  async getAllCategories() {
    return prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
  }

  /**
   * Get active categories only
   */
  async getActiveCategories() {
    return prisma.category.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: number) {
    return prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });
  }

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryDTO) {
    const maxOrder = await prisma.category.aggregate({
      where: { active: true },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    return prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        basePrice: data.basePrice,
        image: data.image,
        displayOrder: data.displayOrder ?? nextOrder,
        active: data.active
      }
    });
  }

  /**
   * Update a category
   */
  async updateCategory(id: number, data: UpdateCategoryDTO) {
    if (data.active === true) {
      // Check if this is a reactivation (currently inactive)
      const current = await prisma.category.findUnique({
        where: { id },
        select: { active: true, displayOrder: true },
      });

      if (current && !current.active) {
        return prisma.$transaction(async (tx) => {
          // Shift active categories at or after the reactivated position
          await tx.category.updateMany({
            where: {
              active: true,
              displayOrder: { gte: current.displayOrder },
            },
            data: { displayOrder: { increment: 1 } },
          });

          return tx.category.update({
            where: { id },
            data,
          });
        });
      }
    }

    return prisma.category.update({
      where: { id },
      data
    });
  }

  /**
   * Deactivate a category and its products (set active = false)
   */
  async deactivateCategory(id: number) {
    return prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { categoryId: id },
        data: { active: false },
      });

      await tx.category.update({
        where: { id },
        data: { active: false },
      });

      await closeDisplayOrderGaps(tx, 'category');
    });
  }

  /**
   * Permanently delete a category (cascades to products)
   */
  async deleteCategory(id: number) {
    return prisma.category.delete({
      where: { id },
    });
  }

  /**
   * Check if category exists
   */
  async categoryExists(id: number): Promise<boolean> {
    const count = await prisma.category.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * Reorder all categories atomically
   * @param categoryIds - Ordered array of category IDs (index = displayOrder)
   * @returns Number of categories updated
   */
  async reorderCategories(categoryIds: number[]): Promise<number> {
    // Validate all categories exist
    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        active: true
      },
      select: { id: true }
    });

    if (categories.length !== categoryIds.length) {
      const foundIds = categories.map(c => c.id);
      const missingIds = categoryIds.filter(id => !foundIds.includes(id));
      throw new Error(`Invalid category IDs: ${missingIds.join(', ')}`);
    }

    // Check for duplicates
    const uniqueIds = new Set(categoryIds);
    if (uniqueIds.size !== categoryIds.length) {
      throw new Error('Duplicate category IDs in reorder request');
    }

    // Build transaction: update each category with its new displayOrder
    const updateOperations = categoryIds.map((categoryId, index) =>
      prisma.category.update({
        where: { id: categoryId },
        data: { displayOrder: index }
      })
    );

    // Execute all updates in a single atomic transaction
    await prisma.$transaction(updateOperations);

    return categoryIds.length;
  }
}

export const categoryService = new CategoryService();
