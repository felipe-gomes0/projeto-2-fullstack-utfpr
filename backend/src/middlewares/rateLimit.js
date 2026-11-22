const rateLimit = require('express-rate-limit');

const mensagem = (texto) => ({ erro: texto, campos: {} });

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: mensagem('Muitas tentativas de login. Tente novamente em alguns minutos.'),
});

const limiteCadastro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: mensagem('Muitos cadastros a partir deste endereço. Tente mais tarde.'),
});

module.exports = { limiteLogin, limiteCadastro };
