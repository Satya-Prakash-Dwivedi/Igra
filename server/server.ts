import express from 'express';
import type { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

import connectDB from './config/db.ts';
import { errorHandler, notFound } from './middleware/errorHandler.ts';
import { requestLogger } from './middleware/requestLogger.ts';
import authRoutes from './routes/authRoutes.ts';
import orderRoutes from './routes/orderRoutes.ts';
import channelRoutes from './routes/channelRoutes.ts';
import supportRoutes from './routes/supportRoutes.ts';
import creditRoutes from './routes/creditRoutes.ts';
import billingRoutes from './routes/billingRoutes.ts';
import uploadRoutes from './routes/uploadRoutes.ts';
import messageRoutes from './routes/messageRoutes.ts';
import adminRoutes from './routes/adminRoutes.ts';
import webhookRoutes from './routes/webhookRoutes.ts';
import logger, { serializeError } from './utils/logger.ts';

dotenv.config({ quiet: true });

const app = express();
const httpServer = createServer(app);

// ─── Socket.IO for Real-Time Chat ─────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.info('socket.connected', {
    socketId: socket.id,
  });

  socket.on('join-order', (orderId: string) => {
    socket.join(`order:${orderId}`);
    logger.info('socket.joined_order', {
      socketId: socket.id,
      orderId,
    });
  });

  socket.on('leave-order', (orderId: string) => {
    socket.leave(`order:${orderId}`);
    logger.info('socket.left_order', {
      socketId: socket.id,
      orderId,
    });
  });

  socket.on('disconnect', () => {
    logger.info('socket.disconnected', {
      socketId: socket.id,
    });
  });
});

// Make io accessible in controllers
app.set('io', io);

// ─── 1. Security Middlewares ──────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
}));
app.use(cookieParser());
app.use(requestLogger);

// Webhooks need raw body — parse before JSON middleware
app.use('/api/v1/webhooks', express.raw({ type: 'application/json' }));

// 🔴 Local Upload Proxy: needs large raw body for multipart chunks
app.use('/api/v1/uploads/local-part', express.raw({ type: '*/*', limit: '20mb' }));

app.use(express.json({ limit: '10kb' }));

// ─── 2. Rate Limiting ────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10000 : 100, // much higher limit for dev
  message: 'Too many requests from this IP, please try again after 15 minutes',
  skip: (req) => process.env.NODE_ENV === 'development', // skip limiting entirely in dev
});
app.use('/api', limiter);

// ─── 3. API Routes ───────────────────────────────────────────
app.use('/api/v1/auth',      authRoutes);
app.use('/api/v1/orders',    orderRoutes);
app.use('/api/v1/orders',    messageRoutes);   // nested: /orders/:id/messages
app.use('/api/v1/channels',  channelRoutes);
app.use('/api/v1/support',   supportRoutes);
app.use('/api/v1/credits',   creditRoutes);
app.use('/api/v1/billing',   billingRoutes);
app.use('/api/v1/uploads',   uploadRoutes);
app.use('/api/v1/admin',     adminRoutes);
app.use('/api/v1/webhooks',  webhookRoutes);

// Static Assets
app.use('/uploads', express.static(path.resolve('uploads')));

// ─── 4. Health Check ─────────────────────────────────────────
app.get('/hello', (req: Request, res: Response) => {
  res.send('Hello from Igra Studios');
});

// ─── 5. Error Handling (must be last) ────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── 6. Start Server ─────────────────────────────────────────
const PORT = process.env.PORT;

const startServer = async () => {
  try {
    // Ensure upload directories exist
    const dirs = ['uploads', 'uploads/chunks'];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('server.dir_created', { dir });
      }
    }

    await connectDB();
    httpServer.listen(PORT, () => {
      logger.info('server.started', {
        port: PORT,
        environment: process.env.NODE_ENV ?? 'development',
      });
      logger.info('socket.ready');
    });
  } catch (error) {
    logger.error('server.start_failed', {
      error: serializeError(error),
    });
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled_rejection', {
    error: serializeError(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', {
    error: serializeError(error),
  });
  process.exit(1);
});

startServer();

export { io };
