import { useState } from 'preact/hooks';
import { precio } from '@/lib/money';

interface Props {
  pedidoId: string;
  folio: string;
  /** centavos de la mercancía, para poder enseñar el total antes de mandar */
  subtotal: number;
  cpEntrega: string | null;
  /**
   * Centavos de una cotización anterior, si el pedido ya pasó por aquí y volvió
   * porque su enlace de pago caducó. Cero la primera vez.
   */
  envioPrevio: number;
}

type Listo = { url: string; total: number; correoEnviado: boolean };

/*
 * El paso que le pone precio al envío de un pedido.
 *
 * El dueño llega aquí con el ticket de la paquetería en la mano: escribe el
 * importe, ve el total que va a cobrar antes de mandarlo, y con un botón se
 * abre el cobro y sale el correo. El enlace se queda a la vista para pegarlo
 * por WhatsApp, que es como muchos clientes van a preferir pagar.
 */
export default function CotizarEnvio({ pedidoId, folio, subtotal, cpEntrega, envioPrevio }: Props) {
  /* Reenvío: el importe ya se sabe, así que viene escrito. El dueño solo tiene
     que pulsar, y si la paquetería le cobró otra cosa lo corrige encima. */
  const reenvio = envioPrevio > 0;
  const [envio, setEnvio] = useState(reenvio ? String(envioPrevio / 100) : '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState<Listo | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const pesos = Number(envio.replace(',', '.'));
  const valido = Number.isFinite(pesos) && pesos > 0;
  const total = valido ? subtotal + Math.round(pesos * 100) : subtotal;

  const cotizar = async () => {
    if (!valido) return setError('Escribe cuánto cobró la paquetería.');
    setOcupado(true);
    setError('');

    const res = await fetch(`/api/admin/pedidos/${pedidoId}/cotizar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ envio: pesos }),
    }).catch(() => null);

    setOcupado(false);

    if (!res?.ok) {
      const cuerpo = await res?.json().catch(() => null);
      return setError(cuerpo?.error ?? 'No se pudo abrir el cobro. Revisa tu conexión.');
    }

    const cuerpo = await res.json();
    setListo({ url: cuerpo.url, total: cuerpo.total, correoEnviado: cuerpo.correoEnviado });
  };

  const cancelar = async () => {
    setOcupado(true);
    setError('');

    const res = await fetch(`/api/admin/pedidos/${pedidoId}/cancelar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).catch(() => null);

    if (res?.ok) {
      window.location.reload();
      return;
    }

    setOcupado(false);
    setConfirmandoCancelar(false);
    const cuerpo = await res?.json().catch(() => null);
    setError(cuerpo?.error ?? 'No se pudo cancelar el pedido.');
  };

  const copiar = async () => {
    if (!listo) return;
    try {
      await navigator.clipboard.writeText(listo.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* Sin permiso de portapapeles el enlace sigue a la vista y seleccionable,
         así que no hace falta avisar de nada. */
    }
  };

  if (listo) {
    return (
      <div class="rounded-md border border-cielo-200 bg-cielo-50 p-4">
        <p class="text-sm font-bold text-cielo-900">
          Cobro abierto por {precio(listo.total)}
        </p>
        <p class="mt-1 text-xs text-cielo-800">
          {listo.correoEnviado
            ? 'Ya le salió el correo con el enlace de pago.'
            : 'El correo no salió. Mándale el enlace por WhatsApp.'}
        </p>

        <div class="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={listo.url}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            class="campo flex-1 font-nota text-[11px]"
            aria-label={`Enlace de pago del pedido ${folio}`}
          />
          <button type="button" onClick={copiar} class="btn-linea shrink-0 px-3 py-2 text-xs">
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        <p class="mt-3 font-nota text-[10px] uppercase tracking-[0.12em] text-cielo-700">
          Recarga la página para verlo como pendiente de pago
        </p>
      </div>
    );
  }

  return (
    <div class="rounded-md border border-oro-300 bg-oro-50 p-4">
      <p class="text-sm font-bold text-oro-900">
        {reenvio ? 'El enlace de pago caducó' : 'Falta el costo del envío'}
      </p>
      <p class="mt-1 text-xs leading-relaxed text-oro-800">
        {reenvio ? (
          <>
            El cliente no pagó en las 24 horas que vale el enlace de Stripe, así que el pedido
            volvió aquí en vez de cancelarse. Comprueba el importe y mándaselo otra vez: recibe un
            correo con un enlace nuevo.
          </>
        ) : (
          <>
            Lleva el paquete a la paquetería y escribe aquí lo que te cobraron
            {cpEntrega && <> por mandarlo al <strong>CP {cpEntrega}</strong></>}. El cliente recibe
            el total y el enlace para pagar.
          </>
        )}
      </p>

      <div class="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label class="campo-etiqueta" for={`envio-${pedidoId}`}>Envío (MXN)</label>
          <div class="flex items-center gap-1 rounded-md border border-tinta-300 bg-white px-3">
            <span class="font-nota text-sm text-tinta-400">$</span>
            <input
              id={`envio-${pedidoId}`}
              class="w-24 border-0 bg-transparent py-2 font-nota text-sm tabular-nums focus:outline-none"
              inputMode="decimal"
              placeholder="145"
              value={envio}
              onInput={(e) => setEnvio((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        <button type="button" onClick={cotizar} disabled={ocupado || !valido} class="btn-primario py-2.5">
          {ocupado
            ? 'Abriendo el cobro…'
            : reenvio ? 'Volver a mandar el cobro' : 'Cotizar y mandar el pago'}
        </button>
      </div>

      <p class="mt-2.5 text-xs text-oro-800">
        Mercancía {precio(subtotal)}
        {valido && <> + envío {precio(Math.round(pesos * 100))} = <strong>{precio(total)}</strong></>}
      </p>

      {error && (
        <p role="alert" class="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div class="mt-3 border-t border-oro-200 pt-3">
        {!confirmandoCancelar ? (
          <button
            type="button"
            onClick={() => setConfirmandoCancelar(true)}
            disabled={ocupado}
            class="text-xs font-bold text-red-700 underline hover:text-red-800"
          >
            Cancelar este pedido
          </button>
        ) : (
          <div>
            <p class="text-xs text-red-800">
              ¿Cancelar {folio}? Se cierra sin cobrar nada. Úsalo cuando el cliente no acepte el
              envío, o cuando ya no responda.
            </p>
            <div class="mt-2 flex gap-2">
              <button type="button" onClick={cancelar} disabled={ocupado}
                class="rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {ocupado ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
              <button type="button" onClick={() => setConfirmandoCancelar(false)} disabled={ocupado}
                class="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700">
                No
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
