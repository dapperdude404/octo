import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  DATABASE_URL: z.string().min(1),
  GPTZERO_API_KEY: z.string().optional().default(''),
  WINSTONAI_API_KEY: z.string().optional().default(''),
  COPYLEAKS_EMAIL: z.string().optional().default(''),
  COPYLEAKS_API_KEY: z.string().optional().default(''),
  COPYLEAKS_SANDBOX: z.string().default('true'),
  COPYLEAKS_WEBHOOK_ENABLED: z.string().default('false'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  COPYLEAKS_WEBHOOK_SECRET: z.string().default('')
});

export const env = schema.parse(process.env);
