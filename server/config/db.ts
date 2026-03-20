import mongoose from "mongoose";
import logger from "../utils/logger.ts";
import dotenv from "dotenv"

dotenv.config()

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI!);
         logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error: any) {
        logger.error(`❌ Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;