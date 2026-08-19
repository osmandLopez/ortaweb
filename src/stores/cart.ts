import { persistentAtom } from '@nanostores/persistent';
import { atom, computed } from 'nanostores';
import type { ItemCarrito } from '@/lib/types';

/**
 * Carrito global. Vive en localStorage para sobrevivir recargas y navegación
 * entre páginas de Astro (cada página es un documento nuevo).
 *
 * Lo que se guarda aquí es solo qué y cuánto: el precio con el que se cobra
 * siempre se relee de la base en /api/checkout.
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

/** Valor de la mercancía. El envío se suma después, ya cotizado. */
export const subtotal = computed(carrito, (items) =>
  items.reduce((n, i) => n + i.precio * i.cantidad, 0),
);

export function agregar(item: ItemCarrito) {
  const items = [...carrito.get()];
  const i = items.findIndex((x) => x.productoId === item.productoId);
  if (i >= 0) items[i] = { ...items[i], cantidad: items[i].cantidad + item.cantidad };
  else items.push(item);
  carrito.set(items);
  cajonAbierto.set(true);
}

export function cambiarCantidad(productoId: string, cantidad: number) {
  if (cantidad <= 0) return quitar(productoId);
  carrito.set(carrito.get().map((i) => (i.productoId === productoId ? { ...i, cantidad } : i)));
}

export function quitar(productoId: string) {
  carrito.set(carrito.get().filter((i) => i.productoId !== productoId));
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
