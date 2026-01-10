import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// ZOD VALIDATIONS
// ============================================

const ProductVariantSchema = z.object({
  sizeName: z.string().min(1, 'Size name is required'),
  price: z.number().positive('Price must be greater than 0'),
  sortOrder: z.number().int().optional().default(0)
});

const CreateProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional(),
  hasVariants: z.boolean().default(false),
  basePrice: z.number().positive().optional(),
  variants: z.array(ProductVariantSchema).optional()
}).refine(data => {
  // If no variants, must have base price
  if (!data.hasVariants && !data.basePrice) {
    return false;
  }
  // If has variants, must have at least one
  if (data.hasVariants && (!data.variants || data.variants.length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Product must have either base price or variants'
});

const UpdateProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional(),
  hasVariants: z.boolean().default(false),
  basePrice: z.number().positive().optional(),
  variants: z.array(ProductVariantSchema).optional()
}).partial();

// ============================================
// ENDPOINTS
// ============================================

// GET /api/products - Get all products
router.get('/', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        variants: {
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});

// GET /api/products/:id - Get a product by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { id },
      include: { variants: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Error fetching product' });
  }
});

// POST /api/products - Create new product
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = CreateProductSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: validation.error.errors 
      });
    }

    const { name, category, hasVariants, basePrice, variants } = validation.data;

    const product = await prisma.product.create({
      data: {
        name,
        category,
        hasVariants,
        basePrice,
        variants: hasVariants && variants ? {
          create: variants
        } : undefined
      },
      include: { variants: true }
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Error creating product' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = UpdateProductSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: validation.error.errors 
      });
    }

    const { name, category, hasVariants, basePrice, variants } = validation.data;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // If updating variants, delete existing ones and create new ones
    if (variants && hasVariants) {
      await prisma.productVariant.deleteMany({
        where: { productId: id }
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        category,
        hasVariants,
        basePrice,
        variants: hasVariants && variants ? {
          create: variants
        } : undefined
      },
      include: { variants: true }
    });

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Error updating product' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.product.delete({
      where: { id }
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Error deleting product' });
  }
});

export { router as productsRouter };