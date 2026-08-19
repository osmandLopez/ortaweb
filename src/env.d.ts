/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    usuario: import('./lib/types').Usuario | null;
  }
}

interface ImportMetaEnv {
  readonly STRIPE_SECRET_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;
  readonly PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  readonly PUBLIC_SITE_URL: string;
  readonly BETTER_AUTH_SECRET: string;
  readonly BETTER_AUTH_TRUSTED_ORIGINS?: string;
  readonly RESEND_API_KEY?: string;
  readonly CORREO_REMITENTE?: string;
  readonly DATABASE_URL: string;
  readonly DATABASE_AUTH_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
