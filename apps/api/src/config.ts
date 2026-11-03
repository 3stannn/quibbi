import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(?:\+srv)?:\/\//)
    .optional(),
  MONGODB_DB: z.string().min(1).default('quibbi'),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
});
export type Config = z.infer<typeof schema>;
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(
    Object.fromEntries(Object.entries(env).filter(([, value]) => value !== '')),
  );
  if (!parsed.success)
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  const result = parsed.data;
  const origin = new URL(result.APP_ORIGIN);
  if (origin.origin !== result.APP_ORIGIN || origin.username || origin.password)
    throw new Error(
      'APP_ORIGIN must be an origin without a trailing slash or path.',
    );
  if (result.NODE_ENV === 'production' && origin.protocol !== 'https:')
    throw new Error('Production APP_ORIGIN must use HTTPS.');
  if (result.NODE_ENV === 'production' && !isConfigured(result))
    throw new Error(
      'Production requires MONGODB_URI, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET.',
    );
  return result;
}
export function isConfigured(config: Config) {
  return Boolean(
    config.MONGODB_URI &&
      config.AUTH_SECRET &&
      config.AUTH_GOOGLE_ID &&
      config.AUTH_GOOGLE_SECRET,
  );
}

export function safeReturnUrl(url: string, origin: string): string {
  try {
    const parsed = new URL(url, origin);
    if (
      parsed.origin !== origin ||
      !/^\/(login$|library(?:\/|$)|decks\/|s\/)/.test(parsed.pathname)
    )
      return `${origin}/library`;
    return parsed.href;
  } catch {
    return `${origin}/library`;
  }
}
