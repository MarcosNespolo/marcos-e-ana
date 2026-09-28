import { lerFamilias, lerRespostaDaChave } from './_lib/dados.js';
import { responder, consulta, codigoValido } from './_lib/util.js';

// GET /api/convite?c=<código>  →  nomes da família e a resposta mais recente, se houver
export default async function handler(req, res) {
  if (req.method !== 'GET') return responder(res, 405, { erro: 'Método não permitido.' });

  const codigo = String(consulta(req).c ?? '').trim().toLowerCase();
  if (!codigoValido(codigo)) return responder(res, 404, { erro: 'Convite não encontrado.' });

  try {
    let { familias } = await lerFamilias();
    // família recém-criada pode ainda não estar na versão em cache
    if (!familias[codigo]) ({ familias } = await lerFamilias({ fresco: true }));
    const familia = familias[codigo];
    if (!familia) return responder(res, 404, { erro: 'Convite não encontrado.' });

    const resposta = await lerRespostaDaChave(codigo);
    return responder(res, 200, {
      familia: { codigo, nome: familia.nome, pessoas: familia.pessoas },
      resposta: resposta
        ? {
            pessoas: resposta.pessoas,
            restricoes: resposta.restricoes,
            telefone: resposta.telefone,
            enviadoEm: resposta.enviadoEm,
          }
        : null,
    });
  } catch (erro) {
    console.error('Falha ao carregar convite', codigo, erro);
    return responder(res, 500, { erro: 'Não foi possível carregar o convite agora.' });
  }
}
