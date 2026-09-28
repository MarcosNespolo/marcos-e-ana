import { put, list, get, del, BlobPreconditionFailedError } from '@vercel/blob';
import { espera } from './util.js';

// Tudo fica num Blob store privado da Vercel:
//   familias.json                      lista de famílias convidadas (editada pelo painel)
//   respostas/<chave>/<data>-<id>.json uma entrada por envio; vale a mais recente de cada chave
// <chave> é o código da família ou "avulsa-xxxxxxxxxx" para quem confirmou sem link nominal.

const ACESSO = 'private';
const FAMILIAS = 'familias.json';

async function lerTexto(caminho, { fresco = false } = {}) {
  const resultado = await get(caminho, { access: ACESSO, useCache: !fresco });
  if (!resultado || resultado.statusCode !== 200) return null;
  const conteudo = await new Response(resultado.stream).text();
  return { conteudo, etag: resultado.blob.etag };
}

export async function lerFamilias({ fresco = false } = {}) {
  const lido = await lerTexto(FAMILIAS, { fresco });
  if (!lido) return { familias: {}, etag: null };
  const dados = JSON.parse(lido.conteudo);
  return { familias: dados.familias ?? {}, etag: lido.etag };
}

// Lê a versão atual, aplica a alteração e grava só se ninguém mexeu no meio (ETag).
export async function alterarFamilias(alterar) {
  let ultimoErro;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { familias, etag } = await lerFamilias({ fresco: true });
    const novas = alterar(structuredClone(familias));
    try {
      await put(FAMILIAS, JSON.stringify({ familias: novas }), {
        access: ACESSO,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
        addRandomSuffix: false,
        allowOverwrite: Boolean(etag),
        ...(etag ? { ifMatch: etag } : {}),
      });
      return novas;
    } catch (erro) {
      ultimoErro = erro;
      const conflito = erro instanceof BlobPreconditionFailedError || !etag;
      if (!conflito) throw erro;
      await espera(120 * (tentativa + 1));
    }
  }
  throw ultimoErro;
}

async function listarTudo(prefix) {
  const blobs = [];
  let cursor;
  do {
    const pagina = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...pagina.blobs);
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  return blobs;
}

function maisRecentePorChave(blobs) {
  const porChave = new Map();
  for (const blob of blobs) {
    const chave = blob.pathname.split('/')[1];
    const atual = porChave.get(chave);
    if (!atual || blob.pathname > atual.pathname) porChave.set(chave, blob);
  }
  return porChave;
}

async function lerJson(url) {
  // cada envio é gravado uma vez e nunca alterado, então o cache pode ser usado
  const resultado = await get(url, { access: ACESSO });
  if (!resultado || resultado.statusCode !== 200) return null;
  return JSON.parse(await new Response(resultado.stream).text());
}

export async function salvarResposta(chave, resposta) {
  const carimbo = String(Date.now()).padStart(14, '0');
  await put(`respostas/${chave}/${carimbo}.json`, JSON.stringify(resposta), {
    access: ACESSO,
    contentType: 'application/json',
    addRandomSuffix: true,
  });
}

export async function lerRespostaDaChave(chave) {
  const blobs = await listarTudo(`respostas/${chave}/`);
  const ultimo = maisRecentePorChave(blobs).get(chave);
  return ultimo ? lerJson(ultimo.url) : null;
}

export async function lerTodasRespostas() {
  const blobs = await listarTudo('respostas/');
  const ultimos = [...maisRecentePorChave(blobs).values()];
  const respostas = await Promise.all(ultimos.map((blob) => lerJson(blob.url)));
  return respostas.filter(Boolean);
}

export async function apagarRespostas(chave) {
  const blobs = await listarTudo(`respostas/${chave}/`);
  if (blobs.length) await del(blobs.map((blob) => blob.url));
  return blobs.length;
}
