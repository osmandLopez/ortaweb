/*
 * Vive aparte de auth-cliente.ts para que el servidor y el formulario del pie
 * (que va en todas las páginas) puedan usarlo sin cargar el cliente de Better Auth.
 */

/* Suficientemente estricta para atrapar erratas de verdad (falta @, falta
   dominio, espacios) sin pelearse con direcciones válidas raras. */
const CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function correoValido(email: string): boolean {
  return CORREO.test(email.trim());
}
