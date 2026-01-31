import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import errorHandler from './middlewares/error.middleware.js';
import { PORT } from './config/env.js';
import authRouter from './routes/auth.route.js';
import leadRouter from './routes/lead.route.js';
import invoiceRouter from './routes/invoice.route.js';
import payoutRouter from './routes/payout.route.js';
import commissionRouter from './routes/commission.route.js';
import dashboardRouter from './routes/dashboard.route.js';
import franchiseRouter from './routes/franchise.route.js';
import bankRouter from './routes/bank.route.js';
import userRouter from './routes/user.route.js';
import documentRouter from './routes/document.route.js';
import reportRouter from './routes/report.route.js';
import agentRouter from './routes/agent.route.js';
import staffRouter from './routes/staff.route.js';
import notificationRouter from './routes/notification.route.js';
import connectDB from './config/db.js';
import { seedDefaultAdmin } from './utils/seedAdmin.js';

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/leads', leadRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/payouts', payoutRouter);
app.use('/api/commissions', commissionRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/franchises', franchiseRouter);
app.use('/api/banks', bankRouter);
app.use('/api/users', userRouter);
app.use('/api/documents', documentRouter);
app.use('/api/reports', reportRouter);
app.use('/api/agents', agentRouter);
app.use('/api/staff', staffRouter);
app.use('/api/notifications', notificationRouter);

// Error handler (must be last)
app.use(errorHandler);

// Start server and connect to database
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();
    
    // Create default admin user if it doesn't exist
    await seedDefaultAdmin();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log("\n" + "=".repeat(60));
      console.log("🚀 Server Started Successfully!");
      console.log("=".repeat(60));
      console.log(`📍 Server URL: http://localhost:${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log("=".repeat(60) + "\n");
    });
  } catch (error) {
    console.error("\n❌ Failed to start server!");
    console.error("Error:", error.message);
    process.exit(1);
  }
};

startServer();
