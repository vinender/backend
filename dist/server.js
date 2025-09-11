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
const http_1 = require("http");
const websocket_1 = require("./utils/websocket");
const kafka_1 = require("./config/kafka");
// Load environment variables
dotenv_1.default.config();
// Import configuration
const constants_1 = require("./config/constants");
require("./config/database"); // Initialize database connection
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const auth_otp_routes_1 = __importDefault(require("./routes/auth.otp.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const field_routes_1 = __importDefault(require("./routes/field.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const stripe_routes_1 = __importDefault(require("./routes/stripe.routes"));
const favorite_routes_1 = __importDefault(require("./routes/favorite.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const payout_routes_1 = __importDefault(require("./routes/payout.routes"));
const claim_routes_1 = __importDefault(require("./routes/claim.routes"));
const stripe_connect_routes_1 = __importDefault(require("./routes/stripe-connect.routes"));
const user_report_routes_1 = __importDefault(require("./routes/user-report.routes"));
const user_block_routes_1 = __importDefault(require("./routes/user-block.routes"));
const payment_method_routes_1 = __importDefault(require("./routes/payment-method.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const admin_payout_routes_1 = __importDefault(require("./routes/admin-payout.routes"));
const auto_payout_routes_1 = __importDefault(require("./routes/auto-payout.routes"));
const earnings_routes_1 = __importDefault(require("./routes/earnings.routes"));
// Import scheduled jobs
const payout_job_1 = require("./jobs/payout.job");
class Server {
    app;
    httpServer;
    io;
    constructor() {
        this.app = (0, express_1.default)();
        this.httpServer = (0, http_1.createServer)(this.app);
        this.configureMiddleware();
        this.configureRoutes();
        this.configureErrorHandling();
        this.configureSocketAndKafka();
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
                    'http://localhost:3003', // Admin dashboard
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
        // Rate limiting - more lenient in development
        const limiter = (0, express_rate_limit_1.rateLimit)({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: constants_1.NODE_ENV === 'development' ? 10000 : 100, // Higher limit in dev
            message: 'Too many requests from this IP, please try again later.',
            skip: (req) => constants_1.NODE_ENV === 'development' && req.ip === '::1', // Skip for localhost in dev
        });
        this.app.use('/api', limiter);
        // Data sanitization against NoSQL query injection
        this.app.use((0, express_mongo_sanitize_1.default)());
        // Stripe webhook endpoint (raw body needed, must be before JSON parser)
        this.app.use('/api/stripe', express_1.default.raw({ type: 'application/json' }));
        this.app.use('/api/payments/webhook', express_1.default.raw({ type: 'application/json' }));
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
                    notifications: '/api/notifications',
                    payments: '/api/payments',
                    chat: '/api/chat',
                },
            });
        });
        // Stripe webhook route (must be before other routes due to raw body requirement)
        this.app.use('/api/stripe', stripe_routes_1.default);
        // Mount API routes
        this.app.use('/api/auth', auth_routes_1.default);
        this.app.use('/api/auth/otp', auth_otp_routes_1.default);
        this.app.use('/api/users', user_routes_1.default);
        this.app.use('/api/fields', field_routes_1.default);
        this.app.use('/api/bookings', booking_routes_1.default);
        this.app.use('/api/reviews', review_routes_1.default);
        this.app.use('/api/notifications', notification_routes_1.default);
        this.app.use('/api/payments', payment_routes_1.default);
        this.app.use('/api/favorites', favorite_routes_1.default);
        this.app.use('/api/chat', chat_routes_1.default);
        this.app.use('/api/payouts', payout_routes_1.default);
        this.app.use('/api/claims', claim_routes_1.default);
        this.app.use('/api/stripe-connect', stripe_connect_routes_1.default);
        this.app.use('/api/user-reports', user_report_routes_1.default);
        this.app.use('/api/user-blocks', user_block_routes_1.default);
        this.app.use('/api/payment-methods', payment_method_routes_1.default);
        this.app.use('/api/admin', admin_routes_1.default);
        this.app.use('/api/admin/payouts', admin_payout_routes_1.default);
        this.app.use('/api/auto-payouts', auto_payout_routes_1.default);
        this.app.use('/api/earnings', earnings_routes_1.default);
        // Serve static files (if any)
        // this.app.use('/uploads', express.static('uploads'));
    }
    configureSocketAndKafka() {
        // Socket.io is initialized in start() method via setupWebSocket
        // We'll get the io instance from there
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
        // Setup WebSocket and get io instance
        const io = (0, websocket_1.setupWebSocket)(this.httpServer);
        this.io = io;
        // Make io globally available for notifications and Kafka
        global.io = io;
        // Initialize Kafka with the io instance
        (0, kafka_1.initializeKafka)(io).catch(error => {
            console.log('Kafka initialization skipped - messages will be handled directly through Socket.io');
        });
        // Initialize scheduled jobs
        (0, payout_job_1.initPayoutJobs)();
        console.log('✅ Scheduled jobs initialized');
        this.httpServer.listen(constants_1.PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🚀 Server is running successfully!               ║
║                                                    ║
║   Mode: ${constants_1.NODE_ENV.padEnd(43)}                     ║
║   Port: ${String(constants_1.PORT).padEnd(43)}                 ║
║   Time: ${new Date().toLocaleString().padEnd(43)}  ║
║                                                    ║
║   API: http://localhost:${constants_1.PORT}/api                ║
║   Health: http://localhost:${constants_1.PORT}/health          ║
║   WebSocket: ws://localhost:${constants_1.PORT}                ║
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
