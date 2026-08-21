import { createAuthClient } from 'better-auth/client';

/**
 * Cliente de autenticación para las islas. Habla con /api/auth del mismo origen,
 * así que no necesita configuración: la cookie de sesión la pone el servidor.
 */
export const authCliente = createAuthClient();

/** Lo que devuelve el cliente de Better Auth cuando algo sale mal. */
export interface ErrorDeAuth {
  code?: string;
  message?: string;
  status?: number;
  statusText?: string;
}

/** Traduce los errores de Better Auth al idioma y al tono de la tienda. */
export function mensajeDeError(error: ErrorDeAuth | null | undefined): string {
  const codigo = error?.code;
  switch (codigo) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'El correo o la contraseña no coinciden.';
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'Ya hay una cuenta con ese correo. Entra en vez de crear una nueva.';
    case 'PASSWORD_TOO_SHORT':
      return 'La contraseña necesita al menos 8 caracteres.';
    case 'PASSWORD_TOO_LONG':
      return 'Esa contraseña es demasiado larga. Prueba con una más corta.';
    case 'INVALID_EMAIL':
      return 'Revisa el correo: parece que le falta algo.';
    case 'EMAIL_NOT_VERIFIED':
      return 'Falta confirmar tu correo. Te mandamos otro enlace: revisa tu bandeja.';
    case 'EMAIL_ALREADY_VERIFIED':
      return 'Ese correo ya está confirmado. Puedes entrar con tu contraseña.';
    case 'INVALID_TOKEN':
      return 'Ese enlace ya no sirve. Pide uno nuevo desde “Olvidé mi contraseña”.';
    case 'TOKEN_EXPIRED':
      return 'El enlace caducó. Pide uno nuevo y ábrelo dentro de la siguiente hora.';
    case 'USER_NOT_FOUND':
      return 'No encontramos una cuenta con ese correo.';
    case 'INVALID_ORIGIN':
    case 'MISSING_OR_NULL_ORIGIN':
      /* Configuración del servidor, no culpa de quien está en el formulario:
         falta el dominio en PUBLIC_SITE_URL o en los orígenes confiables. */
      return 'El servidor no reconoce este dominio. Avísanos para revisarlo.';
    default:
      if (error?.message) return error.message;
      /* Sin código ni mensaje casi siempre es un fallo del servidor que no llegó
         a convertirse en respuesta de Better Auth. Enseñar el número hace que un
         reporte del cliente sirva para algo en vez de quedarse en "no funciona". */
      return error?.status
        ? `No pudimos completar la operación (error ${error.status}). Inténtalo de nuevo o avísanos.`
        : 'No pudimos completar la operación. Revisa tu conexión e inténtalo de nuevo.';
  }
}

/* --- Validación compartida ---------------------------------------------
 *
 * Estas reglas son las mismas que aplica el servidor (Better Auth valida el
 * correo y el largo de la contraseña; el nombre lo comprueba un hook). Aquí
 * viven para que el formulario avise antes de enviar, no para sustituirlo:
 * lo que decide es siempre el backend.
 */

export const LARGO_MINIMO_CLAVE = 8;

/* Suficientemente estricta para atrapar erratas de verdad (falta @, falta
   dominio, espacios) sin pelearse con direcciones válidas raras. */
const CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function correoValido(email: string): boolean {
  return CORREO.test(email.trim());
}

/** Devuelve el primer problema del registro, o null si todo está bien. */
export function errorDeRegistro(datos: {
  nombre: string;
  email: string;
  clave: string;
  confirmacion: string;
}): string | null {
  if (datos.nombre.trim().length < 2) return 'Escribe tu nombre para que sepamos cómo llamarte.';
  if (!datos.email.trim()) return 'Escribe tu correo: ahí llega la confirmación.';
  if (!correoValido(datos.email)) return 'Revisa el correo: parece que le falta algo.';
  if (!datos.clave) return 'Elige una contraseña.';
  if (datos.clave.length < LARGO_MINIMO_CLAVE) {
    return `La contraseña necesita al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
  }
  if (datos.clave !== datos.confirmacion) return 'Las dos contraseñas no coinciden.';
  return null;
}

/** Devuelve el primer problema del inicio de sesión, o null si todo está bien. */
export function errorDeEntrada(datos: { email: string; clave: string }): string | null {
  if (!datos.email.trim()) return 'Escribe tu correo.';
  if (!correoValido(datos.email)) return 'Revisa el correo: parece que le falta algo.';
  if (!datos.clave) return 'Escribe tu contraseña.';
  return null;
}

/** Devuelve el primer problema de la contraseña nueva, o null si todo está bien. */
export function errorDeClaveNueva(clave: string, confirmacion: string): string | null {
  if (!clave) return 'Elige una contraseña.';
  if (clave.length < LARGO_MINIMO_CLAVE) {
    return `La contraseña necesita al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
  }
  if (clave !== confirmacion) return 'Las dos contraseñas no coinciden.';
  return null;
}
