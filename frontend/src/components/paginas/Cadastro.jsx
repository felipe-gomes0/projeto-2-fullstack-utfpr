import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CampoTexto } from '../ui/Campo';
import { AlertaErro } from '../ui/Estados';
import { cpfValido, emailValido, mascaraCpf, senhaValida } from '../../services/formatadores';

const VAZIO = { nome: '', email: '', cpf: '', senha: '', confirmacaoSenha: '' };

function validar(form) {
  const e = {};
  if (form.nome.trim().length < 2) e.nome = 'Informe o nome (mínimo 2 caracteres).';
  if (!form.email.trim()) e.email = 'Informe o e-mail.';
  else if (!emailValido(form.email)) e.email = 'E-mail inválido.';
  if (!form.cpf) e.cpf = 'Informe o CPF.';
  else if (!cpfValido(form.cpf)) e.cpf = 'CPF inválido.';
  if (!senhaValida(form.senha)) e.senha = 'Mínimo 8 caracteres, com letras e números.';
  if (form.confirmacaoSenha !== form.senha) e.confirmacaoSenha = 'A confirmação não confere com a senha.';
  return e;
}

export default function Cadastro() {
  const { cadastrar } = useAuth();
  const navegar = useNavigate();
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);

  const alterar = (campo, transformar = (v) => v) => (e) => {
    setForm({ ...form, [campo]: transformar(e.target.value) });
    setErros({ ...erros, [campo]: undefined });
  };

  async function enviar(e) {
    e.preventDefault();
    const novos = validar(form);
    setErros(novos);
    setErroGeral('');
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      await cadastrar({ ...form, nome: form.nome.trim(), email: form.email.trim() });
      navegar('/', { replace: true });
    } catch (erro) {
      setErros(erro.campos || {});
      setErroGeral(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-auth">
      <div className="auth-painel">
        <div className="auth-marca">
          <span className="logo" aria-hidden="true">↗</span>
          <h1>Finanças</h1>
          <p>Crie sua conta. Já deixamos categorias e uma conta corrente prontas para você começar.</p>
        </div>
        <form className="auth-form" onSubmit={enviar} noValidate>
          <h2>Criar conta</h2>
          <AlertaErro mensagem={erroGeral} />
          <CampoTexto rotulo="Nome" autoComplete="name" value={form.nome} onChange={alterar('nome')} erro={erros.nome} maxLength={120} />
          <CampoTexto rotulo="E-mail" type="email" autoComplete="email" value={form.email} onChange={alterar('email')} erro={erros.email} />
          <CampoTexto rotulo="CPF" inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={alterar('cpf', mascaraCpf)} erro={erros.cpf} />
          <div className="linha-2">
            <CampoTexto rotulo="Senha" type="password" autoComplete="new-password" value={form.senha} onChange={alterar('senha')} erro={erros.senha} ajuda="Mínimo 8 caracteres, com letras e números." />
            <CampoTexto rotulo="Confirmar senha" type="password" autoComplete="new-password" value={form.confirmacaoSenha} onChange={alterar('confirmacaoSenha')} erro={erros.confirmacaoSenha} />
          </div>
          <button type="submit" className="botao botao-primario botao-bloco" disabled={enviando}>
            {enviando ? 'Cadastrando...' : 'Cadastrar'}
          </button>
          <p className="auth-rodape">Já tem conta? <Link to="/login">Entrar</Link></p>
        </form>
      </div>
    </div>
  );
}
