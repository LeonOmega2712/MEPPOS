import { prisma } from '../lib/prisma';
import {
  CreateMenuItemInput,
  UpdateMenuItemInput,
  MenuItemFilterInput
} from '../validation/validation.schemas';

export class MenuService {
  // ============================================
  // MENU ITEMS - READ
  // ============================================

  /**
   * Get all menu items with filters
   */
  async getAllItems(filters?: MenuItemFilterInput) {
    const where: any = {};

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.isConfigurable !== undefined) {
      where.isConfigurable = filters.isConfigurable;
    }

    if (filters?.hasVariants !== undefined) {
      where.hasVariants = filters.hasVariants;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return await prisma.menuItem.findMany({
      where,
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: { variantType: true },
          orderBy: { sortOrder: 'asc' }
        },
        ingredients: {
          include: { ingredient: true }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  /**
   * Get a single menu item by ID
   */
  async getItemById(id: string) {
    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: { variantType: true },
          orderBy: { sortOrder: 'asc' }
        },
        ingredients: {
          include: { ingredient: true }
        }
      }
    });

    if (!item) {
      throw new Error('Menu item not found');
    }

    return item;
  }

  /**
   * Get menu items by category (including subcategories)
   */
  async getItemsByCategory(categoryId: string, includeSubcategories = false) {
    if (!includeSubcategories) {
      return await this.getAllItems({ categoryId });
    }

    // Get all descendant category IDs
    const categoryIds = await this.getDescendantCategoryIds(categoryId);
    categoryIds.push(categoryId);

    return await prisma.menuItem.findMany({
      where: {
        categoryId: { in: categoryIds },
        isActive: true
      },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: { variantType: true },
          orderBy: { sortOrder: 'asc' }
        },
        ingredients: {
          include: { ingredient: true }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  // ============================================
  // MENU ITEMS - CREATE
  // ============================================

  /**
   * Create a new menu item
   */
  async createItem(data: CreateMenuItemInput) {
    // Validate category exists
    const category = await prisma.menuCategory.findUnique({
      where: { id: data.categoryId }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Validate variant types if variants are provided
    if (data.hasVariants && data.variants) {
      const variantTypeIds = data.variants.map(v => v.variantTypeId);
      const variantTypes = await prisma.variantType.findMany({
        where: { id: { in: variantTypeIds } }
      });

      if (variantTypes.length !== new Set(variantTypeIds).size) {
        throw new Error('One or more variant types not found');
      }
    }

    // Validate ingredients if configurable
    if (data.isConfigurable && data.ingredientIds) {
      const ingredients = await prisma.ingredient.findMany({
        where: { id: { in: data.ingredientIds } }
      });

      if (ingredients.length !== data.ingredientIds.length) {
        throw new Error('One or more ingredients not found');
      }
    }

    // Create item with variants and ingredients
    return await prisma.menuItem.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        nameKey: data.nameKey,
        description: data.description,
        imageUrl: data.imageUrl,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        isConfigurable: data.isConfigurable ?? false,
        hasVariants: data.hasVariants,
        basePrice: data.basePrice,
        variants: data.hasVariants && data.variants ? {
          create: data.variants
        } : undefined,
        ingredients: data.isConfigurable && data.ingredientIds ? {
          create: data.ingredientIds.map(ingredientId => ({
            ingredientId,
            isDefault: false
          }))
        } : undefined
      },
      include: {
        category: true,
        variants: {
          include: { variantType: true },
          orderBy: { sortOrder: 'asc' }
        },
        ingredients: {
          include: { ingredient: true }
        }
      }
    });
  }

  // ============================================
  // MENU ITEMS - UPDATE
  // ============================================

  /**
   * Update a menu item
   */
  async updateItem(id: string, data: UpdateMenuItemInput) {
    // Check if item exists
    const existingItem = await prisma.menuItem.findUnique({
      where: { id }
    });

    if (!existingItem) {
      throw new Error('Menu item not found');
    }

    // Validate category if provided
    if (data.categoryId) {
      const category = await prisma.menuCategory.findUnique({
        where: { id: data.categoryId }
      });

      if (!category) {
        throw new Error('Category not found');
      }
    }

    // If updating variants, delete existing ones first
    if (data.variants) {
      await prisma.menuVariant.deleteMany({
        where: { menuItemId: id }
      });
    }

    // If updating ingredients, delete existing associations first
    if (data.ingredientIds) {
      await prisma.menuItemIngredient.deleteMany({
        where: { menuItemId: id }
      });
    }

    return await prisma.menuItem.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        name: data.name,
        nameKey: data.nameKey,
        description: data.description,
        imageUrl: data.imageUrl,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        isConfigurable: data.isConfigurable,
        hasVariants: data.hasVariants,
        basePrice: data.basePrice,
        variants: data.variants ? {
          create: data.variants
        } : undefined,
        ingredients: data.ingredientIds ? {
          create: data.ingredientIds.map(ingredientId => ({
            ingredientId,
            isDefault: false
          }))
        } : undefined
      },
      include: {
        category: true,
        variants: {
          include: { variantType: true },
          orderBy: { sortOrder: 'asc' }
        },
        ingredients: {
          include: { ingredient: true }
        }
      }
    });
  }

  // ============================================
  // MENU ITEMS - DELETE
  // ============================================

  /**
   * Delete a menu item (soft delete by setting isActive = false)
   */
  async deleteItem(id: string, hard = false) {
    const item = await prisma.menuItem.findUnique({
      where: { id }
    });

    if (!item) {
      throw new Error('Menu item not found');
    }

    if (hard) {
      // Hard delete (cascade will handle variants and ingredients)
      await prisma.menuItem.delete({
        where: { id }
      });
      return { message: 'Menu item deleted permanently' };
    } else {
      // Soft delete
      await prisma.menuItem.update({
        where: { id },
        data: { isActive: false }
      });
      return { message: 'Menu item deactivated' };
    }
  }

  // ============================================
  // VARIANTS - OPERATIONS
  // ============================================

  /**
   * Add a variant to an existing menu item
   */
  async addVariant(menuItemId: string, variantData: any) {
    const item = await prisma.menuItem.findUnique({
      where: { id: menuItemId }
    });

    if (!item) {
      throw new Error('Menu item not found');
    }

    if (!item.hasVariants) {
      throw new Error('This item does not support variants');
    }

    return await prisma.menuVariant.create({
      data: {
        menuItemId,
        ...variantData
      },
      include: {
        variantType: true
      }
    });
  }

  /**
   * Update a variant
   */
  async updateVariant(variantId: string, data: any) {
    return await prisma.menuVariant.update({
      where: { id: variantId },
      data,
      include: {
        variantType: true
      }
    });
  }

  /**
   * Delete a variant
   */
  async deleteVariant(variantId: string) {
    await prisma.menuVariant.delete({
      where: { id: variantId }
    });
    return { message: 'Variant deleted successfully' };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get all descendant category IDs (recursive)
   */
  private async getDescendantCategoryIds(categoryId: string): Promise<string[]> {
    const children = await prisma.menuCategory.findMany({
      where: { parentId: categoryId },
      select: { id: true }
    });

    if (children.length === 0) {
      return [];
    }

    const childIds = children.map(c => c.id);
    const descendantIds = await Promise.all(
      childIds.map(id => this.getDescendantCategoryIds(id))
    );

    return [...childIds, ...descendantIds.flat()];
  }
}

export const menuService = new MenuService();