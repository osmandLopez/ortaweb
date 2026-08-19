import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { memoryAdapter } from 'better-auth/adapters/memory';
import * as t from './schema';

import { env, modoDemo, origenesConfiables, sitioUrl } from './entorno';
import { correoConfigurado, correoRestablecer, correoVerificacion, enviarCorreo } from './correo';

/*
 * En modo demo las cuentas viven en memoria: se puede registrar y entrar para
 * enseñar el flujo, pero la sesión no sobrevive al reciclado de la función.
 * Con base real, los usuarios van a la misma base que el catálogo y los pedidos.
 */
const almacen = modoDemo
  ? memoryAdapter({})
  : drizzleAdapter((await import('./sqlite')).orm, {
      provider: 'sqlite',
      // Las claves son los modelos de Better Auth; los valores, mis tablas.
      // Así el SQL queda en español sin que el adaptador tenga que saberlo.
      schema: {
        user: t.usuarios,
        session: t.sesiones,
        account: t.cuentas,
        verification: t.verificaciones,
      },
    });

/*
 * Verificación de correo: se exige en cuanto hay proveedor de envío.
 *
 * Si no lo hay, exigirla dejaría a todo el mundo fuera con un correo que nunca
 * llega, así que la cuenta sirve desde el alta y queda el aviso en consola. En
 * cuanto se definen RESEND_API_KEY y CORREO_REMITENTE, el flujo real se activa
 * solo, sin tocar código.
 */
const conCorreo = correoConfigurado();

if (!conCorreo) {
  console.warn(
    '[orta] Sin proveedor de correo: la verificación de cuenta y el enlace para ' +
      'restablecer contraseña quedan desactivados. Define RESEND_API_KEY y ' +
      'CORREO_REMITENTE para activarlos.',
  );
}

/*
 * Autenticación. Los usuarios viven en la misma base que el catálogo y los
 * pedidos, así que no hay un almacén paralelo que sincronizar: pedidos.usuario_id
 * apunta directo a la tabla de usuarios que llena Better Auth.
 *
 * El rol es un campo adicional del usuario, no una tabla aparte. Se lee en el
 * middleware para decidir el acceso a /admin y /cuenta.
 */
export const auth = betterAuth({
  database: almacen,

  // Sin secreto propio Better Auth no arranca. En modo demo se usa uno fijo:
  // las sesiones son de usar y tirar, no hay nada que proteger todavía.
  secret: env('BETTER_AUTH_SECRET') ?? (modoDemo ? 'orta-demo-sin-secreto-configurado' : undefined),
  // Dominio canónico: el que va en los enlaces que Better Auth firma y manda
  // por correo. No es la lista de orígenes aceptados, que va justo abajo.
  baseURL: sitioUrl(),

  /*
   * Protección CSRF del backend de autenticación. Better Auth compara la
   * cabecera `Origin` de cada POST contra esta lista; lo que no esté aquí se
   * rechaza con `Invalid origin`.
   *
   * La lista sale de las variables del despliegue (dominio propio, dominio de
   * producción de Vercel, deploy y rama) más localhost en desarrollo. Sigue
   * siendo un allowlist cerrado: nada de `*` ni de confiar en lo que mande el
   * navegador.
   */
  trustedOrigins: origenesConfiables(),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: conCorreo,

    // Enlace para elegir contraseña nueva. Lo pide /entrar y aterriza en
    // /restablecer con el token ya validado por Better Auth.
    sendResetPassword: async ({ user, url }) => {
      const resultado = await enviarCorreo({ para: user.email, ...correoRestablecer(user.name, url) });
      if (!resultado.ok) {
        // Que falle el proveedor no puede pasar por "correo enviado": el
        // usuario se quedaría esperando un enlace que nunca sale.
        console.error(`[orta] Restablecer contraseña de ${user.email}: ${resultado.detalle}`);
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: 'No pudimos enviar el correo. Inténtalo en un momento o escríbenos.',
        });
      }
    },
  },

  emailVerification: {
    // Sale solo al registrarse y también al intentar entrar sin verificar, para
    // que nadie se quede encerrado por haber perdido el primer correo.
    sendOnSignUp: conCorreo,
    sendOnSignIn: conCorreo,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // 1 hora
    sendVerificationEmail: async ({ user, url }) => {
      const resultado = await enviarCorreo({ para: user.email, ...correoVerificacion(user.name, url) });
      if (!resultado.ok) {
        console.error(`[orta] Verificación de ${user.email}: ${resultado.detalle}`);
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: 'No pudimos enviar el correo de verificación. Inténtalo en un momento.',
        });
      }
    },
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

  /*
   * Validación de servidor del alta.
   *
   * El formulario ya valida en el navegador, pero eso solo cuida la experiencia:
   * cualquiera puede llamar a /api/auth/sign-up/email directamente. Better Auth
   * comprueba el formato del correo y el largo de la contraseña; el nombre lo
   * comprobamos aquí, y de paso se guarda limpio.
   */
  databaseHooks: {
    user: {
      create: {
        before: async (usuario) => {
          const nombre = (usuario.name ?? '').trim().replace(/\s+/g, ' ');
          if (nombre.length < 2) {
            throw new APIError('BAD_REQUEST', {
              message: 'Escribe tu nombre: al menos dos caracteres.',
            });
          }
          return { data: { ...usuario, name: nombre, email: usuario.email.trim().toLowerCase() } };
        },
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
