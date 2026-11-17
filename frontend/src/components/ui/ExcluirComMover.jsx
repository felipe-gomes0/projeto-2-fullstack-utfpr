// Diálogo de exclusão que, se o registro tiver lançamentos, pede um destino para movê-los
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { AlertaErro } from './Estados';

/**
 * registro: { id, nome, totalLancamentos }
 * opcoesDestino: [{ id, nome }]  (já filtradas: mesmo tipo, exceto o próprio registro)
 * excluir(moverParaId|null) => Promise
 */
export default function ExcluirComMover({ registro, rotuloEntidade, opcoesDestino, excluir, aoFechar }) {
  const [destino, setDestino] = useState('');
  const [erro, setErro] = useState('');
  const [precisaMover, setPrecisaMover] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setDestino('');
    setErro('');
    setPrecisaMover(Boolean(registro?.totalLancamentos > 0));
  }, [registro]);

  if (!registro) return null;

  async function confirmar() {
    if (precisaMover && !destino) {
      setErro('Escolha para onde mover os lançamentos.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await excluir(precisaMover ? Number(destino) : null);
    } catch (e) {
      // 409: o servidor informa que há lançamentos vinculados
      if (e.status === 409 && e.campos?.moverPara) setPrecisaMover(true);
      setErro(e.campos?.moverPara || e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={`Excluir ${rotuloEntidade}`} aberto aoFechar={aoFechar} largura={480}>
      <AlertaErro mensagem={erro} />
      {!precisaMover ? (
        <p className="confirmacao-texto">Tem certeza que deseja excluir <strong>{registro.nome}</strong>?</p>
      ) : (
        <>
          <p className="confirmacao-texto">
            <strong>{registro.nome}</strong> possui {registro.totalLancamentos || 'alguns'} lançamento(s).
            Para excluir, escolha para onde movê-los:
          </p>
          {opcoesDestino.length === 0 ? (
            <p className="nota">Não há outro(a) {rotuloEntidade} compatível. Crie um(a) antes de excluir.</p>
          ) : (
            <div className="campo">
              <label htmlFor="mover-para">Mover lançamentos para</label>
              <select id="mover-para" value={destino} onChange={(e) => setDestino(e.target.value)}>
                <option value="">Selecione...</option>
                {opcoesDestino.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          )}
        </>
      )}
      <div className="acoes-form">
        <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
        <button
          type="button"
          className="botao botao-perigo"
          onClick={confirmar}
          disabled={enviando || (precisaMover && opcoesDestino.length === 0)}
        >
          {precisaMover ? 'Mover e excluir' : 'Excluir'}
        </button>
      </div>
    </Modal>
  );
}
