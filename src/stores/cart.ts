import { persistentAtom } from '@nanostores/persistent';
import { atom, computed } from 'nanostores';
import type { ItemCarrito } from '@/lib/types';

/**
 * Carrito global. Vive en localStorage para sobrevivir recargas y navegación
 * entre páginas de Astro (cada página es un documento nuevo).
 */
export const carrito = persistentAtom<ItemCarrito[]>('orta:carrito', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

/** Estado del cajón lateral. */
export const cajonAbierto = atom(false);

export const totalItems = computed(carrito, (items) =>
  items.reduce((n, i) => n + i.cantidad, 0),
);

/** Lo que se cobra ahora: precio completo en compra, anticipo en apartado. */
export const subtotalACobrar = computed(carrito, (items) =>
  items.reduce((n, i) => n + (i.modo === 'apartado' ? i.anticipo : i.precio) * i.cantidad, 0),
);

/** Valor total de la mercancía, incluyendo el saldo de los apartados. */
export const valorMercancia = computed(carrito, (items) =>
  items.reduce((n, i) => n + i.precio * i.cantidad, 0),
);

export const saldoApartado = computed([valorMercancia, subtotalACobrar], (v, s) => v - s);

export const hayApartado = computed(carrito, (items) =>
  items.some((i) => i.modo === 'apartado'),
);

const clave = (i: Pick<ItemCarrito, 'productoId' | 'modo'>) => `${i.productoId}:${i.modo}`;

export function agregar(item: ItemCarrito) {
  const items = [...carrito.get()];
  const i = items.findIndex((x) => clave(x) === clave(item));
  if (i >= 0) items[i] = { ...items[i], cantidad: items[i].cantidad + item.cantidad };
  else items.push(item);
  carrito.set(items);
  cajonAbierto.set(true);
}

export function cambiarCantidad(productoId: string, modo: ItemCarrito['modo'], cantidad: number) {
  if (cantidad <= 0) return quitar(productoId, modo);
  carrito.set(
    carrito.get().map((i) =>
      clave(i) === `${productoId}:${modo}` ? { ...i, cantidad } : i,
    ),
  );
}

export function quitar(productoId: string, modo: ItemCarrito['modo']) {
  carrito.set(carrito.get().filter((i) => clave(i) !== `${productoId}:${modo}`));
}

export function vaciar() {
  carrito.set([]);
}

export function abrirCajon() {
  cajonAbierto.set(true);
}
export function cerrarCajon() {
  cajonAbierto.set(false);
}
