import { useEffect, useState } from 'preact/hooks';

/**
 * El carrito vive en localStorage, que no existe en el servidor: el HTML se
 * genera siempre con el carrito vacío. Si la isla renderizara el carrito real
 * en su primer paso, el árbol no coincidiría con el del servidor y Preact
 * abortaría la hidratación dejando el componente congelado.
 *
 * Con esto la isla repite el render del servidor una vez y solo después pinta
 * el estado real.
 */
export function useHidratado(): boolean {
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => setHidratado(true), []);
  return hidratado;
}
