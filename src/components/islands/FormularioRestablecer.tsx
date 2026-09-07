import { useState } from 'preact/hooks';
import { authCliente, errorDeClaveNueva, mensajeDeError } from '@/lib/auth-cliente';
import CampoClave from './CampoClave';

interface Props {
  /** token ya validado por Better Auth al abrir el enlace del correo */
  token: string;
}

/**
 * Segundo paso de "olvidé mi contraseña": el enlace del correo aterriza aquí con
 * el token en la URL y desde este formulario se elige la contraseña nueva.
 */
export default function FormularioRestablecer({ token }: Props) {
  const [clave, setClave] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState(false);

  const enviar = async (e: Event) => {
    e.preventDefault();
    setError('');

    const problema = errorDeClaveNueva(clave, confirmacion);
    if (problema) return setError(problema);

    setOcupado(true);
    const { error: err } = await authCliente.resetPassword({ newPassword: clave, token });
    setOcupado(false);
    if (err) return setError(mensajeDeError(err));
    setListo(true);
  };

  if (listo) {
    return (
      <div class="nota-seccion space-y-4">
        <h2 class="rotulo text-lg text-tinta-900">Contraseña actualizada</h2>
        <p class="text-sm text-tinta-600">
          Ya puedes entrar con la contraseña nueva. Las sesiones abiertas en otros
          dispositivos se cerraron.
        </p>
        <a href="/entrar" class="btn-primario w-full">Entrar</a>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate class="nota-seccion space-y-4">
      <h2 class="rotulo text-lg text-tinta-900">Elige tu contraseña nueva</h2>

      <CampoClave
        id="clave"
        etiqueta="Contraseña nueva"
        value={clave}
        onInput={setClave}
        autocomplete="new-password"
        required
        minLength={8}
        ayuda="Mínimo 8 caracteres."
      />

      <CampoClave
        id="confirmacion"
        etiqueta="Repite la contraseña"
        value={confirmacion}
        onInput={setConfirmacion}
        autocomplete="new-password"
        required
      />

      {error && (
        <p role="alert" class="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
      )}

      <button type="submit" class="btn-primario w-full" disabled={ocupado}>
        {ocupado ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
