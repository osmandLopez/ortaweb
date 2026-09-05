import { useState } from 'preact/hooks';
import type { Categoria, Producto } from '@/lib/types';

interface Props {
  categorias: Categoria[];
  /** presente al editar; ausente al crear */
  producto?: Producto;
}

type Estado = { tipo: 'inactivo' } | { tipo: 'guardando' } | { tipo: 'ok'; mensaje: string } | { tipo: 'error'; mensaje: string };

const vacio = {
  nombre: '', slug: '', descripcion: '', sku: '',
  precio: '', precioAnterior: '', stock: '0', categoriaId: '',
  temporada: false, destacado: false, activo: true,
};

const aSlug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const aCentavos = (pesos: string) => Math.round(Number(pesos || 0) * 100);

/*
 * Lado máximo de la foto que se sube, en píxeles.
 *
 * Las fotos de celular vienen de 4000 px y 5 MB. Subirlas tal cual llena el
 * almacén y, peor, deja al cliente cargando megas para ver una tarjeta de 400
 * px. Se reducen aquí, en el navegador, antes de que salgan: así la subida
 * también es más rápida con datos móviles.
 */
const LADO_MAXIMO = 1600;

async function reducir(archivo: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));

    // Ya es chica y ligera: se sube tal cual y se conserva su formato original.
    if (escala === 1 && archivo.size <= 1_000_000) {
      bitmap.close();
      return archivo;
    }

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);

    const ctx = lienzo.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return archivo;
    }

    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, 'image/jpeg', 0.82));
    if (!blob) return archivo;

    return new File([blob], `${archivo.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    /* Formatos que el navegador no sabe decodificar (HEIC de iPhone en
       escritorio, sobre todo). Se manda el original y que el servidor decida. */
    return archivo;
  }
}

export default function ProductForm({ categorias, producto }: Props) {
  const [f, setF] = useState(
    producto
      ? {
          nombre: producto.nombre, slug: producto.slug, descripcion: producto.descripcion,
          sku: producto.sku, precio: String(producto.precio / 100),
          precioAnterior: producto.precioAnterior ? String(producto.precioAnterior / 100) : '',
          stock: String(producto.stock), categoriaId: producto.categoriaId,
          temporada: producto.temporada,
          destacado: producto.destacado, activo: producto.activo,
        }
      : vacio,
  );
  const [imagenes, setImagenes] = useState<string[]>(producto?.imagenes ?? []);
  const [subiendo, setSubiendo] = useState(0);
  const [errorFoto, setErrorFoto] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' });
  const [errores, setErrores] = useState<Record<string, string>>({});

  const set = (k: keyof typeof vacio) => (e: Event) => {
    const el = e.target as HTMLInputElement;
    const valor = el.type === 'checkbox' ? el.checked : el.value;
    setF((prev) => ({
      ...prev,
      [k]: valor,
      // El slug se autogenera hasta que el admin lo edita a mano.
      ...(k === 'nombre' && !producto ? { slug: aSlug(String(valor)) } : {}),
    }));
  };

  const elegirFotos = async (ev: Event) => {
    const input = ev.target as HTMLInputElement;
    const elegidas = [...(input.files ?? [])];
    input.value = ''; // permite volver a elegir la misma foto tras un error
    if (elegidas.length === 0) return;

    setErrorFoto('');
    setSubiendo(elegidas.length);

    for (const original of elegidas) {
      if (/heic|heif/i.test(original.type) || /\.hei[cf]$/i.test(original.name)) {
        setErrorFoto(`«${original.name}» es una foto de iPhone (HEIC). Guárdala como JPG y vuelve a intentarlo.`);
        setSubiendo((n) => n - 1);
        continue;
      }

      const cuerpo = new FormData();
      cuerpo.append('archivo', await reducir(original));

      const res = await fetch('/api/admin/imagenes', { method: 'POST', body: cuerpo }).catch(() => null);

      if (!res?.ok) {
        const { error } = (await res?.json().catch(() => null)) ?? {};
        setErrorFoto(error ?? 'No se pudo subir la foto. Revisa tu conexión.');
      } else {
        const { url } = await res.json();
        setImagenes((prev) => [...prev, url]);
      }

      setSubiendo((n) => n - 1);
    }
  };

  const quitarFoto = (i: number) => setImagenes((prev) => prev.filter((_, j) => j !== i));

  const hacerPortada = (i: number) =>
    setImagenes((prev) => [prev[i], ...prev.filter((_, j) => j !== i)]);

  const validar = () => {
    const e: Record<string, string> = {};
    if (f.nombre.trim().length < 3) e.nombre = 'Escribe el nombre como aparece en la etiqueta.';
    if (!f.slug) e.slug = 'La dirección web no puede quedar vacía.';
    if (!f.sku.trim()) e.sku = 'El SKU identifica la pieza en inventario.';
    if (aCentavos(f.precio) <= 0) e.precio = 'El precio debe ser mayor a cero.';
    if (f.precioAnterior && aCentavos(f.precioAnterior) <= aCentavos(f.precio)) {
      e.precioAnterior = 'El precio anterior debe ser mayor al precio actual.';
    }
    if (!f.categoriaId) e.categoriaId = 'Elige dónde va a aparecer.';
    if (Number(f.stock) < 0) e.stock = 'El stock no puede ser negativo.';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async (ev: Event) => {
    ev.preventDefault();
    if (!validar()) return;
    setEstado({ tipo: 'guardando' });

    const cuerpo = {
      nombre: f.nombre.trim(),
      slug: f.slug,
      descripcion: f.descripcion.trim(),
      sku: f.sku.trim().toUpperCase(),
      precio: aCentavos(f.precio),
      precioAnterior: f.precioAnterior ? aCentavos(f.precioAnterior) : null,
      stock: Number(f.stock),
      categoriaId: f.categoriaId,
      imagenes,
      temporada: f.temporada,
      destacado: f.destacado,
      activo: f.activo,
    };

    const res = await fetch(producto ? `/api/admin/products/${producto.id}` : '/api/admin/products', {
      method: producto ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'No se pudo guardar el producto.' }));
      setEstado({ tipo: 'error', mensaje: error });
      return;
    }

    setEstado({ tipo: 'ok', mensaje: producto ? 'Producto actualizado.' : `${cuerpo.nombre} ya está en el catálogo.` });
    if (!producto) {
      setF(vacio);
      setImagenes([]);
    }
  };

  const raices = categorias.filter((c) => !c.padreId);

  return (
    <form onSubmit={enviar} noValidate class="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div class="space-y-6">
        <fieldset class="nota-seccion">
          <legend class="etiqueta text-tinta-400">Identidad</legend>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="campo-etiqueta" for="nombre">Nombre del producto</label>
              <input id="nombre" class="campo" value={f.nombre} onInput={set('nombre')}
                placeholder="Juego de vajilla Flor de Talavera"
                aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'err-nombre' : undefined} />
              {errores.nombre && <p id="err-nombre" class="mt-1.5 text-xs text-red-600">{errores.nombre}</p>}
            </div>

            <div>
              <label class="campo-etiqueta" for="slug">Dirección web</label>
              <div class="flex items-center gap-1 rounded-md border border-tinta-300 bg-white px-3">
                <span class="font-nota text-[11px] text-tinta-400">/producto/</span>
                <input id="slug" class="w-full border-0 bg-transparent py-2.5 font-nota text-sm focus:outline-none"
                  value={f.slug} onInput={set('slug')} />
              </div>
              {errores.slug && <p class="mt-1.5 text-xs text-red-600">{errores.slug}</p>}
            </div>

            <div>
              <label class="campo-etiqueta" for="sku">SKU</label>
              <input id="sku" class="campo font-nota uppercase" value={f.sku} onInput={set('sku')} placeholder="ORT-VAJ-16" />
              {errores.sku && <p class="mt-1.5 text-xs text-red-600">{errores.sku}</p>}
            </div>

            <div class="sm:col-span-2">
              <label class="campo-etiqueta" for="descripcion">Descripción</label>
              <textarea id="descripcion" rows={3} class="campo resize-y" value={f.descripcion} onInput={set('descripcion')}
                placeholder="Materiales, medidas y cuidados. Lo que preguntarían en el mostrador." />
            </div>
          </div>
        </fieldset>

        {/* Fotos. Se suben en cuanto se eligen, no al guardar: así se ve de
            inmediato si una salió mal y se puede cambiar sin perder el resto
            del formulario. */}
        <fieldset class="nota-seccion">
          <legend class="etiqueta text-tinta-400">Fotos</legend>

          <div class="mt-4">
            <label
              class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-tinta-300 px-4 py-8 text-center transition hover:border-cielo-500 hover:bg-cielo-50"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round" stroke-linejoin="round" class="text-tinta-400" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span class="text-sm font-bold text-tinta-900">Agregar fotos</span>
              <span class="text-xs text-tinta-500">
                JPG, PNG o WebP. Puedes elegir varias a la vez.
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple
                class="sr-only" onChange={elegirFotos} />
            </label>

            {subiendo > 0 && (
              <p role="status" class="mt-3 text-sm text-tinta-600">
                Subiendo {subiendo} {subiendo === 1 ? 'foto' : 'fotos'}…
              </p>
            )}
            {errorFoto && (
              <p role="alert" class="mt-3 rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorFoto}</p>
            )}

            {imagenes.length > 0 && (
              <>
                <ul class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {imagenes.map((url, i) => (
                    <li key={url} class="group relative overflow-hidden rounded-md border border-tinta-200 bg-white">
                      <img src={url} alt="" class="aspect-square w-full object-cover" loading="lazy" />

                      {i === 0 && (
                        <span class="absolute left-1.5 top-1.5 rounded bg-tinta-900 px-1.5 py-0.5 font-nota text-[9px] uppercase tracking-wider text-white">
                          Portada
                        </span>
                      )}

                      <div class="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-white/95 p-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                        {i > 0 ? (
                          <button type="button" onClick={() => hacerPortada(i)}
                            class="rounded px-1.5 py-1 text-[10px] font-bold text-cielo-600 hover:bg-cielo-50">
                            Portada
                          </button>
                        ) : <span />}
                        <button type="button" onClick={() => quitarFoto(i)}
                          class="rounded px-1.5 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50">
                          Quitar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p class="mt-2 text-xs text-tinta-500">
                  La marcada como portada es la que se ve en el catálogo.
                </p>
              </>
            )}
          </div>
        </fieldset>

        <fieldset class="nota-seccion">
          <legend class="etiqueta text-tinta-400">Precio e inventario</legend>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label class="campo-etiqueta" for="precio">Precio (MXN)</label>
              <input id="precio" class="campo font-nota tabular-nums" inputMode="decimal" value={f.precio} onInput={set('precio')} placeholder="2899.00" />
              {errores.precio && <p class="mt-1.5 text-xs text-red-600">{errores.precio}</p>}
            </div>
            <div>
              <label class="campo-etiqueta" for="precioAnterior">Precio anterior</label>
              <input id="precioAnterior" class="campo font-nota tabular-nums" inputMode="decimal" value={f.precioAnterior} onInput={set('precioAnterior')} placeholder="Opcional" />
              {errores.precioAnterior && <p class="mt-1.5 text-xs text-red-600">{errores.precioAnterior}</p>}
            </div>
            <div>
              <label class="campo-etiqueta" for="stock">Existencias</label>
              <input id="stock" class="campo font-nota tabular-nums" inputMode="numeric" value={f.stock} onInput={set('stock')} />
              {errores.stock && <p class="mt-1.5 text-xs text-red-600">{errores.stock}</p>}
            </div>
            <div class="sm:col-span-3">
              <label class="campo-etiqueta" for="categoriaId">Categoría</label>
              <select id="categoriaId" class="campo" value={f.categoriaId} onChange={set('categoriaId')}>
                <option value="">Elige una categoría</option>
                {raices.map((r) => (
                  <optgroup key={r.id} label={r.nombre}>
                    <option value={r.id}>{r.nombre} (general)</option>
                    {categorias.filter((c) => c.padreId === r.id).map((h) => (
                      <option key={h.id} value={h.id}>{h.nombre}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errores.categoriaId && <p class="mt-1.5 text-xs text-red-600">{errores.categoriaId}</p>}
            </div>
          </div>
        </fieldset>

      </div>

      <aside class="space-y-6">
        <fieldset class="nota-seccion">
          <legend class="etiqueta text-tinta-400">Dónde aparece</legend>
          <div class="mt-4 space-y-3">
            {([
              ['temporada', 'Ventas de temporada', 'Se muestra con badge dorado en la portada.'],
              ['destacado', 'Destacado en portada', 'Entra a la rejilla principal de inicio.'],
              ['activo', 'Visible en la tienda', 'Desactívalo para ocultarlo sin borrarlo.'],
            ] as const).map(([k, titulo, ayuda]) => (
              <label key={k} class="flex items-start gap-3">
                <input type="checkbox" checked={f[k] as boolean} onChange={set(k)}
                  class="mt-0.5 h-4 w-4 rounded border-tinta-300 text-cielo-500 focus:ring-cielo-500" />
                <span>
                  <span class="block text-sm font-bold text-tinta-900">{titulo}</span>
                  <span class="block text-xs text-tinta-500">{ayuda}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div class="sticky top-40 space-y-3">
          <button type="submit" class="btn-primario w-full" disabled={estado.tipo === 'guardando' || subiendo > 0}>
            {estado.tipo === 'guardando' ? 'Guardando…' : producto ? 'Guardar cambios' : 'Publicar producto'}
          </button>
          <a href="/admin/productos" class="btn-linea w-full">Cancelar</a>

          {estado.tipo === 'ok' && (
            <p role="status" class="rounded-md bg-cielo-50 px-3 py-2.5 text-sm text-cielo-800">{estado.mensaje}</p>
          )}
          {estado.tipo === 'error' && (
            <p role="alert" class="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{estado.mensaje}</p>
          )}
        </div>
      </aside>
    </form>
  );
}
