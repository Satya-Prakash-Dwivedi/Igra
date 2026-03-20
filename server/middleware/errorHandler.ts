import type {Request, Response, NextFunction} from 'express';
import logger from '../utils/logger.ts';
import { log } from 'node:console';
import { success } from 'zod';

// The main error handler middleware
export const errorHandler = (err : any, req : Request, res : Response, next : NextFunction) => {
    // use the status code from error or default to 500 (Internal server error)
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    // Log the message
    logger.error(`${err.message} - ${req.method} ${req.originalUrl} - IP : ${req.ip}`);

    res.status(statusCode).json({
        success: false,
        message : err.message || "Server Error",
        stack : process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

export const notFound = (req: Request, res : Response, next : NextFunction) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(400);
    next(error);
}