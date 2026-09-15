import { useStore } from '@nanostores/preact';
import { useEffect, useState } from 'preact/hooks';
import { carrito, subtotal, vaciar } from '@/stores/cart';
import { precio } from '@/lib/money';
import { correoValido } from '@/lib/auth-cliente';
import { useHidratado } from '@/stores/hidratacion';
import type { MetodoEntrega, Sucursal } from '@/lib/types';

interface Props {
  sucursales: Sucursal[];
  emailPrevio?: string;
}

export default function Checkout({ sucursales, emailPrevio = '' }: Props) {
  const hidratado = useHidratado();
  const guardados = useStore(carrito);
  const subtotalGuardado = useStore(subtotal);

  const items = hidratado ? guardados : [];
  const mercancia = hidratado ? subtotalGuardado : 0;

  const [email, setEmail] = useState(emailPrevio);
  const [metodo, setMetodo] = useState<MetodoEntrega>('envio');
  const [cp, setCp] = useState('');
  const [sucursalId, setSucursalId] = useState(sucursales[0]?.id ?? '');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  /* Folio de la solicitud de envío ya registrada. Mientras valga algo, la isla
     enseña el acuse en vez del formulario: el pedido existe y volver a mandarlo
     crearía un duplicado. */
  const [solicitado, setSolicitado] = useState('');

  /* Con envío no hay total todavía: el envío lo pone la paquetería después. */
  const total = mercancia;

  /* Volver con el botón "atrás" desde Stripe no siempre recarga la página: el
     navegador suele tenerla guardada entera —el bfcache— con el estado de
     JavaScript incluido. Cuando la restaura así, `enviando` sigue valiendo true
     (lo dejamos puesto a propósito al salir hacia Stripe) y el botón se queda
     apagado en "Abriendo pago seguro…"; ni cambiando la entrega se despierta,
     porque el submit sale por el cerrojo del doble clic. Al restaurarla lo
     soltamos: de ese intento no salió ningún cobro y se puede volver a empezar. */
  useEffect(() => {
    const alRestaurar = (e: PageTransitionEvent) => {
      if (e.persisted) setEnviando(false);
    };
    window.addEventListener('pageshow', alRestaurar);
    return () => window.removeEventListener('pageshow', alRestaurar);
  }, []);

  const pagar = async (e: Event) => {
    e.preventDefault();
    // Segundo cerrojo contra el doble clic: el botón ya está deshabilitado
    // mientras se envía, pero un Enter repetido en el formulario se cuela igual.
    if (enviando) return;

    setError('');
    if (!correoValido(email)) return setError('Escribe un correo válido: ahí te llega la confirmación.');
    if (metodo === 'envio' && !/^\d{5}$/.test(cp)) {
      return setError('Escribe tu código postal: son 5 dígitos. Lo necesitamos para cotizar el envío.');
    }
    if (metodo === 'pickup' && !sucursalId) return setError('Elige la sucursal donde vas a recoger.');

    setEnviando(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
          email,
          metodoEntrega: metodo,
          cp: metodo === 'envio' ? cp : undefined,
          sucursalId: metodo === 'pickup' ? sucursalId : undefined,
        }),
      });

      // El cuerpo puede no ser JSON si algo revienta antes de llegar al endpoint.
      const cuerpo = await res.json().catch(() => null);

      if (!res.ok) {
        setEnviando(false);
        return setError(cuerpo?.error ?? 'No se pudo registrar tu pedido. Inténtalo de nuevo.');
      }

      /* Envío: no hay a dónde ir. El pedido quedó guardado esperando precio de
         envío, así que se vacía el carrito —ya está en el pedido, dejarlo
         invitaría a pedirlo dos veces— y se enseña el acuse con el folio. */
      if (cuerpo?.solicitud) {
        vaciar();
        setSolicitado(cuerpo.folio);
        return;
      }

      if (!cuerpo?.url) {
        setEnviando(false);
        return setError('No se pudo iniciar el pago. Inténtalo de nuevo.');
      }

      /* Stripe Checkout aloja el formulario de tarjeta: ningún dato de pago toca
         nuestro servidor. `enviando` se queda en true a propósito —la pestaña
         está a punto de irse a Stripe y reactivar el botón solo invitaría a un
         segundo clic durante la navegación. */
      window.location.href = cuerpo.url;
    } catch {
      /* La petición ni siquiera salió (sin red, o el servidor no respondió).
         Aquí no hay cobro posible, así que se puede reintentar sin miedo. */
      setEnviando(false);
      setError('No pudimos conectar con el pago. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  /* Acuse de la solicitud. Va antes de la comprobación del carrito vacío a
     propósito: al registrar el pedido se vacía el carrito, y sin este orden el
     cliente vería "tu carrito está vacío" justo después de pedir. */
  if (solicitado) {
    return (
      <div class="nota-seccion mx-auto max-w-xl text-center">
        <p class="etiqueta text-cielo-600">Pedido registrado</p>
        <p class="rotulo mt-3 text-2xl text-tinta-900">Ya lo tenemos apartado</p>

        <p class="mt-4 font-nota text-sm text-tinta-500">
          Folio <strong class="text-tinta-900">{solicitado}</strong>
        </p>

        <p class="mt-5 text-sm leading-relaxed text-tinta-600">
          Te mandamos un correo a <strong class="text-tinta-900">{email}</strong> con el detalle.
          En cuanto pesemos tu paquete y sepamos el costo del envío, te llega el total con el
          enlace para pagar.
        </p>
        <p class="mt-3 text-sm leading-relaxed text-tinta-600">
          <strong class="text-tinta-900">Todavía no se te ha cobrado nada.</strong> Si el envío te
          parece caro, no pagas y cancelamos el pedido.
        </p>

        <div class="mt-7 flex flex-wrap justify-center gap-3">
          <a href="/tienda" class="btn-primario">Seguir viendo la tienda</a>
          <a href="/contacto" class="btn-linea">Dudas sobre mi pedido</a>
        </div>
      </div>
    );
  }

  /* El servidor no conoce el carrito, así que este bloque es también lo que se
     envía en el HTML. Mientras la isla monta dice "leyendo", no "vacío": el
     carrito puede tener cosas y anunciar lo contrario sería mentirle al cliente. */
  if (!hidratado || items.length === 0) {
    return (
      <div class="nota-seccion text-center">
        <p class="rotulo text-xl text-tinta-900">
          {hidratado ? 'Tu carrito está vacío' : 'Leyendo tu carrito'}
        </p>
        <p class="mt-2 text-sm text-tinta-500">
          {hidratado ? 'Agrega algo antes de pasar a pagar.' : 'Un momento.'}
        </p>
        {hidratado && <a href="/tienda" class="btn-primario mt-5">Ver el catálogo</a>}
      </div>
    );
  }

  return (
    <form onSubmit={pagar} class="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <div class="space-y-6">
        <section class="nota-seccion">
          <h2 class="etiqueta text-tinta-400">1 · Contacto</h2>
          <div class="mt-4">
            <label class="campo-etiqueta" for="email">Correo electrónico</label>
            <input id="email" type="email" class="campo" value={email} placeholder="tu@correo.mx"
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
            <p class="mt-1.5 text-xs text-tinta-500">
              Compra como invitado. Si prefieres guardar tu historial,{' '}
              <a href="/entrar" class="text-cielo-600 underline">entra a tu cuenta</a>.
            </p>
          </div>
        </section>

        <section class="nota-seccion">
          <h2 class="etiqueta text-tinta-400">2 · Cómo lo recibes</h2>

          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            {([
              ['envio', 'Envío a domicilio', 'Te pasamos el costo antes de cobrarte'],
              ['pickup', 'Recoger en tienda', 'Sin costo de envío, pagas ahora'],
            ] as const).map(([valor, titulo, ayuda]) => (
              <label key={valor}
                class={`cursor-pointer rounded-md border p-4 transition ${metodo === valor ? 'border-cielo-500 bg-cielo-50' : 'border-tinta-200 hover:border-tinta-400'}`}>
                <input type="radio" name="metodo" class="sr-only" checked={metodo === valor}
                  onChange={() => { setError(''); setMetodo(valor); }} />
                <span class="block text-sm font-bold text-tinta-900">{titulo}</span>
                <span class="block text-xs text-tinta-500">{ayuda}</span>
              </label>
            ))}
          </div>

          {metodo === 'envio' ? (
            <div class="mt-5">
              <label class="campo-etiqueta" for="cp">Código postal</label>
              <input id="cp" class="campo font-nota tabular-nums sm:max-w-[10rem]" inputMode="numeric" maxLength={5}
                value={cp} placeholder="64150"
                onInput={(e) => setCp((e.target as HTMLInputElement).value.replace(/\D/g, ''))} />

              <div class="mt-4 rounded-md border border-oro-300 bg-oro-50 p-4">
                <p class="text-sm font-bold text-oro-900">El envío se cotiza y te lo mandamos</p>
                <p class="mt-1.5 text-xs leading-relaxed text-oro-800">
                  La paquetería cobra según el peso y el tamaño del paquete, así que el precio
                  exacto lo sabemos al despacharlo. Hoy <strong>no te cobramos nada</strong>:
                  registramos tu pedido, lo pesamos, y te mandamos el total con el enlace para
                  pagar. Si el envío te parece caro, no pagas y lo cancelamos.
                </p>
              </div>
            </div>
          ) : (
            <ul class="mt-5 space-y-2">
              {sucursales.map((s) => (
                <li key={s.id}>
                  <label class={`block cursor-pointer rounded-md border p-3.5 transition ${sucursalId === s.id ? 'border-cielo-500 bg-cielo-50' : 'border-tinta-200 hover:border-tinta-400'}`}>
                    <input type="radio" name="sucursal" class="sr-only" checked={sucursalId === s.id}
                      onChange={() => { setError(''); setSucursalId(s.id); }} />
                    <span class="block text-sm font-bold text-tinta-900">{s.nombre}</span>
                    <span class="block text-xs text-tinta-500">{s.direccion}</span>
                    <span class="mt-1 block font-nota text-[11px] text-tinta-500">{s.horario}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section class="nota-seccion">
          <h2 class="etiqueta text-tinta-400">3 · Pago</h2>
          {metodo === 'envio' ? (
            <p class="mt-4 text-sm leading-relaxed text-tinta-600">
              Cuando tengamos el costo del envío te llega un correo con el total y un enlace
              para pagar con tarjeta, Apple&nbsp;Pay o Google&nbsp;Pay. La dirección de entrega
              te la pedimos ahí.
            </p>
          ) : (
            <p class="mt-4 text-sm text-tinta-600">
              Al continuar te llevamos a Stripe para capturar la tarjeta. Aceptamos crédito,
              débito, Apple&nbsp;Pay y Google&nbsp;Pay.
            </p>
          )}
        </section>
      </div>

      <aside class="nota-seccion lg:sticky lg:top-40">
        <h2 class="etiqueta text-tinta-400">Resumen</h2>

        <ul class="mt-4 divide-y divide-tinta-200">
          {items.map((i) => (
            <li key={i.productoId} class="flex justify-between gap-3 py-2.5 text-sm">
              <span class="text-tinta-700">
                {i.nombre}
                <span class="font-nota text-[11px] text-tinta-400"> ×{i.cantidad}</span>
              </span>
              <span class="font-nota shrink-0 tabular-nums text-tinta-900">
                {precio(i.precio * i.cantidad)}
              </span>
            </li>
          ))}
        </ul>

        <dl class="mt-4 space-y-2 border-t border-dashed border-tinta-300 pt-4 text-sm">
          <div class="guia">
            <dt class="text-tinta-600">Subtotal</dt>
            <dd class="font-nota tabular-nums text-tinta-900">{precio(mercancia)}</dd>
          </div>
          <div class="guia">
            <dt class="text-tinta-600">Envío</dt>
            <dd class="font-nota tabular-nums text-tinta-900">
              {metodo === 'pickup' ? 'Recoges' : 'Por cotizar'}
            </dd>
          </div>
          <div class="guia border-t border-tinta-200 pt-3">
            <dt class="font-bold text-tinta-900">{metodo === 'envio' ? 'Mercancía' : 'Total'}</dt>
            <dd class="font-nota text-xl font-bold tabular-nums text-tinta-900">{precio(total)}</dd>
          </div>
        </dl>

        {metodo === 'envio' && (
          <p class="mt-3 text-xs leading-relaxed text-tinta-500">
            Más el envío, que te pasamos por correo antes de cobrarte.
          </p>
        )}

        {error && <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

        <button type="submit" class="btn-primario mt-5 w-full" disabled={enviando}>
          {enviando
            ? metodo === 'envio' ? 'Registrando tu pedido…' : 'Abriendo pago seguro…'
            : metodo === 'envio' ? 'Solicitar mi pedido' : `Pagar ${precio(total)}`}
        </button>
        <p class="mt-3 text-center font-nota text-[11px] text-tinta-500">
          {metodo === 'envio'
            ? 'No se te cobra nada todavía'
            : 'Pago procesado por Stripe · Cifrado extremo a extremo'}
        </p>
      </aside>
    </form>
  );
}
