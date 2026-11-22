const { query } = require('../config/db');

/**
 * Retorna totais agrupados por categoria no período atual e no período anterior.
 * @param {number} usuarioId
 * @param {{ inicio: string, fim: string }} periodo
 * @param {{ inicio: string, fim: string }} anterior
 * @returns {Promise<Array<Object>>}
 */
async function totaisPorCategoria(usuarioId, periodo, anterior) {
  const { rows } = await query(
    `SELECT c.id, c.nome, c.tipo,
            COALESCE(SUM(l.valor_centavos) FILTER (WHERE l.data BETWEEN $2 AND $3), 0) AS total,
            COUNT(l.id)                    FILTER (WHERE l.data BETWEEN $2 AND $3)      AS quantidade,
            COALESCE(SUM(l.valor_centavos) FILTER (WHERE l.data BETWEEN $4 AND $5), 0) AS total_anterior
       FROM categorias c
       LEFT JOIN lancamentos l
              ON l.categoria_id = c.id
             AND l.usuario_id = c.usuario_id
             AND l.data BETWEEN $4 AND $3
      WHERE c.usuario_id = $1
      GROUP BY c.id, c.nome, c.tipo
      ORDER BY total DESC, c.nome`,
    [usuarioId, periodo.inicio, periodo.fim, anterior.inicio, anterior.fim],
  );
  return rows;
}

/**
 * Retorna entradas, saídas no período e saldo acumulado até o fim do período por fonte/destino.
 * @param {number} usuarioId
 * @param {{ inicio: string, fim: string }} periodo
 * @returns {Promise<Array<Object>>}
 */
async function totaisPorFonteDestino(usuarioId, periodo) {
  const { rows } = await query(
    `SELECT f.id, f.nome, f.tipo,
            COALESCE(SUM(l.valor_centavos) FILTER (WHERE l.tipo = 'entrada' AND l.data >= $2), 0) AS entradas,
            COALESCE(SUM(l.valor_centavos) FILTER (WHERE l.tipo = 'saida'   AND l.data >= $2), 0) AS saidas,
            COUNT(l.id) FILTER (WHERE l.data >= $2) AS quantidade,
            COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos ELSE -l.valor_centavos END), 0) AS saldo_acumulado
       FROM fontes_destinos f
       LEFT JOIN lancamentos l
              ON l.fonte_destino_id = f.id
             AND l.usuario_id = f.usuario_id
             AND l.data <= $3
      WHERE f.usuario_id = $1
      GROUP BY f.id, f.nome, f.tipo
      ORDER BY f.tipo, f.nome`,
    [usuarioId, periodo.inicio, periodo.fim],
  );
  return rows;
}

/**
 * Lista os cartões de crédito do usuário.
 * @param {number} usuarioId
 * @returns {Promise<Array<Object>>}
 */
async function cartoes(usuarioId) {
  const { rows } = await query(
    `SELECT id, nome, dia_fechamento, dia_vencimento, limite_centavos
       FROM fontes_destinos
      WHERE usuario_id = $1 AND tipo = 'cartao_credito'
      ORDER BY nome`,
    [usuarioId],
  );
  return rows;
}

/**
 * Lista todos os lançamentos vinculados a cartões de crédito do usuário.
 * @param {number} usuarioId
 * @returns {Promise<Array<Object>>}
 */
async function lancamentosDeCartoes(usuarioId) {
  const { rows } = await query(
    `SELECT l.id, l.tipo, l.descricao, l.valor_centavos, l.data, l.data_compra,
            l.parcela_atual, l.total_parcelas, l.grupo_parcelamento,
            l.fonte_destino_id, c.nome AS categoria_nome
       FROM lancamentos l
       JOIN fontes_destinos f ON f.id = l.fonte_destino_id AND f.tipo = 'cartao_credito'
       JOIN categorias c      ON c.id = l.categoria_id
      WHERE l.usuario_id = $1
      ORDER BY l.data_compra, l.id`,
    [usuarioId],
  );
  return rows;
}

/**
 * Agrupa entradas, saídas e saídas parceladas por mês (`AAAA-MM`).
 * @param {number} usuarioId
 * @param {string} inicio Data inicial (`AAAA-MM-DD`).
 * @param {string} fim Data final (`AAAA-MM-DD`).
 * @returns {Promise<Array<Object>>}
 */
async function totaisMensais(usuarioId, inicio, fim) {
  const { rows } = await query(
    `SELECT to_char(l.data, 'YYYY-MM') AS mes,
            COALESCE(SUM(l.valor_centavos) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(l.valor_centavos) FILTER (WHERE l.tipo = 'saida'), 0)   AS saidas,
            COALESCE(SUM(l.valor_centavos) FILTER (WHERE l.tipo = 'saida' AND l.total_parcelas > 1), 0) AS saidas_parceladas
       FROM lancamentos l
      WHERE l.usuario_id = $1 AND l.data BETWEEN $2 AND $3
      GROUP BY 1
      ORDER BY 1`,
    [usuarioId, inicio, fim],
  );
  return rows;
}

/**
 * Agrupa saídas por categoria e mês (`AAAA-MM`).
 * @param {number} usuarioId
 * @param {string} inicio Data inicial (`AAAA-MM-DD`).
 * @param {string} fim Data final (`AAAA-MM-DD`).
 * @returns {Promise<Array<Object>>}
 */
async function saidasPorCategoriaMensal(usuarioId, inicio, fim) {
  const { rows } = await query(
    `SELECT to_char(l.data, 'YYYY-MM') AS mes, c.id AS categoria_id, c.nome AS categoria_nome,
            SUM(l.valor_centavos) AS total
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1 AND l.tipo = 'saida' AND l.data BETWEEN $2 AND $3
      GROUP BY 1, 2, 3
      ORDER BY 1, 4 DESC`,
    [usuarioId, inicio, fim],
  );
  return rows;
}

/**
 * Calcula o saldo acumulado (entradas menos saídas) até uma data.
 * @param {number} usuarioId
 * @param {string} ate Data limite (`AAAA-MM-DD`).
 * @returns {Promise<number>} Saldo em centavos.
 */
async function saldoAcumulado(usuarioId, ate) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor_centavos ELSE -valor_centavos END), 0) AS saldo
       FROM lancamentos
      WHERE usuario_id = $1 AND data <= $2`,
    [usuarioId, ate],
  );
  return rows[0].saldo;
}

/**
 * Agrupa por mês as parcelas futuras já contratadas após uma data.
 * @param {number} usuarioId
 * @param {string} apos Data de corte (`AAAA-MM-DD`).
 * @returns {Promise<Array<Object>>}
 */
async function parcelasFuturasPorMes(usuarioId, apos) {
  const { rows } = await query(
    `SELECT to_char(data, 'YYYY-MM') AS mes, SUM(valor_centavos) AS total, COUNT(*) AS quantidade
       FROM lancamentos
      WHERE usuario_id = $1 AND tipo = 'saida' AND total_parcelas > 1 AND data > $2
      GROUP BY 1
      ORDER BY 1`,
    [usuarioId, apos],
  );
  return rows;
}

module.exports = {
  totaisPorCategoria,
  totaisPorFonteDestino,
  cartoes,
  lancamentosDeCartoes,
  totaisMensais,
  saidasPorCategoriaMensal,
  saldoAcumulado,
  parcelasFuturasPorMes,
};
