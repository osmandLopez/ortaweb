/*
 * Siembra el catálogo inicial. Es idempotente: si la tabla de categorías ya
 * tiene filas no hace nada, para que no se dupliquen al reejecutarlo.
 *
 *   npm run db:seed          siembra si está vacío
 *   npm run db:seed -- --force   borra y vuelve a sembrar
 */
import { orm } from '../src/lib/sqlite';
import * as t from '../src/lib/schema';
import { categorias, productos, sucursales } from '../src/data/seed';

const forzar = process.argv.includes('--force');

async function main() {
  const existentes = await orm.select({ id: t.categorias.id }).from(t.categorias);

  if (existentes.length > 0 && !forzar) {
    console.log(`La base ya tiene ${existentes.length} categorías. Usa --force para rehacerla.`);
    return;
  }

  if (forzar) {
    /* Se vacía el catálogo, no las cuentas: rehacer los productos de prueba no
       es motivo para echar a todo el mundo de su sesión. Orden inverso a las
       dependencias. */
    for (const tabla of [t.abonos, t.pedidoItems, t.pedidos, t.listaDeseos, t.productos, t.categorias, t.sucursales, t.eventosStripe]) {
      await orm.delete(tabla);
    }
    console.log('Catálogo vaciado. Las cuentas de usuario no se tocan.');
  }

  await orm.insert(t.categorias).values(categorias);
  await orm.insert(t.sucursales).values(sucursales);
  await orm.insert(t.productos).values(
    productos.map((p) => ({ ...p, imagenes: JSON.stringify(p.imagenes) })),
  );

  console.log(
    `Sembrado: ${categorias.length} categorías, ${productos.length} productos, ${sucursales.length} sucursales.`,
  );
}

main().catch((e) => {
  console.error('No se pudo sembrar:', e.message);
  process.exit(1);
});
