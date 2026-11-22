import { moeda } from '../../services/formatadores';

export function CartaoValor({ titulo, valor, tom = 'neutro', detalhe }) {
  return (
    <div className={`cartao-valor tom-${tom}`}>
      <span className="cartao-valor-titulo">{titulo}</span>
      <strong className="cartao-valor-numero">{typeof valor === 'number' ? moeda(valor) : valor}</strong>
      {detalhe && <span className="cartao-valor-detalhe">{detalhe}</span>}
    </div>
  );
}

export default function Resumo({ totais }) {
  if (!totais) return null;
  return (
    <div className="grade-resumo">
      <CartaoValor titulo="Entradas" valor={totais.entradas} tom="positivo" />
      <CartaoValor titulo="Saídas" valor={totais.saidas} tom="negativo" />
      <CartaoValor titulo="Saldo do período" valor={totais.saldo} tom={totais.saldo >= 0 ? 'positivo' : 'negativo'} />
    </div>
  );
}
