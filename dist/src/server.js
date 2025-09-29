"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, // Export app for testing
"default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _express = /*#__PURE__*/ _interop_require_default(require("express"));
const _cors = /*#__PURE__*/ _interop_require_default(require("cors"));
const _helmet = /*#__PURE__*/ _interop_require_default(require("helmet"));
const _morgan = /*#__PURE__*/ _interop_require_default(require("morgan"));
const _compression = /*#__PURE__*/ _interop_require_default(require("compression"));
const _cookieparser = /*#__PURE__*/ _interop_require_default(require("cookie-parser"));
const _dotenv = /*#__PURE__*/ _interop_require_default(require("dotenv"));
const _expressratelimit = require("express-rate-limit");
const _expressmongosanitize = /*#__PURE__*/ _interop_require_default(require("express-mongo-sanitize"));
const _http = require("http");
const _websocket = require("./utils/websocket");
const _kafka = require("./config/kafka");
const _constants = require("./config/constants");
require("./config/database");
const _authroutes = /*#__PURE__*/ _interop_require_default(require("./routes/auth.routes"));
const _authotproutes = /*#__PURE__*/ _interop_require_default(require("./routes/auth.otp.routes"));
const _userroutes = /*#__PURE__*/ _interop_require_default(require("./routes/user.routes"));
const _fieldroutes = /*#__PURE__*/ _interop_require_default(require("./routes/field.routes"));
const _bookingroutes = /*#__PURE__*/ _interop_require_default(require("./routes/booking.routes"));
const _reviewroutes = /*#__PURE__*/ _interop_require_default(require("./routes/review.routes"));
const _notificationroutes = /*#__PURE__*/ _interop_require_default(require("./routes/notification.routes"));
const _paymentroutes = /*#__PURE__*/ _interop_require_default(require("./routes/payment.routes"));
const _striperoutes = /*#__PURE__*/ _interop_require_default(require("./routes/stripe.routes"));
const _favoriteroutes = /*#__PURE__*/ _interop_require_default(require("./routes/favorite.routes"));
const _chatroutes = /*#__PURE__*/ _interop_require_default(require("./routes/chat.routes"));
const _payoutroutes = /*#__PURE__*/ _interop_require_default(require("./routes/payout.routes"));
const _claimroutes = /*#__PURE__*/ _interop_require_default(require("./routes/claim.routes"));
const _stripeconnectroutes = /*#__PURE__*/ _interop_require_default(require("./routes/stripe-connect.routes"));
const _userreportroutes = /*#__PURE__*/ _interop_require_default(require("./routes/user-report.routes"));
const _userblockroutes = /*#__PURE__*/ _interop_require_default(require("./routes/user-block.routes"));
const _paymentmethodroutes = /*#__PURE__*/ _interop_require_default(require("./routes/payment-method.routes"));
const _adminroutes = /*#__PURE__*/ _interop_require_default(require("./routes/admin.routes"));
const _adminpayoutroutes = /*#__PURE__*/ _interop_require_default(require("./routes/admin-payout.routes"));
const _autopayoutroutes = /*#__PURE__*/ _interop_require_default(require("./routes/auto-payout.routes"));
const _earningsroutes = /*#__PURE__*/ _interop_require_default(require("./routes/earnings.routes"));
const _commissionroutes = /*#__PURE__*/ _interop_require_default(require("./routes/commission.routes"));
const _settingsroutes = /*#__PURE__*/ _interop_require_default(require("./routes/settings.routes"));
const _faqroutes = /*#__PURE__*/ _interop_require_default(require("./routes/faq.routes"));
const _uploadroutes = /*#__PURE__*/ _interop_require_default(require("./routes/upload.routes"));
const _aboutpageroutes = /*#__PURE__*/ _interop_require_default(require("./routes/about-page.routes"));
const _apidocumentation = require("./utils/api-documentation");
const _apidocstemplate = require("./utils/api-docs-template");
const _payoutjob = require("./jobs/payout.job");
const _heldpayoutreleasejob = require("./jobs/held-payout-release.job");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
// Load environment variables
_dotenv.default.config();
class Server {
    app;
    httpServer;
    io;
    constructor(){
        this.app = (0, _express.default)();
        this.httpServer = (0, _http.createServer)(this.app);
        this.configureMiddleware();
        this.configureRoutes();
        this.configureErrorHandling();
        this.configureSocketAndKafka();
    }
    configureMiddleware() {
        // CORS configuration - MUST come before other middleware
        this.app.use((0, _cors.default)({
            origin: (origin, callback)=>{
                // Allow requests from these origins
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://localhost:3001',
                    'http://localhost:3002',
                    'http://localhost:3003',
                    'https://fieldsy.indiitserver.in',
                    'https://fieldsy-admin.indiitserver.in',
                    'http://fieldsy.indiitserver.in',
                    'http://fieldsy-admin.indiitserver.in',
                    _constants.FRONTEND_URL
                ];
                // Allow requests with no origin (like mobile apps or Postman)
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            methods: [
                'GET',
                'POST',
                'PUT',
                'PATCH',
                'DELETE',
                'OPTIONS'
            ],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Requested-With'
            ],
            optionsSuccessStatus: 200
        }));
        // Security middleware - configure helmet to allow CORS
        this.app.use((0, _helmet.default)({
            crossOriginResourcePolicy: {
                policy: "cross-origin"
            },
            contentSecurityPolicy: false
        }));
        // Rate limiting - more lenient in development
        const limiter = (0, _expressratelimit.rateLimit)({
            windowMs: 15 * 60 * 1000,
            max: _constants.NODE_ENV === 'development' ? 10000 : 100,
            message: 'Too many requests from this IP, please try again later.',
            skip: (req)=>_constants.NODE_ENV === 'development' && req.ip === '::1'
        });
        this.app.use('/api', limiter);
        // Data sanitization against NoSQL query injection
        this.app.use((0, _expressmongosanitize.default)());
        // Stripe webhook endpoint (raw body needed, must be before JSON parser)
        this.app.use('/api/stripe', _express.default.raw({
            type: 'application/json'
        }));
        this.app.use('/api/payments/webhook', _express.default.raw({
            type: 'application/json'
        }));
        // Body parsing middleware
        this.app.use(_express.default.json({
            limit: '10mb'
        }));
        this.app.use(_express.default.urlencoded({
            extended: true,
            limit: '10mb'
        }));
        this.app.use((0, _cookieparser.default)());
        // Compression middleware
        this.app.use((0, _compression.default)());
        // Logging middleware
        if (_constants.NODE_ENV === 'development') {
            this.app.use((0, _morgan.default)('dev'));
        } else {
            this.app.use((0, _morgan.default)('combined'));
        }
        // Request timestamp
        this.app.use((req, res, next)=>{
            req.requestTime = new Date().toISOString();
            next();
        });
    }
    configureRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res)=>{
            res.status(200).json({
                success: true,
                status: 'OK',
                timestamp: new Date().toISOString(),
                environment: _constants.NODE_ENV,
                uptime: process.uptime()
            });
        });
        // API documentation - Root route for production
        this.app.get('/', (req, res)=>{
            // Check if client accepts HTML
            const acceptHeader = req.headers.accept || '';
            if (acceptHeader.includes('text/html')) {
                // Serve HTML documentation
                res.setHeader('Content-Type', 'text/html');
                res.send((0, _apidocstemplate.generateApiDocsHTML)(_apidocumentation.apiDocumentation));
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
                        chat: '/api/chat'
                    }
                });
            }
        });
        // API documentation endpoint (also available at /api)
        this.app.get('/api', (req, res)=>{
            // Check if client accepts HTML
            const acceptHeader = req.headers.accept || '';
            if (acceptHeader.includes('text/html')) {
                // Serve HTML documentation
                res.setHeader('Content-Type', 'text/html');
                res.send((0, _apidocstemplate.generateApiDocsHTML)(_apidocumentation.apiDocumentation));
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
                        chat: '/api/chat'
                    }
                });
            }
        });
        // Stripe webhook route (must be before other routes due to raw body requirement)
        this.app.use('/api/stripe', _striperoutes.default);
        // Mount API routes
        this.app.use('/api/auth', _authroutes.default);
        this.app.use('/api/auth/otp', _authotproutes.default);
        this.app.use('/api/users', _userroutes.default);
        this.app.use('/api/fields', _fieldroutes.default);
        this.app.use('/api/bookings', _bookingroutes.default);
        this.app.use('/api/reviews', _reviewroutes.default);
        this.app.use('/api/notifications', _notificationroutes.default);
        this.app.use('/api/payments', _paymentroutes.default);
        this.app.use('/api/favorites', _favoriteroutes.default);
        this.app.use('/api/chat', _chatroutes.default);
        this.app.use('/api/payouts', _payoutroutes.default);
        this.app.use('/api/claims', _claimroutes.default);
        this.app.use('/api/stripe-connect', _stripeconnectroutes.default);
        this.app.use('/api/user-reports', _userreportroutes.default);
        this.app.use('/api/user-blocks', _userblockroutes.default);
        this.app.use('/api/payment-methods', _paymentmethodroutes.default);
        this.app.use('/api/admin', _adminroutes.default);
        this.app.use('/api/admin/payouts', _adminpayoutroutes.default);
        this.app.use('/api/auto-payouts', _autopayoutroutes.default);
        this.app.use('/api/earnings', _earningsroutes.default);
        this.app.use('/api/commission', _commissionroutes.default);
        this.app.use('/api/settings', _settingsroutes.default);
        this.app.use('/api/faqs', _faqroutes.default);
        this.app.use('/api/upload', _uploadroutes.default);
        this.app.use('/api/about-page', _aboutpageroutes.default);
    // Serve static files (if any)
    // this.app.use('/uploads', express.static('uploads'));
    }
    configureSocketAndKafka() {
    // Socket.io is initialized in start() method via setupWebSocket
    // We'll get the io instance from there
    }
    configureErrorHandling() {
        // Handle 404 errors
        this.app.use((req, res, next)=>{
            console.log(`404 - Route not found: ${req.method} ${req.path}`);
            res.status(404).json({
                message: 'Route not found',
                path: req.path,
                method: req.method
            });
        });
        // Global error handler
        this.app.use((err, req, res, next)=>{
            console.error('Error caught:', err.message);
            console.error('Stack:', err.stack);
            const statusCode = err.statusCode || 500;
            res.status(statusCode).json({
                message: err.message || 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
            });
        });
    }
    start() {
        // Setup WebSocket and get io instance
        const io = (0, _websocket.setupWebSocket)(this.httpServer);
        this.io = io;
        // Make io globally available for notifications and Kafka
        global.io = io;
        // Initialize Kafka with the io instance
        (0, _kafka.initializeKafka)(io).catch((error)=>{
            console.log('Kafka initialization skipped - messages will be handled directly through Socket.io');
        });
        // Initialize scheduled jobs
        (0, _payoutjob.initPayoutJobs)();
        (0, _heldpayoutreleasejob.startHeldPayoutReleaseJobs)();
        console.log('✅ Scheduled jobs initialized');
        // Enhanced error handling for port conflicts
        this.httpServer.on('error', (error)=>{
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${_constants.PORT} is already in use!`);
                console.log(`💡 Please try one of the following:`);
                console.log(`   1. Run: kill -9 $(lsof -ti:${_constants.PORT})`);
                console.log(`   2. Use a different port: PORT=5001 npm run dev`);
                console.log(`   3. Wait a moment for the port to be released`);
                process.exit(1);
            } else {
                console.error('Server error:', error);
                process.exit(1);
            }
        });
        this.httpServer.listen(_constants.PORT, ()=>{
            console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🚀 Server is running successfully!               ║
║                                                    ║
║   Mode: ${_constants.NODE_ENV.padEnd(43)}║
║   Port: ${String(_constants.PORT).padEnd(43)}║
║   Time: ${new Date().toLocaleString().padEnd(43)}║
║                                                    ║
║   API: http://localhost:${_constants.PORT}/api                ║
║   Health: http://localhost:${_constants.PORT}/health          ║
║   WebSocket: ws://localhost:${_constants.PORT}                ║
║                                                    ║
╚════════════════════════════════════════════════════╝
      `);
        });
        const server = this.httpServer;
        // Graceful shutdown
        process.on('SIGTERM', ()=>{
            console.log('SIGTERM signal received: closing HTTP server');
            server.close(()=>{
                console.log('HTTP server closed');
                process.exit(0);
            });
        });
        process.on('SIGINT', ()=>{
            console.log('SIGINT signal received: closing HTTP server');
            server.close(()=>{
                console.log('HTTP server closed');
                process.exit(0);
            });
        });
        // Handle uncaught exceptions
        process.on('uncaughtException', (err)=>{
            console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
            console.error(err.name, err.message);
            process.exit(1);
        });
        process.on('unhandledRejection', (err)=>{
            console.error('UNHANDLED REJECTION! 💥 Shutting down...');
            console.error(err.name, err.message);
            server.close(()=>{
                process.exit(1);
            });
        });
    }
}
// Create and start server
const server = new Server();
server.start();
const _default = server;

//# sourceMappingURL=server.js.map