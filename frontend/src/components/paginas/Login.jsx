import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CampoTexto } from '../ui/Campo';
import { AlertaErro } from '../ui/Estados';
import { emailValido } from '../../services/formatadores';

export default function Login() {
  const { login, aviso } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);

  const alterar = (campo) => (e) => {
    setForm({ ...form, [campo]: e.target.value });
    setErros({ ...erros, [campo]: undefined });
  };

  async function enviar(e) {
    e.preventDefault();
    const novos = {};
    if (!form.email.trim()) novos.email = 'Informe o e-mail.';
    else if (!emailValido(form.email)) novos.email = 'E-mail inválido.';
    if (!form.senha) novos.senha = 'Informe a senha.';
    setErros(novos);
    setErroGeral('');
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      await login(form.email.trim(), form.senha);
      navegar(local.state?.de || '/', { replace: true });
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
          <p>Controle seus gastos, cartões e faturas em um só lugar.</p>
        </div>
        <form className="auth-form" onSubmit={enviar} noValidate>
          <h2>Entrar</h2>
          {aviso && <div className="alerta alerta-aviso">{aviso}</div>}
          <AlertaErro mensagem={erroGeral} />
          <CampoTexto rotulo="E-mail" type="email" autoComplete="email" value={form.email} onChange={alterar('email')} erro={erros.email} />
          <CampoTexto rotulo="Senha" type="password" autoComplete="current-password" value={form.senha} onChange={alterar('senha')} erro={erros.senha} />
          <button type="submit" className="botao botao-primario botao-bloco" disabled={enviando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
          <p className="auth-rodape">Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
        </form>
      </div>
    </div>
  );
}
