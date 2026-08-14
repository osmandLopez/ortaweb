import { defineMiddleware } from 'astro:middleware';
import { leerSesion, RUTAS_PROTEGIDAS } from '@/lib/session';

export const onRequest = defineMiddleware(async (context, next) => {
  const ruta = context.url.pathname;

  // Better Auth se sirve a sí mismo: es la puerta, no puede estar detrás del guardia.
  if (ruta.startsWith('/api/auth')) return next();

  const usuario = await leerSesion(context.request.headers);
  context.locals.usuario = usuario;

  const regla = RUTAS_PROTEGIDAS.find((r) => ruta.startsWith(r.prefijo));
  if (!regla) return next();

  // El admin entra también a las áreas de cliente; lo contrario no.
  const permitido = usuario && (usuario.rol === regla.rol || usuario.rol === 'admin');
  if (permitido) return next();

  if (ruta.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        error: usuario
          ? 'No tienes permiso para esta operación.'
          : 'Necesitas iniciar sesión.',
      }),
      { status: usuario ? 403 : 401, headers: { 'content-type': 'application/json' } },
    );
  }

  return context.redirect(`/entrar?destino=${encodeURIComponent(ruta)}`, 302);
});
