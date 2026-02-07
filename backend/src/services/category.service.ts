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
    return prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        basePrice: data.basePrice,
        image: data.image,
        displayOrder: data.displayOrder,
        active: data.active
      }
    });
  }

  /**
   * Update a category
   */
  async updateCategory(id: number, data: UpdateCategoryDTO) {
    return prisma.category.update({
      where: { id },
      data
    });
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: number) {
    return prisma.category.delete({
      where: { id }
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
}

export const categoryService = new CategoryService();
