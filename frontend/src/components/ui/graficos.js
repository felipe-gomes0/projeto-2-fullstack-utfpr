import { moeda } from '../../services/formatadores';

export const CORES = ['#0f766e', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#65a30d', '#db2777', '#4b5563', '#ca8a04'];
export const COR_ENTRADA = '#15803d';
export const COR_SAIDA = '#b91c1c';
export const COR_NEUTRA = '#64748b';

/**
 * Formata valores monetários de forma compacta para eixos de gráficos (ex.: `1500` → `"R$ 1,5 mil"`).
 * @param {number} valor
 * @returns {string}
 */
export function moedaCompacta(valor) {
  const abs = Math.abs(valor);
  if (abs >= 1000000) return `R$ ${(valor / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1000) return `R$ ${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${valor.toLocaleString('pt-BR')}`;
}

export const tooltipMoeda = (valor) => moeda(valor);
