import { useState } from 'react';
import { limitesDoMes, mesAno, mesAtual, somarMesesRef } from '../../services/formatadores';

/**
 * Seletor de período com navegação mensal ou intervalo personalizado.
 * @param {Object} props
 * @param {{ inicio: string, fim: string }} props.valor
 * @param {(periodo: { inicio: string, fim: string }) => void} props.aoMudar
 */
export default function Periodo({ valor, aoMudar }) {
  const refDoValor = valor.inicio.slice(0, 7);
  const ehMesInteiro = (() => {
    const l = limitesDoMes(refDoValor);
    return l.inicio === valor.inicio && l.fim === valor.fim;
  })();
  const [personalizado, setPersonalizado] = useState(!ehMesInteiro);

  const irPara = (ref) => aoMudar(limitesDoMes(ref));

  return (
    <div className="periodo">
      {!personalizado ? (
        <div className="periodo-mes">
          <button type="button" className="botao-icone" onClick={() => irPara(somarMesesRef(refDoValor, -1))} aria-label="Mês anterior">‹</button>
          <span className="periodo-rotulo">{mesAno(refDoValor, true)}</span>
          <button type="button" className="botao-icone" onClick={() => irPara(somarMesesRef(refDoValor, 1))} aria-label="Próximo mês">›</button>
          {refDoValor !== mesAtual() && (
            <button type="button" className="botao-link" onClick={() => irPara(mesAtual())}>Mês atual</button>
          )}
        </div>
      ) : (
        <div className="periodo-intervalo">
          <label>
            De
            <input type="date" value={valor.inicio} max={valor.fim} onChange={(e) => e.target.value && aoMudar({ ...valor, inicio: e.target.value })} />
          </label>
          <label>
            até
            <input type="date" value={valor.fim} min={valor.inicio} onChange={(e) => e.target.value && aoMudar({ ...valor, fim: e.target.value })} />
          </label>
        </div>
      )}
      <button
        type="button"
        className="botao-link"
        onClick={() => {
          if (personalizado) irPara(refDoValor);
          setPersonalizado(!personalizado);
        }}
      >
        {personalizado ? 'Navegar por mês' : 'Período personalizado'}
      </button>
    </div>
  );
}
