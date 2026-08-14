/*
 * Punto de entrada de datos.
 *
 * Todo el sitio importa `db` desde aquí y solo conoce la interfaz Repositorio,
 * así que cambiar de motor es cambiar esta línea. El esquema vive en
 * src/lib/schema.ts y las migraciones se generan desde ahí.
 */
import { modoDemo } from './entorno';
import type { Repositorio } from './repositorio';

/* La importación es dinámica a propósito: en modo demo no se debe ni cargar el
   módulo de libSQL, que abre conexión y arrastra el controlador nativo. */
export const db: Repositorio = modoDemo
  ? (await import('./memoria')).memoria
  : (await import('./sqlite')).sqlite;

export { ErrorDeDatos } from './repositorio';
export type { FiltroProductos, Repositorio } from './repositorio';
