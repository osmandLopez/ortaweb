import { useStore } from '@nanostores/preact';
import { abrirCajon, totalItems } from '@/stores/cart';
import { useHidratado } from '@/stores/hidratacion';

/** Isla mínima: solo el contador necesita reaccionar. */
export default function CartButton() {
  const hidratado = useHidratado();
  const guardados = useStore(totalItems);
  const n = hidratado ? guardados : 0;

  return (
    <button
      type="button"
      onClick={abrirCajon}
      class="relative flex items-center gap-2 rounded-md bg-tinta-900 px-3.5 py-2.5 text-white transition hover:bg-tinta-800"
      aria-label={n === 0 ? 'Carrito vacío' : `Carrito, ${n} ${n === 1 ? 'artículo' : 'artículos'}`}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M2 3h2.2l1.9 8.6h7.6L16 5.6H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="7" cy="15" r="1.3" fill="currentColor" />
        <circle cx="13" cy="15" r="1.3" fill="currentColor" />
      </svg>
      <span class="font-nota text-xs tabular-nums">{n}</span>
      {n > 0 && (
        <span class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-cielo-500 ring-2 ring-white" aria-hidden="true" />
      )}
    </button>
  );
}
