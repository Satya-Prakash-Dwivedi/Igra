import type { NextFunction, Request, Response } from 'express'
import logger, { serializeError } from '../utils/logger.ts'

// The main error handler middleware
export const errorHandler = (
  err: Error & { statusCode?: number },
  req: Request,
  res: Response,
  next: NextFunction
) => {
  void next

  const statusCode = res.statusCode === 200 ? (err.statusCode ?? 500) : res.statusCode

  logger.error('request.failed', {
    requestId: res.locals.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    ip: req.ip,
    error: serializeError(err),
  })

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  })
}

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`)
  res.status(404)
  next(error)
}
