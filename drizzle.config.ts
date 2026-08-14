import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/schema.ts',
  out: './db/migraciones',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./orta.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} satisfies Config;
