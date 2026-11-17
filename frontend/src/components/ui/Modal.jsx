// Janela modal simples e acessível (fecha com Esc ou clique no fundo)
import { useEffect, useRef } from 'react';

export default function Modal({ titulo, aberto, aoFechar, children, largura = 520 }) {
  const ref = useRef(null);
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;

  useEffect(() => {
    if (!aberto) return undefined;
    const tecla = (e) => { if (e.key === 'Escape') fecharRef.current(); };
    document.addEventListener('keydown', tecla);
    const anterior = document.activeElement;
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      anterior?.focus?.();
    };
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div className="modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} style={{ maxWidth: largura }} ref={ref}>
        <header className="modal-cabecalho">
          <h2>{titulo}</h2>
          <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}

/** Diálogo de confirmação com botões personalizáveis */
export function Confirmacao({ aberto, titulo, mensagem, botoes, aoFechar, erro }) {
  return (
    <Modal titulo={titulo} aberto={aberto} aoFechar={aoFechar} largura={460}>
      <p className="confirmacao-texto">{mensagem}</p>
      {erro && <div className="alerta alerta-erro">{erro}</div>}
      <div className="acoes-form">
        <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
        {botoes.map((b) => (
          <button
            key={b.rotulo}
            type="button"
            className={`botao ${b.perigo ? 'botao-perigo' : 'botao-primario'}`}
            onClick={b.acao}
            disabled={b.desabilitado}
          >
            {b.rotulo}
          </button>
        ))}
      </div>
    </Modal>
  );
}
