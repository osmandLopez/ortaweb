import { env, sitioUrl } from './entorno';
import { precio } from './money';
import type { Pedido, Sucursal } from './types';

/*
 * Envío de correo transaccional con Resend.
 *
 * Se habla con su API por HTTP en vez de instalar el SDK: es una sola petición
 * POST, corre igual en la función serverless de Vercel que en el dev server, y
 * no añade dependencias al proyecto.
 *
 * Nada de esto es opcional en producción, pero el sitio tiene que seguir de pie
 * si falta la clave: `correoConfigurado` deja que el resto del código decida qué
 * hacer (por ejemplo, no exigir verificación de correo si no hay con qué
 * mandarla) en vez de reventar a mitad de un registro.
 */

const API = 'https://api.resend.com/emails';

/*
 * Los valores de ejemplo de .env.example no cuentan como configuración.
 *
 * Copiar el archivo y no rellenarlo deja RESEND_API_KEY con una clave falsa:
 * el sitio creería que puede mandar correos, exigiría verificar la cuenta y
 * Resend contestaría "API key is invalid" — con el usuario esperando para
 * siempre un correo que no salió. Con esta comprobación el sitio se comporta
 * como si no hubiera proveedor: la cuenta sirve desde el alta y el aviso de
 * consola dice qué falta.
 */
function esMarcadorDePosicion(valor: string): boolean {
  return /x{8,}/i.test(valor) || /tudominio\.mx|ejemplo\.com|cambia-esto/i.test(valor);
}

function valorReal(clave: string): string | undefined {
  const valor = env(clave)?.trim();
  if (!valor || esMarcadorDePosicion(valor)) return undefined;
  return valor;
}

/** true cuando hay proveedor de correo listo para enviar de verdad. */
export function correoConfigurado(): boolean {
  return Boolean(valorReal('RESEND_API_KEY') && remitente());
}

/** Remitente verificado en Resend: "Orta Novedades <hola@tudominio.mx>". */
function remitente(): string | undefined {
  return valorReal('CORREO_REMITENTE');
}

export interface Correo {
  para: string;
  asunto: string;
  html: string;
  /** Alternativa en texto plano. Sin ella, muchos filtros bajan la reputación. */
  texto: string;
}

export type ResultadoCorreo =
  | { ok: true; id: string | null }
  | { ok: false; motivo: 'sin_configurar' | 'rechazado'; detalle: string };

/**
 * Manda un correo. Nunca lanza: quien llama decide si el fallo es fatal.
 *
 * En los flujos de cuenta no lo es —el registro ya quedó hecho— pero sí hay que
 * poder decírselo al usuario en vez de dejarlo esperando un correo que no salió.
 */
export async function enviarCorreo(correo: Correo): Promise<ResultadoCorreo> {
  const clave = valorReal('RESEND_API_KEY');
  const de = remitente();

  if (!clave || !de) {
    const detalle =
      'Falta RESEND_API_KEY o CORREO_REMITENTE, o siguen con el valor de ejemplo. ' +
      'Defínelas en .env para desarrollo, o en las variables de entorno del ' +
      'proyecto en Vercel para el sitio publicado.';
    console.warn(`[orta] Correo no enviado a ${correo.para}: ${detalle}`);
    return { ok: false, motivo: 'sin_configurar', detalle };
  }

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${clave}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: de,
        to: [correo.para],
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
      }),
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      const detalle = `Resend respondió ${res.status}. ${cuerpo}`.trim();
      console.error(`[orta] Correo rechazado para ${correo.para}: ${detalle}`);
      return { ok: false, motivo: 'rechazado', detalle };
    }

    const datos = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: datos?.id ?? null };
  } catch (e) {
    const detalle = (e as Error).message;
    console.error(`[orta] No se pudo contactar al proveedor de correo: ${detalle}`);
    return { ok: false, motivo: 'rechazado', detalle };
  }
}

/* --- Plantillas ---------------------------------------------------------
 *
 * HTML plano con estilos en línea, que es lo único que renderizan igual todos
 * los clientes de correo. Los colores son los de la marca: tinta y cielo.
 */

const TINTA = '#1A1A1E';
const CIELO = '#0EA5E9';
const GRIS = '#6B7280';

function envoltura(titulo: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es-MX"><body style="margin:0;padding:24px;background:#F7F7F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${TINTA}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E5E5E8;border-radius:12px">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${GRIS}">Orta Novedades</p>
      <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:${TINTA}">${titulo}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;color:#3F3F46">${cuerpo}</td></tr>
    <tr><td style="padding:0 28px 24px;border-top:1px solid #E5E5E8">
      <p style="margin:16px 0 0;font-size:12px;color:${GRIS}">
        Si no fuiste tú, puedes ignorar este mensaje.<br>
        <a href="${sitioUrl()}" style="color:${CIELO}">${sitioUrl().replace(/^https?:\/\//, '')}</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function boton(url: string, texto: string): string {
  return `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:${CIELO};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:15px">${texto}</a></p>
  <p style="margin:0;font-size:12px;color:${GRIS};word-break:break-all">O copia este enlace: ${url}</p>`;
}

export function correoVerificacion(nombre: string, url: string): Omit<Correo, 'para'> {
  const saludo = nombre ? `Hola ${nombre.split(' ')[0]}` : 'Hola';
  return {
    asunto: 'Confirma tu correo · Orta Novedades',
    html: envoltura(
      'Confirma tu correo',
      `<p style="margin:0">${saludo}: falta un paso para activar tu cuenta. El enlace vale 1 hora.</p>
       ${boton(url, 'Confirmar mi correo')}`,
    ),
    texto: `${saludo}: confirma tu correo para activar tu cuenta en Orta Novedades.\n\n${url}\n\nEl enlace vale 1 hora. Si no creaste la cuenta, ignora este mensaje.`,
  };
}

export function correoRestablecer(nombre: string, url: string): Omit<Correo, 'para'> {
  const saludo = nombre ? `Hola ${nombre.split(' ')[0]}` : 'Hola';
  return {
    asunto: 'Restablece tu contraseña · Orta Novedades',
    html: envoltura(
      'Restablece tu contraseña',
      `<p style="margin:0">${saludo}: pediste cambiar la contraseña de tu cuenta. El enlace vale 1 hora y solo se puede usar una vez.</p>
       ${boton(url, 'Elegir contraseña nueva')}`,
    ),
    texto: `${saludo}: pediste cambiar tu contraseña en Orta Novedades.\n\n${url}\n\nEl enlace vale 1 hora y solo se puede usar una vez. Si no lo pediste, ignora este mensaje: tu contraseña sigue igual.`,
  };
}

/**
 * Confirmación de compra. Solo sale cuando Stripe confirmó el cobro, y una sola
 * vez por pedido: el webhook no la repite si Stripe reintenta el evento.
 */
export function correoPedido(pedido: Pedido, sucursal: Sucursal | null): Omit<Correo, 'para'> {
  const fecha = new Date(pedido.pagadoEn ?? pedido.creadoEn).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const entrega = sucursal
    ? `Recoges en ${sucursal.nombre} · ${sucursal.direccion}. ${sucursal.horario}.`
    : 'Te enviamos la guía de rastreo en cuanto salga de bodega.';

  const filas = pedido.items
    .map(
      (i) => `<tr>
        <td style="padding:6px 0;font-size:14px;color:#3F3F46">${i.nombre} <span style="color:${GRIS}">×${i.cantidad}</span></td>
        <td style="padding:6px 0;font-size:14px;text-align:right;white-space:nowrap;color:${TINTA}">${precio(i.precio * i.cantidad)}</td>
      </tr>`,
    )
    .join('');

  const totales = `<tr>
      <td style="padding:6px 0;font-size:14px;color:#3F3F46">Subtotal</td>
      <td style="padding:6px 0;font-size:14px;text-align:right;color:${TINTA}">${precio(pedido.subtotal)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#3F3F46">Envío</td>
      <td style="padding:6px 0;font-size:14px;text-align:right;color:${TINTA}">${
        pedido.metodoEntrega === 'pickup' ? 'Recoges en tienda' : pedido.envio === 0 ? 'Gratis' : precio(pedido.envio)
      }</td>
    </tr>
    <tr>
      <td style="padding:10px 0 0;font-size:15px;font-weight:700;border-top:1px solid #E5E5E8;color:${TINTA}">Total pagado</td>
      <td style="padding:10px 0 0;font-size:15px;font-weight:700;text-align:right;border-top:1px solid #E5E5E8;color:${TINTA}">${precio(pedido.pagado)}</td>
    </tr>`;

  const html = envoltura(
    'Gracias por tu compra',
    `<p style="margin:0">Tu pago quedó confirmado el ${fecha}. Guarda este correo: el folio es tu referencia.</p>
     <p style="margin:16px 0 0;font-size:13px;color:${GRIS}">Folio <strong style="color:${TINTA}">${pedido.folio}</strong></p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #E5E5E8">
       ${filas}${totales}
     </table>
     <p style="margin:20px 0 0;font-size:14px;color:#3F3F46">${entrega}</p>`,
  );

  const lineas = pedido.items.map((i) => `· ${i.nombre} ×${i.cantidad} — ${precio(i.precio * i.cantidad)}`).join('\n');

  return {
    asunto: `Pedido ${pedido.folio} confirmado · Orta Novedades`,
    html,
    texto: [
      `Gracias por tu compra. Tu pago quedó confirmado el ${fecha}.`,
      `Folio: ${pedido.folio}`,
      '',
      lineas,
      '',
      `Subtotal: ${precio(pedido.subtotal)}`,
      `Envío: ${pedido.metodoEntrega === 'pickup' ? 'Recoges en tienda' : pedido.envio === 0 ? 'Gratis' : precio(pedido.envio)}`,
      `Total pagado: ${precio(pedido.pagado)}`,
      '',
      entrega,
    ].join('\n'),
  };
}
