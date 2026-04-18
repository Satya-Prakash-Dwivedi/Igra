import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// ─────────────────────────────────────────────────────────────
// 🔴 RED: Replace these dummy values with real credentials
//         from the client before deployment.
//
//    Required environment variables:
//      - S3_BUCKET          (e.g. "igra-assets")
//      - S3_REGION          (e.g. "us-east-1")
//      - AWS_ACCESS_KEY_ID
//      - AWS_SECRET_ACCESS_KEY
//
//    Optional:
//      - S3_ENDPOINT        (for S3-compatible providers)
//      - INVOICE_PDF_BUCKET (defaults to S3_BUCKET)
// ─────────────────────────────────────────────────────────────

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
});

export { s3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand, getSignedUrl };

export default s3Client;
