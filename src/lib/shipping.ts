/*
 * Lo que queda de la cotización automática.
 *
 * Aquí vivían una tabla de tarifas por zona y un umbral de envío gratis. Los dos
 * eran datos de relleno del andamiaje inicial —con códigos postales de
 * Guanajuato, para una tienda que está en Monterrey— y ninguno correspondía a lo
 * que la tienda cobra de verdad.
 *
 * El envío de Orta no se puede calcular: la paquetería lo cobra por peso y
 * dimensiones del paquete, y el precio se conoce al despacharlo. Por eso el
 * sitio ya no cotiza. Registra el pedido como `por_cotizar`, el dueño le pone el
 * importe desde el panel, y ahí se abre el cobro:
 *
 *   src/pages/api/admin/pedidos/[id]/cotizar.ts
 *
 * Si algún día se contrata un agregador (Envia.com, Skydropx) que cotice por API
 * con medidas y peso, este es el archivo donde va esa llamada, y el checkout
 * podría volver a cobrar de una sola vez.
 */

/** Cinco dígitos. Lo único que se valida del destino antes de guardar el pedido. */
export function cpValido(cp: string): boolean {
  return /^\d{5}$/.test(cp);
}
