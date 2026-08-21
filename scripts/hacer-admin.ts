/*
 * Asciende una cuenta ya existente a administrador.
 *
 *   npx tsx scripts/hacer-admin.ts rosario@ortanovedades.mx
 *
 * El rol no se puede pedir desde el registro (está marcado input:false en la
 * configuración de Better Auth), así que este script es la única vía. Crea la
 * cuenta normal desde /entrar y después ascíendela aquí.
 */
import './entorno-local';
import { db } from '../src/lib/db';

const email = process.argv[2];

if (!email) {
  console.error('Falta el correo.\n  npx tsx scripts/hacer-admin.ts correo@ejemplo.mx');
  process.exit(1);
}

const ok = await db.asignarRol(email, 'admin');

if (ok) {
  console.log(`${email} ya es administrador. Vuelve a entrar para que tome efecto.`);
} else {
  console.error(`No hay ninguna cuenta con el correo ${email}. Créala primero en /entrar.`);
  process.exit(1);
}
