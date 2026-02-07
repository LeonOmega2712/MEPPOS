import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://localhost:5432/meppos',
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed based on menu.md...');

  // ============================================
  // CATEGORIES (upsert: skip if already exists)
  // ============================================

  const foodCategory = await prisma.category.upsert({
    where: { name: 'Alimentos' },
    update: {},
    create: {
      name: 'Alimentos',
      description: 'Platillos de mariscos',
      displayOrder: 1,
      active: true,
    },
  });

  const returnableSodasCategory = await prisma.category.upsert({
    where: { name: 'Refrescos Retornables' },
    update: {},
    create: {
      name: 'Refrescos Retornables',
      description: 'Refrescos en envase de vidrio retornable',
      basePrice: 25.0,
      displayOrder: 2,
      active: true,
    },
  });

  const cannedSodasCategory = await prisma.category.upsert({
    where: { name: 'Refrescos de Lata' },
    update: {},
    create: {
      name: 'Refrescos de Lata',
      description: 'Refrescos en presentación de lata',
      basePrice: 30.0,
      displayOrder: 3,
      active: true,
    },
  });

  const beerCategory = await prisma.category.upsert({
    where: { name: 'Cervezas' },
    update: {},
    create: {
      name: 'Cervezas',
      description: 'Presentación de vidrio y lata',
      basePrice: 30.0,
      displayOrder: 4,
      active: true,
    },
  });

  const waterCategory = await prisma.category.upsert({
    where: { name: 'Agua Natural y de Sabor' },
    update: {},
    create: {
      name: 'Agua Natural y de Sabor',
      description: 'Agua embotellada natural y de sabor',
      basePrice: 25.0,
      displayOrder: 5,
      active: true,
    },
  });

  const juiceCategory = await prisma.category.upsert({
    where: { name: 'Jugos' },
    update: {},
    create: {
      name: 'Jugos',
      description: 'Jugos de sabores frutales',
      basePrice: 30.0,
      displayOrder: 6,
      active: true,
    },
  });

  const bottledSodasCategory = await prisma.category.upsert({
    where: { name: 'Refrescos de taparrosca' },
    update: {},
    create: {
      name: 'Refrescos de taparrosca',
      description: 'Refrescos en envase de plastico',
      basePrice: 25.0,
      displayOrder: 7,
      active: true,
    },
  });

  console.log('✅ Categories created');

  // ============================================
  // FOOD PRODUCTS (skipDuplicates: skip if name already exists)
  // ============================================

  // Seafood cocktails
  await prisma.product.createMany({
    data: [
      {
        categoryId: foodCategory.id,
        name: 'Cóctel de Mariscos - Chico',
        description:
          'Cóctel chico de mariscos al gusto (Camarón, Calamar, Ostión, Abulón)',
        price: 60.0,
        displayOrder: 1,
        customizable: true,
        active: true,
      },
      {
        categoryId: foodCategory.id,
        name: 'Cóctel de Mariscos - Mediano',
        description:
          'Cóctel mediano de mariscos al gusto (Camarón, Calamar, Ostión, Abulón)',
        price: 80.0,
        displayOrder: 2,
        customizable: true,
        active: true,
      },
      {
        categoryId: foodCategory.id,
        name: 'Cóctel de Mariscos - Grande',
        description:
          'Cóctel grande de mariscos al gusto (Camarón, Calamar, Ostión, Abulón)',
        price: 100.0,
        displayOrder: 3,
        customizable: true,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  // Tostadas
  await prisma.product.createMany({
    data: [
      {
        categoryId: foodCategory.id,
        name: 'Tostada de Mariscos',
        description:
          'Tostada con mariscos al gusto (Camarón, Calamar, Ostión, Abulón)',
        price: 30.0,
        displayOrder: 4,
        customizable: true,
        active: true,
      },
      {
        categoryId: foodCategory.id,
        name: 'Tostada de Ceviche',
        description: 'Tostada de ceviche con mariscos al gusto',
        price: 15.0,
        displayOrder: 5,
        customizable: true,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  // Seafood soup
  await prisma.product.createMany({
    data: [
      {
        categoryId: foodCategory.id,
        name: 'Sopa de Mariscos - Chica',
        description:
          'Sopa chica con los 4 mariscos (Camarón, Calamar, Ostión, Abulón)',
        price: 70.0,
        displayOrder: 6,
        customizable: false,
        active: true,
      },
      {
        categoryId: foodCategory.id,
        name: 'Sopa de Mariscos - Grande',
        description:
          'Sopa grande con los 4 mariscos (Camarón, Calamar, Ostión, Abulón)',
        price: 100.0,
        displayOrder: 7,
        customizable: false,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Food products created');

  // ============================================
  // DRINKS - SODAS
  // ============================================

  // Bottled sodas - inherits category base price ($25)
  await prisma.product.createMany({
    data: [
      {
        categoryId: bottledSodasCategory.id,
        name: 'Coca-Cola Taparrosca Chica Regular',
        description: 'Coca-Cola regular taparrosca tamaño chico',
        displayOrder: 1,
        active: true,
      },
      {
        categoryId: bottledSodasCategory.id,
        name: 'Coca-Cola Taparrosca Chica Zero',
        description: 'Coca-Cola Zero taparrosca tamaño chico',
        displayOrder: 2,
        active: true,
      },
      {
        categoryId: bottledSodasCategory.id,
        name: 'Coca-Cola Taparrosca Grande',
        description: 'Coca-Cola taparrosca tamaño grande',
        price: 30.0,
        displayOrder: 3,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  // Canned sodas - inherits category base price ($30)
  await prisma.product.createMany({
    data: [
      {
        categoryId: cannedSodasCategory.id,
        name: 'Coca-Cola Lata Regular',
        description: 'Coca-Cola regular en lata',
        displayOrder: 1,
        active: true,
      },
      {
        categoryId: cannedSodasCategory.id,
        name: 'Coca-Cola Lata Light',
        description: 'Coca-Cola Light en lata',
        displayOrder: 2,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  // Returnable sodas - inherits category base price ($25)
  await prisma.product.createMany({
    data: [
      {
        categoryId: returnableSodasCategory.id,
        name: 'Coca-Cola Retornable',
        description: 'Coca-Cola en botella de vidrio retornable',
        displayOrder: 1,
        active: true,
      },
      {
        categoryId: returnableSodasCategory.id,
        name: 'Sprite Retornable',
        description: 'Sprite en botella de vidrio retornable',
        displayOrder: 2,
        active: true,
      },
      {
        categoryId: returnableSodasCategory.id,
        name: 'Fanta Retornable',
        description: 'Fanta en botella de vidrio retornable',
        displayOrder: 3,
        active: true,
      },
      {
        categoryId: returnableSodasCategory.id,
        name: 'Fresca Retornable',
        description: 'Fresca en botella de vidrio retornable',
        displayOrder: 4,
        active: true,
      },
      {
        categoryId: returnableSodasCategory.id,
        name: 'Sidral Retornable',
        description: 'Sidral en botella de vidrio retornable',
        displayOrder: 5,
        active: true,
      },
      {
        categoryId: returnableSodasCategory.id,
        name: 'Agua Mineral',
        description: 'Agua mineral con gas',
        displayOrder: 6,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Sodas created');

  // ============================================
  // BEERS - inherits category base price ($30)
  // ============================================

  await prisma.product.createMany({
    data: [
      {
        categoryId: beerCategory.id,
        name: 'Cerveza XX Media',
        description: 'Cerveza XX botella media',
        displayOrder: 1,
        active: true,
      },
      {
        categoryId: beerCategory.id,
        name: 'Cerveza Indio Media',
        description: 'Cerveza Indio botella media',
        displayOrder: 2,
        active: true,
      },
      {
        categoryId: beerCategory.id,
        name: 'Cerveza Bohemia Pilsner',
        description: 'Cerveza premium Bohemia Pilsner',
        displayOrder: 3,
        active: true,
      },
      {
        categoryId: beerCategory.id,
        name: 'Cerveza Bohemia Vienna',
        description: 'Cerveza premium Bohemia Vienna',
        displayOrder: 4,
        active: true,
      },
      {
        categoryId: beerCategory.id,
        name: 'Cerveza Heineken 00 Lata',
        description: 'Cerveza sin alcohol Heineken 00 en lata',
        displayOrder: 5,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Beers created');

  // ============================================
  // DRINKS - WATER AND FRUITS FLAVOR
  // ============================================

  await prisma.product.createMany({
    data: [
      {
        categoryId: waterCategory.id,
        name: 'Agua Natural',
        description: 'Agua natural embotellada',
        displayOrder: 1,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  // Flavored water - Arbolito brand - inherits category base price ($25)
  await prisma.product.createMany({
    data: [
      {
        categoryId: waterCategory.id,
        name: 'Agua Arbolito - Lima',
        description: 'Agua de sabor lima marca Arbolito',
        displayOrder: 2,
        active: true,
      },
      {
        categoryId: waterCategory.id,
        name: 'Agua Arbolito - Horchata',
        description: 'Agua de horchata marca Arbolito',
        displayOrder: 3,
        active: true,
      },
      {
        categoryId: waterCategory.id,
        name: 'Agua Arbolito - Coco',
        description: 'Agua de coco marca Arbolito',
        displayOrder: 4,
        active: true,
      },
      {
        categoryId: waterCategory.id,
        name: 'Agua Arbolito - Rompope',
        description: 'Agua de rompope marca Arbolito',
        displayOrder: 5,
        active: true,
      },
      {
        categoryId: waterCategory.id,
        name: 'Agua Arbolito - Fresa',
        description: 'Agua de fresa marca Arbolito',
        displayOrder: 6,
        active: true,
      },
      {
        categoryId: waterCategory.id,
        name: 'Agua Arbolito - Café',
        description: 'Agua de café marca Arbolito',
        displayOrder: 7,
        active: true,
      },
      {
        categoryId: waterCategory.id,
        name: 'Agua Arbolito - Chía',
        description: 'Agua de chía marca Arbolito',
        displayOrder: 8,
        active: true,
      },
      {
        categoryId: waterCategory.id,
        name: 'Agua Arbolito - Tamarindo',
        description: 'Agua de tamarindo marca Arbolito',
        displayOrder: 9,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  // Juices - Boing brand
  await prisma.product.createMany({
    data: [
      {
        categoryId: juiceCategory.id,
        name: 'Jugo Boing - Mango',
        description: 'Jugo de mango marca Boing',
        displayOrder: 1,
        active: true,
      },
      {
        categoryId: juiceCategory.id,
        name: 'Jugo Boing - Guayaba',
        description: 'Jugo de guayaba marca Boing',
        displayOrder: 2,
        active: true,
      },
      {
        categoryId: juiceCategory.id,
        name: 'Jugo Boing - Fresa',
        description: 'Jugo de fresa marca Boing',
        displayOrder: 3,
        active: true,
      },
      {
        categoryId: juiceCategory.id,
        name: 'Jugo Boing - Uva',
        description: 'Jugo de uva marca Boing',
        displayOrder: 4,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Water and juices created');

  // ============================================
  // SUMMARY
  // ============================================

  const categoryCount = await prisma.category.count();
  const productCount = await prisma.product.count();

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       🌱 SEED SUMMARY                  ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Categories: ${categoryCount}                          ║`);
  console.log(`║  Products: ${productCount}                           ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('\n✅ Seed completed successfully!');
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
