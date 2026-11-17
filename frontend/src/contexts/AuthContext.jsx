// Contexto de autenticação: usuário, token e funções login/logout/cadastrar.
// O token é persistido no localStorage para sobreviver ao recarregamento da página.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, configurarApi } from '../services/api';

const CHAVE_TOKEN = 'financas.token';
const CHAVE_USUARIO = 'financas.usuario';

const AuthContext = createContext(null);

/** Lê a data de expiração (exp) do JWT, sem validar assinatura (isso é papel do servidor) */
function expiracaoDoToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function lerArmazenado() {
  try {
    const token = localStorage.getItem(CHAVE_TOKEN);
    const usuario = JSON.parse(localStorage.getItem(CHAVE_USUARIO) || 'null');
    const exp = token ? expiracaoDoToken(token) : null;
    if (!token || (exp && exp <= Date.now())) return { token: null, usuario: null };
    return { token, usuario };
  } catch {
    return { token: null, usuario: null };
  }
}

export function AuthProvider({ children }) {
  const inicial = lerArmazenado();
  const [token, setToken] = useState(inicial.token);
  const [usuario, setUsuario] = useState(inicial.usuario);
  const [verificando, setVerificando] = useState(Boolean(inicial.token));
  const [aviso, setAviso] = useState(null);
  const tokenRef = useRef(inicial.token);

  const salvarSessao = useCallback((novoToken, novoUsuario) => {
    tokenRef.current = novoToken;
    setToken(novoToken);
    setUsuario(novoUsuario);
    localStorage.setItem(CHAVE_TOKEN, novoToken);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(novoUsuario));
  }, []);

  /** Logout: o front apenas descarta o token */
  const logout = useCallback((mensagem = null) => {
    tokenRef.current = null;
    setToken(null);
    setUsuario(null);
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
    setAviso(mensagem);
  }, []);

  // liga o cliente HTTP ao contexto (token atual + logout automático no 401).
  // Feito durante o render (e não em useEffect) para valer antes dos efeitos dos componentes filhos.
  configurarApi({
    obterToken: () => tokenRef.current,
    aoNaoAutorizado: () => logout('Sua sessão expirou. Entre novamente.'),
  });

  // ao recarregar a página, confirma o token com o servidor
  useEffect(() => {
    if (!inicial.token) return;
    api.get('/auth/me')
      .then(({ usuario: u }) => {
        setUsuario(u);
        localStorage.setItem(CHAVE_USUARIO, JSON.stringify(u));
      })
      .catch(() => {})
      .finally(() => setVerificando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // logout automático quando o token expirar
  useEffect(() => {
    if (!token) return undefined;
    const exp = expiracaoDoToken(token);
    if (!exp) return undefined;
    const ms = exp - Date.now();
    const timer = setTimeout(() => logout('Sua sessão expirou. Entre novamente.'), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    return () => clearTimeout(timer);
  }, [token, logout]);

  const login = useCallback(async (email, senha) => {
    const resposta = await api.post('/auth/login', { email, senha });
    setAviso(null);
    salvarSessao(resposta.token, resposta.usuario);
    return resposta.usuario;
  }, [salvarSessao]);

  const cadastrar = useCallback(async (dados) => {
    const resposta = await api.post('/auth/cadastro', dados);
    setAviso(null);
    salvarSessao(resposta.token, resposta.usuario);
    return resposta.usuario;
  }, [salvarSessao]);

  const valor = useMemo(() => ({
    usuario,
    token,
    autenticado: Boolean(token),
    verificando,
    aviso,
    login,
    logout,
    cadastrar,
  }), [usuario, token, verificando, aviso, login, logout, cadastrar]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
