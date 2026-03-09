import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
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

// Security headers
app.use(helmet());

// Rate limiting - 200 requests per 15 minutes per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
}));

// Parse JSON bodies with size limit
app.use(express.json({ limit: '1mb' }));

// Parse cookies (for refresh token)
app.use(cookieParser());

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MEPPOS API - Simplified Menu System'
  });
});

// API Routes
app.use('/api', apiRoutes);

// API Documentation route
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'MEPPOS API - Simplified Menu System',
    version: '1.0.0',
    description: 'Simplified menu management system for restaurant POS',
    endpoints: {
      public: {
        'GET /api/menu': 'Get full menu (categories with products, price resolved)',
        'POST /api/auth/login': 'Login (returns access token + refresh cookie)',
        'POST /api/auth/refresh': 'Refresh access token (via httpOnly cookie)',
        'POST /api/auth/logout': 'Logout (clears refresh cookie)',
      },
      authenticated: {
        'GET /api/auth/me': 'Get current user info',
        'GET /api/categories': 'Get all categories (add ?active=true for active only)',
        'GET /api/categories/:id': 'Get category by ID with products',
        'GET /api/categories/:categoryId/products': 'Get products by category',
        'GET /api/products': 'Get all products with resolved price (add ?active=true for active only)',
        'GET /api/products/:id': 'Get product by ID',
        'GET /api/products/:id/price': 'Get effective price of product',
      },
      adminOnly: {
        'POST /api/categories': 'Create category',
        'PUT /api/categories/:id': 'Update category',
        'DELETE /api/categories/:id': 'Soft delete category (?permanent=true for hard delete)',
        'PATCH /api/categories/reorder': 'Batch reorder categories',
        'POST /api/products': 'Create product',
        'PUT /api/products/:id': 'Update product',
        'DELETE /api/products/:id': 'Soft delete product (?permanent=true for hard delete)',
        'PATCH /api/products/reorder': 'Batch reorder products within category',
        'GET /api/users': 'Get all users',
        'GET /api/users/:id': 'Get user by ID',
        'POST /api/users': 'Create user',
        'PUT /api/users/:id': 'Update user',
        'DELETE /api/users/:id': 'Soft delete user (?permanent=true for hard delete)',
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
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
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
  ╔═════════════════════════════════════════╗
  ║  🚀 MEPPOS API Server v1.0.0            ║
  ║  🍽️  Simplified Menu System              ║
  ║  📡 Port: ${PORT}                          ║
  ║  🌍 Environment: ${process.env.NODE_ENV || 'development'}            ║
  ║  🔗 http://localhost:${PORT}               ║
  ║  📚 API Docs: http://localhost:${PORT}/api ║
  ╚═════════════════════════════════════════╝
  `);
});