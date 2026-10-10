/**
 * Prueba de punta a punta del endpoint POST /api/empleos/revalidar, sin red: el
 * `fetch` que regenera las páginas se reemplaza por un espía. Cubre el orden de
 * las puertas (503 sin secreto, 401, 415, 413, 400, 503 sin token de ISR) y
 * que ni el secreto ni el token salgan en la respuesta.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { POST, ALL } from '../../pages/api/empleos/revalidar';

const S = 'secreto-de-prueba-local-1234567890';
const llamar = (init: RequestInit) => {
  const request = new Request('https://dstunja.com/api/empleos/revalidar', { method: 'POST', ...init });
  return (POST as unknown as (c: unknown) => Promise<Response>)({ request, url: new URL(request.url) }) as Promise<Response>;
};
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('las puertas van en orden y la respuesta no lleva secretos', async () => {
  vi.stubEnv('EMPLEOS_WEBHOOK_SECRET', '');
  expect((await llamar({})).status).toBe(503);
  vi.stubEnv('EMPLEOS_WEBHOOK_SECRET', S);
  vi.stubEnv('ISR_BYPASS_TOKEN', 'x'.repeat(40));
  expect((await llamar({ headers: { authorization: 'Bearer malo' } })).status).toBe(401);
  const h = { authorization: `Bearer ${S}`, 'content-type': 'application/json' };
  expect((await llamar({ headers: { authorization: `Bearer ${S}` }, body: '{}' })).status).toBe(415);
  expect((await llamar({ headers: h, body: 'x'.repeat(9000) })).status).toBe(413);
  expect((await llamar({ headers: h, body: '{malo' })).status).toBe(400);
  const pedidos: string[] = [];
  vi.stubGlobal('fetch', async (u: URL, init: RequestInit) => { pedidos.push(`${u} ${new Headers(init.headers).get('x-prerender-revalidate')?.length}`); return new Response('', { status: 200 }); });
  const r = await llamar({ headers: h, body: JSON.stringify({ slugs: ['facturacion'] }) });
  expect(r.status).toBe(202);
  const cuerpo = await r.text();
  expect(cuerpo).not.toContain('x'.repeat(40));
  expect(cuerpo).not.toContain(S);
  expect(pedidos).toEqual([
    'https://dstunja.com/empleos/ 40',
    'https://dstunja.com/api/empleos/vacantes.json 40',
    'https://dstunja.com/empleos/facturacion/ 40',
  ]);
  vi.stubEnv('ISR_BYPASS_TOKEN', '');
  expect((await llamar({ headers: h, body: '{}' })).status).toBe(503);
  expect((ALL as unknown as () => Response)().status).toBe(405);
});
