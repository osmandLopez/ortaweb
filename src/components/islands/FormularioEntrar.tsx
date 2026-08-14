import { useState } from 'preact/hooks';
import { authCliente, mensajeDeError } from '@/lib/auth-cliente';

interface Props {
  destino: string;
}

type Modo = 'entrar' | 'crear' | 'recuperar';

const TEXTOS: Record<Modo, { titulo: string; accion: string; cargando: string }> = {
  entrar: { titulo: 'Entrar', accion: 'Entrar', cargando: 'Entrando…' },
  crear: { titulo: 'Crear cuenta', accion: 'Crear mi cuenta', cargando: 'Creando…' },
  recuperar: { titulo: 'Recuperar acceso', accion: 'Enviarme el enlace', cargando: 'Enviando…' },
};

export default function FormularioEntrar({ destino }: Props) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError('');
    setAviso('');
  };

  const enviar = async (e: Event) => {
    e.preventDefault();
    setError('');
    setAviso('');

    if (modo === 'crear' && nombre.trim().length < 2) {
      return setError('Escribe tu nombre para que sepamos cómo llamarte.');
    }
    if (!email.includes('@')) return setError('Revisa el correo: parece que le falta algo.');
    if (modo !== 'recuperar' && clave.length < 8) {
      return setError('La contraseña necesita al menos 8 caracteres.');
    }

    setOcupado(true);

    if (modo === 'recuperar') {
      const { error: err } = await authCliente.forgetPassword({
        email,
        redirectTo: '/restablecer',
      });
      setOcupado(false);
      if (err) return setError(mensajeDeError(err.code, err.message));
      // No revelamos si el correo existe: mismo mensaje en ambos casos.
      return setAviso('Si hay una cuenta con ese correo, ya salió el enlace para restablecerla.');
    }

    const { error: err } =
      modo === 'crear'
        ? await authCliente.signUp.email({ name: nombre.trim(), email, password: clave })
        : await authCliente.signIn.email({ email, password: clave });

    if (err) {
      setOcupado(false);
      return setError(mensajeDeError(err.code, err.message));
    }

    // Recarga completa a propósito: el servidor tiene que volver a renderizar
    // el header y las rutas protegidas con la sesión ya puesta.
    window.location.href = destino;
  };

  const t = TEXTOS[modo];

  return (
    <div>
      <div class="flex gap-1 border-b border-tinta-200" role="tablist">
        {(['entrar', 'crear'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => cambiarModo(m)}
            class={`etiqueta relative px-4 py-3 transition ${
              modo === m ? 'text-tinta-900' : 'text-tinta-500 hover:text-tinta-900'
            }`}
          >
            {m === 'entrar' ? 'Ya tengo cuenta' : 'Soy nuevo'}
            {modo === m && (
              <span class="absolute inset-x-3 -bottom-px h-0.5 bg-cielo-500" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} noValidate class="nota-seccion mt-6 space-y-4">
        <h2 class="rotulo text-lg text-tinta-900">{t.titulo}</h2>

        {modo === 'crear' && (
          <div>
            <label class="campo-etiqueta" for="nombre">Nombre</label>
            <input
              id="nombre" class="campo" autocomplete="name" value={nombre}
              placeholder="Como quieres que te llamemos"
              onInput={(e) => setNombre((e.target as HTMLInputElement).value)}
            />
          </div>
        )}

        <div>
          <label class="campo-etiqueta" for="email">Correo</label>
          <input
            id="email" type="email" class="campo" autocomplete="email" value={email}
            placeholder="tu@correo.mx"
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          />
        </div>

        {modo !== 'recuperar' && (
          <div>
            <label class="campo-etiqueta" for="clave">Contraseña</label>
            <input
              id="clave" type="password" class="campo" value={clave}
              autocomplete={modo === 'crear' ? 'new-password' : 'current-password'}
              onInput={(e) => setClave((e.target as HTMLInputElement).value)}
            />
            {modo === 'crear' && (
              <p class="mt-1.5 text-xs text-tinta-500">Mínimo 8 caracteres.</p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" class="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
        )}
        {aviso && (
          <p role="status" class="rounded-md bg-cielo-50 px-3 py-2.5 text-sm text-cielo-800">{aviso}</p>
        )}

        <button type="submit" class="btn-primario w-full" disabled={ocupado}>
          {ocupado ? t.cargando : t.accion}
        </button>

        <div class="flex flex-wrap justify-between gap-3 pt-1">
          {modo === 'entrar' && (
            <button type="button" onClick={() => cambiarModo('recuperar')}
              class="text-xs text-tinta-500 underline hover:text-tinta-900">
              Olvidé mi contraseña
            </button>
          )}
          {modo === 'recuperar' && (
            <button type="button" onClick={() => cambiarModo('entrar')}
              class="text-xs text-tinta-500 underline hover:text-tinta-900">
              Volver a entrar
            </button>
          )}
          <a href="/tienda" class="ml-auto text-xs text-tinta-500 underline hover:text-tinta-900">
            Seguir como invitado
          </a>
        </div>
      </form>
    </div>
  );
}
