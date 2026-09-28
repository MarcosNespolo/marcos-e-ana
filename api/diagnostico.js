// Verificação única do registro de aberturas no Blob de produção. Será removida logo após o uso.
import { createHash } from 'node:crypto';
import { registrarAbertura, resumoAberturas, apagarAberturas } from './_lib/dados.js';
import { responder, consulta } from './_lib/util.js';

const ESPERADO = 'e0350731fa1e3d0ae22492a75fdbd73227d5c35f4b6ec2504afc8aeefb78bc7b';
const CODIGO = 'diagnostico-zzzz';

export default async function handler(req, res) {
  const token = String(consulta(req).t ?? '');
  if (createHash('sha256').update(token).digest('hex') !== ESPERADO) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  const passos = {};
  try {
    const antes = Date.now();
    await registrarAbertura(CODIGO);
    await registrarAbertura(CODIGO);
    const resumo = (await resumoAberturas())[CODIGO];
    passos.resumo = resumo ?? null;
    passos.contouDuas = resumo?.total === 2;
    passos.dataCoerente = Boolean(resumo) && Math.abs(Date.parse(resumo.ultima) - antes) < 60_000;
    passos.apagadas = await apagarAberturas(CODIGO);
    passos.sumiu = !(await resumoAberturas())[CODIGO];
    passos.outrosCodigosComAbertura = Object.keys(await resumoAberturas()).length;
    return responder(res, 200, { ok: passos.contouDuas && passos.dataCoerente && passos.sumiu, passos });
  } catch (erro) {
    try { await apagarAberturas(CODIGO); } catch {}
    return responder(res, 500, { ok: false, passos, erro: String(erro?.message ?? erro) });
  }
}
