import express from 'express';
import type {Request, Response } from 'express'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import connectDB from './config/db.ts';
import { errorHandler, notFound } from './middleware/errorHandler.ts'
import authRoutes from './routes/authRoutes.ts';
import logger from './utils/logger.ts';

dotenv.config()

const app = express();

// 1. Security Middlewares
app.use(helmet()); // sets various HTTP headers for security
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(cookieParser()); // Parse cookies from request
app.use(express.json({limit: '10kb'})); // limit body size to prevent Dos

// 2. Rate limiting (Prevent Brute Force)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max : 100, // each IP to 100 request per window
    message : 'Too many request from this IP, please try again after 15 minutes',
});
app.use('/api', limiter);

// 3. API Routes
app.use('/api/v1/auth', authRoutes);

// 4. Error handeling must be last
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT ;

app.get('/hello', (req : Request, res : Response) => {
    res.send('Hello from Igra Studios')
})

const startServer = async() => {
    try {
        await connectDB()
        app.listen(PORT, () => {
            logger.info(`Server running on ${process.env.NODE_ENV} on port ${PORT}`);
        });
    } catch (error) {
        logger.error(`Error starting server : ${error}`)
        process.exit(1);
    }
}

startServer();