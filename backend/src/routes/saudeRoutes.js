const express = require('express');
const Relatorio = require('../models/relatorioModel');
const { montarFaturas } = require('../models/fatura');
const { capturar } = require('../middlewares/errorHandler');
const { paraReais, datas } = require('../middlewares/validacao');

const router = express.Router();

const AVISO = 'Conteúdo educativo, gerado automaticamente a partir dos seus lançamentos. '
  + 'Não constitui recomendação financeira profissional.';

const NECESSIDADES = ['moradia', 'alimentação', 'alimentacao', 'saúde', 'saude', 'mobilidade', 'educação', 'educacao', 'transporte', 'contas'];

const MESES_BASE = 3;
const MESES_PROJECAO = 6;

const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);

function classificar(valor, { bom, atencao, maiorMelhor = true }) {
  if (valor === null || valor === undefined) return 'sem_dados';
  if (maiorMelhor) {
    if (valor >= bom) return 'bom';
    if (valor >= atencao) return 'atencao';
    return 'critico';
  }
  if (valor <= bom) return 'bom';
  if (valor <= atencao) return 'atencao';
  return 'critico';
}

router.get('/', capturar(async (req, res) => {
  const usuarioId = req.usuarioId;
  const hoje = datas.hoje();
  const inicioMesAtual = datas.inicioDoMes(hoje);
  const fimMesAtual = datas.fimDoMes(hoje);
  const inicioBase = datas.inicioDoMes(datas.somarMeses(inicioMesAtual, -MESES_BASE));
  const fimBase = datas.somarDias(inicioMesAtual, -1);

  const [mensais, porCategoria, saldoAtual, parcelasFuturas, cartoes, lancCartoes] = await Promise.all([
    Relatorio.totaisMensais(usuarioId, inicioBase, fimBase),
    Relatorio.saidasPorCategoriaMensal(usuarioId, inicioBase, fimMesAtual),
    Relatorio.saldoAcumulado(usuarioId, hoje),
    Relatorio.parcelasFuturasPorMes(usuarioId, fimMesAtual),
    Relatorio.cartoes(usuarioId),
    Relatorio.lancamentosDeCartoes(usuarioId),
  ]);

  const soma = (campo) => mensais.reduce((s, m) => s + m[campo], 0);
  const rendaMedia = Math.round(soma('entradas') / MESES_BASE);
  const despesaMedia = Math.round(soma('saidas') / MESES_BASE);
  const despesaParceladaMedia = Math.round(soma('saidas_parceladas') / MESES_BASE);
  const temDados = mensais.length > 0;

  const indicadores = [];

  const taxaPoupanca = pct(rendaMedia - despesaMedia, rendaMedia);
  indicadores.push({
    chave: 'taxa_poupanca',
    titulo: 'Taxa de poupança',
    valor: taxaPoupanca,
    unidade: '%',
    status: classificar(taxaPoupanca, { bom: 20, atencao: 10 }),
    descricao: 'Quanto da renda média mensal (últimos 3 meses) sobra depois das despesas. Referência: 20% ou mais.',
  });

  let proximasFaturas = 0;
  let limiteTotal = 0;
  let limiteUtilizado = 0;
  for (const c of cartoes) {
    const r = montarFaturas(c, lancCartoes.filter((l) => l.fonte_destino_id === c.id), hoje, 0);
    const proxima = r.faturas[0];
    proximasFaturas += Math.round(proxima.total * 100);
    limiteTotal += c.limite_centavos || 0;
    limiteUtilizado += Math.round(r.limiteUtilizado * 100);
  }
  const comprometimentoCartao = pct(proximasFaturas, rendaMedia);
  indicadores.push({
    chave: 'comprometimento_cartoes',
    titulo: 'Comprometimento com cartões',
    valor: comprometimentoCartao,
    unidade: '%',
    status: cartoes.length === 0 ? 'sem_dados' : classificar(comprometimentoCartao, { bom: 30, atencao: 50, maiorMelhor: false }),
    descricao: 'Valor da próxima fatura de todos os cartões em relação à renda média. Referência: até 30%.',
    detalhes: {
      proximasFaturas: paraReais(proximasFaturas),
      limiteTotal: paraReais(limiteTotal),
      usoDoLimite: pct(limiteUtilizado, limiteTotal),
    },
  });

  const totalParcelasFuturas = parcelasFuturas.reduce((s, p) => s + p.total, 0);
  const proximoMes = parcelasFuturas[0] ? parcelasFuturas[0].total : 0;
  const comprometimentoParcelas = pct(proximoMes, rendaMedia);
  indicadores.push({
    chave: 'parcelas_futuras',
    titulo: 'Parcelas futuras',
    valor: paraReais(totalParcelasFuturas),
    unidade: 'R$',
    status: classificar(comprometimentoParcelas ?? (totalParcelasFuturas > 0 ? 100 : 0), { bom: 15, atencao: 30, maiorMelhor: false }),
    descricao: 'Total de parcelas de compras já feitas que ainda vão cair nos próximos meses.',
    detalhes: {
      meses: parcelasFuturas.length,
      quantidadeParcelas: parcelasFuturas.reduce((s, p) => s + Number(p.quantidade), 0),
      percentualRendaProximoMes: comprometimentoParcelas,
    },
  });

  const base = porCategoria.filter((c) => c.mes < inicioMesAtual.slice(0, 7));
  let necessidades = 0;
  let desejos = 0;
  for (const c of base) {
    if (NECESSIDADES.includes(c.categoria_nome.toLowerCase())) necessidades += c.total;
    else desejos += c.total;
  }
  const rendaBase = soma('entradas');
  const regra = {
    necessidades: pct(necessidades, rendaBase),
    desejos: pct(desejos, rendaBase),
    poupanca: pct(rendaBase - necessidades - desejos, rendaBase),
  };
  const desvio503020 = rendaBase > 0
    ? Math.max(regra.necessidades - 50, regra.desejos - 30, 20 - regra.poupanca)
    : null;
  indicadores.push({
    chave: 'regra_50_30_20',
    titulo: 'Regra 50/30/20',
    valor: regra,
    unidade: '%',
    status: classificar(desvio503020, { bom: 0, atencao: 10, maiorMelhor: false }),
    descricao: 'Referência: até 50% da renda em necessidades, até 30% em desejos e ao menos 20% guardado.',
  });

  const mesesReserva = despesaMedia > 0 ? Math.round((saldoAtual / despesaMedia) * 10) / 10 : null;
  indicadores.push({
    chave: 'reserva_emergencia',
    titulo: 'Reserva de emergência',
    valor: mesesReserva,
    unidade: 'meses',
    status: classificar(mesesReserva, { bom: 6, atencao: 3 }),
    descricao: 'Quantos meses de despesas médias o saldo acumulado cobre. Referência: 6 meses ou mais.',
    detalhes: { saldoAcumulado: paraReais(saldoAtual), despesaMedia: paraReais(despesaMedia) },
  });

  const mediaPorCategoria = new Map();
  for (const c of base) {
    mediaPorCategoria.set(c.categoria_nome, (mediaPorCategoria.get(c.categoria_nome) || 0) + c.total / MESES_BASE);
  }
  const foraDaCurva = porCategoria
    .filter((c) => c.mes === hoje.slice(0, 7))
    .map((c) => {
      const media = Math.round(mediaPorCategoria.get(c.categoria_nome) || 0);
      return { categoria: c.categoria_nome, atual: c.total, media };
    })
    .filter((c) => c.atual > c.media * 1.3 && c.atual - c.media >= 5000)
    .map((c) => ({
      categoria: c.categoria,
      mesAtual: paraReais(c.atual),
      media: paraReais(c.media),
      aumentoPercentual: c.media > 0 ? Math.round(((c.atual - c.media) / c.media) * 100) : null,
    }));
  indicadores.push({
    chave: 'categorias_fora_da_curva',
    titulo: 'Categorias fora da curva',
    valor: foraDaCurva.length,
    unidade: 'categorias',
    status: foraDaCurva.length === 0 ? 'bom' : (foraDaCurva.length <= 1 ? 'atencao' : 'critico'),
    descricao: 'Categorias cujo gasto no mês atual já passou 30% (e R$ 50) acima da média dos 3 meses anteriores.',
    detalhes: foraDaCurva,
  });

  const parcelasPorMes = new Map(parcelasFuturas.map((p) => [p.mes, p.total]));
  const despesaAVista = Math.max(0, despesaMedia - despesaParceladaMedia);
  const projecao = [{ mes: hoje.slice(0, 7), saldo: paraReais(saldoAtual), entradas: null, saidas: null, real: true }];
  let saldo = saldoAtual;
  for (let i = 1; i <= MESES_PROJECAO; i += 1) {
    const mes = datas.somarMeses(inicioMesAtual, i).slice(0, 7);
    const parcelas = parcelasPorMes.get(mes) || 0;
    const saidas = despesaAVista + parcelas;
    saldo += rendaMedia - saidas;
    projecao.push({
      mes,
      saldo: paraReais(saldo),
      entradas: paraReais(rendaMedia),
      saidas: paraReais(saidas),
      parcelas: paraReais(parcelas),
      real: false,
    });
  }

  const dicas = [];
  const status = Object.fromEntries(indicadores.map((i) => [i.chave, i.status]));
  if (!temDados) {
    dicas.push('Registre suas entradas e saídas por alguns meses para que os indicadores fiquem mais precisos.');
  }
  if (status.taxa_poupanca === 'critico') {
    dicas.push('Sua taxa de poupança está abaixo de 10%. Revise gastos variáveis e tente separar um valor fixo assim que a renda entrar.');
  } else if (status.taxa_poupanca === 'atencao') {
    dicas.push('Você já poupa parte da renda. Tente chegar a 20% automatizando uma transferência mensal.');
  } else if (status.taxa_poupanca === 'bom') {
    dicas.push('Ótimo! Você poupa 20% ou mais da renda. Considere direcionar o excedente para objetivos de médio e longo prazo.');
  }
  if (status.comprometimento_cartoes === 'critico' || status.comprometimento_cartoes === 'atencao') {
    dicas.push('A próxima fatura compromete boa parte da sua renda. Evite novas compras parceladas até reduzir esse percentual.');
  }
  if (status.parcelas_futuras === 'critico') {
    dicas.push('Há muitas parcelas futuras comprometendo os próximos meses. Considere quitar ou não assumir novos parcelamentos.');
  }
  if (status.regra_50_30_20 !== 'bom' && regra.necessidades !== null) {
    if (regra.necessidades > 50) dicas.push('Necessidades passam de 50% da renda. Avalie renegociar custos fixos (aluguel, planos, contas).');
    if (regra.desejos > 30) dicas.push('Gastos com desejos passam de 30% da renda. Defina um teto mensal para lazer e compras.');
  }
  if (status.reserva_emergencia === 'critico') {
    dicas.push('Sua reserva cobre menos de 3 meses de despesas. Priorize construir uma reserva de emergência em aplicação de alta liquidez.');
  }
  for (const c of foraDaCurva) {
    dicas.push(`O gasto com "${c.categoria}" neste mês já está acima da média. Vale acompanhar até o fim do mês.`);
  }
  const ultimoProjetado = projecao[projecao.length - 1].saldo;
  if (ultimoProjetado < 0) {
    dicas.push('Mantido o ritmo atual, a projeção indica saldo negativo nos próximos meses. Ajuste despesas o quanto antes.');
  }

  res.json({
    aviso: AVISO,
    baseCalculo: { inicio: inicioBase, fim: fimBase, meses: MESES_BASE },
    resumo: {
      rendaMedia: paraReais(rendaMedia),
      despesaMedia: paraReais(despesaMedia),
      saldoAtual: paraReais(saldoAtual),
    },
    indicadores,
    projecao,
    dicas,
  });
}));

module.exports = router;
