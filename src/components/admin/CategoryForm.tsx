import { useState } from 'preact/hooks';
import type { Categoria } from '@/lib/types';

interface Props {
  categorias: Categoria[];
}

const ACENTOS = [
  { valor: 'cielo', nombre: 'Cielo', hex: '#00A3E0', uso: 'Novedades y catálogo general' },
  { valor: 'oro', nombre: 'Oro', hex: '#EAB308', uso: 'Temporada y ofertas' },
  { valor: 'mistico', nombre: 'Místico', hex: '#A855F7', uso: 'Colecciones especiales' },
  { valor: 'tinta', nombre: 'Tinta', hex: '#18181B', uso: 'Categorías permanentes' },
] as const;

const aSlug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function CategoryForm({ categorias }: Props) {
  const [lista, setLista] = useState(categorias);
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [padreId, setPadreId] = useState('');
  const [acento, setAcento] = useState<(typeof ACENTOS)[number]['valor']>('tinta');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const raices = lista.filter((c) => !c.padreId);
  const hijasDe = (id: string) => lista.filter((c) => c.padreId === id);

  const crear = async (e: Event) => {
    e.preventDefault();
    setError('');
    const s = slug || aSlug(nombre);
    if (nombre.trim().length < 2) return setError('Escribe el nombre de la categoría.');
    if (lista.some((c) => c.slug === s)) return setError(`Ya existe una categoría con la dirección "${s}".`);

    setGuardando(true);
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        slug: s,
        padreId: padreId || null,
        acento,
        orden: lista.length + 1,
        activa: true,
      }),
    });
    setGuardando(false);

    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: 'No se pudo crear la categoría.' }));
      return setError(msg);
    }
    const creada: Categoria = await res.json();
    setLista((l) => [...l, creada]);
    setNombre('');
    setSlug('');
  };

  const eliminar = async (c: Categoria) => {
    setError('');
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: 'No se pudo eliminar.' }));
      return setError(msg);
    }
    setLista((l) => l.filter((x) => x.id !== c.id));
  };

  return (
    <div class="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <form onSubmit={crear} class="nota-seccion h-fit">
        <h2 class="etiqueta text-tinta-400">Nueva categoría</h2>

        <div class="mt-4 space-y-4">
          <div>
            <label class="campo-etiqueta" for="cat-nombre">Nombre</label>
            <input
              id="cat-nombre" class="campo" value={nombre}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                setNombre(v);
                setSlug(aSlug(v));
              }}
              placeholder="Día de las madres"
            />
          </div>

          <div>
            <label class="campo-etiqueta" for="cat-slug">Dirección web</label>
            <div class="flex items-center gap-1 rounded-md border border-tinta-300 bg-white px-3">
              <span class="font-nota text-[11px] text-tinta-400">/tienda/</span>
              <input id="cat-slug" class="w-full border-0 bg-transparent py-2.5 font-nota text-sm focus:outline-none"
                value={slug} onInput={(e) => setSlug(aSlug((e.target as HTMLInputElement).value))} />
            </div>
          </div>

          <div>
            <label class="campo-etiqueta" for="cat-padre">Depende de</label>
            <select id="cat-padre" class="campo" value={padreId} onChange={(e) => setPadreId((e.target as HTMLSelectElement).value)}>
              <option value="">Nada — es una categoría principal</option>
              {raices.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>

          <fieldset>
            <legend class="campo-etiqueta">Acento</legend>
            <div class="grid grid-cols-2 gap-2">
              {ACENTOS.map((a) => (
                <label
                  key={a.valor}
                  class={`flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition ${acento === a.valor ? 'border-tinta-900 bg-tinta-50' : 'border-tinta-200 hover:border-tinta-400'}`}
                >
                  <input type="radio" name="acento" class="sr-only" checked={acento === a.valor}
                    onChange={() => setAcento(a.valor)} />
                  <span class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: a.hex }} aria-hidden="true" />
                  <span class="min-w-0">
                    <span class="block text-xs font-bold text-tinta-900">{a.nombre}</span>
                    <span class="block text-[11px] leading-tight text-tinta-500">{a.uso}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p role="alert" class="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

          <button type="submit" class="btn-primario w-full" disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear categoría'}
          </button>
        </div>
      </form>

      <div class="nota-seccion">
        <h2 class="etiqueta text-tinta-400">Árbol del catálogo</h2>
        <ul class="mt-4 divide-y divide-tinta-200">
          {raices.map((r) => (
            <li key={r.id} class="py-3">
              <div class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-2.5">
                  <span class="h-2.5 w-2.5 rounded-sm" style={{ background: ACENTOS.find((a) => a.valor === r.acento)?.hex }} aria-hidden="true" />
                  <span class="text-sm font-bold text-tinta-900">{r.nombre}</span>
                  <span class="font-nota text-[11px] text-tinta-400">/{r.slug}</span>
                </span>
                <button type="button" onClick={() => eliminar(r)} class="font-nota text-[11px] text-tinta-400 underline hover:text-red-600">
                  Eliminar
                </button>
              </div>
              {hijasDe(r.id).length > 0 && (
                <ul class="mt-2 space-y-1.5 border-l border-tinta-200 pl-4">
                  {hijasDe(r.id).map((h) => (
                    <li key={h.id} class="flex items-center justify-between gap-3">
                      <span class="text-sm text-tinta-600">
                        {h.nombre} <span class="font-nota text-[11px] text-tinta-400">/{h.slug}</span>
                      </span>
                      <button type="button" onClick={() => eliminar(h)} class="font-nota text-[11px] text-tinta-400 underline hover:text-red-600">
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
