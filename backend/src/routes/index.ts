import { Router } from 'express';
import { menuController } from '../controllers/menu.controller';
import { categoryController } from '../controllers/category.controller';
import { productController } from '../controllers/product.controller';
import { authController } from '../controllers/auth.controller';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

// Menu (accessible without authentication for digital menu / QR)
router.get('/menu', menuController.getFullMenu.bind(menuController));

// Auth
router.post('/auth/login', authController.login.bind(authController));
router.post('/auth/refresh', authController.refresh.bind(authController));
router.post('/auth/logout', authController.logout.bind(authController));

// ============================================
// AUTHENTICATED ROUTES
// ============================================

router.use(authenticate);

// Current user info
router.get('/auth/me', authController.me.bind(authController));

// Categories (GET)
router.get('/categories', categoryController.getAllCategories.bind(categoryController));
router.get('/categories/:id', categoryController.getCategoryById.bind(categoryController));
router.get('/categories/:categoryId/products', productController.getProductsByCategory.bind(productController));

// Products (GET)
router.get('/products', productController.getAllProducts.bind(productController));
router.get('/products/:id', productController.getProductById.bind(productController));
router.get('/products/:id/price', productController.getProductPrice.bind(productController));

// ============================================
// ADMIN-ONLY ROUTES
// ============================================

router.use(authorize('ADMIN'));

// Users
router.get('/users', userController.getAllUsers.bind(userController));
router.get('/users/:id', userController.getUserById.bind(userController));
router.post('/users', userController.createUser.bind(userController));
router.put('/users/:id', userController.updateUser.bind(userController));
router.delete('/users/:id', userController.deleteUser.bind(userController));

// Categories (mutations)
router.post('/categories', categoryController.createCategory.bind(categoryController));
router.put('/categories/:id', categoryController.updateCategory.bind(categoryController));
router.delete('/categories/:id', categoryController.deleteCategory.bind(categoryController));
router.patch('/categories/reorder', categoryController.reorderCategories.bind(categoryController));

// Products (mutations)
router.post('/products', productController.createProduct.bind(productController));
router.put('/products/:id', productController.updateProduct.bind(productController));
router.delete('/products/:id', productController.deleteProduct.bind(productController));
router.patch('/products/reorder', productController.reorderProducts.bind(productController));

export { router as apiRoutes };
