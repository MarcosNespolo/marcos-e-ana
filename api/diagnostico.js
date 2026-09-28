// Verificação temporária do armazenamento (grava, lê, lista e apaga um arquivo de teste).
// Será removida logo após o teste.
import { createHash } from 'node:crypto';
import { put, get, list, del } from '@vercel/blob';

const ESPERADO = '36ce9c3a87a1c071d7eb9a0c033968a008ad0697d3231751f2249b4a666759a2';

export default async function handler(req, res) {
  const token = String(new URL(req.url, 'http://local').searchParams.get('t') ?? '');
  if (createHash('sha256').update(token).digest('hex') !== ESPERADO) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  const variaveis = ['BLOB_READ_WRITE_TOKEN', 'BLOB_STORE_ID', 'VERCEL_OIDC_TOKEN', 'PAINEL_CHAVE'].filter((k) => Boolean(process.env[k]));
  const etapas = [];
  try {
    const gravado = await put(`diagnostico/${Date.now()}.json`, JSON.stringify({ ok: true }), {
      access: 'private', contentType: 'application/json', addRandomSuffix: true,
    });
    etapas.push('put ok');
    const lido = await get(gravado.url, { access: 'private', useCache: false });
    etapas.push(`get ${lido?.statusCode ?? 'null'}`);
    etapas.push(`conteudo ${lido?.stream ? await new Response(lido.stream).text() : '-'}`);
    const listado = await list({ prefix: 'diagnostico/' });
    etapas.push(`list ${listado.blobs.length}`);
    if (listado.blobs.length) await del(listado.blobs.map((b) => b.url));
    etapas.push('del ok');
    res.statusCode = 200;
  } catch (erro) {
    etapas.push(`erro ${erro?.name}: ${erro?.message}`);
    res.statusCode = 500;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ variaveis, etapas }));
}
