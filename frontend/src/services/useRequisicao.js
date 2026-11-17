// Hook para carregar dados da API com estados de carregamento e erro
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {Function} buscar função assíncrona que retorna os dados
 * @param {Array} dependencias recarrega quando mudarem
 */
export function useRequisicao(buscar, dependencias = []) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const ultimaChamada = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(async () => {
    const id = ++ultimaChamada.current;
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await buscar();
      if (id === ultimaChamada.current) setDados(resultado);
    } catch (e) {
      if (id === ultimaChamada.current) setErro(e);
    } finally {
      if (id === ultimaChamada.current) setCarregando(false);
    }
  }, dependencias);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { dados, carregando, erro, recarregar, setDados };
}
