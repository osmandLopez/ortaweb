import { useStore } from '@nanostores/preact';
import { useEffect, useRef } from 'preact/hooks';
import {
  cajonAbierto,
  cambiarCantidad,
  carrito,
  cerrarCajon,
  hayApartado,
  quitar,
  saldoApartado,
  subtotalACobrar,
  totalItems,
  valorMercancia,
} from '@/stores/cart';
import { precio } from '@/lib/money';
import { UMBRAL_ENVIO_GRATIS } from '@/lib/shipping';
import { useHidratado } from '@/stores/hidratacion';

export default function CartDrawer() {
  const hidratado = useHidratado();
  const abierto = useStore(cajonAbierto);
  const guardados = useStore(carrito);
  const nGuardado = useStore(totalItems);
  const aCobrarGuardado = useStore(subtotalACobrar);
  const mercanciaGuardada = useStore(valorMercancia);
  const saldoGuardado = useStore(saldoApartado);
  const apartadoGuardado = useStore(hayApartado);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hasta que la isla monta se repite el render del servidor: carrito vacío.
  const items = hidratado ? guardados : [];
  const n = hidratado ? nGuardado : 0;
  const aCobrar = hidratado ? aCobrarGuardado : 0;
  const mercancia = hidratado ? mercanciaGuardada : 0;
  const saldo = hidratado ? saldoGuardado : 0;
  const conApartado = hidratado && apartadoGuardado;

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && cerrarCajon();
    document.addEventListener('keydown', alTeclear);
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = '';
    };
  }, [abierto]);

  const falta = Math.max(0, UMBRAL_ENVIO_GRATIS - mercancia);
  const avance = Math.min(100, (mercancia / UMBRAL_ENVIO_GRATIS) * 100);

  return (
    <div
      class={`fixed inset-0 z-50 ${abierto ? '' : 'pointer-events-none'}`}
      aria-hidden={!abierto}
    >
      <div
        class={`absolute inset-0 bg-tinta-900/40 transition-opacity duration-200 ${abierto ? 'opacity-100' : 'opacity-0'}`}
        onClick={cerrarCajon}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Tu carrito"
        class={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-alzada transition-transform duration-300 ease-out focus:outline-none ${abierto ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header class="flex items-center justify-between border-b border-tinta-200 px-5 py-4">
          <div>
            <h2 class="rotulo text-lg text-tinta-900">Tu carrito</h2>
            <p class="font-nota text-[11px] text-tinta-500">
              {n} {n === 1 ? 'artículo' : 'artículos'}
            </p>
          </div>
          <button type="button" onClick={cerrarCajon} class="p-2 text-tinta-500 hover:text-tinta-900" aria-label="Cerrar carrito">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" stroke-width="1.6" />
            </svg>
          </button>
        </header>

        {items.length > 0 && (
          <div class="border-b border-tinta-200 px-5 py-3">
            <p class="font-nota text-[11px] text-tinta-600">
              {falta > 0 ? <>Te faltan <strong class="text-tinta-900">{precio(falta)}</strong> para envío gratis</> : 'Envío estándar gratis aplicado'}
            </p>
            <div class="mt-2 h-1 w-full rounded-full bg-tinta-100">
              <div class="h-1 rounded-full bg-cielo-500 transition-[width] duration-500" style={{ width: `${avance}%` }} />
            </div>
          </div>
        )}

        <div class="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <div class="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
              <p class="rotulo text-xl text-tinta-900">Todavía no hay nada</p>
              <p class="max-w-[22ch] text-sm text-tinta-500">
                Empieza por lo que acaba de llegar al mostrador.
              </p>
              <a href="/tienda" class="btn-primario" onClick={cerrarCajon}>Ver el catálogo</a>
            </div>
          ) : (
            <ul class="divide-y divide-tinta-200">
              {items.map((item) => (
                <li key={`${item.productoId}:${item.modo}`} class="flex gap-4 py-4">
                  <div
                    class="h-20 w-16 shrink-0 rounded border border-tinta-200 bg-tinta-50"
                    style={item.imagen ? { backgroundImage: `url(${item.imagen})`, backgroundSize: 'cover' } : undefined}
                    aria-hidden="true"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                      <a href={`/producto/${item.slug}`} class="text-sm font-bold leading-snug text-tinta-900 hover:text-cielo-600">
                        {item.nombre}
                      </a>
                      <button
                        type="button"
                        onClick={() => quitar(item.productoId, item.modo)}
                        class="font-nota text-[11px] text-tinta-400 underline hover:text-tinta-900"
                      >
                        Quitar
                      </button>
                    </div>

                    {item.modo === 'apartado' && (
                      <p class="insignia-apartado mt-1.5">Apartado · anticipo {precio(item.anticipo)}</p>
                    )}

                    <div class="mt-3 flex items-center justify-between">
                      <div class="inline-flex items-center rounded border border-tinta-300">
                        <button
                          type="button"
                          class="px-2.5 py-1 text-tinta-600 hover:text-tinta-900"
                          onClick={() => cambiarCantidad(item.productoId, item.modo, item.cantidad - 1)}
                          aria-label={`Quitar una unidad de ${item.nombre}`}
                        >
                          −
                        </button>
                        <span class="min-w-8 text-center font-nota text-xs tabular-nums">{item.cantidad}</span>
                        <button
                          type="button"
                          class="px-2.5 py-1 text-tinta-600 hover:text-tinta-900"
                          onClick={() => cambiarCantidad(item.productoId, item.modo, item.cantidad + 1)}
                          aria-label={`Agregar una unidad de ${item.nombre}`}
                        >
                          +
                        </button>
                      </div>
                      <p class="font-nota text-sm tabular-nums text-tinta-900">
                        {precio((item.modo === 'apartado' ? item.anticipo : item.precio) * item.cantidad)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer class="border-t border-tinta-200 px-5 py-5">
            <dl class="space-y-2 text-sm">
              <div class="guia">
                <dt class="text-tinta-600">Mercancía</dt>
                <dd class="font-nota tabular-nums text-tinta-900">{precio(mercancia)}</dd>
              </div>
              {conApartado && (
                <div class="guia">
                  <dt class="text-mistico-700">Saldo por liquidar</dt>
                  <dd class="font-nota tabular-nums text-mistico-700">{precio(saldo)}</dd>
                </div>
              )}
              <div class="guia border-t border-dashed border-tinta-300 pt-2.5">
                <dt class="font-bold text-tinta-900">Pagas ahora</dt>
                <dd class="font-nota text-lg font-bold tabular-nums text-tinta-900">{precio(aCobrar)}</dd>
              </div>
            </dl>

            <p class="mt-2 font-nota text-[11px] text-tinta-500">
              El envío se calcula en el siguiente paso.
            </p>

            <a href="/checkout" class="btn-primario mt-4 w-full">Ir a pagar</a>
            <button type="button" onClick={cerrarCajon} class="mt-2 w-full py-2 text-sm text-tinta-500 underline hover:text-tinta-900">
              Seguir comprando
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
