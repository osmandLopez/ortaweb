import { useState } from 'preact/hooks';
import { authCliente } from '@/lib/auth-cliente';

interface Props {
  class?: string;
}

export default function BotonSalir({ class: clase = '' }: Props) {
  const [saliendo, setSaliendo] = useState(false);

  const salir = async () => {
    setSaliendo(true);
    await authCliente.signOut();
    // Recarga completa: el header y las rutas protegidas se renderizan en el
    // servidor y tienen que volver a leerse sin sesión.
    window.location.href = '/';
  };

  return (
    <button type="button" onClick={salir} disabled={saliendo} class={clase}>
      {saliendo ? 'Saliendo…' : 'Salir'}
    </button>
  );
}
