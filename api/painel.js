import { timingSafeEqual } from 'node:crypto';
import { lerFamilias, alterarFamilias, lerTodasRespostas, apagarRespostas, apagarAberturas, resumoAberturas } from './_lib/dados.js';
import { responder, lerCorpo, linha, aleatorio, slug, codigoValido, CHAVE_AVULSA, espera } from './_lib/util.js';

// Painel dos noivos. Toda chamada precisa do cabeçalho x-chave igual à variável PAINEL_CHAVE.
//   GET  /api/painel                                  convites + respostas + aberturas
//   POST /api/painel {acao: "salvar-familias", familias: [{codigo?, nome, pessoas}]}
//   POST /api/painel {acao: "remover-familia", codigo}
//   POST /api/painel {acao: "remover-resposta", chave}

function autorizado(req) {
  const esperado = Buffer.from(process.env.PAINEL_CHAVE ?? '');
  const recebido = Buffer.from(String(req.headers['x-chave'] ?? ''));
  return esperado.length > 0 && esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

async function montarPainel() {
  const [{ familias }, respostas, aberturas] = await Promise.all([
    lerFamilias({ fresco: true }),
    lerTodasRespostas(),
    resumoAberturas(),
  ]);
  return {
    aberturas,
    familias: Object.entries(familias)
      .map(([codigo, familia]) => ({ codigo, ...familia }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    respostas,
  };
}

function limparFamilia(entrada) {
  const nome = linha(entrada?.nome, 80);
  const vistos = new Set();
  const pessoas = (Array.isArray(entrada?.pessoas) ? entrada.pessoas : [])
    .map((pessoa) => linha(pessoa, 80))
    .filter((pessoa) => pessoa && !vistos.has(pessoa) && vistos.add(pessoa))
    .slice(0, 20);
  if (!nome || !pessoas.length) return null;
  return { codigo: entrada?.codigo ? String(entrada.codigo) : null, nome, pessoas };
}

export default async function handler(req, res) {
  if (!process.env.PAINEL_CHAVE) {
    return responder(res, 503, { erro: 'O painel ainda não tem chave configurada (variável PAINEL_CHAVE).' });
  }
  if (!autorizado(req)) {
    await espera(700);
    return responder(res, 401, { erro: 'Chave incorreta.' });
  }

  try {
    if (req.method === 'GET') return responder(res, 200, await montarPainel());
    if (req.method !== 'POST') return responder(res, 405, { erro: 'Método não permitido.' });

    const corpo = await lerCorpo(req);
    const acao = corpo?.acao;

    if (acao === 'salvar-familias') {
      const entradas = (Array.isArray(corpo.familias) ? corpo.familias : []).slice(0, 300).map(limparFamilia);
      if (!entradas.length || entradas.some((f) => !f)) {
        return responder(res, 400, { erro: 'Cada convite precisa de um nome e de pelo menos uma pessoa.' });
      }
      const agora = new Date().toISOString();
      await alterarFamilias((familias) => {
        for (const entrada of entradas) {
          const existente = entrada.codigo && familias[entrada.codigo];
          if (existente) {
            familias[entrada.codigo] = { ...existente, nome: entrada.nome, pessoas: entrada.pessoas, atualizadoEm: agora };
            continue;
          }
          let codigo;
          do codigo = `${slug(entrada.nome)}-${aleatorio(4)}`;
          while (familias[codigo] || !codigoValido(codigo));
          familias[codigo] = { nome: entrada.nome, pessoas: entrada.pessoas, criadoEm: agora };
        }
        return familias;
      });
      return responder(res, 200, await montarPainel());
    }

    if (acao === 'remover-familia') {
      const codigo = String(corpo.codigo ?? '');
      if (!codigoValido(codigo)) return responder(res, 400, { erro: 'Família inválida.' });
      await alterarFamilias((familias) => {
        delete familias[codigo];
        return familias;
      });
      await Promise.all([apagarRespostas(codigo), apagarAberturas(codigo)]);
      return responder(res, 200, await montarPainel());
    }

    if (acao === 'remover-resposta') {
      const chave = String(corpo.chave ?? '');
      if (!CHAVE_AVULSA.test(chave) && !codigoValido(chave)) return responder(res, 400, { erro: 'Resposta inválida.' });
      await apagarRespostas(chave);
      return responder(res, 200, await montarPainel());
    }

    return responder(res, 400, { erro: 'Ação desconhecida.' });
  } catch (erro) {
    console.error('Falha no painel', erro);
    return responder(res, 500, { erro: 'Algo deu errado no servidor. Tente de novo.' });
  }
}
