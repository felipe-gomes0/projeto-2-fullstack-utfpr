// Rate limiting para rotas sensíveis (login e cadastro)
const rateLimit = require('express-rate-limit');

const mensagem = (texto) => ({ erro: texto, campos: {} });

// Login: no máximo 10 tentativas a cada 15 minutos por IP
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true, // só conta tentativas que falharam
  message: mensagem('Muitas tentativas de login. Tente novamente em alguns minutos.'),
});

// Cadastro: no máximo 20 por hora por IP
const limiteCadastro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: mensagem('Muitos cadastros a partir deste endereço. Tente mais tarde.'),
});

module.exports = { limiteLogin, limiteCadastro };
