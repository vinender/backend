"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = require("express-rate-limit");
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
// Load environment variables
dotenv_1.default.config();
// Import configuration
const constants_1 = require("./config/constants");
require("./config/database"); // Initialize database connection
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const field_routes_1 = __importDefault(require("./routes/field.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
class Server {
    app;
    constructor() {
        this.app = (0, express_1.default)();
        this.configureMiddleware();
        this.configureRoutes();
        this.configureErrorHandling();
    }
    configureMiddleware() {
        // CORS configuration - MUST come before other middleware
        this.app.use((0, cors_1.default)({
            origin: (origin, callback) => {
                // Allow requests from these origins
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://localhost:3001',
                    'http://localhost:3002',
                    constants_1.FRONTEND_URL
                ];
                // Allow requests with no origin (like mobile apps or Postman)
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                }
                else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            optionsSuccessStatus: 200,
        }));
        // Security middleware - configure helmet to allow CORS
        this.app.use((0, helmet_1.default)({
            crossOriginResourcePolicy: { policy: "cross-origin" },
            contentSecurityPolicy: false,
        }));
        // Rate limiting
        const limiter = (0, express_rate_limit_1.rateLimit)({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
        });
        this.app.use('/api', limiter);
        // Data sanitization against NoSQL query injection
        this.app.use((0, express_mongo_sanitize_1.default)());
        // Body parsing middleware
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((0, cookie_parser_1.default)());
        // Compression middleware
        this.app.use((0, compression_1.default)());
        // Logging middleware
        if (constants_1.NODE_ENV === 'development') {
            this.app.use((0, morgan_1.default)('dev'));
        }
        else {
            this.app.use((0, morgan_1.default)('combined'));
        }
        // Request timestamp
        this.app.use((req, res, next) => {
            req.requestTime = new Date().toISOString();
            next();
        });
    }
    configureRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                success: true,
                status: 'OK',
                timestamp: new Date().toISOString(),
                environment: constants_1.NODE_ENV,
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
        this.app.use('/api/auth', auth_routes_1.default);
        this.app.use('/api/users', user_routes_1.default);
        this.app.use('/api/fields', field_routes_1.default);
        this.app.use('/api/bookings', booking_routes_1.default);
        this.app.use('/api/reviews', review_routes_1.default);
        // Serve static files (if any)
        // this.app.use('/uploads', express.static('uploads'));
    }
    configureErrorHandling() {
        // Handle 404 errors
        this.app.use((req, res, next) => {
            console.log(`404 - Route not found: ${req.method} ${req.path}`);
            res.status(404).json({
                message: 'Route not found',
                path: req.path,
                method: req.method,
            });
        });
        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Error caught:', err.message);
            console.error('Stack:', err.stack);
            const statusCode = err.statusCode || 500;
            res.status(statusCode).json({
                message: err.message || 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
            });
        });
    }
    start() {
        const server = this.app.listen(constants_1.PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🚀 Server is running successfully!               ║
║                                                    ║
║   Mode: ${constants_1.NODE_ENV.padEnd(43)}║
║   Port: ${String(constants_1.PORT).padEnd(43)}║
║   Time: ${new Date().toLocaleString().padEnd(43)}║
║                                                    ║
║   API: http://localhost:${constants_1.PORT}/api                    ║
║   Health: http://localhost:${constants_1.PORT}/health              ║
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
        process.on('unhandledRejection', (err) => {
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
exports.default = server;
