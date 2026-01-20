import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting menu database seed...');

  // Clear existing data in correct order
  await prisma.menuItemIngredient.deleteMany();
  await prisma.menuVariant.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.variantType.deleteMany();
  await prisma.menuCategory.deleteMany();

  console.log('✅ Cleared existing data');

  // ============================================
  // VARIANT TYPES
  // ============================================
  const sizeType = await prisma.variantType.create({
    data: { name: 'Tamaño', nameKey: 'size', sortOrder: 1 }
  });

  const typeType = await prisma.variantType.create({
    data: { name: 'Tipo', nameKey: 'type', sortOrder: 2 }
  });

  const flavorType = await prisma.variantType.create({
    data: { name: 'Sabor', nameKey: 'flavor', sortOrder: 3 }
  });

  await prisma.variantType.create({
    data: { name: 'Marca', nameKey: 'brand', sortOrder: 4 }
  });

  console.log('✅ Created variant types');

  // ============================================
  // INGREDIENTS (Seafood)
  // ============================================
  const camaron = await prisma.ingredient.create({
    data: { name: 'Camarón', nameKey: 'shrimp', sortOrder: 1 }
  });

  const calamar = await prisma.ingredient.create({
    data: { name: 'Calamar', nameKey: 'squid', sortOrder: 2 }
  });

  const ostion = await prisma.ingredient.create({
    data: { name: 'Ostión', nameKey: 'oyster', sortOrder: 3 }
  });

  const abulon = await prisma.ingredient.create({
    data: { name: 'Abulón', nameKey: 'abalone', sortOrder: 4 }
  });

  const allSeafood = [camaron, calamar, ostion, abulon];

  console.log('✅ Created ingredients');

  // ============================================
  // CATEGORIES
  // ============================================

  // Root categories
  const catAlimentos = await prisma.menuCategory.create({
    data: { name: 'Alimentos', nameKey: 'food', sortOrder: 1 }
  });

  const catBebidas = await prisma.menuCategory.create({
    data: { name: 'Bebidas', nameKey: 'drinks', sortOrder: 2 }
  });

  // Bebidas subcategories
  const catRefresco = await prisma.menuCategory.create({
    data: {
      name: 'Refresco',
      nameKey: 'soda',
      parentId: catBebidas.id,
      sortOrder: 1
    }
  });

  const catCerveza = await prisma.menuCategory.create({
    data: {
      name: 'Cerveza',
      nameKey: 'beer',
      parentId: catBebidas.id,
      sortOrder: 2
    }
  });

  const catAgua = await prisma.menuCategory.create({
    data: {
      name: 'Agua',
      nameKey: 'water',
      parentId: catBebidas.id,
      sortOrder: 3
    }
  });

  // Refresco subcategories
  const catRefrescoTaparrosca = await prisma.menuCategory.create({
    data: {
      name: 'Taparrosca',
      nameKey: 'screw_cap',
      parentId: catRefresco.id,
      sortOrder: 1
    }
  });

  const catRefrescoLata = await prisma.menuCategory.create({
    data: {
      name: 'Lata',
      nameKey: 'can',
      parentId: catRefresco.id,
      sortOrder: 2
    }
  });

  const catRefrescoRetornable = await prisma.menuCategory.create({
    data: {
      name: 'Retornable',
      nameKey: 'returnable',
      parentId: catRefresco.id,
      sortOrder: 3
    }
  });

  // Cerveza subcategories
  const catCervezaMedia = await prisma.menuCategory.create({
    data: {
      name: 'Media',
      nameKey: 'regular',
      parentId: catCerveza.id,
      sortOrder: 1
    }
  });

  const catCervezaPremium = await prisma.menuCategory.create({
    data: {
      name: 'Premium',
      nameKey: 'premium',
      parentId: catCerveza.id,
      sortOrder: 2
    }
  });

  const catCervezaLata = await prisma.menuCategory.create({
    data: {
      name: 'Lata',
      nameKey: 'can',
      parentId: catCerveza.id,
      sortOrder: 3
    }
  });

  // Agua subcategories
  const catAguaSabor = await prisma.menuCategory.create({
    data: {
      name: 'Sabor',
      nameKey: 'flavored',
      parentId: catAgua.id,
      sortOrder: 3
    }
  });

  const catAguaJugo = await prisma.menuCategory.create({
    data: {
      name: 'Jugo',
      nameKey: 'juice',
      parentId: catAgua.id,
      sortOrder: 4
    }
  });

  console.log('✅ Created categories');

  // ============================================
  // MENU ITEMS - ALIMENTOS
  // ============================================

  // Cóctel de mariscos (configurable)
  const coctelMariscos = await prisma.menuItem.create({
    data: {
      categoryId: catAlimentos.id,
      name: 'Cóctel de Mariscos',
      nameKey: 'seafood_cocktail',
      description: 'Cóctel de mariscos fresco con salsa especial',
      isConfigurable: true,
      hasVariants: true,
      sortOrder: 1
    }
  });

  // Add seafood ingredients to cocktail
  for (const seafood of allSeafood) {
    await prisma.menuItemIngredient.create({
      data: {
        menuItemId: coctelMariscos.id,
        ingredientId: seafood.id,
        isDefault: false
      }
    });
  }

  // Cocktail variants (sizes)
  await prisma.menuVariant.createMany({
    data: [
      {
        menuItemId: coctelMariscos.id,
        variantTypeId: sizeType.id,
        name: 'Chico',
        nameKey: 'small',
        price: 100,
        sortOrder: 1
      },
      {
        menuItemId: coctelMariscos.id,
        variantTypeId: sizeType.id,
        name: 'Mediano',
        nameKey: 'medium',
        price: 135,
        sortOrder: 2
      },
      {
        menuItemId: coctelMariscos.id,
        variantTypeId: sizeType.id,
        name: 'Grande',
        nameKey: 'large',
        price: 170,
        sortOrder: 3
      }
    ]
  });

  // Tostadas (configurable)
  const tostadas = await prisma.menuItem.create({
    data: {
      categoryId: catAlimentos.id,
      name: 'Tostadas',
      nameKey: 'tostadas',
      description: 'Tostadas de mariscos o ceviche',
      isConfigurable: true,
      hasVariants: true,
      sortOrder: 2
    }
  });

  // Add seafood ingredients to tostadas
  for (const seafood of allSeafood) {
    await prisma.menuItemIngredient.create({
      data: {
        menuItemId: tostadas.id,
        ingredientId: seafood.id,
        isDefault: false
      }
    });
  }

  // Tostadas variants (types)
  await prisma.menuVariant.createMany({
    data: [
      {
        menuItemId: tostadas.id,
        variantTypeId: typeType.id,
        name: 'Mariscos',
        nameKey: 'seafood',
        price: 80,
        sortOrder: 1
      },
      {
        menuItemId: tostadas.id,
        variantTypeId: typeType.id,
        name: 'Ceviche',
        nameKey: 'ceviche',
        price: 75,
        sortOrder: 2
      }
    ]
  });

  // Sopa de mariscos (NOT configurable - always has all 4 seafood)
  const sopaMariscos = await prisma.menuItem.create({
    data: {
      categoryId: catAlimentos.id,
      name: 'Sopa de Mariscos',
      nameKey: 'seafood_soup',
      description: 'Sopa de mariscos con los 4 tipos de mariscos',
      isConfigurable: false, // Always includes all seafood
      hasVariants: true,
      sortOrder: 3
    }
  });

  // Add all seafood as default ingredients for soup
  for (const seafood of allSeafood) {
    await prisma.menuItemIngredient.create({
      data: {
        menuItemId: sopaMariscos.id,
        ingredientId: seafood.id,
        isDefault: true // All are default for soup
      }
    });
  }

  // Soup variants (sizes)
  await prisma.menuVariant.createMany({
    data: [
      {
        menuItemId: sopaMariscos.id,
        variantTypeId: sizeType.id,
        name: 'Chica',
        nameKey: 'small',
        price: 120,
        sortOrder: 1
      },
      {
        menuItemId: sopaMariscos.id,
        variantTypeId: sizeType.id,
        name: 'Grande',
        nameKey: 'large',
        price: 180,
        sortOrder: 2
      }
    ]
  });

  console.log('✅ Created food items');

  // ============================================
  // MENU ITEMS - BEBIDAS (REFRESCO)
  // ============================================

  // Coca-cola Taparrosca
  const cocaTaparrosca = await prisma.menuItem.create({
    data: {
      categoryId: catRefrescoTaparrosca.id,
      name: 'Coca-cola Taparrosca',
      nameKey: 'coca_cola_screw_cap',
      hasVariants: true,
      sortOrder: 1
    }
  });

  await prisma.menuVariant.createMany({
    data: [
      {
        menuItemId: cocaTaparrosca.id,
        variantTypeId: sizeType.id,
        name: 'Chica Regular',
        nameKey: 'small_regular',
        price: 25,
        sortOrder: 1
      },
      {
        menuItemId: cocaTaparrosca.id,
        variantTypeId: sizeType.id,
        name: 'Chica Zero',
        nameKey: 'small_zero',
        price: 25,
        sortOrder: 2
      },
      {
        menuItemId: cocaTaparrosca.id,
        variantTypeId: sizeType.id,
        name: 'Grande',
        nameKey: 'large',
        price: 40,
        sortOrder: 3
      }
    ]
  });

  // Coca-cola Lata
  const cocaLata = await prisma.menuItem.create({
    data: {
      categoryId: catRefrescoLata.id,
      name: 'Coca-cola Lata',
      nameKey: 'coca_cola_can',
      hasVariants: true,
      sortOrder: 1
    }
  });

  await prisma.menuVariant.createMany({
    data: [
      {
        menuItemId: cocaLata.id,
        variantTypeId: typeType.id,
        name: 'Regular',
        nameKey: 'regular',
        price: 30,
        sortOrder: 1
      },
      {
        menuItemId: cocaLata.id,
        variantTypeId: typeType.id,
        name: 'Light',
        nameKey: 'light',
        price: 30,
        sortOrder: 2
      }
    ]
  });

  // Refrescos Retornables (simple items)
  const refrescosRetornables = [
    { name: 'Coca-cola', nameKey: 'coca_cola', price: 35 },
    { name: 'Sprite', nameKey: 'sprite', price: 35 },
    { name: 'Fanta', nameKey: 'fanta', price: 35 },
    { name: 'Fresca', nameKey: 'fresca', price: 35 },
    { name: 'Sidral', nameKey: 'sidral', price: 35 }
  ];

  for (const [idx, refresco] of refrescosRetornables.entries()) {
    await prisma.menuItem.create({
      data: {
        categoryId: catRefrescoRetornable.id,
        name: refresco.name,
        nameKey: refresco.nameKey,
        hasVariants: false,
        basePrice: refresco.price,
        sortOrder: idx + 1
      }
    });
  }

  console.log('✅ Created soda items');

  // ============================================
  // MENU ITEMS - BEBIDAS (CERVEZA)
  // ============================================

  // Cervezas Media
  await prisma.menuItem.create({
    data: {
      categoryId: catCervezaMedia.id,
      name: 'XX',
      nameKey: 'xx',
      hasVariants: false,
      basePrice: 30,
      sortOrder: 1
    }
  });

  await prisma.menuItem.create({
    data: {
      categoryId: catCervezaMedia.id,
      name: 'Indio',
      nameKey: 'indio',
      hasVariants: false,
      basePrice: 30,
      sortOrder: 2
    }
  });

  // Cerveza Premium
  const bohemia = await prisma.menuItem.create({
    data: {
      categoryId: catCervezaPremium.id,
      name: 'Bohemia',
      nameKey: 'bohemia',
      hasVariants: true,
      sortOrder: 1
    }
  });

  await prisma.menuVariant.createMany({
    data: [
      {
        menuItemId: bohemia.id,
        variantTypeId: typeType.id,
        name: 'Pilsner',
        nameKey: 'pilsner',
        price: 45,
        sortOrder: 1
      },
      {
        menuItemId: bohemia.id,
        variantTypeId: typeType.id,
        name: 'Vienna',
        nameKey: 'vienna',
        price: 45,
        sortOrder: 2
      }
    ]
  });

  // Cerveza Lata
  await prisma.menuItem.create({
    data: {
      categoryId: catCervezaLata.id,
      name: 'Heineken 00',
      nameKey: 'heineken_00',
      hasVariants: false,
      basePrice: 35,
      sortOrder: 1
    }
  });

  console.log('✅ Created beer items');

  // ============================================
  // MENU ITEMS - BEBIDAS (AGUA)
  // ============================================

  // Agua simple
  await prisma.menuItem.create({
    data: {
      categoryId: catAgua.id,
      name: 'Natural',
      nameKey: 'natural_water',
      hasVariants: false,
      basePrice: 15,
      sortOrder: 1
    }
  });

  await prisma.menuItem.create({
    data: {
      categoryId: catAgua.id,
      name: 'Mineral',
      nameKey: 'mineral_water',
      hasVariants: false,
      basePrice: 20,
      sortOrder: 2
    }
  });

  // Agua de sabor - Arbolito
  const arbolito = await prisma.menuItem.create({
    data: {
      categoryId: catAguaSabor.id,
      name: 'Arbolito',
      nameKey: 'arbolito',
      hasVariants: true,
      sortOrder: 1
    }
  });

  const arbolitoFlavors = [
    { name: 'Lima', nameKey: 'lime', price: 25 },
    { name: 'Horchata', nameKey: 'horchata', price: 25 },
    { name: 'Coco', nameKey: 'coconut', price: 25 },
    { name: 'Rompope', nameKey: 'rompope', price: 25 },
    { name: 'Fresa', nameKey: 'strawberry', price: 25 },
    { name: 'Café', nameKey: 'coffee', price: 25 },
    { name: 'Chía', nameKey: 'chia', price: 25 },
    { name: 'Tamarindo', nameKey: 'tamarind', price: 25 }
  ];

  for (const [idx, flavor] of arbolitoFlavors.entries()) {
    await prisma.menuVariant.create({
      data: {
        menuItemId: arbolito.id,
        variantTypeId: flavorType.id,
        name: flavor.name,
        nameKey: flavor.nameKey,
        price: flavor.price,
        sortOrder: idx + 1
      }
    });
  }

  // Jugo Boing
  const boing = await prisma.menuItem.create({
    data: {
      categoryId: catAguaJugo.id,
      name: 'Boing',
      nameKey: 'boing',
      hasVariants: true,
      sortOrder: 1
    }
  });

  const boingFlavors = [
    { name: 'Mango', nameKey: 'mango', price: 20 },
    { name: 'Guayaba', nameKey: 'guava', price: 20 },
    { name: 'Fresa', nameKey: 'strawberry', price: 20 },
    { name: 'Uva', nameKey: 'grape', price: 20 }
  ];

  for (const [idx, flavor] of boingFlavors.entries()) {
    await prisma.menuVariant.create({
      data: {
        menuItemId: boing.id,
        variantTypeId: flavorType.id,
        name: flavor.name,
        nameKey: flavor.nameKey,
        price: flavor.price,
        sortOrder: idx + 1
      }
    });
  }

  console.log('✅ Created water items');

  // ============================================
  // SUMMARY
  // ============================================

  const totalCategories = await prisma.menuCategory.count();
  const totalItems = await prisma.menuItem.count();
  const totalVariants = await prisma.menuVariant.count();
  const totalIngredients = await prisma.ingredient.count();

  console.log(`
  ╔════════════════════════════════════════╗
  ║  ✅ SEED COMPLETED SUCCESSFULLY        ║
  ╠════════════════════════════════════════╣
  ║  📁 Categories: ${totalCategories.toString().padEnd(22)}  ║
  ║  🍽️  Menu Items: ${totalItems.toString().padEnd(22)}  ║
  ║  🔀 Variants: ${totalVariants.toString().padEnd(25)}  ║
  ║  🦐 Ingredients: ${totalIngredients.toString().padEnd(21)}  ║
  ╚════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });