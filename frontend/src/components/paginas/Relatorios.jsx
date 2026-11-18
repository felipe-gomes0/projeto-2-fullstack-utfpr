// Relatórios: por categoria (RF7) e por fonte/destino (RF8)
import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../services/api';
import { useRequisicao } from '../../services/useRequisicao';
import {
  NOMES_TIPO_FONTE, dataBr, limitesDoMes, mesAtual, moeda, percentual,
} from '../../services/formatadores';
import Periodo from '../ui/Periodo';
import Resumo from '../ui/Resumo';
import { Carregando, MensagemErro, Vazio } from '../ui/Estados';
import {
  CORES, COR_ENTRADA, COR_NEUTRA, COR_SAIDA, moedaCompacta, tooltipMoeda,
} from '../ui/graficos';

function Variacao({ valor, inverter = false }) {
  if (valor === null || valor === undefined) return <span className="texto-suave">—</span>;
  const subiu = valor > 0;
  // para saídas, subir é ruim (vermelho); para entradas, subir é bom
  const bom = inverter ? !subiu : subiu;
  if (valor === 0) return <span className="texto-suave">0%</span>;
  return <span className={bom ? 'valor-positivo' : 'valor-negativo'}>{subiu ? '▲' : '▼'} {percentual(Math.abs(valor))}</span>;
}

function TabelaCategorias({ bloco, tipo }) {
  if (bloco.itens.length === 0) return <Vazio titulo={`Sem ${tipo === 'saida' ? 'saídas' : 'entradas'} no período.`} />;
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th>Categoria</th>
            <th className="num">Total</th>
            <th className="num">% do total</th>
            <th className="num">Período anterior</th>
            <th className="num">Variação</th>
          </tr>
        </thead>
        <tbody>
          {bloco.itens.map((i, idx) => (
            <tr key={i.categoriaId}>
              <td><span className="bolinha" style={{ background: CORES[idx % CORES.length] }} />{i.nome}</td>
              <td className="num">{moeda(i.total)}</td>
              <td className="num">
                <div className="barra-pct"><span style={{ width: `${Math.min(100, i.percentual)}%` }} /></div>
                {percentual(i.percentual)}
              </td>
              <td className="num">{moeda(i.totalAnterior)}</td>
              <td className="num"><Variacao valor={i.variacaoPercentual} inverter={tipo === 'saida'} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{moeda(bloco.total)}</td>
            <td className="num">100%</td>
            <td className="num">{moeda(bloco.totalAnterior)}</td>
            <td className="num"><Variacao valor={bloco.variacaoPercentual} inverter={tipo === 'saida'} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RelatorioCategorias({ periodo }) {
  const { dados, carregando, erro, recarregar } = useRequisicao(
    () => api.get('/relatorios/categorias', periodo),
    [periodo.inicio, periodo.fim],
  );
  const [tipo, setTipo] = useState('saida');

  if (carregando) return <Carregando />;
  if (erro) return <MensagemErro erro={erro} aoTentarNovamente={recarregar} />;
  if (!dados) return null;

  const bloco = tipo === 'saida' ? dados.saidas : dados.entradas;
  const comparativo = bloco.itens.map((i) => ({ nome: i.nome, Atual: i.total, Anterior: i.totalAnterior }));
  const pizza = bloco.itens.filter((i) => i.total > 0);

  return (
    <>
      <Resumo totais={{ entradas: dados.entradas.total, saidas: dados.saidas.total, saldo: dados.saldo }} />
      <p className="nota">
        Comparação com o período anterior de mesmo tamanho: {dataBr(dados.periodoAnterior.inicio)} a {dataBr(dados.periodoAnterior.fim)}.
      </p>

      <div className="abas abas-pequenas" role="tablist">
        <button type="button" role="tab" aria-selected={tipo === 'saida'} className={tipo === 'saida' ? 'ativo' : ''} onClick={() => setTipo('saida')}>Saídas</button>
        <button type="button" role="tab" aria-selected={tipo === 'entrada'} className={tipo === 'entrada' ? 'ativo' : ''} onClick={() => setTipo('entrada')}>Entradas</button>
      </div>

      <div className="grade-2">
        <div className="painel">
          <h2>Distribuição</h2>
          {pizza.length === 0 ? <Vazio titulo="Sem valores no período." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pizza} dataKey="total" nameKey="nome" outerRadius={110} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {pizza.map((i) => <Cell key={i.categoriaId} fill={CORES[bloco.itens.indexOf(i) % CORES.length]} />)}
                </Pie>
                <Tooltip formatter={tooltipMoeda} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="painel">
          <h2>Atual × período anterior</h2>
          {comparativo.length === 0 ? <Vazio titulo="Sem valores para comparar." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparativo} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tickFormatter={moedaCompacta} width={80} />
                <Tooltip formatter={tooltipMoeda} />
                <Legend />
                <Bar dataKey="Atual" fill={tipo === 'saida' ? COR_SAIDA : COR_ENTRADA} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Anterior" fill={COR_NEUTRA} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="painel">
        <h2>{tipo === 'saida' ? 'Saídas' : 'Entradas'} por categoria</h2>
        <TabelaCategorias bloco={bloco} tipo={tipo} />
      </div>
    </>
  );
}

function RelatorioFontes({ periodo }) {
  const { dados, carregando, erro, recarregar } = useRequisicao(
    () => api.get('/relatorios/fontes-destinos', periodo),
    [periodo.inicio, periodo.fim],
  );

  if (carregando) return <Carregando />;
  if (erro) return <MensagemErro erro={erro} aoTentarNovamente={recarregar} />;
  if (!dados) return null;

  const comMovimento = dados.itens.filter((i) => i.quantidade > 0);
  const grafico = comMovimento.map((i) => ({ nome: i.nome, Entradas: i.entradas, Saídas: i.saidas, Saldo: i.saldo }));

  return (
    <>
      <Resumo totais={dados.totais} />
      <div className="painel">
        <h2>Entradas, saídas e saldo por fonte/destino</h2>
        {grafico.length === 0 ? <Vazio titulo="Sem movimentação no período." /> : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={grafico} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={moedaCompacta} width={80} />
              <Tooltip formatter={tooltipMoeda} />
              <Legend />
              <Bar dataKey="Entradas" fill={COR_ENTRADA} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saídas" fill={COR_SAIDA} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saldo" fill={CORES[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="painel">
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Fonte/destino</th>
                <th>Tipo</th>
                <th className="num">Entradas</th>
                <th className="num">Saídas</th>
                <th className="num">Saldo do período</th>
                <th className="num" title="Entradas - saídas desde o início até o fim do período">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((i) => (
                <tr key={i.id}>
                  <td>{i.nome}</td>
                  <td><span className={`selo selo-${i.tipo}`}>{NOMES_TIPO_FONTE[i.tipo]}</span></td>
                  <td className="num valor-positivo">{moeda(i.entradas)}</td>
                  <td className="num valor-negativo">{moeda(i.saidas)}</td>
                  <td className={`num ${i.saldo >= 0 ? 'valor-positivo' : 'valor-negativo'}`}>{moeda(i.saldo)}</td>
                  <td className="num">{moeda(i.saldoAcumulado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="num">{moeda(dados.totais.entradas)}</td>
                <td className="num">{moeda(dados.totais.saidas)}</td>
                <td className="num">{moeda(dados.totais.saldo)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

export default function Relatorios() {
  const [aba, setAba] = useState('categorias');
  const [periodo, setPeriodo] = useState(limitesDoMes(mesAtual()));

  return (
    <section>
      <header className="cabecalho-pagina">
        <div>
          <h1>Relatórios</h1>
          <p className="subtitulo">Para onde vai e de onde vem o seu dinheiro</p>
        </div>
      </header>

      <div className="painel filtros">
        <Periodo valor={periodo} aoMudar={setPeriodo} />
      </div>

      <div className="abas" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'categorias'} className={aba === 'categorias' ? 'ativo' : ''} onClick={() => setAba('categorias')}>Por categoria</button>
        <button type="button" role="tab" aria-selected={aba === 'fontes'} className={aba === 'fontes' ? 'ativo' : ''} onClick={() => setAba('fontes')}>Por fonte/destino</button>
      </div>

      {aba === 'categorias' ? <RelatorioCategorias periodo={periodo} /> : <RelatorioFontes periodo={periodo} />}
    </section>
  );
}
