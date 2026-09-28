// Importação única da lista de convidados enviada pelos noivos. Será removida logo após o uso.
import { createHash } from 'node:crypto';
import { alterarFamilias } from './_lib/dados.js';
import { responder, consulta, slug, aleatorio, codigoValido } from './_lib/util.js';

const ESPERADO = '04a550957f91c3d9f7a123125971193136c3cd2dbfabc12322ada733d657e44c';
const NOMES = ["Marcos Nespolo", "Cris", "Marcos Vinícius", "Miguel", "Almerinda", "Mineia", "Larissa", "José", "Débora", "Ricardo", "Luís Gustavo", "Ângela", "Édson", "Thays", "Talita", "Ronaldo", "Gabriela", "Eduardo", "Arildo", "Ivone", "Josué", "Victoria", "Luciana", "Pablio", "Thais", "Gabrielly", "Julia", "Leomara", "Amanda", "Mateus", "Cleomar Damares", "Gabriel", "Gabrise", "Juca"];

export default async function handler(req, res) {
  const token = String(consulta(req).t ?? '');
  if (createHash('sha256').update(token).digest('hex') !== ESPERADO) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  try {
    const agora = new Date().toISOString();
    const familias = await alterarFamilias((atuais) => {
      const existentes = new Set(Object.values(atuais).map((f) => f.nome));
      for (const nome of NOMES) {
        if (existentes.has(nome)) continue;
        let codigo;
        do codigo = `${slug(nome)}-${aleatorio(4)}`;
        while (atuais[codigo] || !codigoValido(codigo));
        atuais[codigo] = { nome, pessoas: [nome], criadoEm: agora };
      }
      return atuais;
    });
    const porNome = new Map(Object.entries(familias).map(([codigo, f]) => [f.nome, codigo]));
    const base = `https://${req.headers.host}`;
    return responder(res, 200, {
      total: Object.keys(familias).length,
      convites: NOMES.map((nome) => ({ nome, link: `${base}/?c=${porNome.get(nome)}` })),
    });
  } catch (erro) {
    console.error('Falha na importação', erro);
    return responder(res, 500, { erro: String(erro?.message ?? erro) });
  }
}
