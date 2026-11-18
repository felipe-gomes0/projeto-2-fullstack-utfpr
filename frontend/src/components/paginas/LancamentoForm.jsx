// Formulário de criação/edição de lançamento (com parcelamento no cartão)
import { useMemo, useState } from 'react';
import { api } from '../../services/api';
import {
  dividirEmParcelas, hojeIso, moeda, moedaParaCentavos, numeroParaMoeda,
} from '../../services/formatadores';
import { CampoMoeda, CampoSelect, CampoTexto } from '../ui/Campo';
import { AlertaErro } from '../ui/Estados';

export default function LancamentoForm({ inicial, categorias, fontes, aoSalvar, aoCancelar }) {
  const editando = Boolean(inicial);
  const ehParcela = editando && inicial.totalParcelas > 1;

  const [form, setForm] = useState(() => ({
    tipo: inicial?.tipo || 'saida',
    descricao: inicial?.descricao || '',
    valor: inicial ? numeroParaMoeda(inicial.valor) : '',
    data: inicial?.data || hojeIso(),
    categoriaId: inicial ? String(inicial.categoria.id) : '',
    fonteDestinoId: inicial ? String(inicial.fonteDestino.id) : '',
    totalParcelas: '1',
  }));
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);

  const categoriasDoTipo = categorias.filter((c) => c.tipo === form.tipo);
  const fonteSelecionada = fontes.find((f) => String(f.id) === form.fonteDestinoId);
  const podeParcelar = !editando && form.tipo === 'saida' && fonteSelecionada?.tipo === 'cartao_credito';
  const nParcelas = podeParcelar ? Number(form.totalParcelas) || 1 : 1;

  const previa = useMemo(() => {
    const centavos = moedaParaCentavos(form.valor);
    if (nParcelas <= 1 || !centavos) return null;
    const partes = dividirEmParcelas(centavos, nParcelas);
    return { primeira: partes[0] / 100, demais: partes[1] / 100 };
  }, [form.valor, nParcelas]);

  const alterar = (campo) => (e) => {
    const valor = e?.target ? e.target.value : e;
    const novo = { ...form, [campo]: valor };
    // ao trocar o tipo, a categoria anterior pode deixar de ser compatível
    if (campo === 'tipo') {
      const cat = categorias.find((c) => String(c.id) === form.categoriaId);
      if (cat && cat.tipo !== valor) novo.categoriaId = '';
    }
    setForm(novo);
    setErros({ ...erros, [campo]: undefined });
  };

  function validar() {
    const e = {};
    if (!form.descricao.trim()) e.descricao = 'Informe a descrição.';
    const centavos = moedaParaCentavos(form.valor);
    if (!centavos) e.valor = 'O valor deve ser positivo.';
    if (!form.data) e.data = 'Informe a data.';
    if (!form.categoriaId) e.categoriaId = 'Selecione a categoria.';
    if (!form.fonteDestinoId) e.fonteDestinoId = 'Selecione a fonte/destino.';
    if (nParcelas > 1 && centavos < nParcelas) e.valor = 'Valor insuficiente para o número de parcelas.';
    return e;
  }

  async function enviar(e) {
    e.preventDefault();
    const novos = validar();
    setErros(novos);
    setErroGeral('');
    if (Object.keys(novos).length) return;

    const corpo = {
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor: form.valor, // "1.234,56" -> o servidor converte para centavos
      data: form.data,
      categoriaId: Number(form.categoriaId),
      fonteDestinoId: Number(form.fonteDestinoId),
    };

    setEnviando(true);
    try {
      let resultado;
      if (editando) {
        resultado = await api.put(`/lancamentos/${inicial.id}`, corpo);
      } else {
        resultado = await api.post('/lancamentos', { ...corpo, totalParcelas: nParcelas });
      }
      aoSalvar(resultado);
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
      {ehParcela && (
        <div className="alerta alerta-aviso">
          Parcela {inicial.parcelaAtual} de {inicial.totalParcelas}. Você pode alterar descrição, valor e categoria desta parcela.
          Para mudar data ou cartão, exclua a compra e lance novamente.
        </div>
      )}

      <div className="seletor-tipo" role="radiogroup" aria-label="Tipo">
        {['saida', 'entrada'].map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={form.tipo === t}
            className={`seletor-opcao ${form.tipo === t ? `ativo ativo-${t}` : ''}`}
            onClick={() => alterar('tipo')(t)}
            disabled={ehParcela}
          >
            {t === 'saida' ? 'Saída' : 'Entrada'}
          </button>
        ))}
      </div>
      {erros.tipo && <small className="campo-erro">{erros.tipo}</small>}

      <CampoTexto rotulo="Descrição" value={form.descricao} onChange={alterar('descricao')} erro={erros.descricao} maxLength={200} />

      <div className="linha-2">
        <CampoMoeda rotulo={nParcelas > 1 ? 'Valor total da compra' : 'Valor'} value={form.valor} onChange={alterar('valor')} erro={erros.valor} />
        <CampoTexto rotulo={nParcelas > 1 ? 'Data da compra' : 'Data'} type="date" value={form.data} onChange={alterar('data')} erro={erros.data} disabled={ehParcela} />
      </div>

      <div className="linha-2">
        <CampoSelect rotulo="Categoria" value={form.categoriaId} onChange={alterar('categoriaId')} erro={erros.categoriaId}>
          <option value="">Selecione...</option>
          {categoriasDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </CampoSelect>
        <CampoSelect rotulo={form.tipo === 'entrada' ? 'Fonte' : 'Destino / meio de pagamento'} value={form.fonteDestinoId} onChange={alterar('fonteDestinoId')} erro={erros.fonteDestinoId} disabled={ehParcela}>
          <option value="">Selecione...</option>
          {fontes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}{f.tipo === 'cartao_credito' ? ' (cartão)' : ''}
            </option>
          ))}
        </CampoSelect>
      </div>

      {podeParcelar && (
        <CampoSelect rotulo="Parcelas" value={form.totalParcelas} onChange={alterar('totalParcelas')} erro={erros.totalParcelas}>
          {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>
          ))}
        </CampoSelect>
      )}
      {previa && (
        <p className="nota">
          {nParcelas} parcelas: 1ª de <strong>{moeda(previa.primeira)}</strong>
          {nParcelas > 1 && <> e {nParcelas - 1}× de <strong>{moeda(previa.demais)}</strong></>}.
          Cada parcela cai na fatura do mês seguinte à anterior.
        </p>
      )}

      <div className="acoes-form">
        <button type="button" className="botao botao-secundario" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="botao botao-primario" disabled={enviando}>
          {enviando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
