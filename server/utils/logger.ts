import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { inspect } from 'node:util'
import winston from 'winston'

export type LogMetadata = Record<string, unknown>

const logDirectory = path.resolve(process.cwd(), 'logs')
const environment = process.env.NODE_ENV ?? 'development'
const isDevelopment = environment === 'development'

mkdirSync(logDirectory, { recursive: true })

const devConsoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    const metadataOutput =
      Object.keys(metadata).length > 0
        ? `\n${inspect(metadata, {
            colors: true,
            compact: false,
            depth: 6,
            breakLength: 100,
          })}`
        : ''

    const stackOutput = stack ? `\n${stack}` : ''

    return `${timestamp} ${level} ${message}${metadataOutput}${stackOutput}`
  })
)

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  defaultMeta: {
    service: 'igra-api',
    environment,
  },
  transports: [
    new winston.transports.Console({
      format: isDevelopment ? devConsoleFormat : jsonFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, 'error.log'),
      level: 'error',
      format: jsonFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, 'application.log'),
      format: jsonFormat,
    }),
  ],
})

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: typeof error === 'string' ? error : 'Unknown error',
    value: error,
  }
}

export default logger
