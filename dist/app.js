"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
//@ts-nocheck
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
// Import API documentation
const api_documentation_1 = require("./utils/api-documentation");
const api_docs_template_1 = require("./utils/api-docs-template");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const field_routes_1 = __importDefault(require("./routes/field.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const earnings_routes_1 = __importDefault(require("./routes/earnings.routes"));
const stripe_connect_routes_1 = __importDefault(require("./routes/stripe-connect.routes"));
const payout_routes_1 = __importDefault(require("./routes/payout.routes"));
const commission_routes_1 = __importDefault(require("./routes/commission.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
// Load environment variables
dotenv_1.default.config();
// Initialize Express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Initialize Prisma
exports.prisma = new client_1.PrismaClient();
// Middleware
app.set('trust proxy', 1);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
        // List of allowed origins
        const allowedOrigins = [
            process.env.FRONTEND_URL || "http://localhost:3000", // Frontend development
            "http://localhost:3001", // Frontend alternate port
            "http://localhost:3002", // Frontend alternate port
            "http://localhost:3003", // Admin dashboard development
            "http://localhost:8081", // Expo web
            "http://localhost:19006", // Expo web alternate port
            "exp://localhost:8081", // Expo development
            "https://fieldsy.indiitserver.in", // Production frontend
            "https://fieldsy-admin.indiitserver.in", // Production admin
            "https://fieldsy-api.indiitserver.in", // Production API (for self-referential calls)
            "http://fieldsy.indiitserver.in", // Allow HTTP as fallback
            "http://fieldsy-admin.indiitserver.in", // Allow HTTP as fallback
            "http://fieldsy-api.indiitserver.in", // Allow HTTP API as fallback
        ];
        // Check if the origin is in the allowed list or is a local development URL
        if (allowedOrigins.includes(origin) ||
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            origin.includes('192.168.') || // Local network IPs for physical devices
            origin.includes('10.0.') // Local network IPs
        ) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// API Documentation - Root route for production
app.get("/", (req, res) => {
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html')) {
        // Serve HTML documentation for browsers
        res.setHeader('Content-Type', 'text/html');
        res.send((0, api_docs_template_1.generateApiDocsHTML)(api_documentation_1.apiDocumentation));
    }
    else {
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
// API Documentation - Also available at /api 
app.get("/api", (req, res) => {
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html')) {
        // Serve HTML documentation for browsers
        res.setHeader('Content-Type', 'text/html');
        res.send((0, api_docs_template_1.generateApiDocsHTML)(api_documentation_1.apiDocumentation));
    }
    else {
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
// Routes
app.use("/api/auth", auth_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/fields", field_routes_1.default);
app.use("/api/bookings", booking_routes_1.default);
app.use("/api/earnings", earnings_routes_1.default);
app.use("/api/stripe-connect", stripe_connect_routes_1.default);
app.use("/api/payouts", payout_routes_1.default);
app.use("/api/commission", commission_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/chat', chat_routes_1.default);
// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || "Internal Server Error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});
// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM signal received: closing HTTP server");
    await exports.prisma.$disconnect();
    process.exit(0);
});
