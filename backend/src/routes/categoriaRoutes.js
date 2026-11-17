// Rotas de categorias: /api/categorias (todas exigem token)
const express = require('express');
const Categoria = require('../models/categoriaModel');
const { erros, capturar } = require('../middlewares/errorHandler');
const { Validador, limparTexto, idDaUrl, inteiro } = require('../middlewares/validacao');

const router = express.Router();
const TIPOS = ['entrada', 'saida'];

const formatar = (c) => ({
  id: c.id,
  nome: c.nome,
  tipo: c.tipo,
  totalLancamentos: Number(c.total_lancamentos || 0),
  criadoEm: c.criado_em,
});

function validarCorpo(corpo = {}) {
  const nome = limparTexto(corpo.nome);
  const { tipo } = corpo;
  const v = new Validador();
  if (!nome) v.erro('nome', 'Informe o nome da categoria.');
  else if (nome.length > 60) v.erro('nome', 'O nome deve ter no máximo 60 caracteres.');
  if (!TIPOS.includes(tipo)) v.erro('tipo', 'Tipo deve ser "entrada" ou "saida".');
  v.verificar();
  return { nome, tipo };
}

/** GET /api/categorias?tipo=entrada|saida */
router.get('/', capturar(async (req, res) => {
  const tipo = TIPOS.includes(req.query.tipo) ? req.query.tipo : null;
  const categorias = await Categoria.listar(req.usuarioId, tipo);
  res.json(categorias.map(formatar));
}));

/** GET /api/categorias/:id */
router.get('/:id', capturar(async (req, res) => {
  const categoria = await Categoria.buscarPorId(idDaUrl(req.params.id), req.usuarioId);
  if (!categoria) throw erros.naoEncontrado('Categoria não encontrada.');
  res.json(formatar(categoria));
}));

/** POST /api/categorias -> 201 | 400 | 409 (nome duplicado no mesmo tipo) */
router.post('/', capturar(async (req, res) => {
  const dados = validarCorpo(req.body);
  const categoria = await Categoria.criar(req.usuarioId, dados);
  res.status(201).json(formatar(categoria));
}));

/** PUT /api/categorias/:id -> 200 | 400 | 404 | 409 */
router.put('/:id', capturar(async (req, res) => {
  const id = idDaUrl(req.params.id);
  const atual = await Categoria.buscarPorId(id, req.usuarioId);
  if (!atual) throw erros.naoEncontrado('Categoria não encontrada.');

  const dados = validarCorpo(req.body);
  if (dados.tipo !== atual.tipo && Number(atual.total_lancamentos) > 0) {
    throw erros.conflito(
      'Não é possível alterar o tipo de uma categoria que possui lançamentos.',
      { tipo: 'A categoria possui lançamentos; o tipo não pode ser alterado.' },
    );
  }

  const categoria = await Categoria.atualizar(id, req.usuarioId, dados);
  res.json(formatar(categoria));
}));

/**
 * DELETE /api/categorias/:id[?moverPara=ID]
 * 204 | 404 | 409 (possui lançamentos e não foi informado destino)
 */
router.delete('/:id', capturar(async (req, res) => {
  const id = idDaUrl(req.params.id);
  const categoria = await Categoria.buscarPorId(id, req.usuarioId);
  if (!categoria) throw erros.naoEncontrado('Categoria não encontrada.');

  const total = Number(categoria.total_lancamentos);
  let moverParaId = null;

  if (total > 0) {
    if (req.query.moverPara === undefined) {
      throw erros.conflito(
        `A categoria possui ${total} lançamento(s). Mova-os para outra categoria antes de excluir.`,
        { moverPara: 'Escolha uma categoria de destino para os lançamentos.' },
      );
    }
    moverParaId = inteiro(req.query.moverPara);
    const destino = moverParaId ? await Categoria.buscarPorId(moverParaId, req.usuarioId) : null;
    if (!destino || destino.id === id || destino.tipo !== categoria.tipo) {
      throw erros.validacao(
        { moverPara: 'A categoria de destino deve ser outra categoria sua, do mesmo tipo.' },
        'Categoria de destino inválida.',
      );
    }
  }

  await Categoria.excluir(id, req.usuarioId, moverParaId);
  res.status(204).end();
}));

module.exports = router;
