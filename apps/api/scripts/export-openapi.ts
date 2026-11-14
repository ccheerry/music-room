import { writeFile } from 'node:fs/promises';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createPrisma } from '../src/db.js';

// Writes the OpenAPI description of every route to docs/openapi.json (needs the database up).
const env = loadEnv({ ...process.env, LOG_LEVEL: 'silent' });
const prisma = createPrisma(env.DATABASE_URL);
const app = await buildApp({ env, prisma, mailer: { send: async () => undefined } });
await app.ready();
const target = new URL('../../../docs/openapi.json', import.meta.url);
await writeFile(target, `${JSON.stringify(app.swagger(), null, '\t')}\n`);
await app.close();
await prisma.$disconnect();
process.stdout.write('docs/openapi.json written\n');
