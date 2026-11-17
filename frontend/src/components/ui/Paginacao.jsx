// Controles de paginação
export default function Paginacao({ pagina, totalPaginas, total, aoMudar }) {
  if (!totalPaginas || totalPaginas <= 1) {
    return total ? <p className="paginacao-info">{total} registro(s)</p> : null;
  }
  return (
    <nav className="paginacao" aria-label="Paginação">
      <button type="button" className="botao botao-secundario" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        Anterior
      </button>
      <span className="paginacao-info">Página {pagina} de {totalPaginas} · {total} registro(s)</span>
      <button type="button" className="botao botao-secundario" disabled={pagina >= totalPaginas} onClick={() => aoMudar(pagina + 1)}>
        Próxima
      </button>
    </nav>
  );
}
