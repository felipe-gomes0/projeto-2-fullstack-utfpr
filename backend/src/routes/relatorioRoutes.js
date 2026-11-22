const express = require('express');
const Relatorio = require('../models/relatorioModel');
const { montarFaturas } = require('../models/fatura');
const { capturar, erros } = require('../middlewares/errorHandler');
const { inteiro, paraReais, datas } = require('../middlewares/validacao');

const router = express.Router();

/**
 * Calcula o percentual de `parte` sobre `total` com duas casas decimais.
 * @param {number} parte
 * @param {number} total
 * @returns {number}
 */
const percentual = (parte, total) => (total > 0 ? Math.round((parte / total) * 10000) / 100 : 0);

/**
 * Calcula a variação percentual entre o período atual e o anterior.
 * @param {number} atual
 * @param {number} anterior
 * @returns {number|null} Variação percentual ou `null` quando não há base de comparação.
 */
const variacao = (atual, anterior) => (anterior > 0 ? Math.round(((atual - anterior) / anterior) * 10000) / 100 : null);

/**
 * Calcula o período imediatamente anterior com o mesmo tamanho do período informado.
 * Quando formado por meses inteiros, retorna o mesmo número de meses inteiros; caso contrário, o mesmo número de dias.
 * @param {{ inicio: string, fim: string }} periodo
 * @returns {{ inicio: string, fim: string, dias: number|null }}
 */
function periodoAnterior({ inicio, fim }) {
  const mesesInteiros = inicio === datas.inicioDoMes(inicio) && fim === datas.fimDoMes(fim);
  if (mesesInteiros) {
    const a = datas.partes(inicio);
    const b = datas.partes(fim);
    const meses = (b.ano - a.ano) * 12 + (b.mes - a.mes) + 1;
    const inicioAnterior = datas.somarMeses(inicio, -meses);
    return { inicio: inicioAnterior, fim: datas.somarDias(inicio, -1), dias: null };
  }
  const dias = datas.diferencaEmDias(inicio, fim) + 1;
  const fimAnterior = datas.somarDias(inicio, -1);
  return { inicio: datas.somarDias(fimAnterior, -(dias - 1)), fim: fimAnterior, dias };
}

router.get('/categorias', capturar(async (req, res) => {
  const periodo = datas.periodoDaQuery(req.query);
  const anterior = periodoAnterior(periodo);
  const linhas = await Relatorio.totaisPorCategoria(req.usuarioId, periodo, anterior);

  const montar = (tipo) => {
    const doTipo = linhas.filter((l) => l.tipo === tipo && (l.total > 0 || l.total_anterior > 0));
    const total = doTipo.reduce((s, l) => s + l.total, 0);
    const totalAnterior = doTipo.reduce((s, l) => s + l.total_anterior, 0);
    const itens = doTipo
      .map((l) => ({
        categoriaId: l.id,
        nome: l.nome,
        quantidade: Number(l.quantidade),
        total: paraReais(l.total),
        percentual: percentual(l.total, total),
        totalAnterior: paraReais(l.total_anterior),
        variacaoPercentual: variacao(l.total, l.total_anterior),
      }))
      .sort((a, b) => b.total - a.total || b.totalAnterior - a.totalAnterior);
    return {
      itens,
      total: paraReais(total),
      totalAnterior: paraReais(totalAnterior),
      variacaoPercentual: variacao(total, totalAnterior),
    };
  };

  const saidas = montar('saida');
  const entradas = montar('entrada');

  res.json({
    periodo,
    periodoAnterior: { inicio: anterior.inicio, fim: anterior.fim },
    saidas,
    entradas,
    saldo: Math.round((entradas.total - saidas.total) * 100) / 100,
    saldoAnterior: Math.round((entradas.totalAnterior - saidas.totalAnterior) * 100) / 100,
  });
}));

router.get('/fontes-destinos', capturar(async (req, res) => {
  const periodo = datas.periodoDaQuery(req.query);
  const linhas = await Relatorio.totaisPorFonteDestino(req.usuarioId, periodo);

  let totalEntradas = 0;
  let totalSaidas = 0;
  const itens = linhas.map((l) => {
    totalEntradas += l.entradas;
    totalSaidas += l.saidas;
    return {
      id: l.id,
      nome: l.nome,
      tipo: l.tipo,
      quantidade: Number(l.quantidade),
      entradas: paraReais(l.entradas),
      saidas: paraReais(l.saidas),
      saldo: paraReais(l.entradas - l.saidas),
      saldoAcumulado: paraReais(l.saldo_acumulado),
    };
  });

  res.json({
    periodo,
    itens,
    totais: {
      entradas: paraReais(totalEntradas),
      saidas: paraReais(totalSaidas),
      saldo: paraReais(totalEntradas - totalSaidas),
    },
  });
}));

router.get('/faturas', capturar(async (req, res) => {
  const meses = req.query.meses === undefined ? 3 : inteiro(req.query.meses);
  if (meses === null || meses < 1 || meses > 12) {
    throw erros.validacao({ meses: 'Informe entre 1 e 12 meses.' }, 'Parâmetro inválido.');
  }
  const cartaoId = inteiro(req.query.cartaoId);

  const hoje = datas.hoje();
  const [cartoes, lancamentos] = await Promise.all([
    Relatorio.cartoes(req.usuarioId),
    Relatorio.lancamentosDeCartoes(req.usuarioId),
  ]);

  const resultado = cartoes
    .filter((c) => !cartaoId || c.id === cartaoId)
    .map((c) => montarFaturas(c, lancamentos.filter((l) => l.fonte_destino_id === c.id), hoje, meses));

  res.json({ hoje, meses, cartoes: resultado });
}));

module.exports = router;
module.exports.periodoAnterior = periodoAnterior;
