/*
 * Diagnóstico de la base: dice a dónde apunta, si responde y si tiene el
 * esquema puesto.
 *
 *   npm run db:probar
 *
 * Existe porque el fallo típico al pasar a Turso es silencioso: las variables
 * están, el build sale bien, y el sitio publicado responde 500 en la primera
 * consulta porque a la base remota nunca se le aplicaron las migraciones. Aquí
 * eso se ve en dos segundos y con el comando exacto que falta.
 */
import './entorno-local';
import { sql } from 'drizzle-orm';
import { tokenBaseDeDatos, urlBaseDeDatos } from '../src/lib/entorno';
import { orm } from '../src/lib/sqlite';

/* Se leen por la misma vía que el sitio, alias de la integración de Vercel
   incluidos: si el diagnóstico mirara solo DATABASE_URL diría "archivo local"
   mientras el sitio habla con Turso. */
const url = urlBaseDeDatos;
const token = tokenBaseDeDatos();
const remota = !url.startsWith('file:');

/* Las tablas que el sitio necesita para no responder 500. Las de Better Auth
   incluidas: sin ellas el middleware revienta en cada petición, no solo al
   entrar a /cuenta. */
const ESPERADAS = [
  'categorias', 'productos', 'sucursales', 'pedidos', 'pedido_items',
  'lista_deseos', 'eventos_stripe', 'usuarios', 'sesiones', 'cuentas', 'verificaciones',
];

/** Un token es un JWT largo; en pantalla solo van las puntas. */
function recorta(valor: string): string {
  return valor.length <= 16 ? '****' : `${valor.slice(0, 6)}…${valor.slice(-4)}`;
}

async function main() {
  console.log(`Base:   ${url}`);
  console.log(`Tipo:   ${remota ? 'remota (Turso)' : 'archivo local'}`);
  console.log(`Token:  ${token ? recorta(token) : '(sin definir)'}`);

  if (remota && !token) {
    console.warn(
      '\n⚠  DATABASE_URL es remota pero falta DATABASE_AUTH_TOKEN. Turso va a\n' +
        '   rechazar la conexión. Genera uno con:  turso db tokens create <base>',
    );
  }
  if (!remota && process.env.VERCEL) {
    console.warn('\n⚠  En Vercel un DATABASE_URL de archivo activa el modo demo: nada se guarda.');
  }

  const inicio = Date.now();
  const tablas = await orm.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'table' order by name`,
  );
  const ms = Date.now() - inicio;
  console.log(`\nConexión correcta (${ms} ms).`);

  const nombres = new Set(tablas.map((t) => t.name));
  const faltan = ESPERADAS.filter((t) => !nombres.has(t));

  if (faltan.length === ESPERADAS.length) {
    console.error(
      '\n✗ La base está vacía: no hay ninguna tabla.\n' +
        '  Aplica el esquema:  npm run db:migrate\n' +
        '  Y luego el catálogo: npm run db:seed',
    );
    process.exit(1);
  }

  if (faltan.length) {
    console.error(
      `\n✗ Faltan tablas: ${faltan.join(', ')}\n` +
        '  La base quedó a medias. Aplica lo que falta:  npm run db:migrate',
    );
    process.exit(1);
  }

  console.log(`Esquema completo: ${ESPERADAS.length} tablas.`);

  /* El conteo distingue "migrada pero vacía" de "lista". Una base migrada sin
     sembrar sirve el sitio sin reventar, pero con la tienda en blanco. */
  const conteos: string[] = [];
  for (const tabla of ['categorias', 'productos', 'sucursales', 'pedidos', 'usuarios']) {
    const [fila] = await orm.all<{ n: number }>(sql`select count(*) as n from ${sql.identifier(tabla)}`);
    conteos.push(`${tabla}: ${fila?.n ?? 0}`);
  }
  console.log(`Filas — ${conteos.join(' · ')}`);

  const [cat] = await orm.all<{ n: number }>(sql`select count(*) as n from categorias`);
  if (!cat?.n) {
    console.warn('\n⚠  Sin catálogo. La tienda se vería vacía. Siémbrala:  npm run db:seed');
  } else {
    console.log('\n✓ Base lista.');
  }
}

main().catch((e: Error) => {
  console.error(`\n✗ No se pudo consultar la base: ${e.message}`);
  if (remota) {
    console.error(
      '  Revisa que DATABASE_URL sea la URL libsql:// exacta de tu base\n' +
        '  (turso db show <base> --url) y que el token no haya expirado.',
    );
  }
  process.exit(1);
});
