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
    service: 'MEPPOS API - Simplified Menu System'
  });
});

// API Routes
app.use('/api', apiRoutes);

// API Documentation route
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'MEPPOS API - Simplified Menu System',
    version: '3.0.0',
    description: 'Simplified menu management system for restaurant POS',
    endpoints: {
      categories: {
        'GET /api/categories': 'Get all categories (add ?active=true for active only)',
        'GET /api/categories/:id': 'Get category by ID',
        'POST /api/categories': 'Create category',
        'PUT /api/categories/:id': 'Update category',
        'DELETE /api/categories/:id': 'Delete category',
        'GET /api/categories/:categoryId/products': 'Get products by category'
      },
      products: {
        'GET /api/products': 'Get all products (add ?active=true for active only)',
        'GET /api/products/:id': 'Get product by ID',
        'GET /api/products/:id/price': 'Get effective price of product',
        'POST /api/products': 'Create product',
        'PUT /api/products/:id': 'Update product',
        'DELETE /api/products/:id': 'Delete product'
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
  ║  🚀 MEPPOS API Server v3.0             ║
  ║  🍽️  Simplified Menu System             ║
  ║  📡 Port: ${PORT}                         ║
  ║  🌍 Environment: ${process.env.NODE_ENV || 'development'}           ║
  ║  🔗 http://localhost:${PORT}             ║
  ║  📚 API Docs: http://localhost:${PORT}/api  ║
  ╚════════════════════════════════════════╝
  `);
});