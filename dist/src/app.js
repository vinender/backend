"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "prisma", {
    enumerable: true,
    get: function() {
        return prisma;
    }
});
const _express = /*#__PURE__*/ _interop_require_default(require("express"));
const _cors = /*#__PURE__*/ _interop_require_default(require("cors"));
const _helmet = /*#__PURE__*/ _interop_require_default(require("helmet"));
const _morgan = /*#__PURE__*/ _interop_require_default(require("morgan"));
const _compression = /*#__PURE__*/ _interop_require_default(require("compression"));
const _cookieparser = /*#__PURE__*/ _interop_require_default(require("cookie-parser"));
const _dotenv = /*#__PURE__*/ _interop_require_default(require("dotenv"));
const _client = require("@prisma/client");
const _apidocumentation = require("./utils/api-documentation");
const _apidocstemplate = require("./utils/api-docs-template");
const _authroutes = /*#__PURE__*/ _interop_require_default(require("./routes/auth.routes"));
const _userroutes = /*#__PURE__*/ _interop_require_default(require("./routes/user.routes"));
const _fieldroutes = /*#__PURE__*/ _interop_require_default(require("./routes/field.routes"));
const _bookingroutes = /*#__PURE__*/ _interop_require_default(require("./routes/booking.routes"));
const _earningsroutes = /*#__PURE__*/ _interop_require_default(require("./routes/earnings.routes"));
const _stripeconnectroutes = /*#__PURE__*/ _interop_require_default(require("./routes/stripe-connect.routes"));
const _payoutroutes = /*#__PURE__*/ _interop_require_default(require("./routes/payout.routes"));
const _commissionroutes = /*#__PURE__*/ _interop_require_default(require("./routes/commission.routes"));
const _adminroutes = /*#__PURE__*/ _interop_require_default(require("./routes/admin.routes"));
const _chatroutes = /*#__PURE__*/ _interop_require_default(require("./routes/chat.routes"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
// Load environment variables
_dotenv.default.config();
// Initialize Express app
const app = (0, _express.default)();
const PORT = process.env.PORT || 5000;
const prisma = new _client.PrismaClient();
// Middleware
app.set('trust proxy', 1);
app.use((0, _helmet.default)());
app.use((0, _cors.default)({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        // List of allowed origins
        const allowedOrigins = [
            process.env.FRONTEND_URL || "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:8081",
            "http://localhost:19006",
            "exp://localhost:8081",
            "https://fieldsy.indiitserver.in",
            "https://fieldsy-admin.indiitserver.in",
            "https://fieldsy-api.indiitserver.in",
            "http://fieldsy.indiitserver.in",
            "http://fieldsy-admin.indiitserver.in",
            "http://fieldsy-api.indiitserver.in"
        ];
        // Check if the origin is in the allowed list or is a local development URL
        if (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.') || // Local network IPs for physical devices
        origin.includes('10.0.') // Local network IPs
        ) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use((0, _compression.default)());
app.use((0, _morgan.default)("dev"));
app.use(_express.default.json());
app.use(_express.default.urlencoded({
    extended: true
}));
app.use((0, _cookieparser.default)());
// API Documentation - Root route for production
app.get("/", (req, res)=>{
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html')) {
        // Serve HTML documentation for browsers
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
// API Documentation - Also available at /api 
app.get("/api", (req, res)=>{
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html')) {
        // Serve HTML documentation for browsers
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
// Routes
app.use("/api/auth", _authroutes.default);
app.use("/api/users", _userroutes.default);
app.use("/api/fields", _fieldroutes.default);
app.use("/api/bookings", _bookingroutes.default);
app.use("/api/earnings", _earningsroutes.default);
app.use("/api/stripe-connect", _stripeconnectroutes.default);
app.use("/api/payouts", _payoutroutes.default);
app.use("/api/commission", _commissionroutes.default);
app.use('/api/admin', _adminroutes.default);
app.use('/api/chat', _chatroutes.default);
// Health check endpoint
app.get("/health", (req, res)=>{
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString()
    });
});
// Error handling middleware
app.use((err, req, res, next)=>{
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || "Internal Server Error",
        ...process.env.NODE_ENV === "development" && {
            stack: err.stack
        }
    });
});
// 404 handler
app.use((req, res)=>{
    res.status(404).json({
        message: "Route not found"
    });
});
// Start server
app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});
// Graceful shutdown
process.on("SIGTERM", async ()=>{
    console.log("SIGTERM signal received: closing HTTP server");
    await prisma.$disconnect();
    process.exit(0);
});

//# sourceMappingURL=app.js.map