import dotenv from 'dotenv'
import mongoose from 'mongoose'
import logger, { serializeError } from '../utils/logger.js'

dotenv.config({ quiet: true })

const connectDB = async () => {
  try {
    if (process.env.NODE_ENV === 'development') {
      mongoose.set('debug', true)
    }

    const conn = await mongoose.connect(process.env.MONGO_URI!, {
      maxPoolSize: 100, // Increased from 10 to 100 for high concurrency
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      family: 4, // Force IPv4 to avoid some environment-specific connection drops
    })

    logger.info('database.connected', {
      host: conn.connection.host,
      database: conn.connection.name,
      poolSize: (conn.connection as any).poolSize || 10,
    })

    // Explicit listeners for connection stability
    mongoose.connection.on('error', (err) => {
      logger.error('database.error', { error: serializeError(err) })
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('database.disconnected')
    })

    mongoose.connection.on('reconnected', () => {
      logger.info('database.reconnected')
    })

    mongoose.connection.on('connected', () => {
      logger.info('database.connected_listener')
    })
  } catch (error) {
    logger.error('database.connection_failed', {
      error: serializeError(error),
    })
    process.exit(1)
  }
}

export default connectDB
