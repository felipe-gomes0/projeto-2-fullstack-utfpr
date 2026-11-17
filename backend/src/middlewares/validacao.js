// Funções de validação, normalização e utilitários de data/dinheiro
// usados pelas rotas (validação e sanitização no servidor).
const { erros } = require('./errorHandler');

/* ------------------------------------------------------------------ */
/* Coletor de erros por campo                                          */
/* ------------------------------------------------------------------ */
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

  /** Lança 400 com o mapa de erros, se houver algum */
  verificar(mensagem = 'Dados inválidos. Verifique os campos.') {
    if (!this.valido) throw erros.validacao(this.campos, mensagem);
  }
}

/* ------------------------------------------------------------------ */
/* Texto                                                              */
/* ------------------------------------------------------------------ */
/** Remove espaços extras e caracteres de controle. Retorna '' se não for string. */
function limparTexto(valor) {
  if (typeof valor !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return valor.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* E-mail                                                             */
/* ------------------------------------------------------------------ */
function normalizarEmail(email) {
  return limparTexto(email).toLowerCase();
}

function emailValido(email) {
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/* ------------------------------------------------------------------ */
/* CPF                                                                */
/* ------------------------------------------------------------------ */
function normalizarCpf(cpf) {
  return String(cpf ?? '').replace(/\D/g, '');
}

/** Valida CPF (11 dígitos, não repetidos e dígitos verificadores corretos) */
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

/* ------------------------------------------------------------------ */
/* Senha                                                              */
/* ------------------------------------------------------------------ */
/** Mínimo 8 caracteres, com pelo menos uma letra e um número */
function senhaValida(senha) {
  return typeof senha === 'string' && senha.length >= 8 && senha.length <= 72
    && /[A-Za-zÀ-ÿ]/.test(senha) && /\d/.test(senha);
}

/* ------------------------------------------------------------------ */
/* Dinheiro (sempre em centavos inteiros)                             */
/* ------------------------------------------------------------------ */
/**
 * Converte um valor monetário em centavos inteiros, sem usar aritmética de float.
 * Aceita número (123.45) ou string ("123.45", "123,45", "1.234,56", "R$ 1.234,56").
 * Retorna null se inválido.
 */
function paraCentavos(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  let texto;
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null;
    texto = valor.toFixed(2);
  } else if (typeof valor === 'string') {
    texto = valor.replace(/R\$|\s/g, '');
    if (texto.includes(',')) {
      // formato brasileiro: pontos de milhar e vírgula decimal
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

/** Centavos -> reais (número com 2 casas) apenas para serialização na resposta */
function paraReais(centavos) {
  return Number(centavos || 0) / 100;
}

/* ------------------------------------------------------------------ */
/* Inteiros e ids                                                     */
/* ------------------------------------------------------------------ */
function inteiro(valor) {
  if (typeof valor === 'number' && Number.isInteger(valor)) return valor;
  if (typeof valor === 'string' && /^-?\d+$/.test(valor.trim())) return Number(valor.trim());
  return null;
}

/** Converte :id da URL; ids inválidos geram 404 (não revelam nada sobre outros registros) */
function idDaUrl(valor) {
  const id = inteiro(valor);
  if (!id || id <= 0 || id > 2147483647) throw erros.naoEncontrado();
  return id;
}

/* ------------------------------------------------------------------ */
/* Datas (strings 'AAAA-MM-DD', sem fuso)                              */
/* ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, '0');

function ultimoDiaDoMes(ano, mes) {
  // mes: 1-12
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Monta 'AAAA-MM-DD' ajustando o dia para o último dia do mês, se necessário. mes pode "transbordar". */
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

/** Valida 'AAAA-MM-DD' e confere se a data existe no calendário */
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
 * Lê ?inicio=&fim= da query. Padrão: mês corrente.
 * Lança 400 se as datas forem inválidas ou invertidas.
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
