import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../services/api';
import { useRequisicao } from '../../services/useRequisicao';
import { dataBr, mesAno, moeda, percentual } from '../../services/formatadores';
import { Carregando, MensagemErro } from '../ui/Estados';
import { CartaoValor } from '../ui/Resumo';
import { moedaCompacta, tooltipMoeda } from '../ui/graficos';

const ROTULO_STATUS = {
  bom: 'Saudável', atencao: 'Atenção', critico: 'Crítico', sem_dados: 'Sem dados',
};

function valorIndicador(ind) {
  if (ind.valor === null || ind.valor === undefined) return '—';
  if (ind.chave === 'regra_50_30_20') return null;
  if (ind.unidade === '%') return percentual(ind.valor);
  if (ind.unidade === 'R$') return moeda(ind.valor);
  if (ind.unidade === 'meses') return `${String(ind.valor).replace('.', ',')} meses`;
  if (ind.unidade === 'categorias') return `${ind.valor} ${ind.valor === 1 ? 'categoria' : 'categorias'}`;
  return `${ind.valor} ${ind.unidade}`;
}

function Regra503020({ valor }) {
  const itens = [
    { rotulo: 'Necessidades', atual: valor.necessidades, meta: 50, classe: 'nec' },
    { rotulo: 'Desejos', atual: valor.desejos, meta: 30, classe: 'des' },
    { rotulo: 'Poupança', atual: valor.poupanca, meta: 20, classe: 'pou' },
  ];
  return (
    <div className="regra">
      {itens.map((i) => (
        <div key={i.rotulo} className="regra-linha">
          <span>{i.rotulo}</span>
          <div className="regra-barra">
            <span className={i.classe} style={{ width: `${Math.max(0, Math.min(100, i.atual ?? 0))}%` }} />
            <i style={{ left: `${i.meta}%` }} title={`Referência: ${i.meta}%`} />
          </div>
          <strong>{percentual(i.atual)}</strong>
        </div>
      ))}
    </div>
  );
}

function Indicador({ ind }) {
  const valor = valorIndicador(ind);
  return (
    <div className={`indicador status-${ind.status}`}>
      <div className="indicador-topo">
        <h3>{ind.titulo}</h3>
        <span className="selo">{ROTULO_STATUS[ind.status]}</span>
      </div>
      {valor !== null && <strong className="indicador-valor">{valor}</strong>}
      {ind.chave === 'regra_50_30_20' && ind.valor.necessidades !== null && <Regra503020 valor={ind.valor} />}
      <p>{ind.descricao}</p>
      {ind.chave === 'categorias_fora_da_curva' && ind.detalhes.length > 0 && (
        <ul className="lista-mini">
          {ind.detalhes.map((c) => (
            <li key={c.categoria}>
              <strong>{c.categoria}</strong>: {moeda(c.mesAtual)} no mês (média {moeda(c.media)})
            </li>
          ))}
        </ul>
      )}
      {ind.chave === 'reserva_emergencia' && ind.detalhes && (
        <small className="texto-suave">Saldo acumulado {moeda(ind.detalhes.saldoAcumulado)} · despesa média {moeda(ind.detalhes.despesaMedia)}/mês</small>
      )}
      {ind.chave === 'comprometimento_cartoes' && ind.detalhes && (
        <small className="texto-suave">Próximas faturas {moeda(ind.detalhes.proximasFaturas)} · uso do limite {percentual(ind.detalhes.usoDoLimite)}</small>
      )}
    </div>
  );
}

export default function SaudeFinanceira() {
  const { dados, carregando, erro, recarregar } = useRequisicao(() => api.get('/saude-financeira'), []);

  return (
    <section>
      <header className="cabecalho-pagina">
        <div>
          <h1>Saúde financeira</h1>
          <p className="subtitulo">Indicadores calculados a partir dos seus lançamentos</p>
        </div>
      </header>

      <div className="alerta alerta-aviso" role="note">
        <strong>Aviso:</strong> {dados?.aviso || 'Conteúdo educativo. Não constitui recomendação financeira profissional.'}
      </div>

      {carregando && <Carregando texto="Calculando indicadores..." />}
      <MensagemErro erro={erro} aoTentarNovamente={recarregar} />

      {dados && (
        <>
          <p className="nota">
            Base de cálculo: média de {dados.baseCalculo.meses} meses ({dataBr(dados.baseCalculo.inicio)} a {dataBr(dados.baseCalculo.fim)}).
          </p>
          <div className="grade-resumo">
            <CartaoValor titulo="Renda média mensal" valor={dados.resumo.rendaMedia} tom="positivo" />
            <CartaoValor titulo="Despesa média mensal" valor={dados.resumo.despesaMedia} tom="negativo" />
            <CartaoValor titulo="Saldo acumulado hoje" valor={dados.resumo.saldoAtual} tom={dados.resumo.saldoAtual >= 0 ? 'positivo' : 'negativo'} />
          </div>

          <div className="grade-indicadores">
            {dados.indicadores.map((ind) => <Indicador key={ind.chave} ind={ind} />)}
          </div>

          <div className="painel">
            <h2>Projeção de saldo (próximos 6 meses)</h2>
            <p className="nota">Renda média − despesas médias à vista − parcelas já contratadas de cada mês.</p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dados.projecao.map((p) => ({ ...p, rotulo: mesAno(p.mes) }))} margin={{ left: 10 }}>
                <defs>
                  <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="rotulo" />
                <YAxis tickFormatter={moedaCompacta} width={80} domain={['auto', 'auto']} />
                <Tooltip formatter={tooltipMoeda} labelFormatter={(r, p) => (p?.[0]?.payload.real ? `${r} (atual)` : `${r} (projeção)`)} />
                <ReferenceLine y={0} stroke="#b91c1c" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#0f766e" strokeWidth={2} fill="url(#gradSaldo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="painel">
            <h2>Dicas</h2>
            {dados.dicas.length === 0 ? <p className="nota">Nenhuma dica no momento. Continue registrando seus lançamentos!</p> : (
              <ul className="dicas">
                {dados.dicas.map((d) => <li key={d}>{d}</li>)}
              </ul>
            )}
            <p className="nota">As dicas seguem regras fixas e documentadas (taxa de poupança, 50/30/20, reserva de emergência etc.).</p>
          </div>
        </>
      )}
    </section>
  );
}
