const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const { pool } = require('./config/db');
const { autenticar } = require('./middlewares/auth');
const { tratadorDeErros, rotaNaoEncontrada } = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const fonteDestinoRoutes = require('./routes/fonteDestinoRoutes');
const lancamentoRoutes = require('./routes/lancamentoRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const saudeRoutes = require('./routes/saudeRoutes');

const app = express();

app.disable('x-powered-by');

app.use(cors({
  origin(origem, callback) {
    if (!origem || config.corsOrigem.includes(origem)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));

app.get('/api/status', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (erro) {
    next(erro);
  }
});

app.use('/api/auth', authRoutes);

app.use('/api/categorias', autenticar, categoriaRoutes);
app.use('/api/fontes-destinos', autenticar, fonteDestinoRoutes);
app.use('/api/lancamentos', autenticar, lancamentoRoutes);
app.use('/api/relatorios', autenticar, relatorioRoutes);
app.use('/api/saude-financeira', autenticar, saudeRoutes);

app.use(rotaNaoEncontrada);
app.use(tratadorDeErros);

if (require.main === module) {
  app.listen(config.porta, () => {
    console.log(`API rodando em http://localhost:${config.porta}/api`);
  });
}

module.exports = app;
