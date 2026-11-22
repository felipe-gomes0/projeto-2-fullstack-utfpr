const express = require('express');
const FonteDestino = require('../models/fonteDestinoModel');
const { erros, capturar } = require('../middlewares/errorHandler');
const {
  Validador, limparTexto, idDaUrl, inteiro, paraCentavos, paraReais,
} = require('../middlewares/validacao');

const router = express.Router();
const TIPOS = ['renda', 'conta', 'cartao_credito'];

const formatar = (f) => ({
  id: f.id,
  nome: f.nome,
  tipo: f.tipo,
  diaFechamento: f.dia_fechamento,
  diaVencimento: f.dia_vencimento,
  limite: f.limite_centavos === null ? null : paraReais(f.limite_centavos),
  totalLancamentos: Number(f.total_lancamentos || 0),
  criadoEm: f.criado_em,
});

function validarCorpo(corpo = {}) {
  const nome = limparTexto(corpo.nome);
  const { tipo } = corpo;
  const v = new Validador();

  if (!nome) v.erro('nome', 'Informe o nome.');
  else if (nome.length > 60) v.erro('nome', 'O nome deve ter no máximo 60 caracteres.');
  if (!TIPOS.includes(tipo)) v.erro('tipo', 'Tipo deve ser "renda", "conta" ou "cartao_credito".');

  let diaFechamento = null;
  let diaVencimento = null;
  let limiteCentavos = null;

  if (tipo === 'cartao_credito') {
    diaFechamento = inteiro(corpo.diaFechamento);
    diaVencimento = inteiro(corpo.diaVencimento);
    limiteCentavos = paraCentavos(corpo.limite);
    if (diaFechamento === null || diaFechamento < 1 || diaFechamento > 31) {
      v.erro('diaFechamento', 'Cartão exige dia de fechamento entre 1 e 31.');
    }
    if (diaVencimento === null || diaVencimento < 1 || diaVencimento > 31) {
      v.erro('diaVencimento', 'Cartão exige dia de vencimento entre 1 e 31.');
    }
    if (limiteCentavos === null || limiteCentavos < 0) {
      v.erro('limite', 'Cartão exige limite (valor maior ou igual a zero).');
    }
  }

  v.verificar();
  return { nome, tipo, diaFechamento, diaVencimento, limiteCentavos };
}

router.get('/', capturar(async (req, res) => {
  const tipo = TIPOS.includes(req.query.tipo) ? req.query.tipo : null;
  const fontes = await FonteDestino.listar(req.usuarioId, tipo);
  res.json(fontes.map(formatar));
}));

router.get('/:id', capturar(async (req, res) => {
  const fonte = await FonteDestino.buscarPorId(idDaUrl(req.params.id), req.usuarioId);
  if (!fonte) throw erros.naoEncontrado('Fonte/destino não encontrado.');
  res.json(formatar(fonte));
}));

router.post('/', capturar(async (req, res) => {
  const dados = validarCorpo(req.body);
  const fonte = await FonteDestino.criar(req.usuarioId, dados);
  res.status(201).json(formatar(fonte));
}));

router.put('/:id', capturar(async (req, res) => {
  const id = idDaUrl(req.params.id);
  const atual = await FonteDestino.buscarPorId(id, req.usuarioId);
  if (!atual) throw erros.naoEncontrado('Fonte/destino não encontrado.');

  const dados = validarCorpo(req.body);
  if (atual.tipo === 'cartao_credito' && dados.tipo !== 'cartao_credito'
      && await FonteDestino.possuiParcelados(id, req.usuarioId)) {
    throw erros.conflito(
      'Este cartão possui compras parceladas; o tipo não pode ser alterado.',
      { tipo: 'Cartão com compras parceladas não pode mudar de tipo.' },
    );
  }

  const fonte = await FonteDestino.atualizar(id, req.usuarioId, dados);
  res.json(formatar(fonte));
}));

router.delete('/:id', capturar(async (req, res) => {
  const id = idDaUrl(req.params.id);
  const fonte = await FonteDestino.buscarPorId(id, req.usuarioId);
  if (!fonte) throw erros.naoEncontrado('Fonte/destino não encontrado.');

  const total = Number(fonte.total_lancamentos);
  let moverParaId = null;

  if (total > 0) {
    if (req.query.moverPara === undefined) {
      throw erros.conflito(
        `Esta fonte/destino possui ${total} lançamento(s). Mova-os antes de excluir.`,
        { moverPara: 'Escolha uma fonte/destino para receber os lançamentos.' },
      );
    }
    moverParaId = inteiro(req.query.moverPara);
    const destino = moverParaId ? await FonteDestino.buscarPorId(moverParaId, req.usuarioId) : null;
    const temParcelados = await FonteDestino.possuiParcelados(id, req.usuarioId);
    if (!destino || destino.id === id || (temParcelados && destino.tipo !== 'cartao_credito')) {
      throw erros.validacao(
        {
          moverPara: temParcelados
            ? 'Há compras parceladas: o destino deve ser outro cartão de crédito seu.'
            : 'O destino deve ser outra fonte/destino sua.',
        },
        'Destino inválido.',
      );
    }
  }

  await FonteDestino.excluir(id, req.usuarioId, moverParaId);
  res.status(204).end();
}));

module.exports = router;
