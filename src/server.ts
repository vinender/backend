//@ts-nocheck
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { 
  generalLimiter, 
  authLimiter, 
  uploadLimiter,
  bookingLimiter,
  paymentLimiter,
  searchLimiter,
  messageLimiter,
  reviewLimiter,
  bypassInDevelopment,
  dynamicLimiter
} from './middleware/rateLimiter.middleware';
import mongoSanitize from 'express-mongo-sanitize';
import { createServer } from 'http';
import { setupWebSocket } from './utils/websocket';
import { initializeKafka } from './config/kafka';

// Load environment variables
dotenv.config();

// Import configuration
import { PORT, NODE_ENV, FRONTEND_URL } from './config/constants';
import './config/database'; // Initialize database connection

// Import routes
import authRoutes from './routes/auth.routes';
import authOtpRoutes from './routes/auth.otp.routes';
import userRoutes from './routes/user.routes';
import fieldRoutes from './routes/field.routes';
import bookingRoutes from './routes/booking.routes';
import reviewRoutes from './routes/review.routes';
import notificationRoutes from './routes/notification.routes';
import paymentRoutes from './routes/payment.routes';
import stripeRoutes from './routes/stripe.routes';
import favoriteRoutes from './routes/favorite.routes';
import chatRoutes from './routes/chat.routes';
import payoutRoutes from './routes/payout.routes';
import claimRoutes from './routes/claim.routes';
import stripeConnectRoutes from './routes/stripe-connect.routes';
import userReportRoutes from './routes/user-report.routes';
import userBlockRoutes from './routes/user-block.routes';
import paymentMethodRoutes from './routes/payment-method.routes';
import adminRoutes from './routes/admin.routes';
import adminPayoutRoutes from './routes/admin-payout.routes';
import autoPayoutRoutes from './routes/auto-payout.routes';
import earningsRoutes from './routes/earnings.routes';
import commissionRoutes from './routes/commission.routes';
import settingsRoutes from './routes/settings.routes';
import faqRoutes from './routes/faq.routes';
import uploadRoutes from './routes/upload.routes';
import aboutPageRoutes from './routes/about-page.routes';
import amenityRoutes from './routes/amenity.routes';

// Import middleware
import { errorHandler, notFound } from './middleware/error.middleware';

// Import API documentation
import { apiDocumentation } from './utils/api-documentation';
import { generateApiDocsHTML } from './utils/api-docs-template';

// Import scheduled jobs
import { initPayoutJobs } from './jobs/payout.job';
import { startHeldPayoutReleaseJobs } from './jobs/held-payout-release.job';


class Server {
  private app: Application;
  private httpServer: any;
  private io: any;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
    this.configureSocketAndKafka();
  }

  private configureMiddleware(): void {
    // CORS configuration - MUST come before other middleware
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests from these origins
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001', 
          'http://localhost:5000', 
          'http://localhost:3002',
          'http://localhost:3003', // Admin dashboard
          'http://localhost:8081', // Expo web
          'https://fieldsy.indiitserver.in', // Production frontend
          'https://fieldsy-admin.indiitserver.in', // Production admin
          'http://fieldsy.indiitserver.in', // Allow HTTP as fallback
          'http://fieldsy-admin.indiitserver.in', // Allow HTTP as fallback
          FRONTEND_URL
        ];
        
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      optionsSuccessStatus: 200,
    }));

    // Security middleware - configure helmet to allow CORS
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }));

    // Apply general rate limiter to all API routes (60 requests per minute)
    // Bypass in development for localhost
    this.app.use('/api', bypassInDevelopment(generalLimiter));
    
    // Apply dynamic rate limiting based on user role
    this.app.use('/api', dynamicLimiter);

    // Data sanitization against NoSQL query injection
    this.app.use(mongoSanitize());

    // Stripe webhook endpoint (raw body needed, must be before JSON parser)
    this.app.use('/api/stripe', express.raw({ type: 'application/json' }));
    this.app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser());

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    if (NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Request timestamp
    this.app.use((req, res, next) => {
      req.requestTime = new Date().toISOString();
      next();
    });
  }

  private configureRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        uptime: process.uptime(),
      });
    });

    // API documentation - Root route for production
    this.app.get('/', (req, res) => {
      // Check if client accepts HTML
      const acceptHeader = req.headers.accept || '';
      
      if (acceptHeader.includes('text/html')) {
        // Serve HTML documentation
        res.setHeader('Content-Type', 'text/html');
        res.send(generateApiDocsHTML(apiDocumentation));
      } else {
        // Serve JSON for API clients
        res.json({
          success: true,
          message: 'Fieldsy API',
          version: '1.0.0',
          documentation: 'Visit this URL in a browser for interactive documentation',
          endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            fields: '/api/fields',
            bookings: '/api/bookings',
            reviews: '/api/reviews',
            notifications: '/api/notifications',
            payments: '/api/payments',
            chat: '/api/chat',
          },
        });
      }
    });

    // API documentation endpoint (also available at /api)
    this.app.get('/api', (req, res) => {
      // Check if client accepts HTML
      const acceptHeader = req.headers.accept || '';
      
      if (acceptHeader.includes('text/html')) {
        // Serve HTML documentation
        res.setHeader('Content-Type', 'text/html');
        res.send(generateApiDocsHTML(apiDocumentation));
      } else {
        // Serve JSON for API clients
        res.json({
          success: true,
          message: 'Fieldsy API',
          version: '1.0.0',
          documentation: '/api (view in browser for interactive docs)',
          endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            fields: '/api/fields',
            bookings: '/api/bookings',
            reviews: '/api/reviews',
            notifications: '/api/notifications',
            payments: '/api/payments',
            chat: '/api/chat',
          },
        });
      }
    });

    // Stripe webhook route (must be before other routes due to raw body requirement)
    this.app.use('/api/stripe', stripeRoutes);
    
    // Mount API routes with specific rate limiters
    // Auth routes - 5 requests per minute for login/register
    this.app.use('/api/auth', bypassInDevelopment(authLimiter), authRoutes);
    this.app.use('/api/auth/otp', bypassInDevelopment(authLimiter), authOtpRoutes);
    
    // User routes - general rate limit
    this.app.use('/api/users', userRoutes);
    
    // Fields routes - search endpoints get search limiter (30/min)
    this.app.use('/api/fields/search', bypassInDevelopment(searchLimiter));
    this.app.use('/api/fields', fieldRoutes);
    
    // Booking routes - 5 bookings per minute
    this.app.use('/api/bookings', bypassInDevelopment(bookingLimiter), bookingRoutes);
    
    // Review routes - 3 reviews per minute
    this.app.use('/api/reviews', bypassInDevelopment(reviewLimiter), reviewRoutes);
    
    // General routes with standard limits
    this.app.use('/api/notifications', notificationRoutes);
    
    // Payment routes - 5 payment attempts per minute
    this.app.use('/api/payments', bypassInDevelopment(paymentLimiter), paymentRoutes);
    
    // General routes
    this.app.use('/api/favorites', favoriteRoutes);
    
    // Chat routes - 30 messages per minute
    this.app.use('/api/chat', bypassInDevelopment(messageLimiter), chatRoutes);
    
    // Payout and financial routes
    this.app.use('/api/payouts', payoutRoutes);
    this.app.use('/api/claims', claimRoutes);
    this.app.use('/api/stripe-connect', stripeConnectRoutes);
    
    // User interaction routes
    this.app.use('/api/user-reports', userReportRoutes);
    this.app.use('/api/user-blocks', userBlockRoutes);
    this.app.use('/api/payment-methods', paymentMethodRoutes);
    
    // Admin routes - handled by dynamic limiter (200/min for admins)
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/admin/payouts', adminPayoutRoutes);
    this.app.use('/api/auto-payouts', autoPayoutRoutes);
    
    // Other routes
    this.app.use('/api/earnings', earningsRoutes);
    this.app.use('/api/commission', commissionRoutes);
    this.app.use('/api/settings', settingsRoutes);
    this.app.use('/api/faqs', faqRoutes);
    
    // Upload routes - 20 uploads per minute
    this.app.use('/api/upload', bypassInDevelopment(uploadLimiter), uploadRoutes);

    this.app.use('/api/about-page', aboutPageRoutes);

    // Amenities routes
    this.app.use('/api/amenities', amenityRoutes);

    // Serve static files (if any)
    // this.app.use('/uploads', express.static('uploads'));
  }

  private configureSocketAndKafka(): void {
    // Socket.io is initialized in start() method via setupWebSocket
    // We'll get the io instance from there
  }

  private configureErrorHandling(): void {
    // Handle 404 errors
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`404 - Route not found: ${req.method} ${req.path}`);
      res.status(404).json({
        message: 'Route not found',
        path: req.path,
        method: req.method,
      });
    });

    // Global error handler
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      console.error('Error caught:', err.message);
      console.error('Stack:', err.stack);
      
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      });
    });
  }

  public start(): void {
    // Setup WebSocket and get io instance
    const io = setupWebSocket(this.httpServer);
    this.io = io;
    
    // Make io globally available for notifications and Kafka
    (global as any).io = io;
    
    // Initialize Kafka with the io instance
    initializeKafka(io).catch(error => {
      console.log('Kafka initialization skipped - messages will be handled directly through Socket.io');
    });
    
    // Initialize scheduled jobs
    initPayoutJobs();
    startHeldPayoutReleaseJobs();
    console.log('✅ Scheduled jobs initialized');
    
    // Enhanced error handling for port conflicts
    this.httpServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
        console.log(`💡 Please try one of the following:`);
        console.log(`   1. Run: kill -9 $(lsof -ti:${PORT})`);
        console.log(`   2. Use a different port: PORT=5001 npm run dev`);
        console.log(`   3. Wait a moment for the port to be released`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });
    
    this.httpServer.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🚀 Server is running successfully!               ║
║                                                    ║
║   Mode: ${NODE_ENV.padEnd(43)}║
║   Port: ${String(PORT).padEnd(43)}║
║   Time: ${new Date().toLocaleString().padEnd(43)}║
║                                                    ║
║   API: http://localhost:${PORT}/api                ║
║   Health: http://localhost:${PORT}/health          ║
║   WebSocket: ws://localhost:${PORT}                ║
║                                                    ║
╚════════════════════════════════════════════════════╝
      `);
    });
    
    const server = this.httpServer;

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
      console.error(err.name, err.message);
      process.exit(1);
    });

    process.on('unhandledRejection', (err: any) => {
      console.error('UNHANDLED REJECTION! 💥 Shutting down...');
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });
  }
}

// Create and start server
const server = new Server();
server.start();

// Export app for testing
export default server;
