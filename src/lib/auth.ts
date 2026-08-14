import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { orm } from './sqlite';
import * as t from './schema';

import { env, sitioUrl } from './entorno';

/*
 * Autenticación. Los usuarios viven en la misma base que el catálogo y los
 * pedidos, así que no hay un almacén paralelo que sincronizar: pedidos.usuario_id
 * apunta directo a la tabla de usuarios que llena Better Auth.
 *
 * El rol es un campo adicional del usuario, no una tabla aparte. Se lee en el
 * middleware para decidir el acceso a /admin y /cuenta.
 */
export const auth = betterAuth({
  database: drizzleAdapter(orm, {
    provider: 'sqlite',
    // Las claves son los modelos de Better Auth; los valores, mis tablas.
    // Así el SQL queda en español sin que el adaptador tenga que saberlo.
    schema: {
      user: t.usuarios,
      session: t.sesiones,
      account: t.cuentas,
      verification: t.verificaciones,
    },
  }),

  secret: env('BETTER_AUTH_SECRET'),
  // En Vercel sale de VERCEL_URL si no hay dominio propio configurado, para que
  // la sesión no se rompa en los despliegues de previsualización.
  baseURL: sitioUrl(),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // El correo de verificación exige un proveedor de envío; hasta que lo haya,
    // la cuenta sirve desde el alta. Los pedidos no dependen de tener cuenta.
    requireEmailVerification: false,
  },

  user: {
    additionalFields: {
      rol: {
        type: 'string',
        required: false,
        defaultValue: 'cliente',
        // Nadie se asciende a sí mismo: el rol no se acepta desde el registro.
        input: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 días
    updateAge: 60 * 60 * 24, // renueva como mucho una vez al día
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min sin ir a la base en cada navegación
    },
  },

  advanced: {
    cookiePrefix: 'orta',
  },
});

export type Sesion = typeof auth.$Infer.Session;
