const { datas, paraReais } = require('../middlewares/validacao');

/**
 * Calcula referência (`AAAA-MM`), data de fechamento e data de vencimento de uma fatura
 * a partir do mês de fechamento. Dias inexistentes são ajustados para o último dia do mês.
 * O vencimento ocorre no mesmo mês do fechamento se `diaVencimento > diaFechamento`, senão no mês seguinte.
 * @param {number} ano
 * @param {number} mesFechamento Mês de fechamento (1-12; aceita valores fora da faixa para transbordo).
 * @param {number} diaFechamento Dia de fechamento (1-31).
 * @param {number} diaVencimento Dia de vencimento (1-31).
 * @returns {{ referencia: string, fechamento: string, vencimento: string }}
 */
function datasDaFatura(ano, mesFechamento, diaFechamento, diaVencimento) {
  const fechamento = datas.criarData(ano, mesFechamento, diaFechamento);
  const mesVencimento = diaVencimento > diaFechamento ? mesFechamento : mesFechamento + 1;
  const vencimento = datas.criarData(ano, mesVencimento, diaVencimento);
  return {
    referencia: vencimento.slice(0, 7),
    fechamento,
    vencimento,
  };
}

/**
 * Calcula em qual fatura entra uma compra ou uma parcela específica dela.
 * Compras antes do fechamento entram na fatura do mesmo mês; no dia do fechamento ou depois, na seguinte.
 * A parcela `k` entra `k - 1` meses após a primeira.
 * @param {string} dataCompra Data no formato `AAAA-MM-DD`.
 * @param {number} diaFechamento Dia de fechamento (1-31).
 * @param {number} diaVencimento Dia de vencimento (1-31).
 * @param {number} [parcela=1] Número da parcela (1-based).
 * @returns {{ referencia: string, fechamento: string, vencimento: string }}
 */
function calcularFatura(dataCompra, diaFechamento, diaVencimento, parcela = 1) {
  const { ano, mes, dia } = datas.partes(dataCompra);
  const fechamentoNoMesDaCompra = Math.min(diaFechamento, datas.ultimoDiaDoMes(ano, mes));
  let mesFechamento = dia < fechamentoNoMesDaCompra ? mes : mes + 1;
  mesFechamento += parcela - 1;
  return datasDaFatura(ano, mesFechamento, diaFechamento, diaVencimento);
}

/**
 * Converte uma referência `AAAA-MM` em um índice absoluto de meses.
 * @param {string} ref
 * @returns {number}
 */
const indiceMes = (ref) => {
  const [a, m] = ref.split('-').map(Number);
  return a * 12 + (m - 1);
};

/**
 * Monta a fatura atual (aberta), eventual fatura fechada ainda não vencida e as próximas faturas de um cartão,
 * calculando o limite utilizado considerando todas as parcelas em faturas ainda não vencidas.
 * @param {Object} cartao Registro do cartão em `fontes_destinos`.
 * @param {Array<Object>} lancamentos Lançamentos vinculados ao cartão.
 * @param {string} hoje Data atual no formato `AAAA-MM-DD`.
 * @param {number} [meses=3] Quantidade de faturas futuras além da atual.
 * @returns {{ cartao: Object, limiteUtilizado: number, limiteDisponivel: number, faturas: Array<Object> }}
 */
function montarFaturas(cartao, lancamentos, hoje, meses = 3) {
  const { dia_fechamento: diaF, dia_vencimento: diaV } = cartao;

  const porReferencia = new Map();
  for (const l of lancamentos) {
    const fatura = calcularFatura(l.data_compra, diaF, diaV, l.parcela_atual);
    if (!porReferencia.has(fatura.referencia)) porReferencia.set(fatura.referencia, []);
    porReferencia.get(fatura.referencia).push(l);
  }

  const atual = calcularFatura(hoje, diaF, diaV, 1);
  const [anoF, mesF] = atual.fechamento.split('-').map(Number);

  const lista = [];
  const anterior = datasDaFatura(anoF, mesF - 1, diaF, diaV);
  if (anterior.vencimento >= hoje) lista.push({ ...anterior, status: 'fechada' });
  lista.push({ ...atual, status: 'aberta' });
  for (let i = 1; i <= meses; i += 1) {
    lista.push({ ...datasDaFatura(anoF, mesF + i, diaF, diaV), status: 'futura' });
  }

  const totalDe = (itens) => itens.reduce(
    (soma, l) => soma + (l.tipo === 'saida' ? l.valor_centavos : -l.valor_centavos),
    0,
  );

  let utilizadoCentavos = 0;
  const refMinima = indiceMes(lista[0].referencia);
  for (const [ref, itens] of porReferencia) {
    if (indiceMes(ref) >= refMinima) utilizadoCentavos += totalDe(itens);
  }
  const limiteCentavos = cartao.limite_centavos || 0;

  const faturas = lista.map((f) => {
    const itens = (porReferencia.get(f.referencia) || []).map((l) => ({
      id: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      categoria: l.categoria_nome,
      dataCompra: l.data_compra,
      parcelaAtual: l.parcela_atual,
      totalParcelas: l.total_parcelas,
      parcela: l.total_parcelas > 1 ? `${l.parcela_atual}/${l.total_parcelas}` : null,
      valor: paraReais(l.valor_centavos),
    }));
    return {
      ...f,
      lancamentos: itens,
      total: paraReais(totalDe(porReferencia.get(f.referencia) || [])),
    };
  });

  return {
    cartao: {
      id: cartao.id,
      nome: cartao.nome,
      diaFechamento: diaF,
      diaVencimento: diaV,
      limite: paraReais(limiteCentavos),
    },
    limiteUtilizado: paraReais(utilizadoCentavos),
    limiteDisponivel: paraReais(limiteCentavos - utilizadoCentavos),
    faturas,
  };
}

module.exports = { calcularFatura, datasDaFatura, montarFaturas };
