/*
 * Comprobación de la configuración de Stripe.
 *
 *   npm run stripe:probar
 *
 * Existe por el mismo motivo que probar-correo: desde dentro del sitio, una
 * clave mal puesta se ve como "no pudimos abrir el pago" y el motivo real se
 * queda en los logs de la función. Aquí sale entero.
 *
 * Hace tres cosas, de menos a más comprometida:
 *   1. Mira que las tres variables existan y tengan la pinta correcta.
 *   2. Llama a la API de verdad, para saber si la clave sirve y a qué cuenta va.
 *   3. Abre una sesión de Checkout con el MISMO código que usa el sitio y la
 *      cierra enseguida. Es lo único que demuestra que los parámetros de
 *      crearSesionCheckout son válidos para tu cuenta.
 *
 * No cobra nada ni toca la base de datos.
 */
import './entorno-local';
import { crearSesionCheckout, enModoPrueba, stripeCliente } from '../src/lib/stripe';
import { sitioUrl } from '../src/lib/entorno';

const CLAVES = {
  secreta: process.env.STRIPE_SECRET_KEY ?? '',
  publica: process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  webhook: process.env.STRIPE_WEBHOOK_SECRET ?? '',
};

/* Las claves reales de Stripe pasan de 100 caracteres y los secretos de webhook
   rondan los 38. Los valores de ejemplo de .env.example tienen la forma correcta
   pero se quedan muy cortos, y ese es justo el fallo que más cuesta ver: el
   prefijo engaña y parece que está configurado. */
const pareceReal = (v: string, minimo: number) => v.length >= minimo;

let fallos = 0;
let pendientes = 0;
const bien = (t: string) => console.log(`  ✓ ${t}`);
const mal = (t: string) => {
  console.error(`  ✗ ${t}`);
  fallos++;
};
/* Distinto de `mal`: falta configurar algo, pero no impide comprobar el resto.
   El secreto del webhook es el caso típico —se saca de la CLI, que es un paso
   aparte— y tratarlo como error fatal dejaba sin probar las claves de la API,
   que es justo lo que se venía a mirar. */
const pendiente = (t: string) => {
  console.warn(`  · ${t}`);
  pendientes++;
};
const aviso = (t: string) => console.warn(`  ! ${t}`);

console.log('\nVariables de entorno\n');

if (!CLAVES.secreta) {
  mal('STRIPE_SECRET_KEY no está definida.');
} else if (!/^sk_(test|live)_/.test(CLAVES.secreta)) {
  mal('STRIPE_SECRET_KEY no empieza por sk_test_ ni sk_live_. Copiaste otra cosa.');
} else if (!pareceReal(CLAVES.secreta, 40)) {
  mal(
    `STRIPE_SECRET_KEY mide ${CLAVES.secreta.length} caracteres: sigue siendo el valor\n` +
      '    de ejemplo. La real pasa de 100. Sácala de Stripe > Desarrolladores >\n' +
      '    Claves de API > Clave secreta > Revelar clave de prueba.',
  );
} else {
  bien(`STRIPE_SECRET_KEY (${enModoPrueba() ? 'modo Prueba' : 'MODO PRODUCCIÓN'})`);
  if (!enModoPrueba()) {
    aviso('Es una clave de producción: los cobros son reales. Para desarrollar usa sk_test_.');
  }
}

if (!CLAVES.publica) {
  aviso(
    'PUBLIC_STRIPE_PUBLISHABLE_KEY no está definida. No hace falta hoy: el pago\n' +
      '    ocurre en el Checkout alojado por Stripe y el sitio nunca carga stripe.js.\n' +
      '    Déjala puesta igualmente por si más adelante se incrusta el formulario.',
  );
} else if (!/^pk_(test|live)_/.test(CLAVES.publica)) {
  mal('PUBLIC_STRIPE_PUBLISHABLE_KEY no empieza por pk_. Ojo: PUBLIC_ se publica al navegador.');
} else if (/^pk_test_/.test(CLAVES.publica) !== enModoPrueba()) {
  mal('La clave pública y la secreta son de modos distintos (una Test y otra Live).');
} else if (!pareceReal(CLAVES.publica, 40)) {
  aviso(
    `PUBLIC_STRIPE_PUBLISHABLE_KEY mide ${CLAVES.publica.length} caracteres: sigue siendo el\n` +
      '    valor de ejemplo. Hoy no rompe nada porque no se usa, pero cámbiala\n' +
      '    cuando pongas la secreta y así no queda una trampa para más adelante.',
  );
} else {
  bien('PUBLIC_STRIPE_PUBLISHABLE_KEY');
}

if (!CLAVES.webhook) {
  pendiente('STRIPE_WEBHOOK_SECRET sin definir: el webhook rechazará todos los avisos.');
} else if (!CLAVES.webhook.startsWith('whsec_')) {
  mal('STRIPE_WEBHOOK_SECRET no empieza por whsec_.');
} else if (!pareceReal(CLAVES.webhook, 32)) {
  pendiente(
    `STRIPE_WEBHOOK_SECRET mide ${CLAVES.webhook.length} caracteres: sigue siendo el valor\n` +
      '    de ejemplo. El real ronda los 38 y lo da "stripe listen" en local, o el\n' +
      '    panel al crear el endpoint.',
  );
} else {
  bien('STRIPE_WEBHOOK_SECRET');
}

/* Solo se corta aquí si la clave secreta no sirve: sin ella no hay nada más que
   comprobar. Lo que falte del webhook se dice al final, después de haber
   probado lo que sí se puede probar. */
if (fallos > 0) {
  console.error(`\n${fallos} problema(s) que hay que arreglar antes de seguir.\n`);
  process.exit(1);
}

/* --- La clave sirve de verdad ------------------------------------------- */

console.log('\nConexión con Stripe\n');

let cuentaEnPrueba: boolean;
try {
  const saldo = await stripeCliente().balance.retrieve();
  cuentaEnPrueba = !saldo.livemode;
  bien(`La API responde. Cuenta en modo ${cuentaEnPrueba ? 'Prueba' : 'Producción'}.`);
  const mxn = saldo.available.find((s) => s.currency === 'mxn');
  if (!mxn) {
    aviso(
      'La cuenta no tiene saldo en MXN todavía. Es normal antes del primer cobro,\n' +
        '    pero comprueba en Stripe > Configuración > Moneda que MXN esté aceptada:\n' +
        '    el sitio cobra en pesos y una cuenta que no los admita rechaza la sesión.',
    );
  }
} catch (e) {
  const detalle = (e as Error).message;
  console.error(`  ✗ Stripe rechazó la clave: ${detalle}\n`);
  if (/Invalid API Key|No such/i.test(detalle)) {
    console.error(
      'La clave no es válida. Cópiala otra vez desde Stripe > Desarrolladores >\n' +
        'Claves de API, y revisa que no se haya colado un espacio ni un salto de\n' +
        'línea al pegarla en .env.',
    );
  }
  process.exit(1);
}

/* --- Los parámetros de la sesión son válidos ---------------------------- */

console.log('\nApertura de una sesión de Checkout (de prueba, se cierra al final)\n');

try {
  const sesion = await crearSesionCheckout({
    items: [
      {
        productoId: 'diagnostico',
        slug: 'diagnostico',
        nombre: 'Artículo de diagnóstico',
        precio: 1000, // $10.00 MXN. No se cobra: la sesión se cierra sin pagar.
        imagen: '',
        cantidad: 1,
      },
    ],
    envio: null,
    metodoEntrega: 'pickup',
    sucursalId: null,
    email: '',
    folio: 'ON-PRUEBA',
    usuarioId: null,
    origen: sitioUrl(),
    // Aleatoria: cada ejecución del diagnóstico abre su propia sesión.
    claveIdempotencia: `diagnostico_${crypto.randomUUID()}`,
  });

  bien(`Sesión creada: ${sesion.id}`);
  bien(`URL de retorno configurada sobre ${sitioUrl()}`);

  if (!sesion.url) {
    aviso('Stripe no devolvió URL de pago. Revisa que la cuenta esté activada para cobrar.');
  }

  await stripeCliente().checkout.sessions.expire(sesion.id);
  bien('Sesión cerrada. No queda nada pendiente en tu panel.');
} catch (e) {
  const detalle = (e as Error).message;
  console.error(`  ✗ No se pudo abrir la sesión: ${detalle}\n`);
  if (/currency|mxn/i.test(detalle)) {
    console.error(
      'Tu cuenta de Stripe no acepta MXN. Entra a Stripe > Configuración >\n' +
        'Pagos y activa el peso mexicano, o cambia MONEDA en src/lib/stripe.ts.',
    );
  } else if (/activate|activation|capabilities/i.test(detalle)) {
    console.error(
      'La cuenta todavía no está activada para recibir pagos. En modo Prueba no\n' +
        'debería hacer falta; si sale en producción, completa el alta del negocio\n' +
        'en Stripe > Configuración > Datos del negocio.',
    );
  }
  process.exit(1);
}

if (pendientes > 0) {
  console.log('\nLas claves de la API funcionan: ya puedes cobrar en modo Prueba.\n');
  console.log('Falta el secreto del webhook. Sin él, /api/webhooks/stripe rechaza todos');
  console.log('los avisos de Stripe. La página de retorno confirma igual el pedido, así');
  console.log('que una compra de prueba ya funciona de principio a fin, pero el webhook');
  console.log('es lo que cubre al cliente que cierra la pestaña al pagar.\n');
  console.log('Para sacarlo en local, con la CLI de Stripe instalada:\n');
  console.log('  npm run stripe:listen\n');
  console.log('Imprime "Your webhook signing secret is whsec_...". Copia ese valor a');
  console.log('STRIPE_WEBHOOK_SECRET en .env y vuelve a ejecutar este comando.\n');
  process.exit(1);
}

console.log('\nTodo listo. Siguiente paso: arranca el sitio y el reenvío de eventos.\n');
console.log('  Terminal 1:  npm run dev');
console.log('  Terminal 2:  npm run stripe:listen');
console.log('\nY paga con la tarjeta de prueba 4242 4242 4242 4242, cualquier fecha');
console.log('futura, cualquier CVC y cualquier código postal.\n');
