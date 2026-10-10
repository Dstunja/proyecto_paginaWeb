import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rechazoCron } from './cron';

const SECRETO = 's3creto-del-cron-de-prueba-0123456789';
const pedido = (autorizacion?: string) =>
  new Request('https://dstunja.com/api/empleos/limpieza', {
    headers: autorizacion ? { authorization: autorizacion } : {},
  });

describe('rechazoCron', () => {
  it('sin CRON_SECRET responde 503 (no queda abierto)', async () => {
    const r = rechazoCron(pedido(`Bearer ${SECRETO}`), {});
    expect(r?.status).toBe(503);
    expect(rechazoCron(pedido('Bearer '), { CRON_SECRET: '   ' })?.status).toBe(503);
  });

  it('sin cabecera, con otro secreto o sin "Bearer" responde 401', () => {
    const env = { CRON_SECRET: SECRETO };
    expect(rechazoCron(pedido(), env)?.status).toBe(401);
    expect(rechazoCron(pedido('Bearer otro'), env)?.status).toBe(401);
    expect(rechazoCron(pedido(`Bearer ${SECRETO}x`), env)?.status).toBe(401);
    expect(rechazoCron(pedido(SECRETO), env)?.status).toBe(401);
    expect(rechazoCron(pedido('Bearer '), env)?.status).toBe(401);
  });

  it('con el secreto correcto deja pasar', () => {
    expect(rechazoCron(pedido(`Bearer ${SECRETO}`), { CRON_SECRET: SECRETO })).toBeNull();
  });

  it('el rechazo no devuelve el secreto', async () => {
    const r = rechazoCron(pedido('Bearer otro'), { CRON_SECRET: SECRETO })!;
    expect(await r.text()).not.toContain(SECRETO);
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
});

describe('crons de vercel.json', () => {
  const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
    crons: { path: string; schedule: string }[];
  };

  it('declara las dos limpiezas, una vez al día (límite del plan Hobby)', () => {
    const rutas = vercel.crons.map((c) => c.path).sort();
    expect(rutas).toEqual(['/api/empleos/limpieza', '/api/pqrs/limpieza']);
    for (const c of vercel.crons) expect(c.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });

  it('cada cron apunta a un endpoint que existe y usa la puerta con secreto', () => {
    for (const c of vercel.crons) {
      const archivo = join(process.cwd(), 'src/pages', `${c.path}.ts`);
      expect(existsSync(archivo)).toBe(true);
      expect(readFileSync(archivo, 'utf8')).toContain('rechazoCron(request, env)');
    }
  });
});
