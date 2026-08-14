/*
 * Punto de entrada de datos.
 *
 * Todo el sitio importa `db` desde aquí y solo conoce la interfaz Repositorio,
 * así que cambiar de motor es cambiar esta línea. El esquema vive en
 * src/lib/schema.ts y las migraciones se generan desde ahí.
 */
import { sqlite } from './sqlite';

export const db = sqlite;

export { ErrorDeDatos } from './repositorio';
export type { FiltroProductos, Repositorio } from './repositorio';
