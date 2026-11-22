export function Carregando({ texto = 'Carregando...' }) {
  return (
    <div className="estado" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function MensagemErro({ erro, aoTentarNovamente }) {
  if (!erro) return null;
  return (
    <div className="estado estado-erro" role="alert">
      <strong>Não foi possível carregar os dados.</strong>
      <span>{erro.message || String(erro)}</span>
      {aoTentarNovamente && (
        <button type="button" className="botao botao-secundario" onClick={aoTentarNovamente}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Vazio({ titulo = 'Nada por aqui ainda.', children }) {
  return (
    <div className="estado estado-vazio">
      <strong>{titulo}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

export function AlertaErro({ mensagem }) {
  if (!mensagem) return null;
  return <div className="alerta alerta-erro" role="alert">{mensagem}</div>;
}

export function AlertaSucesso({ mensagem }) {
  if (!mensagem) return null;
  return <div className="alerta alerta-sucesso" role="status">{mensagem}</div>;
}
