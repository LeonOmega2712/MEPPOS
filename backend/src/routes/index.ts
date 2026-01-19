import { Router } from 'express';
import { menuController } from '../controllers/menu.controller';
import { categoryController } from '../controllers/category.controller';
import { ingredientController } from '../controllers/ingredient.controller';
import { variantTypeController } from '../controllers/variant-type.controller';

const router = Router();

// ============================================
// MENU CATEGORIES
// ============================================

// GET routes
router.get('/categories', categoryController.getAllCategories.bind(categoryController));
router.get('/categories/tree', categoryController.getCategoryTree.bind(categoryController));
router.get('/categories/root', categoryController.getRootCategories.bind(categoryController));
router.get('/categories/:id', categoryController.getCategoryById.bind(categoryController));
router.get('/categories/:id/path', categoryController.getCategoryPath.bind(categoryController));

// POST routes
router.post('/categories', categoryController.createCategory.bind(categoryController));

// PUT routes
router.put('/categories/:id', categoryController.updateCategory.bind(categoryController));

// DELETE routes
router.delete('/categories/:id', categoryController.deleteCategory.bind(categoryController));

// ============================================
// MENU ITEMS
// ============================================

// GET routes
router.get('/menu-items', menuController.getAllItems.bind(menuController));
router.get('/menu-items/:id', menuController.getItemById.bind(menuController));
router.get('/menu-items/category/:categoryId', menuController.getItemsByCategory.bind(menuController));

// POST routes
router.post('/menu-items', menuController.createItem.bind(menuController));
router.post('/menu-items/:id/variants', menuController.addVariant.bind(menuController));

// PUT routes
router.put('/menu-items/:id', menuController.updateItem.bind(menuController));
router.put('/variants/:id', menuController.updateVariant.bind(menuController));

// DELETE routes
router.delete('/menu-items/:id', menuController.deleteItem.bind(menuController));
router.delete('/variants/:id', menuController.deleteVariant.bind(menuController));

// ============================================
// VARIANT TYPES
// ============================================

router.get('/variant-types', variantTypeController.getAll.bind(variantTypeController));
router.get('/variant-types/:id', variantTypeController.getById.bind(variantTypeController));
router.post('/variant-types', variantTypeController.create.bind(variantTypeController));
router.put('/variant-types/:id', variantTypeController.update.bind(variantTypeController));
router.delete('/variant-types/:id', variantTypeController.delete.bind(variantTypeController));

// ============================================
// INGREDIENTS
// ============================================

router.get('/ingredients', ingredientController.getAll.bind(ingredientController));
router.get('/ingredients/:id', ingredientController.getById.bind(ingredientController));
router.post('/ingredients', ingredientController.create.bind(ingredientController));
router.put('/ingredients/:id', ingredientController.update.bind(ingredientController));
router.delete('/ingredients/:id', ingredientController.delete.bind(ingredientController));

export { router as apiRoutes };