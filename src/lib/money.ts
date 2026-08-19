const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

/** Centavos -> "$1,299.00" */
export function precio(centavos: number): string {
  return mxn.format(centavos / 100);
}

/** Centavos -> "1,299" (sin símbolo, para rótulos grandes) */
export function cifra(centavos: number): string {
  return new Intl.NumberFormat('es-MX').format(Math.round(centavos / 100));
}

export function descuento(precio: number, anterior: number | null): number | null {
  if (!anterior || anterior <= precio) return null;
  return Math.round(((anterior - precio) / anterior) * 100);
}

/** Folio de nota: ON-A4F2K9 */
export function generarFolio(prefijo = 'ON'): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `${prefijo}-${s}`;
}
