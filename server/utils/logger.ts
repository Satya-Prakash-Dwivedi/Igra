import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { inspect } from 'node:util'
import winston from 'winston'

export type LogMetadata = Record<string, unknown>

const serviceName = process.env.SERVICE_NAME || process.env.CONTAINER_NAME || 'igra-api'
const logDirectory = path.resolve(process.cwd(), 'Logs')
const environment = process.env.NODE_ENV ?? 'development'
const isDevelopment = environment === 'development'

mkdirSync(logDirectory, { recursive: true })

const devConsoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, service, environment, ...metadata }) => {
    // 1. Level Icons
    const icons: Record<string, string> = {
      info: 'ℹ️ ',
      warn: '⚠️ ',
      error: '🚨 ',
      debug: '🐞 ',
    }
    // Strip ANSI codes to get raw level name
    const rawLevel = level.replace(/\x1b\[[0-9;]*m/g, '')
    const icon = icons[rawLevel] || '📝 '

    // 2. Clean Metadata
    const cleanMeta = Object.keys(metadata).reduce((acc, key) => {
      // Filter out internal winston symbols
      if (typeof key !== 'symbol' && !key.startsWith('_')) {
        acc[key] = metadata[key]
      }
      return acc
    }, {} as Record<string, unknown>)

    // 3. HTTP Request Formatting (Special Case)
    if (typeof message === 'string' && (message.includes('request.completed') || message.includes('request.failed'))) {
      const method = String(cleanMeta.method || '').padEnd(6)
      const statusCode = Number(cleanMeta.statusCode) || 0
      const path = cleanMeta.path || ''
      const durationMs = cleanMeta.durationMs ? `${cleanMeta.durationMs}ms` : ''

      // Color code status
      let statusColor = '\x1b[32m' // Green
      if (statusCode >= 400) statusColor = '\x1b[31m' // Red
      else if (statusCode >= 300) statusColor = '\x1b[33m' // Yellow
      
      const reset = '\x1b[0m'
      const statusText = `${statusColor}${statusCode}${reset}`

      let errorTrace = ''
      if (cleanMeta.error && typeof cleanMeta.error === 'object') {
        const errStr = (cleanMeta.error as any).stack || inspect(cleanMeta.error, { colors: true })
        errorTrace = `\n\x1b[31m${errStr}\x1b[0m`
        delete cleanMeta.error
      }

      return `${timestamp} ${level} ${icon} [HTTP] ${statusText} | ${method} ${path} \t ${durationMs}${errorTrace}`
    }

    // 4. Default Metadata Formatter
    const metaKeys = Object.keys(cleanMeta)
    let metadataOutput = ''
    
    if (metaKeys.length > 0) {
      if (metaKeys.length <= 3 && !stack) {
        // Compact inline metadata
        const compact = metaKeys.map(k => `\x1b[36m${k}\x1b[0m=${inspect(cleanMeta[k], { colors: true, compact: true, depth: 1 })}`).join(' ')
        metadataOutput = ` \x1b[2m| ${compact}\x1b[0m`
      } else {
        // Detailed multiline metadata
        metadataOutput = `\n${inspect(cleanMeta, {
          colors: true,
          compact: false,
          depth: 6,
          breakLength: 100,
        })}`
      }
    }

    const stackOutput = stack ? `\n\x1b[31m${stack}\x1b[0m` : ''

    return `${timestamp} ${level} ${icon} ${message}${metadataOutput}${stackOutput}`
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
    service: serviceName,
    environment,
  },
  transports: [
    new winston.transports.Console({
      format: isDevelopment ? devConsoleFormat : jsonFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, `${serviceName}-error.log`),
      level: 'error',
      format: jsonFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, `${serviceName}.log`),
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
