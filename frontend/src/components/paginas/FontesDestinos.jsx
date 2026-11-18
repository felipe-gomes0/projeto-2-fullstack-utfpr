// CRUD de fontes/destinos (renda, conta, cartão de crédito)
import { useState } from 'react';
import { api } from '../../services/api';
import { useRequisicao } from '../../services/useRequisicao';
import { NOMES_TIPO_FONTE, moeda, numeroParaMoeda } from '../../services/formatadores';
import Modal from '../ui/Modal';
import ExcluirComMover from '../ui/ExcluirComMover';
import { CampoMoeda, CampoSelect, CampoTexto } from '../ui/Campo';
import { AlertaErro, AlertaSucesso, Carregando, MensagemErro, Vazio } from '../ui/Estados';

function FonteForm({ inicial, aoSalvar, aoCancelar }) {
  const [form, setForm] = useState({
    nome: inicial?.nome || '',
    tipo: inicial?.tipo || 'conta',
    diaFechamento: inicial?.diaFechamento ? String(inicial.diaFechamento) : '',
    diaVencimento: inicial?.diaVencimento ? String(inicial.diaVencimento) : '',
    limite: inicial?.limite !== null && inicial?.limite !== undefined ? numeroParaMoeda(inicial.limite) : '',
  });
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cartao = form.tipo === 'cartao_credito';

  const alterar = (campo) => (e) => {
    setForm({ ...form, [campo]: e?.target ? e.target.value : e });
    setErros({ ...erros, [campo]: undefined });
  };

  function validar() {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Informe o nome.';
    if (cartao) {
      const dia = (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31 && v !== '';
      if (!dia(form.diaFechamento)) e.diaFechamento = 'Dia entre 1 e 31.';
      if (!dia(form.diaVencimento)) e.diaVencimento = 'Dia entre 1 e 31.';
      if (form.limite === '') e.limite = 'Informe o limite.';
    }
    return e;
  }

  async function enviar(e) {
    e.preventDefault();
    const novos = validar();
    setErros(novos);
    setErroGeral('');
    if (Object.keys(novos).length) return;
    const corpo = { nome: form.nome.trim(), tipo: form.tipo };
    if (cartao) {
      corpo.diaFechamento = Number(form.diaFechamento);
      corpo.diaVencimento = Number(form.diaVencimento);
      corpo.limite = form.limite;
    }
    setEnviando(true);
    try {
      if (inicial) await api.put(`/fontes-destinos/${inicial.id}`, corpo);
      else await api.post('/fontes-destinos', corpo);
      aoSalvar();
    } catch (erro) {
      setErros(erro.campos || {});
      setErroGeral(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="form">
      <AlertaErro mensagem={erroGeral} />
      <CampoTexto rotulo="Nome" value={form.nome} maxLength={60} onChange={alterar('nome')} erro={erros.nome} placeholder="Ex.: Nubank, Conta Itaú, Salário" />
      <CampoSelect rotulo="Tipo" value={form.tipo} onChange={alterar('tipo')} erro={erros.tipo}>
        <option value="conta">Conta</option>
        <option value="renda">Renda</option>
        <option value="cartao_credito">Cartão de crédito</option>
      </CampoSelect>
      {cartao && (
        <>
          <div className="linha-2">
            <CampoTexto rotulo="Dia de fechamento" type="number" min={1} max={31} value={form.diaFechamento} onChange={alterar('diaFechamento')} erro={erros.diaFechamento} />
            <CampoTexto rotulo="Dia de vencimento" type="number" min={1} max={31} value={form.diaVencimento} onChange={alterar('diaVencimento')} erro={erros.diaVencimento} />
          </div>
          <CampoMoeda rotulo="Limite" value={form.limite} onChange={alterar('limite')} erro={erros.limite} />
          <p className="nota">Compras feitas antes do dia de fechamento entram na fatura do mês; no dia do fechamento ou depois, na fatura seguinte.</p>
        </>
      )}
      <div className="acoes-form">
        <button type="button" className="botao botao-secundario" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="botao botao-primario" disabled={enviando}>{enviando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </form>
  );
}

export default function FontesDestinos() {
  const { dados, carregando, erro, recarregar } = useRequisicao(() => api.get('/fontes-destinos'), []);
  const [form, setForm] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [sucesso, setSucesso] = useState('');

  return (
    <section>
      <header className="cabecalho-pagina">
        <div>
          <h1>Fontes e destinos</h1>
          <p className="subtitulo">Contas, rendas e cartões de crédito</p>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => setForm({ inicial: null })}>+ Nova fonte/destino</button>
      </header>

      <AlertaSucesso mensagem={sucesso} />
      <div className="painel">
        {carregando && <Carregando />}
        <MensagemErro erro={erro} aoTentarNovamente={recarregar} />
        {dados && dados.length === 0 && <Vazio titulo="Nenhuma fonte/destino cadastrada." />}
        {dados && dados.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Fechamento</th>
                  <th>Vencimento</th>
                  <th className="num">Limite</th>
                  <th className="num">Lançamentos</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {dados.map((f) => (
                  <tr key={f.id}>
                    <td>{f.nome}</td>
                    <td><span className={`selo selo-${f.tipo}`}>{NOMES_TIPO_FONTE[f.tipo]}</span></td>
                    <td>{f.diaFechamento ? `dia ${f.diaFechamento}` : '—'}</td>
                    <td>{f.diaVencimento ? `dia ${f.diaVencimento}` : '—'}</td>
                    <td className="num">{f.limite !== null ? moeda(f.limite) : '—'}</td>
                    <td className="num">{f.totalLancamentos}</td>
                    <td className="acoes">
                      <button type="button" className="botao-link" onClick={() => setForm({ inicial: f })}>Editar</button>
                      <button type="button" className="botao-link perigo" onClick={() => setExcluindo(f)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal titulo={form?.inicial ? 'Editar fonte/destino' : 'Nova fonte/destino'} aberto={Boolean(form)} aoFechar={() => setForm(null)}>
        {form && (
          <FonteForm
            inicial={form.inicial}
            aoCancelar={() => setForm(null)}
            aoSalvar={() => { setSucesso(form.inicial ? 'Registro atualizado.' : 'Registro criado.'); setForm(null); recarregar(); }}
          />
        )}
      </Modal>

      <ExcluirComMover
        registro={excluindo}
        rotuloEntidade="fonte/destino"
        opcoesDestino={(dados || []).filter((f) => excluindo && f.id !== excluindo.id
          && (excluindo.tipo !== 'cartao_credito' || f.tipo === 'cartao_credito'))}
        aoFechar={() => setExcluindo(null)}
        excluir={async (moverPara) => {
          await api.delete(`/fontes-destinos/${excluindo.id}`, moverPara ? { moverPara } : undefined);
          setSucesso('Registro excluído.');
          setExcluindo(null);
          recarregar();
        }}
      />
    </section>
  );
}
