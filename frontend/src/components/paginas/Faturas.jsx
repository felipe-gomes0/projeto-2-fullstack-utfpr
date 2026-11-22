import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../services/api';
import { useRequisicao } from '../../services/useRequisicao';
import { dataBr, mesAno, moeda } from '../../services/formatadores';
import { Carregando, MensagemErro, Vazio } from '../ui/Estados';
import { CORES, moedaCompacta, tooltipMoeda } from '../ui/graficos';

const STATUS = {
  fechada: { rotulo: 'Fechada · aguardando pagamento', classe: 'selo-alerta' },
  aberta: { rotulo: 'Atual (aberta)', classe: 'selo-ativo' },
  futura: { rotulo: 'Futura', classe: '' },
};

function Fatura({ fatura }) {
  const [aberta, setAberta] = useState(fatura.status !== 'futura');
  const status = STATUS[fatura.status];
  return (
    <article className={`fatura fatura-${fatura.status}`}>
      <button type="button" className="fatura-cabecalho" onClick={() => setAberta(!aberta)} aria-expanded={aberta}>
        <div>
          <h3>Fatura de {mesAno(fatura.referencia, true)}</h3>
          <span className={`selo ${status.classe}`}>{status.rotulo}</span>
        </div>
        <div className="fatura-datas">
          <span>Fecha <strong>{dataBr(fatura.fechamento)}</strong></span>
          <span>Vence <strong>{dataBr(fatura.vencimento)}</strong></span>
        </div>
        <strong className="fatura-total">{moeda(fatura.total)}</strong>
      </button>
      {aberta && (
        fatura.lancamentos.length === 0 ? <p className="nota fatura-vazia">Nenhum lançamento nesta fatura.</p> : (
          <table className="tabela tabela-compacta">
            <thead>
              <tr><th>Compra</th><th>Descrição</th><th>Categoria</th><th>Parcela</th><th className="num">Valor</th></tr>
            </thead>
            <tbody>
              {fatura.lancamentos.map((l) => (
                <tr key={l.id}>
                  <td>{dataBr(l.dataCompra)}</td>
                  <td>{l.descricao}</td>
                  <td>{l.categoria}</td>
                  <td>{l.parcela ? <span className="selo">{l.parcela}</span> : 'à vista'}</td>
                  <td className={`num ${l.tipo === 'entrada' ? 'valor-positivo' : ''}`}>{l.tipo === 'entrada' ? '− ' : ''}{moeda(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </article>
  );
}

function Cartao({ dados, cor }) {
  const { cartao, limiteUtilizado, limiteDisponivel, faturas } = dados;
  const uso = cartao.limite > 0 ? Math.min(100, (limiteUtilizado / cartao.limite) * 100) : 0;
  const grafico = faturas.map((f) => ({ mes: mesAno(f.referencia), Total: f.total }));

  return (
    <div className="painel">
      <div className="cartao-topo">
        <div>
          <h2><span className="bolinha" style={{ background: cor }} />{cartao.nome}</h2>
          <p className="texto-suave">Fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}</p>
        </div>
        <div className="limite">
          <div className="limite-valores">
            <span>Utilizado <strong>{moeda(limiteUtilizado)}</strong></span>
            <span>Disponível <strong className={limiteDisponivel < 0 ? 'valor-negativo' : 'valor-positivo'}>{moeda(limiteDisponivel)}</strong></span>
          </div>
          <div className="barra-limite" role="progressbar" aria-valuenow={Math.round(uso)} aria-valuemin={0} aria-valuemax={100} aria-label="Uso do limite">
            <span style={{ width: `${uso}%` }} className={uso > 80 ? 'alto' : ''} />
          </div>
          <small className="texto-suave">Limite total {moeda(cartao.limite)} · inclui parcelas futuras</small>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={grafico}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" />
          <YAxis tickFormatter={moedaCompacta} width={80} />
          <Tooltip formatter={tooltipMoeda} />
          <Bar dataKey="Total" fill={cor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="faturas">
        {faturas.map((f) => <Fatura key={f.referencia} fatura={f} />)}
      </div>
    </div>
  );
}

export default function Faturas() {
  const [meses, setMeses] = useState(3);
  const { dados, carregando, erro, recarregar } = useRequisicao(
    () => api.get('/relatorios/faturas', { meses }),
    [meses],
  );

  return (
    <section>
      <header className="cabecalho-pagina">
        <div>
          <h1>Faturas</h1>
          <p className="subtitulo">Fatura atual e previsão das próximas, incluindo parcelas futuras</p>
        </div>
        <label className="seletor-inline">
          Próximas
          <select value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
            {[3, 6, 12].map((n) => <option key={n} value={n}>{n} faturas</option>)}
          </select>
        </label>
      </header>

      {carregando && <Carregando />}
      <MensagemErro erro={erro} aoTentarNovamente={recarregar} />
      {dados && dados.cartoes.length === 0 && (
        <div className="painel">
          <Vazio titulo="Você ainda não tem cartões de crédito cadastrados.">
            <Link to="/fontes-destinos">Cadastrar cartão</Link>
          </Vazio>
        </div>
      )}
      {dados?.cartoes.map((c, i) => <Cartao key={c.cartao.id} dados={c} cor={CORES[i % CORES.length]} />)}
    </section>
  );
}
