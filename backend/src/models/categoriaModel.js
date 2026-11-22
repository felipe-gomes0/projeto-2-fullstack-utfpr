const { query, transacao } = require('../config/db');

const SELECT_BASE = `
  SELECT c.id, c.nome, c.tipo, c.criado_em,
         (SELECT COUNT(*) FROM lancamentos l WHERE l.categoria_id = c.id AND l.usuario_id = c.usuario_id) AS total_lancamentos
    FROM categorias c`;

async function listar(usuarioId, tipo) {
  const params = [usuarioId];
  let filtro = '';
  if (tipo) {
    params.push(tipo);
    filtro = ' AND c.tipo = $2';
  }
  const { rows } = await query(
    `${SELECT_BASE} WHERE c.usuario_id = $1${filtro} ORDER BY c.tipo, lower(c.nome)`,
    params,
  );
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await query(`${SELECT_BASE} WHERE c.id = $1 AND c.usuario_id = $2`, [id, usuarioId]);
  return rows[0] || null;
}

async function criar(usuarioId, { nome, tipo }) {
  const { rows } = await query(
    `INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3)
     RETURNING id, nome, tipo, criado_em, 0::bigint AS total_lancamentos`,
    [usuarioId, nome, tipo],
  );
  return rows[0];
}

async function atualizar(id, usuarioId, { nome, tipo }) {
  const { rowCount } = await query(
    'UPDATE categorias SET nome = $1, tipo = $2 WHERE id = $3 AND usuario_id = $4',
    [nome, tipo, id, usuarioId],
  );
  return rowCount > 0 ? buscarPorId(id, usuarioId) : null;
}

/**
 * Exclui a categoria. Se `moverParaId` for informado, move antes os lançamentos
 * para a categoria de destino dentro da mesma transação.
 * @param {number} id
 * @param {number} usuarioId
 * @param {number|null} [moverParaId=null]
 * @returns {Promise<boolean>}
 */
async function excluir(id, usuarioId, moverParaId = null) {
  return transacao(async (client) => {
    if (moverParaId) {
      await client.query(
        `UPDATE lancamentos SET categoria_id = $1, atualizado_em = now()
          WHERE categoria_id = $2 AND usuario_id = $3`,
        [moverParaId, id, usuarioId],
      );
    }
    const { rowCount } = await client.query(
      'DELETE FROM categorias WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId],
    );
    return rowCount > 0;
  });
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir };
