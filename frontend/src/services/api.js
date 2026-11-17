// Cliente HTTP único da aplicação (wrapper de fetch).
// - injeta "Authorization: Bearer <token>" em todas as requisições
// - ao receber 401 em uma requisição autenticada, executa o logout
// - padroniza os erros no formato { status, mensagem, campos }

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

let obterToken = () => null;
let aoNaoAutorizado = () => {};

/** Chamado pelo AuthContext para ligar o cliente ao estado de autenticação */
export function configurarApi(opcoes) {
  obterToken = opcoes.obterToken;
  aoNaoAutorizado = opcoes.aoNaoAutorizado;
}

export class ApiError extends Error {
  constructor(status, mensagem, campos = {}) {
    super(mensagem);
    this.status = status;
    this.campos = campos || {};
  }
}

function montarUrl(caminho, params) {
  const url = new URL(BASE_URL + caminho);
  if (params) {
    Object.entries(params).forEach(([chave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(chave, valor);
    });
  }
  return url.toString();
}

async function requisicao(metodo, caminho, { corpo, params } = {}) {
  const token = obterToken();
  const headers = { Accept: 'application/json' };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(montarUrl(caminho, params), {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique se a API está rodando.');
  }

  if (resposta.status === 204) return null;

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && token) aoNaoAutorizado();
    throw new ApiError(
      resposta.status,
      dados?.erro || `Erro ${resposta.status} ao comunicar com o servidor.`,
      dados?.campos,
    );
  }
  return dados;
}

export const api = {
  get: (caminho, params) => requisicao('GET', caminho, { params }),
  post: (caminho, corpo) => requisicao('POST', caminho, { corpo }),
  put: (caminho, corpo) => requisicao('PUT', caminho, { corpo }),
  delete: (caminho, params) => requisicao('DELETE', caminho, { params }),
};
