import { useState } from 'react';
import { api } from '../../services/api';
import { useRequisicao } from '../../services/useRequisicao';
import Modal from '../ui/Modal';
import ExcluirComMover from '../ui/ExcluirComMover';
import { CampoSelect, CampoTexto } from '../ui/Campo';
import { AlertaErro, AlertaSucesso, Carregando, MensagemErro, Vazio } from '../ui/Estados';

function CategoriaForm({ inicial, aoSalvar, aoCancelar }) {
  const [form, setForm] = useState({ nome: inicial?.nome || '', tipo: inicial?.tipo || 'saida' });
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const novos = {};
    if (!form.nome.trim()) novos.nome = 'Informe o nome.';
    setErros(novos);
    setErroGeral('');
    if (Object.keys(novos).length) return;
    setEnviando(true);
    try {
      const corpo = { nome: form.nome.trim(), tipo: form.tipo };
      if (inicial) await api.put(`/categorias/${inicial.id}`, corpo);
      else await api.post('/categorias', corpo);
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
      <CampoTexto rotulo="Nome" value={form.nome} maxLength={60} onChange={(e) => { setForm({ ...form, nome: e.target.value }); setErros({}); }} erro={erros.nome} />
      <CampoSelect
        rotulo="Tipo"
        value={form.tipo}
        onChange={(e) => { setForm({ ...form, tipo: e.target.value }); setErros({}); }}
        erro={erros.tipo}
        ajuda={inicial?.totalLancamentos > 0 ? 'Categorias com lançamentos não podem mudar de tipo.' : undefined}
      >
        <option value="saida">Saída</option>
        <option value="entrada">Entrada</option>
      </CampoSelect>
      <div className="acoes-form">
        <button type="button" className="botao botao-secundario" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="botao botao-primario" disabled={enviando}>{enviando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </form>
  );
}

export default function Categorias() {
  const { dados, carregando, erro, recarregar } = useRequisicao(() => api.get('/categorias'), []);
  const [form, setForm] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [sucesso, setSucesso] = useState('');

  const grupos = [
    { tipo: 'saida', titulo: 'Saídas' },
    { tipo: 'entrada', titulo: 'Entradas' },
  ];

  return (
    <section>
      <header className="cabecalho-pagina">
        <div>
          <h1>Categorias</h1>
          <p className="subtitulo">Organize suas entradas e saídas</p>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => setForm({ inicial: null })}>+ Nova categoria</button>
      </header>

      <AlertaSucesso mensagem={sucesso} />
      {carregando && <Carregando />}
      <MensagemErro erro={erro} aoTentarNovamente={recarregar} />

      {dados && (
        <div className="grade-2">
          {grupos.map((g) => {
            const itens = dados.filter((c) => c.tipo === g.tipo);
            return (
              <div className="painel" key={g.tipo}>
                <h2><span className={`marcador marcador-${g.tipo}`} />{g.titulo}</h2>
                {itens.length === 0 ? <Vazio titulo="Nenhuma categoria." /> : (
                  <table className="tabela">
                    <thead><tr><th>Nome</th><th className="num">Lançamentos</th><th aria-label="Ações" /></tr></thead>
                    <tbody>
                      {itens.map((c) => (
                        <tr key={c.id}>
                          <td>{c.nome}</td>
                          <td className="num">{c.totalLancamentos}</td>
                          <td className="acoes">
                            <button type="button" className="botao-link" onClick={() => setForm({ inicial: c })}>Editar</button>
                            <button type="button" className="botao-link perigo" onClick={() => setExcluindo(c)}>Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal titulo={form?.inicial ? 'Editar categoria' : 'Nova categoria'} aberto={Boolean(form)} aoFechar={() => setForm(null)}>
        {form && (
          <CategoriaForm
            inicial={form.inicial}
            aoCancelar={() => setForm(null)}
            aoSalvar={() => { setSucesso(form.inicial ? 'Categoria atualizada.' : 'Categoria criada.'); setForm(null); recarregar(); }}
          />
        )}
      </Modal>

      <ExcluirComMover
        registro={excluindo}
        rotuloEntidade="categoria"
        opcoesDestino={(dados || []).filter((c) => excluindo && c.tipo === excluindo.tipo && c.id !== excluindo.id)}
        aoFechar={() => setExcluindo(null)}
        excluir={async (moverPara) => {
          await api.delete(`/categorias/${excluindo.id}`, moverPara ? { moverPara } : undefined);
          setSucesso('Categoria excluída.');
          setExcluindo(null);
          recarregar();
        }}
      />
    </section>
  );
}
