// Servidor local: arquivos de public/ (com URLs limpas, como na Vercel) e as funções de api/.
// Uso: npm run dev   (PORTA=3000 e PAINEL_CHAVE=teste por padrão)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PUBLICO = join(RAIZ, 'public');
const PORTA = Number(process.env.PORTA ?? 3000);
process.env.PAINEL_CHAVE ??= 'teste';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ics': 'text/calendar; charset=utf-8',
  '.woff2': 'font/woff2',
};

async function arquivo(caminho) {
  try {
    const info = await stat(caminho);
    return info.isFile() ? caminho : null;
  } catch {
    return null;
  }
}

async function estatico(url, res) {
  const limpo = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (limpo.startsWith('..')) return false;
  const candidatos = limpo === '' ? ['index.html'] : [limpo, `${limpo}.html`, join(limpo, 'index.html')];
  for (const candidato of candidatos) {
    const encontrado = await arquivo(join(PUBLICO, candidato));
    if (encontrado) {
      res.writeHead(200, { 'Content-Type': TIPOS[extname(encontrado)] ?? 'application/octet-stream' });
      res.end(await readFile(encontrado));
      return true;
    }
  }
  return false;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const rota = url.pathname.match(/^\/api\/([a-z0-9-]+)$/);
    if (rota) {
      const modulo = await import(pathToFileURL(join(RAIZ, 'api', `${rota[1]}.js`)).href);
      req.query = Object.fromEntries(url.searchParams);
      return await modulo.default(req, res);
    }
    if (await estatico(url, res)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  } catch (erro) {
    console.error(erro);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erro no servidor local');
  }
}).listen(PORTA, () => console.log(`Site em http://localhost:${PORTA} (painel: /painel, chave "${process.env.PAINEL_CHAVE}")`));
