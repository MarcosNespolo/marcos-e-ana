// Faz o import de '@vercel/blob' apontar para o substituto em memória durante o desenvolvimento.
const SUBSTITUTO = new URL('./blob-mock.mjs', import.meta.url).href;

export async function resolve(especificador, contexto, proximo) {
  if (especificador === '@vercel/blob') return { url: SUBSTITUTO, shortCircuit: true };
  return proximo(especificador, contexto);
}
