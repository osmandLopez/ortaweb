import { useState } from 'preact/hooks';
import {
  authCliente,
  errorDeEntrada,
  errorDeRegistro,
  mensajeDeError,
} from '@/lib/auth-cliente';

interface Props {
  destino: string;
  /** false cuando el servidor no tiene proveedor de correo configurado */
  conVerificacion?: boolean;
}

type Modo = 'entrar' | 'crear' | 'recuperar';

const TEXTOS: Record<Modo, { titulo: string; accion: string; cargando: string }> = {
  entrar: { titulo: 'Entrar', accion: 'Entrar', cargando: 'Entrando…' },
  crear: { titulo: 'Crear cuenta', accion: 'Crear mi cuenta', cargando: 'Creando…' },
  recuperar: { titulo: 'Recuperar acceso', accion: 'Enviarme el enlace', cargando: 'Enviando…' },
};

export default function FormularioEntrar({ destino, conVerificacion = true }: Props) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  /* Cuando el alta exige verificar el correo no hay sesión todavía: en vez de
     navegar, el formulario deja su sitio a la pantalla de "revisa tu correo". */
  const [pendienteDeVerificar, setPendienteDeVerificar] = useState('');

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError('');
    setAviso('');
  };

  const enviar = async (e: Event) => {
    e.preventDefault();
    setError('');
    setAviso('');

    /* Validación de navegador: evita el viaje al servidor y señala el campo.
       El backend vuelve a validar lo mismo, no se confía en esto. */
    if (modo === 'crear') {
      const problema = errorDeRegistro({ nombre, email, clave, confirmacion });
      if (problema) return setError(problema);
    } else if (modo === 'entrar') {
      const problema = errorDeEntrada({ email, clave });
      if (problema) return setError(problema);
    } else if (!email.trim()) {
      return setError('Escribe el correo de tu cuenta.');
    }

    setOcupado(true);

    if (modo === 'recuperar') {
      const { error: err } = await authCliente.requestPasswordReset({
        email: email.trim(),
        // Better Auth valida el token y redirige aquí con ?token=… o ?error=…
        redirectTo: '/restablecer',
      });
      setOcupado(false);
      if (err) return setError(mensajeDeError(err));
      // No revelamos si el correo existe: mismo mensaje en ambos casos.
      return setAviso('Si hay una cuenta con ese correo, ya salió el enlace para restablecerla.');
    }

    if (modo === 'crear') {
      const { data, error: err } = await authCliente.signUp.email({
        name: nombre.trim(),
        email: email.trim(),
        password: clave,
        // A dónde llega el usuario al abrir el enlace del correo.
        callbackURL: '/verificar?estado=ok',
      });
      setOcupado(false);
      if (err) return setError(mensajeDeError(err));

      /* Con verificación activa el alta no abre sesión: hay que confirmar el
         correo primero. Sin proveedor de correo, la cuenta sirve desde ya. */
      if (conVerificacion && !data?.token) return setPendienteDeVerificar(email.trim());
      window.location.href = destino;
      return;
    }

    const { error: err } = await authCliente.signIn.email({ email: email.trim(), password: clave });
    if (err) {
      setOcupado(false);
      if (err.code === 'EMAIL_NOT_VERIFIED') return setPendienteDeVerificar(email.trim());
      return setError(mensajeDeError(err));
    }

    // Recarga completa a propósito: el servidor tiene que volver a renderizar
    // el header y las rutas protegidas con la sesión ya puesta.
    window.location.href = destino;
  };

  if (pendienteDeVerificar) {
    return (
      <PantallaVerificacion
        email={pendienteDeVerificar}
        alVolver={() => {
          setPendienteDeVerificar('');
          cambiarModo('entrar');
        }}
      />
    );
  }

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
              id="nombre" class="campo" autocomplete="name" value={nombre} required
              placeholder="Como quieres que te llamemos"
              onInput={(e) => setNombre((e.target as HTMLInputElement).value)}
            />
          </div>
        )}

        <div>
          <label class="campo-etiqueta" for="email">Correo</label>
          <input
            id="email" type="email" class="campo" autocomplete="email" value={email} required
            placeholder="tu@correo.mx"
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          />
          {modo === 'recuperar' && (
            <p class="mt-1.5 text-xs text-tinta-500">
              Te mandamos un enlace para elegir una contraseña nueva.
            </p>
          )}
        </div>

        {modo !== 'recuperar' && (
          <div>
            <label class="campo-etiqueta" for="clave">Contraseña</label>
            <input
              id="clave" type="password" class="campo" value={clave} required minLength={8}
              autocomplete={modo === 'crear' ? 'new-password' : 'current-password'}
              onInput={(e) => setClave((e.target as HTMLInputElement).value)}
            />
            {modo === 'crear' && (
              <p class="mt-1.5 text-xs text-tinta-500">Mínimo 8 caracteres.</p>
            )}
          </div>
        )}

        {modo === 'crear' && (
          <div>
            <label class="campo-etiqueta" for="confirmacion">Repite la contraseña</label>
            <input
              id="confirmacion" type="password" class="campo" value={confirmacion} required
              autocomplete="new-password"
              onInput={(e) => setConfirmacion((e.target as HTMLInputElement).value)}
            />
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

/** Pantalla de espera tras el alta: el correo salió, falta abrirlo. */
function PantallaVerificacion({ email, alVolver }: { email: string; alVolver: () => void }) {
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const [error, setError] = useState('');

  const reenviar = async () => {
    setError('');
    setEstado('enviando');
    const { error: err } = await authCliente.sendVerificationEmail({
      email,
      callbackURL: '/verificar?estado=ok',
    });
    if (err) {
      setEstado('listo');
      return setError(mensajeDeError(err));
    }
    setEstado('enviado');
  };

  return (
    <div class="nota-seccion mt-6 space-y-4">
      <h2 class="rotulo text-lg text-tinta-900">Revisa tu correo</h2>
      <p class="text-sm leading-relaxed text-tinta-600">
        Mandamos un enlace de confirmación a <strong class="text-tinta-900">{email}</strong>.
        Ábrelo dentro de la próxima hora para activar tu cuenta. Si no aparece, mira en
        correo no deseado.
      </p>

      {error && (
        <p role="alert" class="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
      )}
      {estado === 'enviado' && (
        <p role="status" class="rounded-md bg-cielo-50 px-3 py-2.5 text-sm text-cielo-800">
          Enlace reenviado. Puede tardar un par de minutos.
        </p>
      )}

      <button type="button" class="btn-primario w-full" onClick={reenviar} disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Enviando…' : 'Reenviar el correo'}
      </button>
      <button type="button" onClick={alVolver} class="w-full py-2 text-sm text-tinta-500 underline hover:text-tinta-900">
        Volver a entrar
      </button>
    </div>
  );
}
