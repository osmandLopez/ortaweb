import { useState } from 'preact/hooks';
import type { Suscriptor } from '@/lib/types';

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

/*
 * La lista del boletín en el panel, con la baja manual para quien la pide por
 * WhatsApp o por correo en vez de usar el enlace.
 */
export default function ListaBoletin({ suscriptores }: { suscriptores: Suscriptor[] }) {
  const [lista, setLista] = useState(suscriptores);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState('');

  const darDeBaja = async (s: Suscriptor) => {
    setOcupado(s.id);
    setError('');

    /* El content-type va aunque no haya cuerpo: sin él, la protección anti-CSRF
       de Astro le da 403 al DELETE en Vercel. Ver ProductForm.tsx. */
    const res = await fetch(`/api/admin/boletin/${s.id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).catch(() => null);

    setOcupado(null);
    setConfirmando(null);

    if (res?.status === 204 || res?.status === 404) {
      setLista((l) => l.filter((x) => x.id !== s.id));
      return;
    }
    setError(`No se pudo dar de baja a ${s.email}. Revisa tu conexión.`);
  };

  if (lista.length === 0) {
    return (
      <p class="nota-seccion text-sm text-tinta-500">
        Todavía no se ha suscrito nadie. Los correos que dejen en el pie de la tienda aparecerán aquí.
      </p>
    );
  }

  return (
    <div class="nota-seccion">
      {error && <p role="alert" class="mb-4 rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      <ul class="divide-y divide-tinta-200">
        {lista.map((s) => (
          <li key={s.id} class="flex flex-wrap items-center justify-between gap-3 py-3">
            <span class="min-w-0">
              <span class="block break-all text-sm text-tinta-900">{s.email}</span>
              <span class="block font-nota text-[11px] text-tinta-400">desde el {fecha(s.creadoEn)}</span>
            </span>
            {confirmando === s.id ? (
              <span class="flex items-center gap-2">
                <span class="text-xs text-tinta-600">¿Seguro?</span>
                <button type="button" class="btn-tinta px-3 py-1.5 text-xs" disabled={ocupado === s.id}
                  onClick={() => darDeBaja(s)}>
                  {ocupado === s.id ? 'Un momento…' : 'Sí, dar de baja'}
                </button>
                <button type="button" class="btn-linea px-3 py-1.5 text-xs" onClick={() => setConfirmando(null)}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" class="font-nota text-[11px] text-red-700 underline"
                onClick={() => setConfirmando(s.id)}>
                Dar de baja
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
