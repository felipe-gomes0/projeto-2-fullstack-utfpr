// Ponto de entrada da API
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const { pool } = require('./config/db');
const { autenticar } = require('./middlewares/auth');
const { tratadorDeErros, rotaNaoEncontrada } = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');

const app = express();

app.disable('x-powered-by');

// CORS restrito à origem do front-end
app.use(cors({
  origin(origem, callback) {
    // requisições sem Origin (curl, Postman) não são afetadas pelo CORS do navegador
    if (!origem || config.corsOrigem.includes(origem)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));

// Healthcheck simples (público)
app.get('/api/status', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (erro) {
    next(erro);
  }
});

// Rotas públicas: cadastro e login (o /me exige token dentro do próprio router)
app.use('/api/auth', authRoutes);

// Todas as demais rotas sob /api exigem token

app.use(rotaNaoEncontrada);
app.use(tratadorDeErros);

if (require.main === module) {
  app.listen(config.porta, () => {
    console.log(`API rodando em http://localhost:${config.porta}/api`);
  });
}

module.exports = app;
