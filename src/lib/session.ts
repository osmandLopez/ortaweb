import { auth } from './auth';
import type { Rol, Usuario } from './types';

/*
 * Lectura de sesión para el servidor.
 *
 * Better Auth guarda la sesión en una cookie httpOnly y la valida contra la
 * tabla `sesiones`. Con cookieCache activo, la mayoría de las navegaciones se
 * resuelven sin tocar la base.
 */
export async function leerSesion(headers: Headers): Promise<Usuario | null> {
  const sesion = await auth.api.getSession({ headers }).catch(() => null);
  if (!sesion?.user) return null;

  const u = sesion.user as typeof sesion.user & { rol?: Rol };
  return {
    id: u.id,
    nombre: u.name,
    email: u.email,
    rol: u.rol === 'admin' ? 'admin' : 'cliente',
    creadoEn: new Date(u.createdAt).toISOString(),
  };
}

export function esAdmin(usuario: Usuario | null): boolean {
  return usuario?.rol === 'admin';
}

export function rolDe(usuario: Usuario | null): Rol {
  return usuario?.rol ?? 'invitado';
}

/**
 * Rutas que exigen un rol concreto. El resto del sitio es público, incluido el
 * checkout: comprar como invitado es un requisito, no una excepción.
 */
export const RUTAS_PROTEGIDAS: { prefijo: string; rol: Rol }[] = [
  { prefijo: '/admin', rol: 'admin' },
  { prefijo: '/api/admin', rol: 'admin' },
  { prefijo: '/cuenta', rol: 'cliente' },
];
