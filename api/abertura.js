import { lerFamilias, registrarAbertura } from './_lib/dados.js';
import { responder, lerCorpo, codigoValido } from './_lib/util.js';

// POST /api/abertura {codigo}  →  registra que o convidado abriu o próprio link.
// A página só chama isto depois de ficar alguns segundos visível num navegador de verdade.
// Prévias de link (WhatsApp, Telegram, iMessage, Facebook...) baixam só o HTML e não rodam
// esse código; mesmo assim, qualquer acesso com cara de robô é descartado aqui.
// Só nomes de robôs: o navegador embutido de apps (Instagram, Telegram, LinkedIn...) é gente de verdade.
// O robô de prévia do WhatsApp se apresenta como "WhatsApp/2.x"; os demais têm "bot" ou "preview" no nome.
const ROBOS = /bot|crawl|spider|slurp|preview|^whatsapp\/|facebookexternalhit|facebookcatalog|meta-external|embedly|vkshare|headless|phantom|lighthouse|pagespeed|^(python|curl|wget|go-http|java|okhttp|axios|node-fetch|undici)/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Método não permitido.' });

  const agente = String(req.headers['user-agent'] ?? '');
  if (!agente || ROBOS.test(agente)) return responder(res, 200, { ok: true, ignorado: true });

  const corpo = await lerCorpo(req);
  const codigo = String(corpo?.codigo ?? '').trim().toLowerCase();
  if (!codigoValido(codigo)) return responder(res, 404, { erro: 'Convite não encontrado.' });

  try {
    let { familias } = await lerFamilias();
    if (!familias[codigo]) ({ familias } = await lerFamilias({ fresco: true }));
    if (!familias[codigo]) return responder(res, 404, { erro: 'Convite não encontrado.' });
    await registrarAbertura(codigo);
    return responder(res, 200, { ok: true });
  } catch (erro) {
    console.error('Falha ao registrar abertura', codigo, erro);
    return responder(res, 500, { erro: 'Não foi possível registrar.' });
  }
}
