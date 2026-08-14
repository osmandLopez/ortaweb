import type { APIRoute } from 'astro';
import { auth } from '@/lib/auth';

export const prerender = false;

/*
 * Better Auth resuelve aquí todas sus rutas: alta, entrada, salida, sesión y
 * restablecer contraseña. No hay endpoints propios que mantener.
 *
 * Ojo con el middleware: /api/auth NO puede quedar detrás del guardia de rol,
 * porque es justamente por donde se entra.
 */
export const ALL: APIRoute = ({ request }) => auth.handler(request);
