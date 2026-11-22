const express = require('express');
const bcrypt = require('bcrypt');
const config = require('../config/env');
const Usuario = require('../models/usuarioModel');
const { autenticar, gerarToken } = require('../middlewares/auth');
const { limiteLogin, limiteCadastro } = require('../middlewares/rateLimit');
const { erros, capturar } = require('../middlewares/errorHandler');
const {
  Validador, limparTexto, normalizarEmail, emailValido, normalizarCpf, cpfValido, senhaValida,
} = require('../middlewares/validacao');

const router = express.Router();

const HASH_FICTICIO = bcrypt.hashSync('senha-ficticia-123', config.bcryptRounds);

const usuarioPublico = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  cpf: u.cpf,
  criadoEm: u.criado_em,
});

router.post('/cadastro', limiteCadastro, capturar(async (req, res) => {
  const corpo = req.body || {};
  const nome = limparTexto(corpo.nome);
  const email = normalizarEmail(corpo.email);
  const cpf = normalizarCpf(corpo.cpf);
  const { senha, confirmacaoSenha } = corpo;

  const v = new Validador();
  if (nome.length < 2) v.erro('nome', 'Informe o nome (mínimo 2 caracteres).');
  else if (nome.length > 120) v.erro('nome', 'O nome deve ter no máximo 120 caracteres.');
  if (!email) v.erro('email', 'Informe o e-mail.');
  else if (!emailValido(email)) v.erro('email', 'E-mail inválido.');
  if (!cpf) v.erro('cpf', 'Informe o CPF.');
  else if (!cpfValido(cpf)) v.erro('cpf', 'CPF inválido.');
  if (!senhaValida(senha)) {
    v.erro('senha', 'A senha deve ter no mínimo 8 caracteres, com letras e números.');
  }
  if (typeof confirmacaoSenha !== 'string' || confirmacaoSenha !== senha) {
    v.erro('confirmacaoSenha', 'A confirmação não confere com a senha.');
  }
  v.verificar();

  const emUso = await Usuario.camposEmUso(email, cpf);
  if (emUso.email || emUso.cpf) {
    const campos = {};
    if (emUso.email) campos.email = 'E-mail já cadastrado.';
    if (emUso.cpf) campos.cpf = 'CPF já cadastrado.';
    throw erros.conflito('Já existe um usuário com estes dados.', campos);
  }

  const senhaHash = await bcrypt.hash(senha, config.bcryptRounds);
  const usuario = await Usuario.criarComPadroes({ nome, email, cpf, senhaHash });
  const token = gerarToken(usuario.id);

  res.status(201).json({ usuario: usuarioPublico(usuario), token });
}));

router.post('/login', limiteLogin, capturar(async (req, res) => {
  const corpo = req.body || {};
  const email = normalizarEmail(corpo.email);
  const { senha } = corpo;

  const v = new Validador();
  if (!email) v.erro('email', 'Informe o e-mail.');
  if (typeof senha !== 'string' || senha.length === 0) v.erro('senha', 'Informe a senha.');
  v.verificar();

  const usuario = await Usuario.buscarParaLogin(email);
  const hashComparacao = usuario ? usuario.senha_hash : HASH_FICTICIO;
  const senhaConfere = await bcrypt.compare(String(senha).slice(0, 72), hashComparacao);

  if (!usuario || !senhaConfere) {
    throw erros.naoAutorizado('E-mail ou senha inválidos.');
  }

  res.json({
    token: gerarToken(usuario.id),
    expiraEm: config.jwt.expiraEm,
    usuario: usuarioPublico(usuario),
  });
}));

router.get('/me', autenticar, capturar(async (req, res) => {
  const usuario = await Usuario.buscarPorId(req.usuarioId);
  if (!usuario) throw erros.naoAutorizado('Usuário não encontrado.');
  res.json({ usuario: usuarioPublico(usuario) });
}));

module.exports = router;
