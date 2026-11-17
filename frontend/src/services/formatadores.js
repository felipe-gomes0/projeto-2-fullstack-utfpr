// Formatação (pt-BR), máscaras e validações do lado do cliente

const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numeroFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 1234.5 -> "R$ 1.234,50" */
export const moeda = (valor) => moedaFmt.format(Number(valor) || 0);

/** '2026-11-03' -> '03/11/2026' (sem conversão de fuso) */
export function dataBr(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** '2026-11' -> 'nov/2026' */
export function mesAno(ref, longo = false) {
  if (!ref) return '';
  const [a, m] = ref.split('-').map(Number);
  return `${(longo ? MESES_LONGOS : MESES)[m - 1]}/${a}`;
}

export const percentual = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`);

/* --------------------------- datas --------------------------- */
const pad = (n) => String(n).padStart(2, '0');

export function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Primeiro e último dia do mês de 'AAAA-MM' */
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

/* --------------------------- máscaras --------------------------- */
/** "52998224725" -> "529.982.247-25" (aceita digitação parcial) */
export function mascaraCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Máscara de moeda baseada em centavos: "123456" -> "1.234,56" */
export function mascaraMoeda(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digitos) return '';
  const centavos = Number(digitos.slice(-15));
  return numeroFmt.format(centavos / 100);
}

/** número em reais -> texto mascarado ("1.234,56") para preencher formulários */
export const numeroParaMoeda = (n) => (n === null || n === undefined || n === '' ? '' : numeroFmt.format(Number(n)));

/** "1.234,56" -> 123456 (centavos inteiros) */
export function moedaParaCentavos(texto) {
  const d = String(texto || '').replace(/\D/g, '');
  return d ? Number(d) : 0;
}

/** Mesma regra do servidor: diferença de arredondamento na 1ª parcela */
export function dividirEmParcelas(totalCentavos, n) {
  if (!n || n < 1) return [];
  const base = Math.floor(totalCentavos / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + (totalCentavos - base * n) : base));
}

/* --------------------------- validações --------------------------- */
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
