import { lerFamilias, salvarResposta } from './_lib/dados.js';
import { responder, lerCorpo, linha, texto, aleatorio, codigoValido, CHAVE_AVULSA } from './_lib/util.js';

const MAX_PESSOAS = 20;

// POST /api/rsvp  →  grava a confirmação de uma família (com código) ou avulsa (nomes digitados)
export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Método não permitido.' });

  const corpo = await lerCorpo(req);
  if (!corpo || typeof corpo !== 'object') return responder(res, 400, { erro: 'Não entendemos os dados enviados.' });

  // campo invisível: se veio preenchido, foi um robô
  if (corpo.site) return responder(res, 200, { ok: true, chave: null, enviadoEm: new Date().toISOString() });

  const restricoes = texto(corpo.restricoes, 600);
  const telefone = linha(corpo.telefone, 40);
  const entrada = Array.isArray(corpo.pessoas) ? corpo.pessoas.slice(0, MAX_PESSOAS) : [];
  const codigo = corpo.codigo ? String(corpo.codigo).trim().toLowerCase() : '';

  try {
    let chave;
    let familiaNome = null;
    let pessoas;

    if (codigo) {
      if (!codigoValido(codigo)) return responder(res, 404, { erro: 'Convite não encontrado.' });
      let { familias } = await lerFamilias();
      if (!familias[codigo]) ({ familias } = await lerFamilias({ fresco: true }));
      const familia = familias[codigo];
      if (!familia) return responder(res, 404, { erro: 'Convite não encontrado.' });

      const escolhas = new Map(entrada.map((p) => [linha(p?.nome, 80), p?.vai]));
      const mesmosNomes =
        escolhas.size === familia.pessoas.length && familia.pessoas.every((nome) => escolhas.has(nome));
      if (!mesmosNomes) {
        return responder(res, 409, { erro: 'Este convite foi atualizado. Recarregue a página e confirme de novo.' });
      }
      pessoas = familia.pessoas.map((nome) => ({ nome, vai: escolhas.get(nome) }));
      chave = codigo;
      familiaNome = familia.nome;
    } else {
      pessoas = entrada.map((p) => ({ nome: linha(p?.nome, 80), vai: p?.vai }));
      if (!pessoas.length || pessoas.some((p) => !p.nome)) {
        return responder(res, 400, { erro: 'Escreva o nome de cada pessoa.' });
      }
      chave = CHAVE_AVULSA.test(String(corpo.chave ?? '')) ? corpo.chave : `avulsa-${aleatorio(10)}`;
    }

    if (pessoas.some((p) => typeof p.vai !== 'boolean')) {
      return responder(res, 400, { erro: 'Marque se cada pessoa vai ou não.' });
    }

    const enviadoEm = new Date().toISOString();
    await salvarResposta(chave, {
      chave,
      tipo: codigo ? 'familia' : 'avulsa',
      familia: familiaNome,
      pessoas,
      restricoes,
      telefone,
      enviadoEm,
    });
    return responder(res, 200, { ok: true, chave, enviadoEm });
  } catch (erro) {
    console.error('Falha ao salvar confirmação', erro);
    return responder(res, 500, { erro: 'Não conseguimos salvar agora. Tente de novo em alguns minutos.' });
  }
}
