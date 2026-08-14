import { useStore } from '@nanostores/preact';
import { useState } from 'preact/hooks';
import { carrito, hayApartado, saldoApartado, subtotalACobrar, valorMercancia } from '@/stores/cart';
import { precio } from '@/lib/money';
import { useHidratado } from '@/stores/hidratacion';
import type { MetodoEntrega, OpcionEnvio, Sucursal } from '@/lib/types';

interface Props {
  sucursales: Sucursal[];
  emailPrevio?: string;
}

export default function Checkout({ sucursales, emailPrevio = '' }: Props) {
  const hidratado = useHidratado();
  const guardados = useStore(carrito);
  const aCobrarGuardado = useStore(subtotalACobrar);
  const mercanciaGuardada = useStore(valorMercancia);
  const saldoGuardado = useStore(saldoApartado);
  const apartadoGuardado = useStore(hayApartado);

  const items = hidratado ? guardados : [];
  const aCobrar = hidratado ? aCobrarGuardado : 0;
  const mercancia = hidratado ? mercanciaGuardada : 0;
  const saldo = hidratado ? saldoGuardado : 0;
  const conApartado = hidratado && apartadoGuardado;

  const [email, setEmail] = useState(emailPrevio);
  const [metodo, setMetodo] = useState<MetodoEntrega>('envio');
  const [cp, setCp] = useState('');
  const [opciones, setOpciones] = useState<OpcionEnvio[]>([]);
  const [opcionId, setOpcionId] = useState('');
  const [sucursalId, setSucursalId] = useState(sucursales[0]?.id ?? '');
  const [cotizando, setCotizando] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const opcion = opciones.find((o) => o.id === opcionId) ?? null;
  const costoEnvio = metodo === 'envio' ? opcion?.costo ?? 0 : 0;
  const totalHoy = aCobrar + costoEnvio;

  const cotizar = async () => {
    setError('');
    if (!/^\d{5}$/.test(cp)) return setError('El código postal son 5 dígitos.');
    setCotizando(true);
    const res = await fetch('/api/shipping/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cp, subtotal: mercancia }),
    });
    setCotizando(false);
    if (!res.ok) return setError((await res.json()).error);
    const { opciones: nuevas } = await res.json();
    setOpciones(nuevas);
    setOpcionId(nuevas[0]?.id ?? '');
  };

  const pagar = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (!email) return setError('Escribe tu correo: ahí te llega la confirmación.');
    if (metodo === 'envio' && !opcion) return setError('Cotiza el envío con tu código postal.');
    if (metodo === 'pickup' && !sucursalId) return setError('Elige la sucursal donde vas a recoger.');

    setEnviando(true);
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, modo: i.modo })),
        email,
        metodoEntrega: metodo,
        cp: metodo === 'envio' ? cp : undefined,
        opcionEnvioId: opcionId || undefined,
        sucursalId: metodo === 'pickup' ? sucursalId : undefined,
      }),
    });

    if (!res.ok) {
      setEnviando(false);
      return setError((await res.json()).error ?? 'No se pudo iniciar el pago.');
    }
    // Stripe Checkout aloja el formulario de tarjeta: ningún dato de pago
    // toca nuestro servidor.
    const { url } = await res.json();
    window.location.href = url;
  };

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
              ['envio', 'Envío a domicilio', 'Cotizamos con tu código postal'],
              ['pickup', 'Recoger en tienda', 'Sin costo, listo el mismo día'],
            ] as const).map(([valor, titulo, ayuda]) => (
              <label key={valor}
                class={`cursor-pointer rounded-md border p-4 transition ${metodo === valor ? 'border-cielo-500 bg-cielo-50' : 'border-tinta-200 hover:border-tinta-400'}`}>
                <input type="radio" name="metodo" class="sr-only" checked={metodo === valor}
                  onChange={() => setMetodo(valor)} />
                <span class="block text-sm font-bold text-tinta-900">{titulo}</span>
                <span class="block text-xs text-tinta-500">{ayuda}</span>
              </label>
            ))}
          </div>

          {metodo === 'envio' ? (
            <div class="mt-5">
              <label class="campo-etiqueta" for="cp">Código postal</label>
              <div class="flex gap-2">
                <input id="cp" class="campo font-nota tabular-nums" inputMode="numeric" maxLength={5}
                  value={cp} placeholder="36000"
                  onInput={(e) => setCp((e.target as HTMLInputElement).value.replace(/\D/g, ''))} />
                <button type="button" class="btn-linea shrink-0" onClick={cotizar} disabled={cotizando}>
                  {cotizando ? 'Cotizando…' : 'Cotizar'}
                </button>
              </div>

              {opciones.length > 0 && (
                <ul class="mt-4 space-y-2">
                  {opciones.map((o) => (
                    <li key={o.id}>
                      <label class={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3.5 transition ${opcionId === o.id ? 'border-cielo-500 bg-cielo-50' : 'border-tinta-200 hover:border-tinta-400'}`}>
                        <span>
                          <input type="radio" name="opcionEnvio" class="sr-only" checked={opcionId === o.id}
                            onChange={() => setOpcionId(o.id)} />
                          <span class="block text-sm font-bold text-tinta-900">{o.nombre}</span>
                          <span class="block text-xs text-tinta-500">
                            {o.descripcion} · {o.diasHabiles[0]}–{o.diasHabiles[1]} días hábiles
                          </span>
                        </span>
                        <span class="font-nota text-sm tabular-nums text-tinta-900">
                          {o.costo === 0 ? 'Gratis' : precio(o.costo)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <ul class="mt-5 space-y-2">
              {sucursales.map((s) => (
                <li key={s.id}>
                  <label class={`block cursor-pointer rounded-md border p-3.5 transition ${sucursalId === s.id ? 'border-cielo-500 bg-cielo-50' : 'border-tinta-200 hover:border-tinta-400'}`}>
                    <input type="radio" name="sucursal" class="sr-only" checked={sucursalId === s.id}
                      onChange={() => setSucursalId(s.id)} />
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
          <p class="mt-4 text-sm text-tinta-600">
            Al continuar te llevamos a Stripe para capturar la tarjeta. Aceptamos crédito,
            débito, Apple&nbsp;Pay y Google&nbsp;Pay.
          </p>
          {conApartado && (
            <p class="mt-3 rounded-md bg-mistico-50 px-3 py-2.5 text-sm text-mistico-800">
              Hoy pagas solo el anticipo. El saldo de {precio(saldo)} lo abonas en línea o en
              sucursal antes de la fecha de vencimiento.
            </p>
          )}
        </section>
      </div>

      <aside class="nota-seccion lg:sticky lg:top-40">
        <h2 class="etiqueta text-tinta-400">Resumen</h2>

        <ul class="mt-4 divide-y divide-tinta-200">
          {items.map((i) => (
            <li key={`${i.productoId}:${i.modo}`} class="flex justify-between gap-3 py-2.5 text-sm">
              <span class="text-tinta-700">
                {i.nombre}
                <span class="font-nota text-[11px] text-tinta-400"> ×{i.cantidad}</span>
                {i.modo === 'apartado' && <span class="mt-1 block text-[11px] text-mistico-700">Anticipo</span>}
              </span>
              <span class="font-nota shrink-0 tabular-nums text-tinta-900">
                {precio((i.modo === 'apartado' ? i.anticipo : i.precio) * i.cantidad)}
              </span>
            </li>
          ))}
        </ul>

        <dl class="mt-4 space-y-2 border-t border-dashed border-tinta-300 pt-4 text-sm">
          <div class="guia">
            <dt class="text-tinta-600">Envío</dt>
            <dd class="font-nota tabular-nums text-tinta-900">
              {metodo === 'pickup' ? 'Recoges' : opcion ? (costoEnvio === 0 ? 'Gratis' : precio(costoEnvio)) : 'Por cotizar'}
            </dd>
          </div>
          {conApartado && (
            <div class="guia">
              <dt class="text-mistico-700">Saldo por liquidar</dt>
              <dd class="font-nota tabular-nums text-mistico-700">{precio(saldo)}</dd>
            </div>
          )}
          <div class="guia border-t border-tinta-200 pt-3">
            <dt class="font-bold text-tinta-900">Pagas hoy</dt>
            <dd class="font-nota text-xl font-bold tabular-nums text-tinta-900">{precio(totalHoy)}</dd>
          </div>
        </dl>

        {error && <p role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

        <button type="submit" class="btn-primario mt-5 w-full" disabled={enviando}>
          {enviando ? 'Abriendo pago seguro…' : `Pagar ${precio(totalHoy)}`}
        </button>
        <p class="mt-3 text-center font-nota text-[11px] text-tinta-500">
          Pago procesado por Stripe · Cifrado extremo a extremo
        </p>
      </aside>
    </form>
  );
}
