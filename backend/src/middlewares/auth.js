// Middleware de autenticação JWT.
// Lê "Authorization: Bearer <token>", valida e define req.usuarioId.
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { erros } = require('./errorHandler');

function gerarToken(usuarioId) {
  return jwt.sign({ sub: String(usuarioId) }, config.jwt.segredo, { expiresIn: config.jwt.expiraEm });
}

function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const [esquema, token] = cabecalho.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return next(erros.naoAutorizado('Token de autenticação ausente.'));
  }

  try {
    const payload = jwt.verify(token, config.jwt.segredo);
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) throw new Error('payload inválido');
    req.usuarioId = id; // ÚNICA fonte do id do usuário em todas as rotas protegidas
    return next();
  } catch (erro) {
    if (erro.name === 'TokenExpiredError') {
      return next(erros.naoAutorizado('Sessão expirada. Faça login novamente.'));
    }
    return next(erros.naoAutorizado('Token inválido.'));
  }
}

module.exports = { autenticar, gerarToken };
