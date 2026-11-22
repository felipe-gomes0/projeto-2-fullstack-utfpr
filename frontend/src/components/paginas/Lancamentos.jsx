import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useRequisicao } from '../../services/useRequisicao';
import { dataBr, limitesDoMes, mesAtual, moeda } from '../../services/formatadores';
import Periodo from '../ui/Periodo';
import Resumo from '../ui/Resumo';
import Paginacao from '../ui/Paginacao';
import Modal, { Confirmacao } from '../ui/Modal';
import { AlertaSucesso, Carregando, MensagemErro, Vazio } from '../ui/Estados';
import LancamentoForm from './LancamentoForm';

const FILTROS_VAZIOS = { tipo: '', categoriaId: '', fonteDestinoId: '', busca: '' };
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d+$/;

/**
 * Lê período e filtros iniciais da URL (ex.: `?fonteDestinoId=3&inicio=2025-01-01&fim=2029-12-31`).
 * @param {URLSearchParams} params
 * @returns {{ periodo: { inicio: string, fim: string }, filtros: Object }}
 */
function estadoInicialDaUrl(params) {
  const inicio = params.get('inicio');
  const fim = params.get('fim');
  const periodo = DATA_ISO.test(inicio || '') && DATA_ISO.test(fim || '') && inicio <= fim
    ? { inicio, fim }
    : limitesDoMes(mesAtual());
  const filtros = { ...FILTROS_VAZIOS };
  for (const campo of ['categoriaId', 'fonteDestinoId']) {
    if (ID.test(params.get(campo) || '')) filtros[campo] = params.get(campo);
  }
  return { periodo, filtros };
}

export default function Lancamentos() {
  const [params, setParams] = useSearchParams();
  const [inicial] = useState(() => estadoInicialDaUrl(params));
  const [periodo, setPeriodo] = useState(inicial.periodo);
  const [filtros, setFiltros] = useState(inicial.filtros);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [formAberto, setFormAberto] = useState(params.get('novo') === '1');
  const [editando, setEditando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [erroExclusao, setErroExclusao] = useState('');
  const [sucesso, setSucesso] = useState('');

  const apoio = useRequisicao(
    () => Promise.all([api.get('/categorias'), api.get('/fontes-destinos')])
      .then(([categorias, fontes]) => ({ categorias, fontes })),
    [],
  );

  const lista = useRequisicao(
    () => api.get('/lancamentos', { ...periodo, ...filtros, pagina, limite: 15 }),
    [periodo.inicio, periodo.fim, filtros.tipo, filtros.categoriaId, filtros.fonteDestinoId, filtros.busca, pagina],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => (f.busca === busca ? f : { ...f, busca }));
      setPagina(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (!sucesso) return undefined;
    const t = setTimeout(() => setSucesso(''), 3500);
    return () => clearTimeout(t);
  }, [sucesso]);

  const mudarFiltro = (campo) => (e) => {
    setFiltros({ ...filtros, [campo]: e.target.value });
    setPagina(1);
  };

  const fecharForm = () => {
    setFormAberto(false);
    setEditando(null);
    if (params.get('novo')) setParams({}, { replace: true });
  };

  const aoSalvar = (resultado) => {
    if (resultado?.totalParcelas > 1) setSucesso(`Compra lançada em ${resultado.totalParcelas} parcelas.`);
    else setSucesso(editando ? 'Lançamento atualizado.' : 'Lançamento criado.');
    fecharForm();
    lista.recarregar();
  };

  async function excluir(todasParcelas) {
    setErroExclusao('');
    try {
      await api.delete(`/lancamentos/${excluindo.id}`, todasParcelas ? { todasParcelas: 'true' } : undefined);
      setSucesso(todasParcelas ? 'Todas as parcelas foram excluídas.' : 'Lançamento excluído.');
      setExcluindo(null);
      if (lista.dados?.itens.length === 1 && pagina > 1) setPagina(pagina - 1);
      else lista.recarregar();
    } catch (erro) {
      setErroExclusao(erro.message);
    }
  }

  const temFiltro = Object.values(filtros).some(Boolean);

  return (
    <section>
      <header className="cabecalho-pagina">
        <div>
          <h1>Lançamentos</h1>
          <p className="subtitulo">Entradas e saídas do período</p>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => { setEditando(null); setFormAberto(true); }} disabled={!apoio.dados}>
          + Novo lançamento
        </button>
      </header>

      <AlertaSucesso mensagem={sucesso} />

      <div className="painel filtros">
        <Periodo valor={periodo} aoMudar={(p) => { setPeriodo(p); setPagina(1); }} />
        <div className="filtros-campos">
          <select value={filtros.tipo} onChange={mudarFiltro('tipo')} aria-label="Filtrar por tipo">
            <option value="">Todos os tipos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
          <select value={filtros.categoriaId} onChange={mudarFiltro('categoriaId')} aria-label="Filtrar por categoria">
            <option value="">Todas as categorias</option>
            {apoio.dados?.categorias
              .filter((c) => !filtros.tipo || c.tipo === filtros.tipo)
              .map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.tipo === 'entrada' ? 'entrada' : 'saída'})</option>)}
          </select>
          <select value={filtros.fonteDestinoId} onChange={mudarFiltro('fonteDestinoId')} aria-label="Filtrar por fonte/destino">
            <option value="">Todas as fontes/destinos</option>
            {apoio.dados?.fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <input type="search" placeholder="Buscar descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar por descrição" />
          {temFiltro && (
            <button type="button" className="botao-link" onClick={() => { setFiltros(FILTROS_VAZIOS); setBusca(''); setPagina(1); }}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {lista.dados && <Resumo totais={lista.dados.totais} />}

      <div className="painel">
        {lista.carregando && <Carregando />}
        <MensagemErro erro={lista.erro || apoio.erro} aoTentarNovamente={() => { apoio.recarregar(); lista.recarregar(); }} />
        {!lista.carregando && lista.dados && lista.dados.itens.length === 0 && (
          <Vazio titulo="Nenhum lançamento encontrado.">
            {temFiltro ? 'Tente ajustar os filtros.' : 'Use o botão "Novo lançamento" para começar.'}
          </Vazio>
        )}
        {!lista.carregando && lista.dados?.itens.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Fonte/destino</th>
                  <th className="num">Valor</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {lista.dados.itens.map((l) => (
                  <tr key={l.id}>
                    <td>{dataBr(l.data)}</td>
                    <td>
                      {l.descricao}
                      {l.totalParcelas > 1 && <span className="selo" title={`Compra em ${dataBr(l.dataCompra)}`}>{l.parcelaAtual}/{l.totalParcelas}</span>}
                    </td>
                    <td>{l.categoria.nome}</td>
                    <td>{l.fonteDestino.nome}</td>
                    <td className={`num ${l.tipo === 'entrada' ? 'valor-positivo' : 'valor-negativo'}`}>
                      {l.tipo === 'entrada' ? '+' : '−'} {moeda(l.valor)}
                    </td>
                    <td className="acoes">
                      <button type="button" className="botao-link" onClick={() => { setEditando(l); setFormAberto(true); }}>Editar</button>
                      <button type="button" className="botao-link perigo" onClick={() => { setErroExclusao(''); setExcluindo(l); }}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lista.dados && <Paginacao {...lista.dados.paginacao} aoMudar={setPagina} />}
      </div>

      <Modal titulo={editando ? 'Editar lançamento' : 'Novo lançamento'} aberto={formAberto && Boolean(apoio.dados)} aoFechar={fecharForm} largura={620}>
        {apoio.dados && (
          <LancamentoForm
            key={editando?.id || 'novo'}
            inicial={editando}
            categorias={apoio.dados.categorias}
            fontes={apoio.dados.fontes}
            aoSalvar={aoSalvar}
            aoCancelar={fecharForm}
          />
        )}
      </Modal>

      <Confirmacao
        aberto={Boolean(excluindo)}
        titulo="Excluir lançamento"
        erro={erroExclusao}
        aoFechar={() => setExcluindo(null)}
        mensagem={excluindo && (excluindo.totalParcelas > 1
          ? `"${excluindo.descricao}" é a parcela ${excluindo.parcelaAtual} de ${excluindo.totalParcelas}. Deseja excluir só esta parcela ou todas as parcelas da compra?`
          : `Tem certeza que deseja excluir "${excluindo.descricao}" (${moeda(excluindo.valor)})?`)}
        botoes={excluindo?.totalParcelas > 1
          ? [
            { rotulo: 'Só esta parcela', acao: () => excluir(false), perigo: true },
            { rotulo: `Todas as ${excluindo.totalParcelas} parcelas`, acao: () => excluir(true), perigo: true },
          ]
          : [{ rotulo: 'Excluir', acao: () => excluir(false), perigo: true }]}
      />
    </section>
  );
}
