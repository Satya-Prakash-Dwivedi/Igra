import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const S3_BUCKET = process.env.S3_BUCKET || 'igra-assets-dev';
export const S3_REGION = process.env.S3_REGION || 'us-east-1';
export const INVOICE_PDF_BUCKET = process.env.INVOICE_PDF_BUCKET || S3_BUCKET;

const s3Client = new S3Client({
  region: S3_REGION,
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'DUMMY_ACCESS_KEY_ID',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'DUMMY_SECRET_ACCESS_KEY',
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export { s3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand, getSignedUrl };

export default s3Client;
