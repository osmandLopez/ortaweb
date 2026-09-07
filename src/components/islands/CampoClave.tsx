/*
 * Campo de contraseña con botón para verla u ocultarla.
 *
 * No es una isla: no se hidrata sola, la usan por dentro FormularioEntrar y
 * FormularioRestablecer. Vive aquí porque es Preact y solo la consumen ellas.
 *
 * Empieza siempre oculta y vuelve a ocultarse cuando el campo pierde el foco:
 * la contraseña destapada en una pantalla que alguien deja abierta es peor que
 * teclearla a ciegas. El botón queda fuera del orden de tabulación (tabIndex
 * -1) para que al tabular desde el correo se caiga en el campo y de ahí al
 * siguiente, sin tropezar con el ojo; quien navega con teclado no lo necesita,
 * porque no se equivoca al teclear sin ver más que nadie.
 */
import { useState } from 'preact/hooks';

interface Props {
  id: string;
  etiqueta: string;
  value: string;
  onInput: (valor: string) => void;
  autocomplete: 'current-password' | 'new-password';
  required?: boolean;
  minLength?: number;
  /** Texto de ayuda bajo el campo, si lo lleva. */
  ayuda?: string;
}

export default function CampoClave({
  id,
  etiqueta,
  value,
  onInput,
  autocomplete,
  required = false,
  minLength,
  ayuda,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label class="campo-etiqueta" for={id}>{etiqueta}</label>

      <div class="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          class="campo pr-11"
          value={value}
          required={required}
          minLength={minLength}
          autocomplete={autocomplete}
          onInput={(e) => onInput((e.target as HTMLInputElement).value)}
          onBlur={() => setVisible(false)}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-tinta-400 transition-colors hover:text-tinta-900"
        >
          {visible ? (
            /* Ojo tachado: la contraseña está a la vista, pulsar la esconde. */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {ayuda && <p class="mt-1.5 text-xs text-tinta-500">{ayuda}</p>}
    </div>
  );
}
