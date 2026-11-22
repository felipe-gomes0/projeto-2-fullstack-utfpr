import { useId } from 'react';
import { mascaraMoeda } from '../../services/formatadores';

export function Campo({ rotulo, erro, ajuda, children, className = '' }) {
  const id = useId();
  const filho = typeof children === 'function'
    ? children({ id, 'aria-invalid': Boolean(erro), 'aria-describedby': erro ? `${id}-erro` : undefined })
    : children;
  return (
    <div className={`campo ${erro ? 'campo-invalido' : ''} ${className}`}>
      {rotulo && <label htmlFor={id}>{rotulo}</label>}
      {filho}
      {ajuda && !erro && <small className="campo-ajuda">{ajuda}</small>}
      {erro && <small id={`${id}-erro`} className="campo-erro">{erro}</small>}
    </div>
  );
}

export function CampoTexto({ rotulo, erro, ajuda, className, ...props }) {
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda} className={className}>
      {(a11y) => <input {...a11y} {...props} />}
    </Campo>
  );
}

/**
 * Campo monetário com máscara baseada em centavos (ex.: `"12345"` → `"123,45"`).
 * @param {Object} props
 * @param {string} [props.rotulo]
 * @param {string} [props.erro]
 * @param {string} [props.ajuda]
 * @param {string} props.value
 * @param {(valorMascarado: string) => void} props.onChange
 * @param {string} [props.className]
 */
export function CampoMoeda({ rotulo, erro, ajuda, value, onChange, className, ...props }) {
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda} className={className}>
      {(a11y) => (
        <div className="input-prefixo">
          <span>R$</span>
          <input
            {...a11y}
            {...props}
            inputMode="numeric"
            value={value}
            placeholder="0,00"
            onChange={(e) => onChange(mascaraMoeda(e.target.value))}
          />
        </div>
      )}
    </Campo>
  );
}

export function CampoSelect({ rotulo, erro, ajuda, children, className, ...props }) {
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda} className={className}>
      {(a11y) => <select {...a11y} {...props}>{children}</select>}
    </Campo>
  );
}
