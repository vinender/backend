import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { createServer } from 'http';
import { setupWebSocket } from './utils/websocket';
import { initializeSocket } from './config/socket';
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

// Import middleware
import { errorHandler, notFound } from './middleware/error.middleware';

// Import scheduled jobs
import { initPayoutJobs } from './jobs/payout.job';

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
          'http://localhost:3002',
          'http://localhost:3003', // Admin dashboard
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

    // Rate limiting - more lenient in development
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: NODE_ENV === 'development' ? 10000 : 100, // Higher limit in dev
      message: 'Too many requests from this IP, please try again later.',
      skip: (req) => NODE_ENV === 'development' && req.ip === '::1', // Skip for localhost in dev
    });
    this.app.use('/api', limiter);

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

    // API info endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        message: 'Fieldsy API',
        version: '1.0.0',
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
    });

    // Stripe webhook route (must be before other routes due to raw body requirement)
    this.app.use('/api/stripe', stripeRoutes);
    
    // Mount API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/auth/otp', authOtpRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/fields', fieldRoutes);
    this.app.use('/api/bookings', bookingRoutes);
    this.app.use('/api/reviews', reviewRoutes);
    this.app.use('/api/notifications', notificationRoutes);
    this.app.use('/api/payments', paymentRoutes);
    this.app.use('/api/favorites', favoriteRoutes);
    this.app.use('/api/chat', chatRoutes);
    this.app.use('/api/payouts', payoutRoutes);
    this.app.use('/api/claims', claimRoutes);
    this.app.use('/api/stripe-connect', stripeConnectRoutes);
    this.app.use('/api/user-reports', userReportRoutes);
    this.app.use('/api/user-blocks', userBlockRoutes);
    this.app.use('/api/payment-methods', paymentMethodRoutes);
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/admin/payouts', adminPayoutRoutes);
    this.app.use('/api/auto-payouts', autoPayoutRoutes);
    this.app.use('/api/earnings', earningsRoutes);

    // Serve static files (if any)
    // this.app.use('/uploads', express.static('uploads'));
  }

  private configureSocketAndKafka(): void {
    // Initialize Socket.io
    this.io = initializeSocket(this.httpServer);
    
    // Make io globally available for notifications
    (global as any).io = this.io;
    
    // Initialize Kafka (optional - will fallback to direct processing if not available)
    initializeKafka(this.io).catch(error => {
      console.log('Kafka initialization skipped - messages will be handled directly through Socket.io');
    });
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
    // Setup WebSocket
    setupWebSocket(this.httpServer);
    
    // Initialize scheduled jobs
    initPayoutJobs();
    console.log('✅ Scheduled jobs initialized');
    
    this.httpServer.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🚀 Server is running successfully!               ║
║                                                    ║
║   Mode: ${NODE_ENV.padEnd(43)}                     ║
║   Port: ${String(PORT).padEnd(43)}                 ║
║   Time: ${new Date().toLocaleString().padEnd(43)}  ║
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