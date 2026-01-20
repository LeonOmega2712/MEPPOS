import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRoutes } from './routes';

// Load environment variables
dotenv.config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARES
// ============================================

// CORS - allow requests from frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'MEPPOS API - Menu System'
  });
});

// API Routes
app.use('/api', apiRoutes);

// API Documentation route
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'MEPPOS API - Menu System',
    version: '2.0.0',
    description: 'Complete menu management system for seafood restaurant POS',
    endpoints: {
      categories: {
        'GET /api/categories': 'Get all categories (flat)',
        'GET /api/categories/tree': 'Get category tree (hierarchical)',
        'GET /api/categories/root': 'Get root categories only',
        'GET /api/categories/:id': 'Get category by ID',
        'GET /api/categories/:id/path': 'Get breadcrumb path',
        'POST /api/categories': 'Create category',
        'PUT /api/categories/:id': 'Update category',
        'DELETE /api/categories/:id': 'Delete category'
      },
      menuItems: {
        'GET /api/menu-items': 'Get all menu items',
        'GET /api/menu-items/:id': 'Get menu item by ID',
        'GET /api/menu-items/category/:categoryId': 'Get items by category',
        'POST /api/menu-items': 'Create menu item',
        'PUT /api/menu-items/:id': 'Update menu item',
        'DELETE /api/menu-items/:id': 'Delete menu item'
      },
      variants: {
        'POST /api/menu-items/:id/variants': 'Add variant to item',
        'PUT /api/variants/:id': 'Update variant',
        'DELETE /api/variants/:id': 'Delete variant'
      },
      variantTypes: {
        'GET /api/variant-types': 'Get all variant types',
        'GET /api/variant-types/:id': 'Get variant type by ID',
        'POST /api/variant-types': 'Create variant type',
        'PUT /api/variant-types/:id': 'Update variant type',
        'DELETE /api/variant-types/:id': 'Delete variant type'
      },
      ingredients: {
        'GET /api/ingredients': 'Get all ingredients',
        'GET /api/ingredients/:id': 'Get ingredient by ID',
        'POST /api/ingredients': 'Create ingredient',
        'PUT /api/ingredients/:id': 'Update ingredient',
        'DELETE /api/ingredients/:id': 'Delete ingredient'
      }
    },
    documentation: 'https://github.com/your-repo/MEPPOS#api-documentation'
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 - Route not found
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    suggestion: 'Visit /api for available endpoints'
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║  🚀 MEPPOS API Server v2.0             ║
  ║  🍽️  Menu Management System             ║
  ║  📡 Port: ${PORT}                         ║
  ║  🌍 Environment: ${process.env.NODE_ENV || 'development'}           ║
  ║  🔗 http://localhost:${PORT}             ║
  ║  📚 API Docs: http://localhost:${PORT}/api  ║
  ╚════════════════════════════════════════╝
  `);
});