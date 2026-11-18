import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import RotaProtegida, { RotaPublica } from './components/layout/RotaProtegida';
import Login from './components/paginas/Login';
import Cadastro from './components/paginas/Cadastro';
import Dashboard from './components/paginas/Dashboard';
import Lancamentos from './components/paginas/Lancamentos';
import Categorias from './components/paginas/Categorias';
import FontesDestinos from './components/paginas/FontesDestinos';
import Relatorios from './components/paginas/Relatorios';
import Faturas from './components/paginas/Faturas';
import SaudeFinanceira from './components/paginas/SaudeFinanceira';

export default function App() {
  return (
    <Routes>
      <Route element={<RotaPublica />}>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
      </Route>

      <Route element={<RotaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/fontes-destinos" element={<FontesDestinos />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/faturas" element={<Faturas />} />
          <Route path="/saude-financeira" element={<SaudeFinanceira />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
