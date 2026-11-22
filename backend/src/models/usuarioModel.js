const { query, transacao } = require('../config/db');

const CATEGORIAS_PADRAO = [
  { nome: 'Salário', tipo: 'entrada' },
  { nome: 'Freelance', tipo: 'entrada' },
  { nome: 'Rendimentos', tipo: 'entrada' },
  { nome: 'Outros', tipo: 'entrada' },
  { nome: 'Alimentação', tipo: 'saida' },
  { nome: 'Moradia', tipo: 'saida' },
  { nome: 'Saúde', tipo: 'saida' },
  { nome: 'Mobilidade', tipo: 'saida' },
  { nome: 'Lazer', tipo: 'saida' },
  { nome: 'Educação', tipo: 'saida' },
  { nome: 'Outros', tipo: 'saida' },
];

const FONTES_PADRAO = [
  { nome: 'Conta corrente', tipo: 'conta' },
  { nome: 'Salário mensal', tipo: 'renda' },
];

const CAMPOS_PUBLICOS = 'id, nome, email, cpf, criado_em';

/**
 * Verifica quais campos únicos (`email`, `cpf`) já estão em uso.
 * @param {string} email
 * @param {string} cpf
 * @returns {Promise<{ email: boolean, cpf: boolean }>}
 */
async function camposEmUso(email, cpf) {
  const { rows } = await query(
    `SELECT
        EXISTS (SELECT 1 FROM usuarios WHERE email = $1) AS email,
        EXISTS (SELECT 1 FROM usuarios WHERE cpf = $2)   AS cpf`,
    [email, cpf],
  );
  return rows[0];
}

/**
 * Cria o usuário junto com categorias e fontes/destinos padrão em uma única transação.
 * @param {{ nome: string, email: string, cpf: string, senhaHash: string }} dados
 * @returns {Promise<Object>}
 */
async function criarComPadroes({ nome, email, cpf, senhaHash }) {
  return transacao(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO usuarios (nome, email, cpf, senha_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CAMPOS_PUBLICOS}`,
      [nome, email, cpf, senhaHash],
    );
    const usuario = rows[0];

    for (const c of CATEGORIAS_PADRAO) {
      await client.query(
        'INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3)',
        [usuario.id, c.nome, c.tipo],
      );
    }
    for (const f of FONTES_PADRAO) {
      await client.query(
        'INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, $2, $3)',
        [usuario.id, f.nome, f.tipo],
      );
    }
    return usuario;
  });
}

/**
 * Busca o usuário por e-mail incluindo `senha_hash` exclusivamente para verificação de login.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function buscarParaLogin(email) {
  const { rows } = await query(
    'SELECT id, nome, email, cpf, senha_hash FROM usuarios WHERE email = $1',
    [email],
  );
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await query(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] || null;
}

module.exports = {
  CATEGORIAS_PADRAO,
  FONTES_PADRAO,
  camposEmUso,
  criarComPadroes,
  buscarParaLogin,
  buscarPorId,
};
