const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { erros } = require('./errorHandler');

/**
 * Gera um token JWT assinado para o usuário informado.
 * @param {number} usuarioId
 * @returns {string}
 */
function gerarToken(usuarioId) {
  return jwt.sign({ sub: String(usuarioId) }, config.jwt.segredo, { expiresIn: config.jwt.expiraEm });
}

/**
 * Middleware de autenticação JWT.
 * Valida o cabeçalho `Authorization: Bearer <token>` e define `req.usuarioId`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
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
    req.usuarioId = id;
    return next();
  } catch (erro) {
    if (erro.name === 'TokenExpiredError') {
      return next(erros.naoAutorizado('Sessão expirada. Faça login novamente.'));
    }
    return next(erros.naoAutorizado('Token inválido.'));
  }
}

module.exports = { autenticar, gerarToken };
