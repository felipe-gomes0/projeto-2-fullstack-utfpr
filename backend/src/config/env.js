// Carrega e valida as variáveis de ambiente (.env)
require('dotenv').config();

const obrigatorias = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
const faltando = obrigatorias.filter((nome) => !process.env[nome]);
if (faltando.length > 0) {
  console.error(`Variáveis de ambiente ausentes: ${faltando.join(', ')}. Copie .env.example para .env.`);
  process.exit(1);
}

module.exports = {
  porta: Number(process.env.PORT) || 3001,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: Number(process.env.DB_POOL_MAX) || 10,
  },
  jwt: {
    segredo: process.env.JWT_SECRET,
    expiraEm: process.env.JWT_EXPIRES_IN || '1h',
  },
  corsOrigem: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
};
