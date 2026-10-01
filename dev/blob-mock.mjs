// Substituto em memória do @vercel/blob para rodar o site localmente (npm run dev).
// Imita só o que o site usa: put, get, head, list, del e o erro de ETag.
// Como no Blob de verdade, o get() devolve o ETag fraco do CDN (W/"...") e só o do head() serve no ifMatch.
import { randomBytes } from 'node:crypto';

const HOST = 'https://local.private.blob.vercel-storage.com/';
const blobs = new Map(); // pathname -> { corpo, etag, uploadedAt, contentType }

export class BlobError extends Error {}
export class BlobPreconditionFailedError extends BlobError {
  constructor() {
    super('Precondition failed: ETag mismatch.');
  }
}
export class BlobNotFoundError extends BlobError {
  constructor() {
    super('The requested blob does not exist');
  }
}

function caminhoDe(urlOuCaminho) {
  return urlOuCaminho.startsWith(HOST) ? decodeURIComponent(new URL(urlOuCaminho).pathname.slice(1)) : urlOuCaminho;
}

function metadados(pathname, item) {
  return { url: HOST + pathname, downloadUrl: `${HOST}${pathname}?download=1`, pathname, size: item.corpo.length, uploadedAt: item.uploadedAt, etag: item.etag };
}

export async function put(pathname, corpo, opcoes = {}) {
  let final = pathname;
  if (opcoes.addRandomSuffix) {
    const ponto = pathname.lastIndexOf('.');
    const sufixo = randomBytes(8).toString('base64url').replace(/[-_]/g, 'x');
    final = ponto > pathname.lastIndexOf('/') ? `${pathname.slice(0, ponto)}-${sufixo}${pathname.slice(ponto)}` : `${pathname}-${sufixo}`;
  }
  const atual = blobs.get(final);
  if (atual && !opcoes.allowOverwrite) throw new BlobError('This blob already exists');
  if (opcoes.ifMatch && (!atual || atual.etag !== opcoes.ifMatch)) throw new BlobPreconditionFailedError();
  const item = { corpo: Buffer.from(typeof corpo === 'string' ? corpo : corpo), etag: `"${randomBytes(6).toString('hex')}"`, uploadedAt: new Date(), contentType: opcoes.contentType };
  blobs.set(final, item);
  return metadados(final, item);
}

export async function get(urlOuCaminho, opcoes = {}) {
  if (opcoes.access !== 'private' && opcoes.access !== 'public') throw new BlobError('access must be "private" or "public"');
  const item = blobs.get(caminhoDe(urlOuCaminho));
  if (!item) return null;
  return {
    statusCode: 200,
    stream: new Response(item.corpo).body,
    headers: new Headers(),
    blob: { ...metadados(caminhoDe(urlOuCaminho), item), etag: `W/${item.etag}`, contentType: item.contentType, contentDisposition: '', cacheControl: '' },
  };
}

export async function head(urlOuCaminho) {
  const pathname = caminhoDe(urlOuCaminho);
  const item = blobs.get(pathname);
  if (!item) throw new BlobNotFoundError();
  return { ...metadados(pathname, item), contentType: item.contentType };
}

export async function list({ prefix = '', cursor, limit = 1000 } = {}) {
  const todos = [...blobs.entries()].filter(([pathname]) => pathname.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
  const inicio = cursor ? Number(cursor) : 0;
  const pagina = todos.slice(inicio, inicio + limit);
  const hasMore = inicio + limit < todos.length;
  return { blobs: pagina.map(([pathname, item]) => metadados(pathname, item)), hasMore, cursor: hasMore ? String(inicio + limit) : undefined };
}

export async function del(urls) {
  for (const url of [].concat(urls)) blobs.delete(caminhoDe(url));
}
