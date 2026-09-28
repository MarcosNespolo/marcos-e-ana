import { randomInt } from 'node:crypto';

export function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}

// Na Vercel o corpo JSON já vem em req.body; localmente lemos o stream.
export async function lerCorpo(req) {
  try {
    const pronto = req.body;
    if (pronto !== undefined && pronto !== null) {
      if (typeof pronto === 'string') return JSON.parse(pronto || '{}');
      if (Buffer.isBuffer(pronto)) return JSON.parse(pronto.toString('utf8') || '{}');
      return pronto;
    }
  } catch {
    return null;
  }
  const partes = [];
  let tamanho = 0;
  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > 100_000) return null;
    partes.push(parte);
  }
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
  } catch {
    return null;
  }
}

export function consulta(req) {
  if (req.query) return req.query;
  return Object.fromEntries(new URL(req.url, 'http://local').searchParams);
}

// Texto de uma linha: sem quebras, espaços normalizados.
export function linha(valor, maximo) {
  return String(valor ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo);
}

// Texto livre: mantém quebras de linha simples.
export function texto(valor, maximo) {
  return String(valor ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maximo);
}

const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';

export function aleatorio(tamanho) {
  let saida = '';
  for (let i = 0; i < tamanho; i++) saida += ALFABETO[randomInt(ALFABETO.length)];
  return saida;
}

export function slug(nome) {
  const base = String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(familia|fam)-/, '');
  let curto = base;
  if (curto.length > 24) {
    curto = curto.slice(0, 24);
    const corte = curto.lastIndexOf('-');
    if (corte > 8) curto = curto.slice(0, corte);
  }
  return curto.replace(/-+$/, '') || 'convite';
}

export const CODIGO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CHAVE_AVULSA = /^avulsa-[a-z0-9]{10}$/;

export function codigoValido(codigo) {
  return typeof codigo === 'string' && codigo.length >= 3 && codigo.length <= 40 && CODIGO.test(codigo) && !codigo.startsWith('avulsa-');
}

export function espera(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
