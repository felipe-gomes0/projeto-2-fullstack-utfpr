// Estrutura das telas autenticadas: menu lateral + conteúdo
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LINKS = [
  { para: '/', rotulo: 'Dashboard', icone: '◧', fim: true },
  { para: '/lancamentos', rotulo: 'Lançamentos', icone: '⇅' },
  { para: '/categorias', rotulo: 'Categorias', icone: '◈' },
  { para: '/fontes-destinos', rotulo: 'Fontes e destinos', icone: '▤' },
  { para: '/relatorios', rotulo: 'Relatórios', icone: '▥' },
  { para: '/faturas', rotulo: 'Faturas', icone: '▭' },
  { para: '/saude-financeira', rotulo: 'Saúde financeira', icone: '♥' },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navegar = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);

  const sair = () => {
    logout();
    navegar('/login', { replace: true });
  };

  return (
    <div className="app">
      <aside className={`menu ${menuAberto ? 'menu-aberto' : ''}`}>
        <div className="menu-marca">
          <span className="logo" aria-hidden="true">↗</span>
          <span>Finanças</span>
        </div>
        <nav className="menu-links" onClick={() => setMenuAberto(false)}>
          {LINKS.map((l) => (
            <NavLink key={l.para} to={l.para} end={l.fim} className={({ isActive }) => (isActive ? 'ativo' : '')}>
              <span className="menu-icone" aria-hidden="true">{l.icone}</span>
              {l.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="menu-usuario">
          <div>
            <strong>{usuario?.nome}</strong>
            <small>{usuario?.email}</small>
          </div>
          <button type="button" className="botao botao-secundario botao-pequeno" onClick={sair}>Sair</button>
        </div>
      </aside>

      <div className="conteudo">
        <header className="barra-mobile">
          <button type="button" className="botao-icone" onClick={() => setMenuAberto(!menuAberto)} aria-label="Abrir menu">☰</button>
          <span>Finanças</span>
        </header>
        <main className="principal">
          <Outlet />
        </main>
      </div>
      {menuAberto && <div className="menu-fundo" onClick={() => setMenuAberto(false)} />}
    </div>
  );
}
