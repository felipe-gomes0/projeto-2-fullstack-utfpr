const { Pool, types } = require('pg');
const config = require('./env');

types.setTypeParser(1082, (valor) => valor);
types.setTypeParser(20, (valor) => Number(valor));
types.setTypeParser(1700, (valor) => Number(valor));

const pool = new Pool(config.db);

pool.on('error', (erro) => {
  console.error('Erro inesperado no pool do PostgreSQL:', erro);
});

/**
 * Executa uma consulta SQL parametrizada no pool de conexões.
 * @param {string} sql
 * @param {Array<*>} [params=[]]
 * @returns {Promise<import('pg').QueryResult>}
 */
function query(sql, params = []) {
  return pool.query(sql, params);
}

/**
 * Executa uma função dentro de uma transação, aplicando COMMIT em caso de sucesso
 * ou ROLLBACK em caso de erro.
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function transacao(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transacao };
