import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

interface ProductRow {
  price: Prisma.Decimal | null;
  category: { basePrice: Prisma.Decimal | null };
}

function computeEffectivePrice(product: ProductRow): number | null {
  if (product.price !== null) return Number(product.price);
  if (product.category.basePrice !== null) return Number(product.category.basePrice);
  return null;
}

export class MenuService {
  async getFullMenu() {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        products: {
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
          include: {
            category: {
              select: { basePrice: true }
            }
          }
        }
      }
    });

    return categories.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      basePrice: category.basePrice ? Number(category.basePrice) : null,
      image: category.image,
      displayOrder: category.displayOrder,
      products: category.products.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: computeEffectivePrice(product),
        image: product.image,
        displayOrder: product.displayOrder,
        customizable: product.customizable,
      }))
    }));
  }
}

export const menuService = new MenuService();
