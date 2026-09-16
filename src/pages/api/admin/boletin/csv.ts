import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { sitioUrl } from '@/lib/entorno';

export const prerender = false;

/*
 * La lista del boletín en CSV, para subirla a la herramienta con la que se
 * manden las promociones.
 *
 * Cada fila lleva su enlace de baja: el aviso de privacidad promete uno al
 * final de cada correo, y así cualquier herramienta puede ponerlo como campo.
 */

/* Excel ejecuta como fórmula una celda que empieza con = + - o @, y el correo
   lo escribe cualquiera en el pie. El apóstrofo lo deja como texto. */
const celda = (valor: string) => {
  const seguro = /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replace(/"/g, '""')}"`;
};

export const GET: APIRoute = async () => {
  const suscriptores = await db.listarSuscriptores();
  const base = sitioUrl();

  const filas = [
    ['correo', 'suscrito_el', 'enlace_baja'],
    ...suscriptores.map((s) => [s.email, s.creadoEn.slice(0, 10), `${base}/boletin/baja?token=${s.token}`]),
  ];
  // El BOM es para que Excel abra el archivo como UTF-8 y no destroce los acentos.
  const csv = '\uFEFF' + filas.map((f) => f.map(celda).join(',')).join('\r\n') + '\r\n';

  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="orta-boletin-${hoy}.csv"`,
      'cache-control': 'no-store',
    },
  });
};
