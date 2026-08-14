import { createAuthClient } from 'better-auth/client';

/**
 * Cliente de autenticación para las islas. Habla con /api/auth del mismo origen,
 * así que no necesita configuración: la cookie de sesión la pone el servidor.
 */
export const authCliente = createAuthClient();

/** Traduce los errores de Better Auth al idioma y al tono de la tienda. */
export function mensajeDeError(codigo: string | undefined, texto: string | undefined): string {
  switch (codigo) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'El correo o la contraseña no coinciden.';
    case 'USER_ALREADY_EXISTS':
      return 'Ya hay una cuenta con ese correo. Entra en vez de crear una nueva.';
    case 'PASSWORD_TOO_SHORT':
      return 'La contraseña necesita al menos 8 caracteres.';
    case 'INVALID_EMAIL':
      return 'Revisa el correo: parece que le falta algo.';
    default:
      return texto || 'No pudimos completar la operación. Inténtalo de nuevo.';
  }
}
