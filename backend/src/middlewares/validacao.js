const { erros } = require('./errorHandler');

class Validador {
  constructor() {
    this.campos = {};
  }

  erro(campo, mensagem) {
    if (!this.campos[campo]) this.campos[campo] = mensagem;
    return this;
  }

  get valido() {
    return Object.keys(this.campos).length === 0;
  }

  /**
   * Lança erro HTTP 400 com o mapa de campos inválidos caso exista algum erro registrado.
   * @param {string} [mensagem='Dados inválidos. Verifique os campos.']
   * @throws {import('./errorHandler').AppError}
   */
  verificar(mensagem = 'Dados inválidos. Verifique os campos.') {
    if (!this.valido) throw erros.validacao(this.campos, mensagem);
  }
}

/**
 * Remove espaços excedentes e caracteres de controle.
 * @param {*} valor
 * @returns {string} Texto sanitizado ou string vazia se não for string.
 */
function limparTexto(valor) {
  if (typeof valor !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return valor.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizarEmail(email) {
  return limparTexto(email).toLowerCase();
}

function emailValido(email) {
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function normalizarCpf(cpf) {
  return String(cpf ?? '').replace(/\D/g, '');
}

/**
 * Valida CPF com 11 dígitos numéricos, rejeitando sequências repetidas e conferindo os dígitos verificadores.
 * @param {string} cpf
 * @returns {boolean}
 */
function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split('').map(Number);
  const calcularDv = (quantidade) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i += 1) soma += digitos[i] * (quantidade + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDv(9) === digitos[9] && calcularDv(10) === digitos[10];
}

/**
 * Verifica se a senha possui entre 8 e 72 caracteres, com ao menos uma letra e um número.
 * @param {*} senha
 * @returns {boolean}
 */
function senhaValida(senha) {
  return typeof senha === 'string' && senha.length >= 8 && senha.length <= 72
    && /[A-Za-zÀ-ÿ]/.test(senha) && /\d/.test(senha);
}

/**
 * Converte um valor monetário em centavos inteiros sem aritmética de ponto flutuante.
 * Aceita número (`123.45`) ou string (`"123.45"`, `"123,45"`, `"1.234,56"`, `"R$ 1.234,56"`).
 * @param {number|string|null|undefined} valor
 * @returns {number|null} Valor em centavos ou `null` se inválido.
 */
function paraCentavos(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  let texto;
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null;
    texto = valor.toFixed(2);
    if (Math.abs(valor - Number(texto)) > 1e-9) return null;
  } else if (typeof valor === 'string') {
    texto = valor.replace(/R\$|\s/g, '');
    if (texto.includes(',')) {
      texto = texto.replace(/\./g, '').replace(',', '.');
    }
  } else {
    return null;
  }

  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(texto);
  if (!match) return null;
  const [, sinal, inteiro, decimal = ''] = match;
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(centavos)) return null;
  return sinal === '-' ? -centavos : centavos;
}

/**
 * Converte centavos inteiros para reais (número com duas casas) para serialização na resposta.
 * @param {number|null|undefined} centavos
 * @returns {number}
 */
function paraReais(centavos) {
  return Number(centavos || 0) / 100;
}

function inteiro(valor) {
  if (typeof valor === 'number' && Number.isInteger(valor)) return valor;
  if (typeof valor === 'string' && /^-?\d+$/.test(valor.trim())) return Number(valor.trim());
  return null;
}

/**
 * Converte o parâmetro `:id` da URL para inteiro positivo, lançando HTTP 404 se inválido.
 * @param {string|number} valor
 * @returns {number}
 * @throws {import('./errorHandler').AppError}
 */
function idDaUrl(valor) {
  const id = inteiro(valor);
  if (!id || id <= 0 || id > 2147483647) throw erros.naoEncontrado();
  return id;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Retorna o último dia do mês informado.
 * @param {number} ano
 * @param {number} mes Mês de 1 a 12.
 * @returns {number}
 */
function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Monta uma data `AAAA-MM-DD`, ajustando dias inexistentes para o último dia do mês.
 * Aceita valores de `mes` fora de 1-12 (transbordo de ano).
 * @param {number} ano
 * @param {number} mes
 * @param {number} dia
 * @returns {string}
 */
function criarData(ano, mes, dia) {
  const total = ano * 12 + (mes - 1);
  const a = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const d = Math.min(dia, ultimoDiaDoMes(a, m));
  return `${a}-${pad(m)}-${pad(d)}`;
}

function partes(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return { ano, mes, dia };
}

/**
 * Valida se a string está no formato `AAAA-MM-DD` e corresponde a uma data existente no calendário.
 * @param {*} valor
 * @returns {boolean}
 */
function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const { ano, mes, dia } = partes(valor);
  if (ano < 1900 || ano > 2200 || mes < 1 || mes > 12) return false;
  return dia >= 1 && dia <= ultimoDiaDoMes(ano, mes);
}

function hoje() {
  const agora = new Date();
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

function somarMeses(iso, meses) {
  const { ano, mes, dia } = partes(iso);
  return criarData(ano, mes + meses, dia);
}

function somarDias(iso, dias) {
  const { ano, mes, dia } = partes(iso);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function diferencaEmDias(inicio, fim) {
  const a = partes(inicio);
  const b = partes(fim);
  return Math.round((Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 86400000);
}

function inicioDoMes(iso) {
  const { ano, mes } = partes(iso);
  return `${ano}-${pad(mes)}-01`;
}

function fimDoMes(iso) {
  const { ano, mes } = partes(iso);
  return `${ano}-${pad(mes)}-${pad(ultimoDiaDoMes(ano, mes))}`;
}

/**
 * Lê e valida `?inicio=&fim=` da query string, usando o mês corrente como padrão.
 * @param {{ inicio?: string, fim?: string }} query
 * @returns {{ inicio: string, fim: string }}
 * @throws {import('./errorHandler').AppError} HTTP 400 se as datas forem inválidas, invertidas ou excederem 5 anos.
 */
function periodoDaQuery(query) {
  const v = new Validador();
  const base = hoje();
  const inicio = query.inicio || inicioDoMes(base);
  const fim = query.fim || fimDoMes(base);
  if (!dataValida(inicio)) v.erro('inicio', 'Data inicial inválida (use AAAA-MM-DD).');
  if (!dataValida(fim)) v.erro('fim', 'Data final inválida (use AAAA-MM-DD).');
  if (v.valido && inicio > fim) v.erro('fim', 'A data final deve ser igual ou posterior à inicial.');
  if (v.valido && diferencaEmDias(inicio, fim) > 366 * 5) v.erro('fim', 'Período máximo de 5 anos.');
  v.verificar('Período inválido.');
  return { inicio, fim };
}

module.exports = {
  Validador,
  limparTexto,
  normalizarEmail,
  emailValido,
  normalizarCpf,
  cpfValido,
  senhaValida,
  paraCentavos,
  paraReais,
  inteiro,
  idDaUrl,
  datas: {
    ultimoDiaDoMes,
    criarData,
    partes,
    dataValida,
    hoje,
    somarMeses,
    somarDias,
    diferencaEmDias,
    inicioDoMes,
    fimDoMes,
    periodoDaQuery,
  },
};
