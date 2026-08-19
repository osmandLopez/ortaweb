import { useState } from 'preact/hooks';
import { authCliente, correoValido, mensajeDeError } from '@/lib/auth-cliente';

/**
 * Pide otro correo de verificación cuando el enlace anterior caducó o se perdió.
 * No hace falta sesión: basta el correo de la cuenta.
 */
export default function ReenviarVerificacion() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const [error, setError] = useState('');

  const enviar = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (!correoValido(email)) return setError('Revisa el correo: parece que le falta algo.');

    setEstado('enviando');
    const { error: err } = await authCliente.sendVerificationEmail({
      email: email.trim(),
      callbackURL: '/verificar?estado=ok',
    });
    if (err) {
      setEstado('listo');
      return setError(mensajeDeError(err.code, err.message));
    }
    setEstado('enviado');
  };

  if (estado === 'enviado') {
    return (
      <p role="status" class="rounded-md bg-cielo-50 px-3 py-2.5 text-sm text-cielo-800">
        Si esa cuenta existe y sigue sin confirmar, ya salió un enlace nuevo. Ábrelo dentro
        de la próxima hora.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} noValidate class="space-y-3">
      <div>
        <label class="campo-etiqueta" for="email-reenvio">Correo de tu cuenta</label>
        <input
          id="email-reenvio" type="email" class="campo" autocomplete="email" value={email}
          placeholder="tu@correo.mx"
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        />
      </div>

      {error && (
        <p role="alert" class="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
      )}

      <button type="submit" class="btn-primario w-full" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Enviando…' : 'Mandarme otro enlace'}
      </button>
    </form>
  );
}
