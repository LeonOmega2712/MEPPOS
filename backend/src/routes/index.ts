import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { productController } from '../controllers/product.controller';

const router = Router();

// ============================================
// CATEGORIES
// ============================================

router.get('/categories', categoryController.getAllCategories.bind(categoryController));
router.get('/categories/:id', categoryController.getCategoryById.bind(categoryController));
router.post('/categories', categoryController.createCategory.bind(categoryController));
router.put('/categories/:id', categoryController.updateCategory.bind(categoryController));
router.delete('/categories/:id', categoryController.deleteCategory.bind(categoryController));

// ============================================
// PRODUCTS
// ============================================

router.get('/products', productController.getAllProducts.bind(productController));
router.get('/products/:id', productController.getProductById.bind(productController));
router.get('/products/:id/price', productController.getProductPrice.bind(productController));
router.post('/products', productController.createProduct.bind(productController));
router.put('/products/:id', productController.updateProduct.bind(productController));
router.delete('/products/:id', productController.deleteProduct.bind(productController));

// Products by category
router.get('/categories/:categoryId/products', productController.getProductsByCategory.bind(productController));

export { router as apiRoutes };
