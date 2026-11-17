// Tratamento de erros centralizado.
// Todas as respostas de erro seguem o formato único:
//   { "erro": "mensagem geral", "campos": { "campo": "mensagem do campo" } }

class AppError extends Error {
  /**
   * @param {number} status  código HTTP
   * @param {string} mensagem mensagem geral
   * @param {Object<string,string>} campos erros por campo
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

// Converte violações de restrições do PostgreSQL em respostas amigáveis
const RESTRICOES_UNICAS = {
  usuarios_email_key: { campo: 'email', mensagem: 'E-mail já cadastrado.' },
  usuarios_cpf_key: { campo: 'cpf', mensagem: 'CPF já cadastrado.' },
  categorias_usuario_tipo_nome_uk: { campo: 'nome', mensagem: 'Já existe uma categoria com este nome e tipo.' },
  fontes_destinos_usuario_nome_uk: { campo: 'nome', mensagem: 'Já existe uma fonte/destino com este nome.' },
};

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

// Envolve handlers async para que erros (rejeições) cheguem ao tratador central
const capturar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 404 para rotas inexistentes
function rotaNaoEncontrada(req, res, next) {
  next(new AppError(404, `Rota ${req.method} ${req.originalUrl} não encontrada.`));
}

// eslint-disable-next-line no-unused-vars
function tratadorDeErros(erro, req, res, next) {
  // JSON malformado no corpo
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.', campos: {} });
  }

  let appErro = erro instanceof AppError ? erro : traduzirErroBanco(erro);

  if (!appErro) {
    console.error(erro);
    appErro = new AppError(500, 'Erro interno do servidor.');
  }

  return res.status(appErro.status).json({ erro: appErro.message, campos: appErro.campos || {} });
}

module.exports = { AppError, erros, capturar, tratadorDeErros, rotaNaoEncontrada };
