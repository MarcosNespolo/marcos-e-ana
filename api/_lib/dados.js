import { put, list, get, head, del, BlobPreconditionFailedError, BlobNotFoundError } from '@vercel/blob';
import { espera } from './util.js';

// Tudo fica num Blob store privado da Vercel:
//   familias.json                      convites (uma pessoa ou uma família), editados pelo painel
//   respostas/<chave>/<data>-<id>.json uma entrada por envio; vale a mais recente de cada chave
//   aberturas/<codigo>/<data>-<id>.json uma entrada cada vez que um convidado abre o link
// <chave> é o código da família ou "avulsa-xxxxxxxxxx" para quem confirmou sem link nominal.

const ACESSO = 'private';
const FAMILIAS = 'familias.json';

async function lerTexto(caminho, { fresco = false } = {}) {
  const resultado = await get(caminho, { access: ACESSO, useCache: !fresco });
  if (!resultado || resultado.statusCode !== 200) return null;
  return new Response(resultado.stream).text();
}

export async function lerFamilias({ fresco = false } = {}) {
  const conteudo = await lerTexto(FAMILIAS, { fresco });
  if (!conteudo) return { familias: {} };
  return { familias: JSON.parse(conteudo).familias ?? {} };
}

// O ETag que o put aceita no ifMatch vem do head() (API). O get() devolve o ETag do CDN,
// que chega fraco (W/"...") e nunca bate.
async function etagAtual(caminho) {
  try {
    return (await head(caminho)).etag;
  } catch (erro) {
    if (erro instanceof BlobNotFoundError) return null;
    throw erro;
  }
}

// Lê a versão atual, aplica a alteração e grava só se ninguém mexeu no meio (ETag).
// O ETag é lido antes do conteúdo: se alguém gravar entre os dois, o put falha e tenta de novo.
export async function alterarFamilias(alterar) {
  let ultimoErro;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const etag = await etagAtual(FAMILIAS);
    const { familias } = await lerFamilias({ fresco: true });
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

async function apagarPrefixo(prefixo) {
  const blobs = await listarTudo(prefixo);
  if (blobs.length) await del(blobs.map((blob) => blob.url));
  return blobs.length;
}

export function apagarRespostas(chave) {
  return apagarPrefixo(`respostas/${chave}/`);
}

export function apagarAberturas(codigo) {
  return apagarPrefixo(`aberturas/${codigo}/`);
}

export async function registrarAbertura(codigo) {
  const agora = Date.now();
  await put(`aberturas/${codigo}/${String(agora).padStart(14, '0')}.json`, JSON.stringify({ em: new Date(agora).toISOString() }), {
    access: ACESSO,
    contentType: 'application/json',
    addRandomSuffix: true,
  });
}

// Só a listagem: a data de cada abertura está no próprio nome do arquivo.
export async function resumoAberturas() {
  const resumo = {};
  for (const blob of await listarTudo('aberturas/')) {
    const [, codigo, arquivo = ''] = blob.pathname.split('/');
    const ms = Number(arquivo.slice(0, 14));
    if (!codigo || !Number.isFinite(ms) || ms <= 0) continue;
    const atual = (resumo[codigo] ??= { total: 0, primeira: ms, ultima: ms });
    atual.total += 1;
    atual.primeira = Math.min(atual.primeira, ms);
    atual.ultima = Math.max(atual.ultima, ms);
  }
  for (const item of Object.values(resumo)) {
    item.primeira = new Date(item.primeira).toISOString();
    item.ultima = new Date(item.ultima).toISOString();
  }
  return resumo;
}
