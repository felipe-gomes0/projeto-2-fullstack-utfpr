require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function garantirBanco() {
  const admin = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [process.env.DB_NAME]);
    if (rowCount === 0) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(process.env.DB_NAME)) throw new Error('DB_NAME inválido');
      await admin.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`Banco "${process.env.DB_NAME}" criado.`);
    }
  } finally {
    await admin.end();
  }
}

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('Informe o arquivo .sql. Ex.: node database/executar-sql.js database/schema.sql');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(arquivo), 'utf8');

  await garantirBanco();

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`Script ${arquivo} executado com sucesso.`);
  } finally {
    await client.end();
  }
}

main().catch((erro) => {
  console.error('Falha ao executar o script SQL:', erro.message);
  process.exit(1);
});
