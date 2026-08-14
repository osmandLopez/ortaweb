import { useState } from 'preact/hooks';
import type { Categoria, Producto } from '@/lib/types';
import { calcularAnticipo, precio } from '@/lib/money';

interface Props {
  categorias: Categoria[];
  /** presente al editar; ausente al crear */
  producto?: Producto;
}

type Estado = { tipo: 'inactivo' } | { tipo: 'guardando' } | { tipo: 'ok'; mensaje: string } | { tipo: 'error'; mensaje: string };

const vacio = {
  nombre: '', slug: '', descripcion: '', sku: '',
  precio: '', precioAnterior: '', stock: '0', categoriaId: '',
  apartable: false, anticipoMinimo: '30', plazoSemanas: '8',
  temporada: false, destacado: false, activo: true,
  imagenes: '',
};

const aSlug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const aCentavos = (pesos: string) => Math.round(Number(pesos || 0) * 100);

export default function ProductForm({ categorias, producto }: Props) {
  const [f, setF] = useState(
    producto
      ? {
          nombre: producto.nombre, slug: producto.slug, descripcion: producto.descripcion,
          sku: producto.sku, precio: String(producto.precio / 100),
          precioAnterior: producto.precioAnterior ? String(producto.precioAnterior / 100) : '',
          stock: String(producto.stock), categoriaId: producto.categoriaId,
          apartable: producto.apartable, anticipoMinimo: String(producto.anticipoMinimo),
          plazoSemanas: String(producto.plazoSemanas), temporada: producto.temporada,
          destacado: producto.destacado, activo: producto.activo,
          imagenes: producto.imagenes.join('\n'),
        }
      : vacio,
  );
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
    if (f.apartable && (Number(f.anticipoMinimo) < 10 || Number(f.anticipoMinimo) > 100)) {
      e.anticipoMinimo = 'El anticipo va de 10% a 100%.';
    }
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
      imagenes: f.imagenes.split('\n').map((s) => s.trim()).filter(Boolean),
      apartable: f.apartable,
      anticipoMinimo: f.apartable ? Number(f.anticipoMinimo) : 0,
      plazoSemanas: f.apartable ? Number(f.plazoSemanas) : 0,
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
    if (!producto) setF(vacio);
  };

  const anticipoCalc = calcularAnticipo(aCentavos(f.precio), Number(f.anticipoMinimo || 0));
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

            <div class="sm:col-span-2">
              <label class="campo-etiqueta" for="imagenes">Imágenes · una URL por línea</label>
              <textarea id="imagenes" rows={3} class="campo resize-y font-nota text-xs" value={f.imagenes} onInput={set('imagenes')}
                placeholder="/img/vajilla-1.jpg" />
              <p class="mt-1.5 text-xs text-tinta-500">La primera es la que se ve en el catálogo.</p>
            </div>
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

        <fieldset class="nota-seccion" style={{ borderColor: f.apartable ? '#A855F7' : undefined }}>
          <legend class="etiqueta text-mistico-600">Apartado</legend>

          <label class="mt-4 flex items-start gap-3">
            <input type="checkbox" checked={f.apartable} onChange={set('apartable')}
              class="mt-0.5 h-4 w-4 rounded border-tinta-300 text-mistico-500 focus:ring-mistico-500" />
            <span>
              <span class="block text-sm font-bold text-tinta-900">Se puede apartar con anticipo</span>
              <span class="block text-xs text-tinta-500">El cliente paga una parte hoy y liquida en abonos.</span>
            </span>
          </label>

          {f.apartable && (
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label class="campo-etiqueta" for="anticipoMinimo">Anticipo mínimo (%)</label>
                <input id="anticipoMinimo" class="campo font-nota tabular-nums" inputMode="numeric" value={f.anticipoMinimo} onInput={set('anticipoMinimo')} />
                {errores.anticipoMinimo && <p class="mt-1.5 text-xs text-red-600">{errores.anticipoMinimo}</p>}
              </div>
              <div>
                <label class="campo-etiqueta" for="plazoSemanas">Plazo para liquidar (semanas)</label>
                <input id="plazoSemanas" class="campo font-nota tabular-nums" inputMode="numeric" value={f.plazoSemanas} onInput={set('plazoSemanas')} />
              </div>
              {aCentavos(f.precio) > 0 && (
                <p class="sm:col-span-2 rounded-md bg-mistico-50 px-3 py-2.5 font-nota text-xs text-mistico-800">
                  El cliente pagará {precio(anticipoCalc)} hoy y {precio(aCentavos(f.precio) - anticipoCalc)} en abonos.
                </p>
              )}
            </div>
          )}
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
          <button type="submit" class="btn-primario w-full" disabled={estado.tipo === 'guardando'}>
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
