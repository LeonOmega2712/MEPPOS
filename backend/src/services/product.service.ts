import { prisma } from '../lib/prisma';
import { CreateProductDTO, UpdateProductDTO } from '../types/product.types';

export class ProductService {
  /**
   * Get all products
   */
  async getAllProducts() {
    return prisma.product.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            basePrice: true
          }
        }
      }
    });
  }

  /**
   * Get active products only
   */
  async getActiveProducts() {
    return prisma.product.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            basePrice: true
          }
        }
      }
    });
  }

  /**
   * Get product by ID
   */
  async getProductById(id: number) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true
      }
    });
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(categoryId: number) {
    return prisma.product.findMany({
      where: { categoryId },
      orderBy: { displayOrder: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            basePrice: true
          }
        }
      }
    });
  }

  /**
   * Get active products by category
   */
  async getActiveProductsByCategory(categoryId: number) {
    return prisma.product.findMany({
      where: {
        categoryId,
        active: true
      },
      orderBy: { displayOrder: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            basePrice: true
          }
        }
      }
    });
  }

  /**
   * Create a new product
   */
  async createProduct(data: CreateProductDTO) {
    return prisma.product.create({
      data,
      include: {
        category: true
      }
    });
  }

  /**
   * Update a product
   */
  async updateProduct(id: number, data: UpdateProductDTO) {
    return prisma.product.update({
      where: { id },
      data,
      include: {
        category: true
      }
    });
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: number) {
    return prisma.product.delete({
      where: { id }
    });
  }

  /**
   * Check if product exists
   */
  async productExists(id: number): Promise<boolean> {
    const count = await prisma.product.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * Get the effective price of a product (product price or category basePrice)
   */
  async getEffectivePrice(id: number): Promise<number | null> {
    const product = await this.getProductById(id);
    if (!product) return null;

    // If product has its own price, use it
    if (product.price !== null) {
      return Number(product.price);
    }

    // Otherwise, inherit from category
    if (product.category.basePrice !== null) {
      return Number(product.category.basePrice);
    }

    return null;
  }
}

export const productService = new ProductService();
