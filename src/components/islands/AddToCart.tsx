import { useState } from 'preact/hooks';
import { agregar } from '@/stores/cart';
import { precio } from '@/lib/money';

interface Props {
  productoId: string;
  slug: string;
  nombre: string;
  precioCentavos: number;
  imagen?: string;
  stock: number;
  /** compacto: una sola acción, para las tarjetas de la rejilla */
  compacto?: boolean;
}

export default function AddToCart({
  productoId,
  slug,
  nombre,
  precioCentavos,
  imagen = '',
  stock,
  compacto = false,
}: Props) {
  const [cantidad, setCantidad] = useState(1);
  const agotado = stock <= 0;

  const alAgregar = () => {
    agregar({ productoId, slug, nombre, precio: precioCentavos, imagen, cantidad });
  };

  if (agotado) {
    return (
      <button type="button" disabled class="btn-linea w-full">
        Agotado
      </button>
    );
  }

  if (compacto) {
    return (
      <button type="button" onClick={alAgregar} class="btn-primario w-full">
        Agregar
      </button>
    );
  }

  return (
    <div class="space-y-3">
      <div class="flex items-center gap-4">
        <label for={`cant-${productoId}`} class="campo-etiqueta mb-0">Cantidad</label>
        <div class="inline-flex items-center rounded border border-tinta-300">
          <button type="button" class="px-3 py-2 text-tinta-600 hover:text-tinta-900" onClick={() => setCantidad((c) => Math.max(1, c - 1))} aria-label="Menos uno">−</button>
          <input
            id={`cant-${productoId}`}
            class="w-10 border-0 bg-transparent text-center font-nota text-sm tabular-nums focus:outline-none"
            value={cantidad}
            inputMode="numeric"
            onInput={(e) => setCantidad(Math.min(stock, Math.max(1, Number((e.target as HTMLInputElement).value) || 1)))}
          />
          <button type="button" class="px-3 py-2 text-tinta-600 hover:text-tinta-900" onClick={() => setCantidad((c) => Math.min(stock, c + 1))} aria-label="Más uno">+</button>
        </div>
        <p class="font-nota text-[11px] text-tinta-500">{stock} en existencia</p>
      </div>

      <button type="button" onClick={alAgregar} class="btn-primario w-full">
        Agregar al carrito · {precio(precioCentavos * cantidad)}
      </button>
    </div>
  );
}
