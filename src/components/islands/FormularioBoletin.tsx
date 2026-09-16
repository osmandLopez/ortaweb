import { useState } from 'preact/hooks';
import { correoValido } from '@/lib/correo-valido';

/*
 * El «Avísame de lo que llega» del pie. Manda JSON con fetch en vez de un
 * <form method="post"> normal, que en Vercel se lleva un 403: ver
 * src/pages/api/boletin/index.ts.
 */
export default function FormularioBoletin() {
  const [email, setEmail] = useState('');
  const [sitio, setSitio] = useState('');
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'dentro'>('listo');
  const [error, setError] = useState('');

  const enviar = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (!correoValido(email)) return setError('Revisa el correo: parece que le falta algo.');

    setEstado('enviando');
    const res = await fetch('/api/boletin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, sitio }),
    }).catch(() => null);

    if (!res?.ok) {
      setEstado('listo');
      const cuerpo = await res?.json().catch(() => null);
      return setError(cuerpo?.error ?? 'No se pudo apuntar tu correo. Revisa tu conexión.');
    }
    setEstado('dentro');
  };

  if (estado === 'dentro') {
    return (
      <p role="status" class="mt-7 max-w-sm rounded-md bg-tinta-800 px-3 py-2.5 text-sm text-white">
        Listo, ya estás en la lista. Te escribimos cuando llegue algo bueno.
      </p>
    );
  }

  return (
    <form class="mt-7 max-w-sm" onSubmit={enviar} noValidate>
      <label for="boletin" class="etiqueta text-tinta-500">Avísame de lo que llega</label>
      <div class="mt-2 flex gap-2">
        <input
          id="boletin" name="email" type="email" autocomplete="email" required placeholder="tu@correo.mx"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          class="w-full rounded-md border border-tinta-700 bg-tinta-800 px-3 py-2.5 text-sm text-white placeholder:text-tinta-500 focus:border-cielo-500 focus:outline-none"
        />
        <button type="submit" class="btn-primario px-4 py-2.5" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Un momento…' : 'Suscribirme'}
        </button>
      </div>

      {/* Campo trampa para bots: fuera de la vista y del tabulador. */}
      <input
        type="text" name="sitio" tabIndex={-1} autocomplete="off" aria-hidden="true"
        class="absolute -left-[9999px] h-px w-px opacity-0"
        value={sitio}
        onInput={(e) => setSitio((e.target as HTMLInputElement).value)}
      />

      {error && <p role="alert" class="mt-2 text-sm text-red-400">{error}</p>}

      <p class="mt-2 text-xs text-tinta-500">
        Te das de baja cuando quieras.{' '}
        <a href="/privacidad#promociones" class="underline hover:text-tinta-300">Aviso de privacidad</a>
      </p>
    </form>
  );
}
