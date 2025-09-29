import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import compression from "compression"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"

// Import API documentation
import { apiDocumentation } from "./utils/api-documentation"
import { generateApiDocsHTML } from "./utils/api-docs-template"

// Import routes
import authRoutes from "./routes/auth.routes"
import userRoutes from "./routes/user.routes"
import fieldRoutes from "./routes/field.routes"
import bookingRoutes from "./routes/booking.routes"
import earningsRoutes from "./routes/earnings.routes"
import stripeConnectRoutes from "./routes/stripe-connect.routes"
import payoutRoutes from "./routes/payout.routes"
import commissionRoutes from "./routes/commission.routes"
import adminRoutes from "./routes/admin.routes"
import chatRoutes from "./routes/chat.routes"
// Load environment variables

dotenv.config();

// Initialize Express app
const app = express()
const PORT = process.env.PORT || 5000

// Initialize Prisma
export const prisma = new PrismaClient()

// Middleware
app.set('trust proxy', 1); 
app.use(helmet())
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
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
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}))

app.use(compression())
app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// API Documentation - Root route for production
app.get("/", (req, res) => {
  const acceptHeader = req.headers.accept || '';
  
  if (acceptHeader.includes('text/html')) {
    // Serve HTML documentation for browsers
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

// API Documentation - Also available at /api 
app.get("/api", (req, res) => {
  const acceptHeader = req.headers.accept || '';
  
  if (acceptHeader.includes('text/html')) {
    // Serve HTML documentation for browsers
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

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/fields", fieldRoutes)
app.use("/api/bookings", bookingRoutes)
app.use("/api/earnings", earningsRoutes)
app.use("/api/stripe-connect", stripeConnectRoutes)
app.use("/api/payouts", payoutRoutes)
app.use("/api/commission", commissionRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/chat', chatRoutes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() })
})

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})


// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing HTTP server")
  await prisma.$disconnect();
  process.exit(0);
})

