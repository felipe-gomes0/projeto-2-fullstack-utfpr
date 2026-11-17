// Regras de faturas de cartão de crédito (RF9).
// Funções puras (sem acesso ao banco), reutilizadas por /relatorios/faturas e /saude-financeira.
const { datas, paraReais } = require('../middlewares/validacao');

/**
 * Datas de fechamento e vencimento de uma fatura, a partir do mês de fechamento.
 * Dias inexistentes (ex.: 31 em fevereiro) viram o último dia do mês.
 * @param {number} ano
 * @param {number} mesFechamento 1-12 (pode "transbordar", ex.: 13 = janeiro do ano seguinte)
 */
function datasDaFatura(ano, mesFechamento, diaFechamento, diaVencimento) {
  const fechamento = datas.criarData(ano, mesFechamento, diaFechamento);
  // vencimento no mesmo mês do fechamento se o dia de vencimento for maior; senão, no mês seguinte
  const mesVencimento = diaVencimento > diaFechamento ? mesFechamento : mesFechamento + 1;
  const vencimento = datas.criarData(ano, mesVencimento, diaVencimento);
  return {
    referencia: vencimento.slice(0, 7), // mês da fatura = mês do vencimento (AAAA-MM)
    fechamento,
    vencimento,
  };
}

/**
 * Calcula em qual fatura cai uma compra (ou a parcela `parcela` dela).
 * - compra ANTES do dia de fechamento -> fatura que fecha no mesmo mês
 * - compra NO dia do fechamento ou depois -> fatura que fecha no mês seguinte
 * - a parcela k cai k-1 meses depois da primeira
 *
 * Ex.: calcularFatura('2026-12-28', 25, 5, 1)
 *   -> { referencia: '2027-02', fechamento: '2027-01-25', vencimento: '2027-02-05' }
 *
 * @param {string} dataCompra 'AAAA-MM-DD'
 * @param {number} diaFechamento 1-31
 * @param {number} diaVencimento 1-31
 * @param {number} [parcela=1]
 */
function calcularFatura(dataCompra, diaFechamento, diaVencimento, parcela = 1) {
  const { ano, mes, dia } = datas.partes(dataCompra);
  const fechamentoNoMesDaCompra = Math.min(diaFechamento, datas.ultimoDiaDoMes(ano, mes));
  let mesFechamento = dia < fechamentoNoMesDaCompra ? mes : mes + 1;
  mesFechamento += parcela - 1;
  return datasDaFatura(ano, mesFechamento, diaFechamento, diaVencimento);
}

/** 'AAAA-MM' -> índice absoluto de meses (facilita somar/subtrair meses) */
const indiceMes = (ref) => {
  const [a, m] = ref.split('-').map(Number);
  return a * 12 + (m - 1);
};

/**
 * Monta a fatura atual (aberta), a eventual fatura já fechada e ainda não vencida
 * e as `meses` próximas faturas de um cartão.
 * @param {Object} cartao linha de fontes_destinos
 * @param {Array} lancamentos lançamentos deste cartão
 * @param {string} hoje 'AAAA-MM-DD'
 * @param {number} meses quantidade de faturas futuras além da atual
 */
function montarFaturas(cartao, lancamentos, hoje, meses = 3) {
  const { dia_fechamento: diaF, dia_vencimento: diaV } = cartao;

  // agrupa cada lançamento na fatura correspondente
  const porReferencia = new Map();
  for (const l of lancamentos) {
    const fatura = calcularFatura(l.data_compra, diaF, diaV, l.parcela_atual);
    if (!porReferencia.has(fatura.referencia)) porReferencia.set(fatura.referencia, []);
    porReferencia.get(fatura.referencia).push(l);
  }

  const atual = calcularFatura(hoje, diaF, diaV, 1);
  // mês de fechamento da fatura atual (para gerar as próximas)
  const [anoF, mesF] = atual.fechamento.split('-').map(Number);

  const lista = [];
  // fatura anterior: já fechada, mas ainda não venceu (aguardando pagamento)
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

  // limite utilizado = todas as parcelas em faturas ainda não vencidas (inclui futuras além do horizonte)
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
