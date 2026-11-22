class AppError extends Error {
  /**
   * @param {number} status Código HTTP da resposta.
   * @param {string} mensagem Mensagem geral do erro.
   * @param {Object<string, string>} [campos={}] Mapa de erros por campo.
   */
  constructor(status, mensagem, campos = {}) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

const erros = {
  validacao: (campos, mensagem = 'Dados inválidos.') => new AppError(400, mensagem, campos),
  naoAutorizado: (mensagem = 'Não autenticado.') => new AppError(401, mensagem),
  naoEncontrado: (mensagem = 'Registro não encontrado.') => new AppError(404, mensagem),
  conflito: (mensagem, campos = {}) => new AppError(409, mensagem, campos),
};

const RESTRICOES_UNICAS = {
  usuarios_email_key: { campo: 'email', mensagem: 'E-mail já cadastrado.' },
  usuarios_cpf_key: { campo: 'cpf', mensagem: 'CPF já cadastrado.' },
  categorias_usuario_tipo_nome_uk: { campo: 'nome', mensagem: 'Já existe uma categoria com este nome e tipo.' },
  fontes_destinos_usuario_nome_uk: { campo: 'nome', mensagem: 'Já existe uma fonte/destino com este nome.' },
};

/**
 * Converte erros de restrição do PostgreSQL em instâncias de `AppError`.
 * @param {Error & { code?: string, constraint?: string }} erro
 * @returns {AppError | null}
 */
function traduzirErroBanco(erro) {
  if (erro.code === '23505') {
    const info = RESTRICOES_UNICAS[erro.constraint];
    if (info) return erros.conflito(info.mensagem, { [info.campo]: info.mensagem });
    return erros.conflito('Registro duplicado.');
  }
  if (erro.code === '23503') {
    return erros.conflito('Operação viola a integridade referencial (existem registros vinculados).');
  }
  if (erro.code === '23514' || erro.code === '22P02' || erro.code === '22007' || erro.code === '22008') {
    return erros.validacao({}, 'Dados inválidos para o banco de dados.');
  }
  return null;
}

/**
 * Envolve um handler assíncrono do Express encaminhando rejeições para `next`.
 * @param {import('express').RequestHandler} fn
 * @returns {import('express').RequestHandler}
 */
const capturar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function rotaNaoEncontrada(req, res, next) {
  next(new AppError(404, `Rota ${req.method} ${req.originalUrl} não encontrada.`));
}

/**
 * Middleware centralizado de tratamento de erros no formato `{ erro, campos }`.
 * @param {Error} erro
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {import('express').Response}
 */
// eslint-disable-next-line no-unused-vars
function tratadorDeErros(erro, req, res, next) {
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.', campos: {} });
  }
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisição muito grande.', campos: {} });
  }
  if (erro.expose && erro.status >= 400 && erro.status < 500) {
    return res.status(erro.status).json({ erro: 'Requisição inválida.', campos: {} });
  }

  let appErro = erro instanceof AppError ? erro : traduzirErroBanco(erro);

  if (!appErro) {
    console.error(erro);
    appErro = new AppError(500, 'Erro interno do servidor.');
  }

  return res.status(appErro.status).json({ erro: appErro.message, campos: appErro.campos || {} });
}

module.exports = { AppError, erros, capturar, tratadorDeErros, rotaNaoEncontrada };
