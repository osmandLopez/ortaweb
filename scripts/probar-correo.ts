/*
 * Prueba de envío real con Resend.
 *
 *   npm run correo:probar -- tu@correo.mx
 *
 * Manda un correo de verdad usando el mismo código que el sitio (src/lib/correo.ts),
 * así que lo que salga aquí es exactamente lo que pasaría en un registro. Existe
 * porque los fallos de Resend se ven desde dentro del sitio como "no llegó el
 * correo", sin más: Better Auth convierte el error en un 500 genérico y el
 * motivo real se queda en los logs de la función. Aquí sale el estado y el
 * cuerpo de la respuesta, que es lo único que dice qué está mal.
 */
import './entorno-local';
import { correoConfigurado, correoVerificacion, enviarCorreo } from '../src/lib/correo';
import { sitioUrl } from '../src/lib/entorno';

const destino = process.argv[2];

if (!destino || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
  console.error('Falta el correo de destino.\n  npm run correo:probar -- tu@correo.mx');
  process.exit(1);
}

const remitente = process.env.CORREO_REMITENTE;

console.log(`Remitente: ${remitente ?? '(sin definir)'}`);
console.log(`Clave:     ${process.env.RESEND_API_KEY ? 'definida' : '(sin definir)'}`);
console.log(`Destino:   ${destino}\n`);

if (!correoConfigurado()) {
  console.error(
    '✗ El sitio se considera "sin proveedor de correo": falta RESEND_API_KEY o\n' +
      '  CORREO_REMITENTE, o alguna sigue con el valor de ejemplo de .env.example.\n' +
      '  Mientras siga así, la verificación de cuenta y el restablecimiento de\n' +
      '  contraseña quedan desactivados (a propósito, para no encerrar a nadie).',
  );
  process.exit(1);
}

/* Se manda la plantilla real de verificación, no un "hola mundo": así se ve de
   una vez cómo llega, cómo se lee el asunto y si el enlace sale bien formado. */
const plantilla = correoVerificacion('Prueba', `${sitioUrl()}/verificar?prueba=1`);
const resultado = await enviarCorreo({ para: destino, ...plantilla });

if (resultado.ok) {
  console.log(`✓ Resend lo aceptó. id: ${resultado.id ?? '(sin id)'}`);
  console.log('  Revisa la bandeja y también spam. Si no llega en un par de');
  console.log('  minutos, míralo en https://resend.com/emails: ahí se ve si');
  console.log('  rebotó y por qué.');
  process.exit(0);
}

console.error(`✗ No se envió (${resultado.motivo}): ${resultado.detalle}\n`);

/* Los tres errores que salen siempre al configurar Resend por primera vez. El
   cuerpo que devuelve la API es correcto pero no dice qué hacer. */
const d = resultado.detalle;
if (/\b401\b|api_key|API key/i.test(d)) {
  console.error(
    'La clave no es válida. Cópiala otra vez de resend.com > API Keys\n' +
      '(empieza con re_) y revisa que no se haya colado un espacio en .env.',
  );
} else if (/\b403\b|not verified|testing emails/i.test(d)) {
  console.error(
    'El dominio del remitente no está verificado, o estás usando\n' +
      'onboarding@resend.dev, que solo entrega a la dirección con la que\n' +
      'abriste la cuenta de Resend. Para mandar a cualquiera hay que verificar\n' +
      'un dominio propio: resend.com > Domains > Add Domain, y poner los\n' +
      'registros DNS que pida donde tengas el dominio.',
  );
} else if (/\b422\b|from/i.test(d)) {
  console.error(
    'CORREO_REMITENTE está mal formado. Tiene que ser exactamente\n' +
      '  Nombre <correo@tudominio.mx>\n' +
      'y el dominio, uno verificado en Resend.',
  );
}

process.exit(1);
