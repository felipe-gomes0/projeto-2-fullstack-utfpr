// Testes das regras de fatura e parcelamento (node --test)
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_USER = process.env.DB_USER || 'teste';
process.env.DB_NAME = process.env.DB_NAME || 'teste';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste';

const test = require('node:test');
const assert = require('node:assert');
const { calcularFatura } = require('../src/models/fatura');
const { dividirEmParcelas } = require('../src/routes/lancamentoRoutes');
const { cpfValido, paraCentavos, datas } = require('../src/middlewares/validacao');

test('Nubank (fecha 3, vence 10): compra antes do fechamento entra na fatura do mês', () => {
  assert.deepStrictEqual(calcularFatura('2026-11-02', 3, 10), {
    referencia: '2026-11', fechamento: '2026-11-03', vencimento: '2026-11-10',
  });
});

test('Nubank: compra no dia do fechamento vai para o mês seguinte', () => {
  assert.strictEqual(calcularFatura('2026-11-03', 3, 10).referencia, '2026-12');
});

test('Visa (fecha 25, vence 5): compra em 28/12 cai na fatura 02/2027', () => {
  assert.deepStrictEqual(calcularFatura('2026-12-28', 25, 5), {
    referencia: '2027-02', fechamento: '2027-01-25', vencimento: '2027-02-05',
  });
});

test('Visa: parcela 3/3 de compra em 20/12/2026 cai na fatura 03/2027', () => {
  assert.deepStrictEqual(calcularFatura('2026-12-20', 25, 5, 3), {
    referencia: '2027-03', fechamento: '2027-02-25', vencimento: '2027-03-05',
  });
});

test('dias inexistentes são ajustados para o último dia do mês', () => {
  // fecha dia 31, vence dia 8: em fevereiro o fechamento vira dia 28
  assert.deepStrictEqual(calcularFatura('2027-02-10', 31, 8), {
    referencia: '2027-03', fechamento: '2027-02-28', vencimento: '2027-03-08',
  });
  // compra em 28/02 (= dia do fechamento ajustado) vai para a fatura seguinte
  assert.strictEqual(calcularFatura('2027-02-28', 31, 8).fechamento, '2027-03-31');
  assert.strictEqual(datas.somarMeses('2027-01-31', 1), '2027-02-28');
});

test('parcelamento: diferença de arredondamento na primeira parcela', () => {
  assert.deepStrictEqual(dividirEmParcelas(10000, 3), [3334, 3333, 3333]);
  assert.strictEqual(dividirEmParcelas(429990, 10).reduce((a, b) => a + b, 0), 429990);
});

test('CPF e valores monetários', () => {
  assert.ok(cpfValido('52998224725'));
  assert.ok(!cpfValido('52998224724'));
  assert.ok(!cpfValido('11111111111'));
  assert.strictEqual(paraCentavos('1.234,56'), 123456);
  assert.strictEqual(paraCentavos(0.1 + 0.2), 30);
  assert.strictEqual(paraCentavos('12.5'), 1250);
  assert.strictEqual(paraCentavos('abc'), null);
});
