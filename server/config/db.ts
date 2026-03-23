import dotenv from 'dotenv'
import mongoose from 'mongoose'
import logger, { serializeError } from '../utils/logger.ts'

dotenv.config({ quiet: true })

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI!)

    logger.info('database.connected', {
      host: conn.connection.host,
      database: conn.connection.name,
    })
  } catch (error) {
    logger.error('database.connection_failed', {
      error: serializeError(error),
    })
    process.exit(1)
  }
}

export default connectDB
