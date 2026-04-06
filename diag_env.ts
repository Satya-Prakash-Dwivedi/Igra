import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

console.log('--- S3 ENV DIAGNOSTICS ---');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? (process.env.AWS_ACCESS_KEY_ID === 'DUMMY_ACCESS_KEY_ID' ? 'DUMMY' : 'PRESENT') : 'MISSING');
console.log('S3_BUCKET:', process.env.S3_BUCKET);
console.log('isS3Disabled:', !process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'DUMMY_ACCESS_KEY_ID');
console.log('--- END DIAGNOSTICS ---');
