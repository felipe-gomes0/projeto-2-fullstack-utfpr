const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numeroFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Formata um valor numérico como moeda brasileira (ex.: `1234.5` → `"R$ 1.234,50"`).
 * @param {number|string} valor
 * @returns {string}
 */
export const moeda = (valor) => moedaFmt.format(Number(valor) || 0);

/**
 * Converte uma data ISO `AAAA-MM-DD` para `DD/MM/AAAA` sem conversão de fuso horário.
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function dataBr(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/**
 * Formata uma referência `AAAA-MM` como mês e ano em português (ex.: `"nov/2026"`).
 * @param {string|null|undefined} ref
 * @param {boolean} [longo=false]
 * @returns {string}
 */
export function mesAno(ref, longo = false) {
  if (!ref) return '';
  const [a, m] = ref.split('-').map(Number);
  return `${(longo ? MESES_LONGOS : MESES)[m - 1]}/${a}`;
}

export const percentual = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`);

const pad = (n) => String(n).padStart(2, '0');

export function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Retorna o primeiro e o último dia do mês da referência `AAAA-MM`.
 * @param {string} ref
 * @returns {{ inicio: string, fim: string }}
 */
export function limitesDoMes(ref) {
  const [a, m] = ref.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return { inicio: `${a}-${pad(m)}-01`, fim: `${a}-${pad(m)}-${pad(ultimo)}` };
}

export function mesAtual() {
  return hojeIso().slice(0, 7);
}

export function somarMesesRef(ref, n) {
  const [a, m] = ref.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/**
 * Período amplo (2 anos para trás e ~3 anos para frente, dentro do limite de 5 anos da API),
 * usado para encontrar todos os lançamentos de uma categoria ou fonte/destino, incluindo parcelas futuras.
 * @returns {{ inicio: string, fim: string }}
 */
export function periodoAmplo() {
  const ref = mesAtual();
  return {
    inicio: limitesDoMes(somarMesesRef(ref, -24)).inicio,
    fim: limitesDoMes(somarMesesRef(ref, 35)).fim,
  };
}

/**
 * Aplica máscara de CPF (`000.000.000-00`), aceitando digitação parcial.
 * @param {string} valor
 * @returns {string}
 */
export function mascaraCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Aplica máscara monetária baseada em centavos (ex.: `"123456"` → `"1.234,56"`).
 * @param {string|number} valor
 * @returns {string}
 */
export function mascaraMoeda(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digitos) return '';
  const centavos = Number(digitos.slice(-15));
  return numeroFmt.format(centavos / 100);
}

/**
 * Converte número em reais para texto mascarado (`"1.234,56"`) para preenchimento de formulários.
 * @param {number|string|null|undefined} n
 * @returns {string}
 */
export const numeroParaMoeda = (n) => (n === null || n === undefined || n === '' ? '' : numeroFmt.format(Number(n)));

/**
 * Converte texto monetário mascarado (`"1.234,56"`) em centavos inteiros (`123456`).
 * @param {string} texto
 * @returns {number}
 */
export function moedaParaCentavos(texto) {
  const d = String(texto || '').replace(/\D/g, '');
  return d ? Number(d) : 0;
}

/**
 * Divide um total em centavos em `n` parcelas inteiras, atribuindo eventual resto à primeira parcela.
 * @param {number} totalCentavos
 * @param {number} n
 * @returns {Array<number>}
 */
export function dividirEmParcelas(totalCentavos, n) {
  if (!n || n < 1) return [];
  const base = Math.floor(totalCentavos / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + (totalCentavos - base * n) : base));
}

export function cpfValido(valor) {
  const cpf = String(valor || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dig = cpf.split('').map(Number);
  const dv = (q) => {
    let soma = 0;
    for (let i = 0; i < q; i += 1) soma += dig[i] * (q + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === dig[9] && dv(10) === dig[10];
}

export const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());

export const senhaValida = (s) => typeof s === 'string' && s.length >= 8 && /[A-Za-zÀ-ÿ]/.test(s) && /\d/.test(s);

export const NOMES_TIPO_FONTE = {
  renda: 'Renda',
  conta: 'Conta',
  cartao_credito: 'Cartão de crédito',
};
