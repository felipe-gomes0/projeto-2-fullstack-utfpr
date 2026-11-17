// Redireciona para /login quando não há usuário autenticado
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Carregando } from '../ui/Estados';

export default function RotaProtegida() {
  const { autenticado, verificando } = useAuth();
  const local = useLocation();

  if (verificando) return <div className="tela-cheia"><Carregando texto="Verificando sessão..." /></div>;
  if (!autenticado) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  return <Outlet />;
}

/** Para login/cadastro: se já estiver logado, vai para o dashboard */
export function RotaPublica() {
  const { autenticado } = useAuth();
  if (autenticado) return <Navigate to="/" replace />;
  return <Outlet />;
}
