import dotenv from 'dotenv';
import path from 'path';
import os from 'os';

dotenv.config();

const isVercel = Boolean(process.env.VERCEL);

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  UPLOAD_DIR: process.env.UPLOAD_DIR || (isVercel ? path.join(os.tmpdir(), 'uploads') : './uploads'),
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '26214400', 10), // 25MB
};

