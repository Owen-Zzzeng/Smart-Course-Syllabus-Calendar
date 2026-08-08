import { z } from 'zod';

/**
 * Fail fast on misconfiguration. Importing this module anywhere on the server
 * guarantees the process has a usable configuration, rather than discovering a
 * missing variable deep inside a request handler.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-2024-08-06'),
  MOCK_AI: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  ENABLE_OCR: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

/**
 * The extractor runs in mock mode when explicitly forced or when no API key is
 * present. This keeps the whole product demoable with zero credentials.
 */
export const usingMockAi = env.MOCK_AI || env.OPENAI_API_KEY.length === 0;
