import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();

  // ============================================
  // PRODUCTS WITH VARIANTS
  // ============================================

  const shrimpCocktail = await prisma.product.create({
    data: {
      name: 'Shrimp Cocktail',
      category: 'Cocktails',
      hasVariants: true,
      variants: {
        create: [
          { sizeName: 'Small', price: 100, sortOrder: 1 },
          { sizeName: 'Medium', price: 135, sortOrder: 2 },
          { sizeName: 'Large', price: 170, sortOrder: 3 }
        ]
      }
    }
  });

  const aguachile = await prisma.product.create({
    data: {
      name: 'Aguachile',
      category: 'Dishes',
      hasVariants: true,
      variants: {
        create: [
          { sizeName: 'Medium', price: 120, sortOrder: 1 },
          { sizeName: 'Large', price: 180, sortOrder: 2 }
        ]
      }
    }
  });

  const beer = await prisma.product.create({
    data: {
      name: 'Beer',
      category: 'Drinks',
      hasVariants: true,
      variants: {
        create: [
          { sizeName: 'Small', price: 30, sortOrder: 1 },
          { sizeName: 'Large', price: 60, sortOrder: 2 }
        ]
      }
    }
  });

  // ============================================
  // PRODUCTS WITHOUT VARIANTS
  // ============================================

  const soda = await prisma.product.create({
    data: {
      name: 'Soda',
      category: 'Drinks',
      hasVariants: false,
      basePrice: 25
    }
  });

  const water = await prisma.product.create({
    data: {
      name: 'Water',
      category: 'Drinks',
      hasVariants: false,
      basePrice: 15
    }
  });

  const cevicheTostadas = await prisma.product.create({
    data: {
      name: 'Ceviche Tostadas',
      category: 'Starters',
      hasVariants: false,
      basePrice: 80
    }
  });

  console.log('✅ Seed completed successfully!');
  console.log(`
  Products created:
  - ${shrimpCocktail.name} (${shrimpCocktail.hasVariants ? 'with variants' : 'no variants'})
  - ${aguachile.name} (${aguachile.hasVariants ? 'with variants' : 'no variants'})
  - ${beer.name} (${beer.hasVariants ? 'with variants' : 'no variants'})
  - ${soda.name} (${soda.hasVariants ? 'with variants' : 'no variants'})
  - ${water.name} (${water.hasVariants ? 'with variants' : 'no variants'})
  - ${cevicheTostadas.name} (${cevicheTostadas.hasVariants ? 'with variants' : 'no variants'})
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });