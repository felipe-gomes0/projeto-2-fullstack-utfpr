// Seed: 2 usuários com cartões e ~4 meses de lançamentos (3 meses completos + mês atual),
// incluindo compras parceladas. As datas são relativas à data de hoje, então o seed
// sempre gera dados "recentes".
// Uso: npm run db:seed   (rode antes npm run db:schema)
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const config = require('../src/config/env');
const { pool, query } = require('../src/config/db');
const Usuario = require('../src/models/usuarioModel');
const FonteDestino = require('../src/models/fonteDestinoModel');
const Categoria = require('../src/models/categoriaModel');
const Lancamento = require('../src/models/lancamentoModel');
const { datas } = require('../src/middlewares/validacao');

const SENHA_PADRAO = 'Senha123';

// gerador pseudoaleatório determinístico (mesmo seed => mesmos dados)
function criarAleatorio(semente) {
  let s = semente;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function dividirEmParcelas(total, n) {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + (total - base * n) : base));
}

async function criarUsuario({ nome, email, cpf, cartoes, contas = [] }) {
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, config.bcryptRounds);
  const usuario = await Usuario.criarComPadroes({ nome, email, cpf, senhaHash });

  for (const c of cartoes) {
    await FonteDestino.criar(usuario.id, {
      nome: c.nome, tipo: 'cartao_credito', diaFechamento: c.fechamento, diaVencimento: c.vencimento, limiteCentavos: c.limite,
    });
  }
  for (const nomeConta of contas) {
    await FonteDestino.criar(usuario.id, { nome: nomeConta, tipo: 'conta', diaFechamento: null, diaVencimento: null, limiteCentavos: null });
  }

  const categorias = await Categoria.listar(usuario.id);
  const fontes = await FonteDestino.listar(usuario.id);
  const cat = (nome, tipo) => categorias.find((c) => c.nome === nome && c.tipo === tipo).id;
  const fonte = (nome) => fontes.find((f) => f.nome === nome).id;

  return { usuario, cat, fonte };
}

/** Lança um registro simples ou parcelado (mesma regra da API) */
async function lancar(usuarioId, { tipo, descricao, valor, data, categoriaId, fonteDestinoId, parcelas = 1 }) {
  const grupo = parcelas > 1 ? crypto.randomUUID() : null;
  const linhas = dividirEmParcelas(valor, parcelas).map((valorCentavos, i) => ({
    tipo,
    descricao,
    valorCentavos,
    data: datas.somarMeses(data, i),
    dataCompra: data,
    categoriaId,
    fonteDestinoId,
    grupoParcelamento: grupo,
    parcelaAtual: i + 1,
    totalParcelas: parcelas,
  }));
  await Lancamento.criarLinhas(usuarioId, linhas);
}

/**
 * Gera lançamentos de um usuário para os 3 meses anteriores e o mês atual (até hoje).
 */
async function gerarMovimentacao(ctx, perfil, semente) {
  const { usuario, cat, fonte } = ctx;
  const rand = criarAleatorio(semente);
  const hoje = datas.hoje();
  const inicioMesAtual = datas.inicioDoMes(hoje);
  const varia = (valor, faixa = 0.25) => Math.round(valor * (1 - faixa + rand() * 2 * faixa));

  // saldo inicial (4 meses atrás, fora da base de cálculo dos indicadores)
  await lancar(usuario.id, {
    tipo: 'entrada',
    descricao: 'Saldo inicial',
    valor: perfil.saldoInicial,
    data: datas.somarMeses(inicioMesAtual, -4),
    categoriaId: cat('Outros', 'entrada'),
    fonteDestinoId: fonte(perfil.contaReserva),
  });

  for (let m = -3; m <= 0; m += 1) {
    const inicioMes = datas.somarMeses(inicioMesAtual, m);
    const { ano, mes } = datas.partes(inicioMes);
    const dia = (d) => datas.criarData(ano, mes, d);
    const lancamentos = [];

    // entradas
    lancamentos.push({ tipo: 'entrada', descricao: 'Salário', valor: perfil.salario, data: dia(5), categoriaId: cat('Salário', 'entrada'), fonteDestinoId: fonte('Conta corrente') });
    if (perfil.freela && rand() > 0.4) {
      lancamentos.push({ tipo: 'entrada', descricao: 'Projeto freelance', valor: varia(perfil.freela, 0.4), data: dia(18), categoriaId: cat('Freelance', 'entrada'), fonteDestinoId: fonte('Conta corrente') });
    }
    lancamentos.push({ tipo: 'entrada', descricao: 'Rendimento poupança', valor: varia(3500, 0.3), data: dia(28), categoriaId: cat('Rendimentos', 'entrada'), fonteDestinoId: fonte(perfil.contaReserva) });

    // saídas fixas (conta)
    lancamentos.push({ tipo: 'saida', descricao: 'Aluguel', valor: perfil.aluguel, data: dia(10), categoriaId: cat('Moradia', 'saida'), fonteDestinoId: fonte('Conta corrente') });
    lancamentos.push({ tipo: 'saida', descricao: 'Conta de energia', valor: varia(18000), data: dia(12), categoriaId: cat('Moradia', 'saida'), fonteDestinoId: fonte('Conta corrente') });
    lancamentos.push({ tipo: 'saida', descricao: 'Internet', valor: 9990, data: dia(15), categoriaId: cat('Moradia', 'saida'), fonteDestinoId: fonte('Conta corrente') });
    lancamentos.push({ tipo: 'saida', descricao: 'Plano de saúde', valor: perfil.saude, data: dia(8), categoriaId: cat('Saúde', 'saida'), fonteDestinoId: fonte('Conta corrente') });
    lancamentos.push({ tipo: 'saida', descricao: 'Mensalidade curso', valor: perfil.educacao, data: dia(7), categoriaId: cat('Educação', 'saida'), fonteDestinoId: fonte('Conta corrente') });

    // saídas variáveis (cartão)
    for (const d of [3, 11, 19, 26]) {
      lancamentos.push({ tipo: 'saida', descricao: 'Supermercado', valor: varia(perfil.mercado), data: dia(d), categoriaId: cat('Alimentação', 'saida'), fonteDestinoId: fonte(perfil.cartaoPrincipal) });
    }
    for (const d of [2, 9, 16, 23]) {
      lancamentos.push({ tipo: 'saida', descricao: 'Aplicativo de transporte', valor: varia(3200, 0.5), data: dia(d), categoriaId: cat('Mobilidade', 'saida'), fonteDestinoId: fonte(perfil.cartaoSecundario) });
    }
    lancamentos.push({ tipo: 'saida', descricao: 'Restaurante', valor: varia(14000, 0.4), data: dia(14), categoriaId: cat('Alimentação', 'saida'), fonteDestinoId: fonte(perfil.cartaoSecundario) });
    lancamentos.push({ tipo: 'saida', descricao: 'Cinema e lazer', valor: varia(perfil.lazer, 0.5), data: dia(21), categoriaId: cat('Lazer', 'saida'), fonteDestinoId: fonte(perfil.cartaoPrincipal) });
    lancamentos.push({ tipo: 'saida', descricao: 'Farmácia', valor: varia(8500, 0.5), data: dia(17), categoriaId: cat('Saúde', 'saida'), fonteDestinoId: fonte(perfil.cartaoPrincipal) });
    lancamentos.push({ tipo: 'saida', descricao: 'Combustível', valor: varia(25000, 0.3), data: dia(20), categoriaId: cat('Mobilidade', 'saida'), fonteDestinoId: fonte('Conta corrente') });

    for (const l of lancamentos) {
      if (l.data <= hoje) await lancar(usuario.id, l);
    }
  }

  // compras parceladas (datas no passado; parcelas caem nos meses seguintes)
  for (const p of perfil.parcelados) {
    const data = datas.somarDias(datas.somarMeses(inicioMesAtual, p.mesesAtras), p.dia - 1);
    if (data > hoje) continue;
    await lancar(usuario.id, {
      tipo: 'saida',
      descricao: p.descricao,
      valor: p.valor,
      data,
      categoriaId: cat(p.categoria, 'saida'),
      fonteDestinoId: fonte(p.cartao),
      parcelas: p.parcelas,
    });
  }
}

async function main() {
  const { rows } = await query('SELECT COUNT(*) AS total FROM usuarios');
  if (Number(rows[0].total) > 0) {
    console.log('O banco já possui usuários. Rode "npm run db:reset" para recriar tudo do zero.');
    return;
  }

  // ---- Usuário 1 ----
  const ana = await criarUsuario({
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    cpf: '52998224725',
    cartoes: [
      { nome: 'Nubank', fechamento: 3, vencimento: 10, limite: 500000 },
      { nome: 'Visa Platinum', fechamento: 25, vencimento: 5, limite: 800000 },
    ],
    contas: ['Poupança'],
  });
  await gerarMovimentacao(ana, {
    salario: 650000,
    freela: 120000,
    aluguel: 180000,
    saude: 32000,
    educacao: 45000,
    saldoInicial: 2500000,
    mercado: 38000,
    lazer: 20000,
    contaReserva: 'Poupança',
    cartaoPrincipal: 'Nubank',
    cartaoSecundario: 'Visa Platinum',
    parcelados: [
      { descricao: 'Notebook', valor: 429990, parcelas: 10, mesesAtras: -2, dia: 20, categoria: 'Educação', cartao: 'Visa Platinum' },
      { descricao: 'Fone de ouvido', valor: 10000, parcelas: 3, mesesAtras: -1, dia: 2, categoria: 'Lazer', cartao: 'Nubank' },
      { descricao: 'Geladeira', valor: 359900, parcelas: 12, mesesAtras: -3, dia: 15, categoria: 'Moradia', cartao: 'Nubank' },
      { descricao: 'Passagem aérea', valor: 184750, parcelas: 6, mesesAtras: 0, dia: 1, categoria: 'Lazer', cartao: 'Visa Platinum' },
    ],
  }, 42);

  // ---- Usuário 2 ----
  const bruno = await criarUsuario({
    nome: 'Bruno Lima',
    email: 'bruno@exemplo.com',
    cpf: '11144477735',
    cartoes: [
      { nome: 'Mastercard Black', fechamento: 31, vencimento: 8, limite: 1200000 },
    ],
    contas: ['Investimentos'],
  });
  await gerarMovimentacao(bruno, {
    salario: 420000,
    freela: 0,
    aluguel: 150000,
    saude: 25000,
    educacao: 30000,
    saldoInicial: 300000,
    mercado: 45000,
    lazer: 45000,
    contaReserva: 'Investimentos',
    cartaoPrincipal: 'Mastercard Black',
    cartaoSecundario: 'Mastercard Black',
    parcelados: [
      { descricao: 'Smart TV', valor: 279900, parcelas: 10, mesesAtras: -1, dia: 28, categoria: 'Lazer', cartao: 'Mastercard Black' },
      { descricao: 'Celular', valor: 489900, parcelas: 12, mesesAtras: -2, dia: 10, categoria: 'Outros', cartao: 'Mastercard Black' },
    ],
  }, 7);

  const { rows: resumo } = await query(
    `SELECT u.email, COUNT(l.id) AS lancamentos
       FROM usuarios u LEFT JOIN lancamentos l ON l.usuario_id = u.id
      GROUP BY u.email ORDER BY u.email`,
  );
  console.log('Seed concluído:');
  for (const r of resumo) console.log(`  ${r.email}  (senha: ${SENHA_PADRAO})  -> ${r.lancamentos} lançamentos`);
}

main()
  .catch((erro) => {
    console.error('Falha no seed:', erro);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
