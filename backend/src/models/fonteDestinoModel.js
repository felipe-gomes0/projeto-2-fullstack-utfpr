const { query, transacao } = require('../config/db');

const SELECT_BASE = `
  SELECT f.id, f.nome, f.tipo, f.dia_fechamento, f.dia_vencimento, f.limite_centavos, f.criado_em,
         (SELECT COUNT(*) FROM lancamentos l WHERE l.fonte_destino_id = f.id AND l.usuario_id = f.usuario_id) AS total_lancamentos
    FROM fontes_destinos f`;

async function listar(usuarioId, tipo) {
  const params = [usuarioId];
  let filtro = '';
  if (tipo) {
    params.push(tipo);
    filtro = ' AND f.tipo = $2';
  }
  const { rows } = await query(
    `${SELECT_BASE} WHERE f.usuario_id = $1${filtro} ORDER BY f.tipo, lower(f.nome)`,
    params,
  );
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await query(`${SELECT_BASE} WHERE f.id = $1 AND f.usuario_id = $2`, [id, usuarioId]);
  return rows[0] || null;
}

async function criar(usuarioId, dados) {
  const { rows } = await query(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite_centavos)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [usuarioId, dados.nome, dados.tipo, dados.diaFechamento, dados.diaVencimento, dados.limiteCentavos],
  );
  return buscarPorId(rows[0].id, usuarioId);
}

async function atualizar(id, usuarioId, dados) {
  const { rowCount } = await query(
    `UPDATE fontes_destinos
        SET nome = $1, tipo = $2, dia_fechamento = $3, dia_vencimento = $4, limite_centavos = $5
      WHERE id = $6 AND usuario_id = $7`,
    [dados.nome, dados.tipo, dados.diaFechamento, dados.diaVencimento, dados.limiteCentavos, id, usuarioId],
  );
  return rowCount > 0 ? buscarPorId(id, usuarioId) : null;
}

/**
 * Exclui a fonte/destino. Se `moverParaId` for informado, move antes os lançamentos
 * para o destino dentro da mesma transação.
 * @param {number} id
 * @param {number} usuarioId
 * @param {number|null} [moverParaId=null]
 * @returns {Promise<boolean>}
 */
async function excluir(id, usuarioId, moverParaId = null) {
  return transacao(async (client) => {
    if (moverParaId) {
      await client.query(
        `UPDATE lancamentos SET fonte_destino_id = $1, atualizado_em = now()
          WHERE fonte_destino_id = $2 AND usuario_id = $3`,
        [moverParaId, id, usuarioId],
      );
    }
    const { rowCount } = await client.query(
      'DELETE FROM fontes_destinos WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId],
    );
    return rowCount > 0;
  });
}

/**
 * Indica se há lançamentos parcelados vinculados a esta fonte/destino.
 * @param {number} id
 * @param {number} usuarioId
 * @returns {Promise<boolean>}
 */
async function possuiParcelados(id, usuarioId) {
  const { rows } = await query(
    `SELECT EXISTS (
        SELECT 1 FROM lancamentos
         WHERE fonte_destino_id = $1 AND usuario_id = $2 AND total_parcelas > 1
     ) AS existe`,
    [id, usuarioId],
  );
  return rows[0].existe;
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir, possuiParcelados };
