const { query, transacao } = require('../config/db');

const SELECT_BASE = `
  SELECT l.id, l.tipo, l.descricao, l.valor_centavos, l.data, l.data_compra,
         l.categoria_id, c.nome AS categoria_nome,
         l.fonte_destino_id, f.nome AS fonte_destino_nome, f.tipo AS fonte_destino_tipo,
         l.grupo_parcelamento, l.parcela_atual, l.total_parcelas,
         l.criado_em, l.atualizado_em
    FROM lancamentos l
    JOIN categorias c      ON c.id = l.categoria_id
    JOIN fontes_destinos f ON f.id = l.fonte_destino_id`;

/**
 * Monta a cláusula `WHERE` parametrizada a partir dos filtros informados.
 * @param {number} usuarioId
 * @param {{ inicio: string, fim: string, tipo?: string|null, categoriaId?: number|null, fonteDestinoId?: number|null, busca?: string|null }} filtros
 * @returns {{ where: string, params: Array<*> }}
 */
function montarFiltros(usuarioId, filtros) {
  const condicoes = ['l.usuario_id = $1', 'l.data BETWEEN $2 AND $3'];
  const params = [usuarioId, filtros.inicio, filtros.fim];

  const adicionar = (sql, valor) => {
    params.push(valor);
    condicoes.push(sql.replace('?', `$${params.length}`));
  };

  if (filtros.tipo) adicionar('l.tipo = ?', filtros.tipo);
  if (filtros.categoriaId) adicionar('l.categoria_id = ?', filtros.categoriaId);
  if (filtros.fonteDestinoId) adicionar('l.fonte_destino_id = ?', filtros.fonteDestinoId);
  if (filtros.busca) adicionar('l.descricao ILIKE ?', `%${filtros.busca.replace(/[\\%_]/g, '\\$&')}%`);

  return { where: condicoes.join(' AND '), params };
}

/**
 * Lista lançamentos paginados aplicando os filtros e calcula os totais do período filtrado.
 * @param {number} usuarioId
 * @param {Object} filtros
 * @param {{ pagina: number, limite: number }} paginacao
 * @returns {Promise<{ itens: Array<Object>, totais: Object }>}
 */
async function listar(usuarioId, filtros, { pagina, limite }) {
  const { where, params } = montarFiltros(usuarioId, filtros);

  const totaisPromise = query(
    `SELECT COUNT(*) AS quantidade,
            COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor_centavos END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN l.tipo = 'saida'   THEN l.valor_centavos END), 0) AS saidas
       FROM lancamentos l
      WHERE ${where}`,
    params,
  );

  const offset = (pagina - 1) * limite;
  const itensPromise = query(
    `${SELECT_BASE}
      WHERE ${where}
      ORDER BY l.data DESC, l.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limite, offset],
  );

  const [totais, itens] = await Promise.all([totaisPromise, itensPromise]);
  return { itens: itens.rows, totais: totais.rows[0] };
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await query(`${SELECT_BASE} WHERE l.id = $1 AND l.usuario_id = $2`, [id, usuarioId]);
  return rows[0] || null;
}

async function listarDoGrupo(grupo, usuarioId) {
  const { rows } = await query(
    `${SELECT_BASE} WHERE l.grupo_parcelamento = $1 AND l.usuario_id = $2 ORDER BY l.parcela_atual`,
    [grupo, usuarioId],
  );
  return rows;
}

/**
 * Insere um lançamento simples ou todas as parcelas de uma compra parcelada
 * em uma única transação.
 * @param {number} usuarioId
 * @param {Array<Object>} linhas
 * @returns {Promise<Array<Object>>}
 */
async function criarLinhas(usuarioId, linhas) {
  const ids = await transacao(async (client) => {
    const inseridos = [];
    for (const l of linhas) {
      const { rows } = await client.query(
        `INSERT INTO lancamentos
           (usuario_id, tipo, descricao, valor_centavos, data, data_compra,
            categoria_id, fonte_destino_id, grupo_parcelamento, parcela_atual, total_parcelas)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [usuarioId, l.tipo, l.descricao, l.valorCentavos, l.data, l.dataCompra,
          l.categoriaId, l.fonteDestinoId, l.grupoParcelamento, l.parcelaAtual, l.totalParcelas],
      );
      inseridos.push(rows[0].id);
    }
    return inseridos;
  });

  const { rows } = await query(
    `${SELECT_BASE} WHERE l.id = ANY($1::int[]) AND l.usuario_id = $2 ORDER BY l.parcela_atual`,
    [ids, usuarioId],
  );
  return rows;
}

async function atualizar(id, usuarioId, dados) {
  const { rowCount } = await query(
    `UPDATE lancamentos
        SET tipo = $1, descricao = $2, valor_centavos = $3, data = $4, data_compra = $5,
            categoria_id = $6, fonte_destino_id = $7, atualizado_em = now()
      WHERE id = $8 AND usuario_id = $9`,
    [dados.tipo, dados.descricao, dados.valorCentavos, dados.data, dados.dataCompra,
      dados.categoriaId, dados.fonteDestinoId, id, usuarioId],
  );
  return rowCount > 0 ? buscarPorId(id, usuarioId) : null;
}

async function excluir(id, usuarioId) {
  const { rowCount } = await query('DELETE FROM lancamentos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rowCount;
}

async function excluirGrupo(grupo, usuarioId) {
  const { rowCount } = await query(
    'DELETE FROM lancamentos WHERE grupo_parcelamento = $1 AND usuario_id = $2',
    [grupo, usuarioId],
  );
  return rowCount;
}

module.exports = { listar, buscarPorId, listarDoGrupo, criarLinhas, atualizar, excluir, excluirGrupo };
