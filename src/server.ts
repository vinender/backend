import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

// Load environment variables
dotenv.config();

// Import configuration
import { PORT, NODE_ENV, FRONTEND_URL } from './config/constants';
import './config/database'; // Initialize database connection

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import fieldRoutes from './routes/field.routes';
import bookingRoutes from './routes/booking.routes';
import reviewRoutes from './routes/review.routes';

// Import middleware
import { errorHandler, notFound } from './middleware/error.middleware';

class Server {
  private app: Application;

  constructor() {
    this.app = express();
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
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

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use('/api', limiter);

    // Data sanitization against NoSQL query injection
    this.app.use(mongoSanitize());

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
        },
      });
    });

    // Mount API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/fields', fieldRoutes);
    this.app.use('/api/bookings', bookingRoutes);
    this.app.use('/api/reviews', reviewRoutes);

    // Serve static files (if any)
    // this.app.use('/uploads', express.static('uploads'));
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
    const server = this.app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🚀 Server is running successfully!               ║
║                                                    ║
║   Mode: ${NODE_ENV.padEnd(43)}║
║   Port: ${String(PORT).padEnd(43)}║
║   Time: ${new Date().toLocaleString().padEnd(43)}║
║                                                    ║
║   API: http://localhost:${PORT}/api                    ║
║   Health: http://localhost:${PORT}/health              ║
║                                                    ║
╚════════════════════════════════════════════════════╝
      `);
    });

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