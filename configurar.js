/**
 * Prepara o ambiente local: cria backend/.env, frontend/.env e o .env da raiz.
 * Escolhe portas livres a partir das padrão (API 3001, banco 5432, front-end 5173)
 * e gera um JWT_SECRET aleatório. Arquivos que já existem não são sobrescritos,
 * a menos que seja usado --forcar.
 *
 * Uso: node configurar.js [--forcar]
 */
const fs = require('fs');
const net = require('net');
const path = require('path');
const crypto = require('crypto');

const raiz = __dirname;
const forcar = process.argv.includes('--forcar');

function conecta(porta, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: porta, host });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

function consegueEscutar(porta) {
  return new Promise((resolve) => {
    const servidor = net.createServer();
    servidor.once('error', () => resolve(false));
    servidor.listen({ port: porta, host: '0.0.0.0', exclusive: true }, () => servidor.close(() => resolve(true)));
  });
}

async function portaLivre(inicial, reservadas) {
  for (let porta = inicial; porta < inicial + 100; porta += 1) {
    if (reservadas.includes(porta)) continue;
    const ocupada = (await conecta(porta, '127.0.0.1')) || (await conecta(porta, '::1')) || !(await consegueEscutar(porta));
    if (!ocupada) return porta;
  }
  throw new Error(`Nenhuma porta livre encontrada a partir de ${inicial}.`);
}

function lerEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return {};
  return Object.fromEntries(
    fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)
      .map((linha) => linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
      .filter(Boolean)
      .map(([, chave, valor]) => [chave, valor.trim()]),
  );
}

function preencher(exemplo, valores) {
  return fs.readFileSync(exemplo, 'utf8').replace(/^([A-Z0-9_]+)=.*$/gm, (linha, chave) => (
    chave in valores ? `${chave}=${valores[chave]}` : linha
  ));
}

async function main() {
  const backendEnv = path.join(raiz, 'backend', '.env');
  const frontendEnv = path.join(raiz, 'frontend', '.env');
  const raizEnv = path.join(raiz, '.env');
  const criarBackend = forcar || !fs.existsSync(backendEnv);
  const criarFrontend = forcar || !fs.existsSync(frontendEnv);

  const atualBackend = lerEnv(backendEnv);
  const atualFrontend = lerEnv(frontendEnv);
  const reservadas = [];
  const escolher = async (padrao) => {
    const porta = await portaLivre(padrao, reservadas);
    reservadas.push(porta);
    return porta;
  };

  const portaApi = criarBackend ? await escolher(3001) : Number(atualBackend.PORT) || 3001;
  const portaBanco = criarBackend ? await escolher(5432) : Number(atualBackend.DB_PORT) || 5432;
  const portaFront = criarFrontend ? await escolher(5173) : Number(atualFrontend.FRONTEND_PORT) || 5173;

  if (criarBackend) {
    fs.writeFileSync(backendEnv, preencher(path.join(raiz, 'backend', '.env.example'), {
      PORT: portaApi,
      DB_PORT: portaBanco,
      JWT_SECRET: crypto.randomBytes(48).toString('hex'),
      CORS_ORIGIN: `http://localhost:${portaFront}`,
    }));
    console.log(`backend/.env criado (API ${portaApi}, banco ${portaBanco}).`);
  } else {
    console.log('backend/.env já existe, mantido.');
  }

  if (criarFrontend) {
    fs.writeFileSync(frontendEnv, preencher(path.join(raiz, 'frontend', '.env.example'), {
      FRONTEND_PORT: portaFront,
      VITE_API_URL: `http://localhost:${portaApi}/api`,
    }));
    console.log(`frontend/.env criado (front-end ${portaFront}).`);
  } else {
    console.log('frontend/.env já existe, mantido.');
  }

  const conteudoRaiz = fs.existsSync(raizEnv) ? fs.readFileSync(raizEnv, 'utf8') : '';
  if (!/^COMPOSE_FILE=/m.test(conteudoRaiz)) {
    const separador = conteudoRaiz && !conteudoRaiz.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(raizEnv, `${conteudoRaiz}${separador}# Faz o "docker compose" usar backend/.env e frontend/.env\nCOMPOSE_FILE=docker-compose.env.yml\n`);
    console.log('.env da raiz configurado para o Docker Compose.');
  }

  const final = { ...lerEnv(backendEnv), ...lerEnv(frontendEnv) };
  console.log(`
Pronto. Para subir tudo:  docker compose up --build
  Front-end:  http://localhost:${final.FRONTEND_PORT}
  API:        ${final.VITE_API_URL}
  Banco:      localhost:${final.DB_PORT}`);
}

main().catch((erro) => {
  console.error('Falha ao configurar:', erro.message);
  process.exit(1);
});
