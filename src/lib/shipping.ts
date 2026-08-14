import type { OpcionEnvio } from './types';

/*
 * Cotización nacional por código postal.
 *
 * Las zonas están definidas por prefijo de CP. Cuando contrates la paquetería
 * (Envia.com, Skydropx, Estafeta), sustituye `cotizar` por la llamada a su API y
 * conserva la firma: el checkout solo consume OpcionEnvio[].
 */

type Zona = 'local' | 'centro' | 'nacional' | 'extendida';

const PREFIJOS_LOCALES = ['36', '37']; // Guanajuato y alrededores
const PREFIJOS_CENTRO = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '50', '76'];

export function zonaDeCP(cp: string): Zona {
  const p = cp.slice(0, 2);
  if (PREFIJOS_LOCALES.includes(p)) return 'local';
  if (PREFIJOS_CENTRO.includes(p)) return 'centro';
  if (Number(p) >= 20 && Number(p) <= 79) return 'nacional';
  return 'extendida';
}

const TARIFAS: Record<Zona, OpcionEnvio[]> = {
  local: [
    { id: 'local-mismo-dia', nombre: 'Entrega local mismo día', descripcion: 'Pedidos antes de las 14:00', costo: 6900, diasHabiles: [0, 1] },
    { id: 'estandar', nombre: 'Estándar', descripcion: 'Paquetería nacional', costo: 9900, diasHabiles: [2, 3] },
  ],
  centro: [
    { id: 'estandar', nombre: 'Estándar', descripcion: 'Paquetería nacional', costo: 12900, diasHabiles: [3, 5] },
    { id: 'express', nombre: 'Express', descripcion: 'Prioritario con rastreo', costo: 19900, diasHabiles: [1, 2] },
  ],
  nacional: [
    { id: 'estandar', nombre: 'Estándar', descripcion: 'Paquetería nacional', costo: 15900, diasHabiles: [4, 7] },
    { id: 'express', nombre: 'Express', descripcion: 'Prioritario con rastreo', costo: 24900, diasHabiles: [2, 3] },
  ],
  extendida: [
    { id: 'estandar', nombre: 'Zona extendida', descripcion: 'Cobertura ampliada', costo: 21900, diasHabiles: [6, 10] },
  ],
};

/** Envío gratis a partir de este subtotal (centavos). */
export const UMBRAL_ENVIO_GRATIS = 99900;

export function cotizar(cp: string, subtotal: number): { zona: Zona; opciones: OpcionEnvio[] } {
  const zona = zonaDeCP(cp);
  const opciones = TARIFAS[zona].map((o) =>
    subtotal >= UMBRAL_ENVIO_GRATIS && o.id === 'estandar'
      ? { ...o, costo: 0, descripcion: 'Gratis por compra mayor a $999' }
      : o,
  );
  return { zona, opciones };
}

export function cpValido(cp: string): boolean {
  return /^\d{5}$/.test(cp);
}
