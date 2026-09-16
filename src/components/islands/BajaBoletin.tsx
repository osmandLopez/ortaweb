import { useState } from 'preact/hooks';

/*
 * Botón de baja del boletín. La baja la hace el clic, no abrir el enlace: ver
 * src/pages/api/boletin/baja.ts.
 */
export default function BajaBoletin({ token }: { token: string }) {
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'fuera'>('listo');
  const [error, setError] = useState('');

  const darDeBaja = async () => {
    setError('');
    setEstado('enviando');
    const res = await fetch('/api/boletin/baja', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null);

    if (!res?.ok) {
      setEstado('listo');
      const cuerpo = await res?.json().catch(() => null);
      return setError(cuerpo?.error ?? 'No se pudo completar. Revisa tu conexión e intenta otra vez.');
    }
    setEstado('fuera');
  };

  if (estado === 'fuera') {
    return (
      <p role="status" class="rounded-md bg-cielo-50 px-3 py-2.5 text-sm text-cielo-800">
        Listo: ya no te mandaremos correos de novedades. Los de tus pedidos sí te siguen llegando.
      </p>
    );
  }

  return (
    <div class="space-y-3">
      {error && <p role="alert" class="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      <button type="button" class="btn-primario w-full" onClick={darDeBaja} disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Un momento…' : 'Darme de baja'}
      </button>
    </div>
  );
}
