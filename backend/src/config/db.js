// Pool de conexões com o PostgreSQL.
// Somente a camada models/ deve importar este arquivo.
const { Pool, types } = require('pg');
const config = require('./env');

// DATE (OID 1082) volta como string 'AAAA-MM-DD' (evita problemas de fuso horário)
types.setTypeParser(1082, (valor) => valor);
// BIGINT (OID 20) e COUNT(*) voltam como número (valores em centavos cabem com folga)
types.setTypeParser(20, (valor) => Number(valor));
// NUMERIC (OID 1700) -> número (usado apenas em resultados de SUM)
types.setTypeParser(1700, (valor) => Number(valor));

const pool = new Pool(config.db);

pool.on('error', (erro) => {
  console.error('Erro inesperado no pool do PostgreSQL:', erro);
});

/**
 * Executa uma consulta parametrizada.
 * @param {string} sql
 * @param {Array} params
 */
function query(sql, params = []) {
  return pool.query(sql, params);
}

/**
 * Executa `fn` dentro de uma transação. `fn` recebe o client da transação.
 * Faz COMMIT se tudo der certo e ROLLBACK em caso de erro.
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
