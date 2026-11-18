// Dashboard: resumo do mês corrente
import { Link } from 'react-router-dom';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { useRequisicao } from '../../services/useRequisicao';
import { dataBr, limitesDoMes, mesAno, mesAtual, moeda } from '../../services/formatadores';
import Resumo from '../ui/Resumo';
import { Carregando, MensagemErro, Vazio } from '../ui/Estados';
import { CORES, tooltipMoeda } from '../ui/graficos';

export default function Dashboard() {
  const { usuario } = useAuth();
  const ref = mesAtual();
  const periodo = limitesDoMes(ref);

  const lanc = useRequisicao(() => api.get('/lancamentos', { ...periodo, limite: 6 }), []);
  const cat = useRequisicao(() => api.get('/relatorios/categorias', periodo), []);
  const fat = useRequisicao(() => api.get('/relatorios/faturas', { meses: 1 }), []);

  const pizza = (cat.dados?.saidas.itens || []).filter((i) => i.total > 0);

  return (
    <section>
      <header className="cabecalho-pagina">
        <div>
          <h1>Olá, {usuario?.nome?.split(' ')[0]}!</h1>
          <p className="subtitulo">Resumo de {mesAno(ref, true)}</p>
        </div>
        <Link to="/lancamentos?novo=1" className="botao botao-primario">+ Novo lançamento</Link>
      </header>

      {lanc.carregando && !lanc.dados && <Carregando />}
      <MensagemErro erro={lanc.erro} aoTentarNovamente={lanc.recarregar} />
      {lanc.dados && <Resumo totais={lanc.dados.totais} />}

      <div className="grade-2">
        <div className="painel">
          <h2>Saídas por categoria</h2>
          {cat.carregando && <Carregando />}
          <MensagemErro erro={cat.erro} aoTentarNovamente={cat.recarregar} />
          {cat.dados && pizza.length === 0 && <Vazio titulo="Sem saídas neste mês." />}
          {pizza.length > 0 && (
            <div className="grafico">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pizza} dataKey="total" nameKey="nome" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {pizza.map((item, i) => <Cell key={item.categoriaId} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={tooltipMoeda} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="painel">
          <h2>Próximas faturas</h2>
          {fat.carregando && <Carregando />}
          <MensagemErro erro={fat.erro} aoTentarNovamente={fat.recarregar} />
          {fat.dados && fat.dados.cartoes.length === 0 && (
            <Vazio titulo="Nenhum cartão cadastrado.">
              <Link to="/fontes-destinos">Cadastre um cartão de crédito</Link>
            </Vazio>
          )}
          <ul className="lista-simples">
            {fat.dados?.cartoes.map((c) => {
              const proxima = c.faturas[0];
              return (
                <li key={c.cartao.id}>
                  <div>
                    <strong>{c.cartao.nome}</strong>
                    <small>Fatura {mesAno(proxima.referencia)} · vence {dataBr(proxima.vencimento)}</small>
                  </div>
                  <div className="texto-direita">
                    <strong>{moeda(proxima.total)}</strong>
                    <small>Disponível {moeda(c.limiteDisponivel)}</small>
                  </div>
                </li>
              );
            })}
          </ul>
          {fat.dados?.cartoes.length > 0 && <Link to="/faturas" className="botao-link">Ver previsão completa →</Link>}
        </div>
      </div>

      <div className="painel">
        <div className="painel-cabecalho">
          <h2>Últimos lançamentos</h2>
          <Link to="/lancamentos" className="botao-link">Ver todos →</Link>
        </div>
        {lanc.dados && lanc.dados.itens.length === 0 && <Vazio titulo="Nenhum lançamento neste mês." />}
        {lanc.dados && lanc.dados.itens.length > 0 && (
          <ul className="lista-simples">
            {lanc.dados.itens.map((l) => (
              <li key={l.id}>
                <div>
                  <strong>{l.descricao}{l.totalParcelas > 1 && <span className="selo">{l.parcelaAtual}/{l.totalParcelas}</span>}</strong>
                  <small>{dataBr(l.data)} · {l.categoria.nome} · {l.fonteDestino.nome}</small>
                </div>
                <strong className={l.tipo === 'entrada' ? 'valor-positivo' : 'valor-negativo'}>
                  {l.tipo === 'entrada' ? '+' : '−'} {moeda(l.valor)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
