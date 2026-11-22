const express = require('express');
const crypto = require('crypto');
const Lancamento = require('../models/lancamentoModel');
const Categoria = require('../models/categoriaModel');
const FonteDestino = require('../models/fonteDestinoModel');
const { erros, capturar } = require('../middlewares/errorHandler');
const {
  Validador, limparTexto, idDaUrl, inteiro, paraCentavos, paraReais, datas,
} = require('../middlewares/validacao');

const router = express.Router();
const TIPOS = ['entrada', 'saida'];
const MAX_PARCELAS = 48;
const VALOR_MAXIMO_CENTAVOS = 100000000000;

const formatar = (l) => ({
  id: l.id,
  tipo: l.tipo,
  descricao: l.descricao,
  valor: paraReais(l.valor_centavos),
  data: l.data,
  dataCompra: l.data_compra,
  categoria: { id: l.categoria_id, nome: l.categoria_nome },
  fonteDestino: { id: l.fonte_destino_id, nome: l.fonte_destino_nome, tipo: l.fonte_destino_tipo },
  grupoParcelamento: l.grupo_parcelamento,
  parcelaAtual: l.parcela_atual,
  totalParcelas: l.total_parcelas,
  criadoEm: l.criado_em,
  atualizadoEm: l.atualizado_em,
});

/**
 * Divide um valor total em centavos em `n` parcelas inteiras, atribuindo
 * eventual diferença de arredondamento à primeira parcela.
 * @param {number} totalCentavos
 * @param {number} n
 * @returns {Array<number>}
 */
function dividirEmParcelas(totalCentavos, n) {
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + resto : base));
}

/**
 * Valida os campos de criação ou edição de um lançamento e verifica se a categoria
 * e a fonte/destino pertencem ao usuário autenticado.
 * @param {number} usuarioId
 * @param {Object} [corpo={}]
 * @param {{ permitirParcelas: boolean }} opcoes
 * @returns {Promise<Object>}
 */
async function validarLancamento(usuarioId, corpo = {}, { permitirParcelas }) {
  const v = new Validador();
  const tipo = corpo.tipo;
  const descricao = limparTexto(corpo.descricao);
  const valorCentavos = paraCentavos(corpo.valor);
  const data = corpo.data;
  const categoriaId = inteiro(corpo.categoriaId);
  const fonteDestinoId = inteiro(corpo.fonteDestinoId);
  const totalParcelas = corpo.totalParcelas === undefined || corpo.totalParcelas === ''
    ? 1 : inteiro(corpo.totalParcelas);

  if (!TIPOS.includes(tipo)) v.erro('tipo', 'Tipo deve ser "entrada" ou "saida".');
  if (!descricao) v.erro('descricao', 'Informe a descrição.');
  else if (descricao.length > 200) v.erro('descricao', 'A descrição deve ter no máximo 200 caracteres.');
  if (valorCentavos === null) v.erro('valor', 'Informe um valor válido.');
  else if (valorCentavos <= 0) v.erro('valor', 'O valor deve ser positivo.');
  else if (valorCentavos > VALOR_MAXIMO_CENTAVOS) v.erro('valor', 'Valor acima do permitido.');
  if (!datas.dataValida(data)) v.erro('data', 'Data inválida (use AAAA-MM-DD).');
  if (!categoriaId) v.erro('categoriaId', 'Selecione a categoria.');
  if (!fonteDestinoId) v.erro('fonteDestinoId', 'Selecione a fonte/destino.');
  if (permitirParcelas && (totalParcelas === null || totalParcelas < 1 || totalParcelas > MAX_PARCELAS)) {
    v.erro('totalParcelas', `Número de parcelas deve ser entre 1 e ${MAX_PARCELAS}.`);
  }
  v.verificar();

  const [categoria, fonte] = await Promise.all([
    Categoria.buscarPorId(categoriaId, usuarioId),
    FonteDestino.buscarPorId(fonteDestinoId, usuarioId),
  ]);
  if (!categoria) v.erro('categoriaId', 'Categoria não encontrada.');
  else if (categoria.tipo !== tipo) {
    v.erro('categoriaId', `A categoria "${categoria.nome}" é do tipo ${categoria.tipo === 'entrada' ? 'entrada' : 'saída'} e não é compatível com o lançamento.`);
  }
  if (!fonte) v.erro('fonteDestinoId', 'Fonte/destino não encontrado.');

  if (permitirParcelas && totalParcelas > 1) {
    if (fonte && fonte.tipo !== 'cartao_credito') {
      v.erro('totalParcelas', 'Parcelamento só é permitido em cartão de crédito.');
    }
    if (tipo !== 'saida') v.erro('totalParcelas', 'Somente saídas podem ser parceladas.');
    if (valorCentavos < totalParcelas) v.erro('valor', 'Valor insuficiente para o número de parcelas.');
  }
  v.verificar();

  return {
    tipo, descricao, valorCentavos, data, categoriaId, fonteDestinoId, totalParcelas, fonte,
  };
}

router.get('/', capturar(async (req, res) => {
  const { inicio, fim } = datas.periodoDaQuery(req.query);
  const filtros = {
    inicio,
    fim,
    tipo: TIPOS.includes(req.query.tipo) ? req.query.tipo : null,
    categoriaId: inteiro(req.query.categoriaId) || null,
    fonteDestinoId: inteiro(req.query.fonteDestinoId) || null,
    busca: limparTexto(req.query.busca).slice(0, 100) || null,
  };
  const pagina = Math.max(1, inteiro(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, inteiro(req.query.limite) || 20));

  const { itens, totais } = await Lancamento.listar(req.usuarioId, filtros, { pagina, limite });
  const quantidade = Number(totais.quantidade);

  res.json({
    itens: itens.map(formatar),
    paginacao: {
      pagina,
      limite,
      total: quantidade,
      totalPaginas: Math.max(1, Math.ceil(quantidade / limite)),
    },
    totais: {
      entradas: paraReais(totais.entradas),
      saidas: paraReais(totais.saidas),
      saldo: paraReais(totais.entradas - totais.saidas),
    },
    filtros: { ...filtros },
  });
}));

router.get('/:id', capturar(async (req, res) => {
  const lancamento = await Lancamento.buscarPorId(idDaUrl(req.params.id), req.usuarioId);
  if (!lancamento) throw erros.naoEncontrado('Lançamento não encontrado.');

  const resposta = formatar(lancamento);
  if (lancamento.grupo_parcelamento) {
    const parcelas = await Lancamento.listarDoGrupo(lancamento.grupo_parcelamento, req.usuarioId);
    resposta.parcelas = parcelas.map((p) => ({
      id: p.id, parcelaAtual: p.parcela_atual, valor: paraReais(p.valor_centavos), data: p.data,
    }));
  }
  res.json(resposta);
}));

router.post('/', capturar(async (req, res) => {
  const d = await validarLancamento(req.usuarioId, req.body, { permitirParcelas: true });

  const grupo = d.totalParcelas > 1 ? crypto.randomUUID() : null;
  const valores = dividirEmParcelas(d.valorCentavos, d.totalParcelas);

  const linhas = valores.map((valorCentavos, i) => ({
    tipo: d.tipo,
    descricao: d.descricao,
    valorCentavos,
    data: datas.somarMeses(d.data, i),
    dataCompra: d.data,
    categoriaId: d.categoriaId,
    fonteDestinoId: d.fonteDestinoId,
    grupoParcelamento: grupo,
    parcelaAtual: i + 1,
    totalParcelas: d.totalParcelas,
  }));

  const criados = await Lancamento.criarLinhas(req.usuarioId, linhas);
  res.status(201).json({
    grupoParcelamento: grupo,
    totalParcelas: d.totalParcelas,
    lancamentos: criados.map(formatar),
  });
}));

router.put('/:id', capturar(async (req, res) => {
  const id = idDaUrl(req.params.id);
  const atual = await Lancamento.buscarPorId(id, req.usuarioId);
  if (!atual) throw erros.naoEncontrado('Lançamento não encontrado.');

  const corpo = { ...req.body };
  const parcelado = atual.total_parcelas > 1;

  if (parcelado) {
    const v = new Validador();
    if (corpo.tipo !== undefined && corpo.tipo !== atual.tipo) v.erro('tipo', 'Não é possível alterar o tipo de uma parcela.');
    if (corpo.data !== undefined && corpo.data !== atual.data) {
      v.erro('data', 'Não é possível alterar a data de uma parcela. Exclua a compra e lance novamente.');
    }
    if (corpo.fonteDestinoId !== undefined && inteiro(corpo.fonteDestinoId) !== atual.fonte_destino_id) {
      v.erro('fonteDestinoId', 'Não é possível mudar o cartão de uma parcela isoladamente.');
    }
    if (corpo.totalParcelas !== undefined && inteiro(corpo.totalParcelas) !== atual.total_parcelas) {
      v.erro('totalParcelas', 'O número de parcelas não pode ser alterado.');
    }
    v.verificar('Alteração não permitida em parcela.');
    corpo.tipo = atual.tipo;
    corpo.data = atual.data;
    corpo.fonteDestinoId = atual.fonte_destino_id;
  }

  const d = await validarLancamento(req.usuarioId, corpo, { permitirParcelas: false });

  const atualizado = await Lancamento.atualizar(id, req.usuarioId, {
    ...d,
    dataCompra: parcelado ? atual.data_compra : d.data,
  });
  res.json(formatar(atualizado));
}));

router.delete('/:id', capturar(async (req, res) => {
  const id = idDaUrl(req.params.id);
  const lancamento = await Lancamento.buscarPorId(id, req.usuarioId);
  if (!lancamento) throw erros.naoEncontrado('Lançamento não encontrado.');

  if (req.query.todasParcelas === 'true' && lancamento.grupo_parcelamento) {
    await Lancamento.excluirGrupo(lancamento.grupo_parcelamento, req.usuarioId);
  } else {
    await Lancamento.excluir(id, req.usuarioId);
  }
  res.status(204).end();
}));

module.exports = router;
module.exports.dividirEmParcelas = dividirEmParcelas;
