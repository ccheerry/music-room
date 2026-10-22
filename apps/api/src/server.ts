import { loadEnv } from './config/env.js';
import { createPrisma } from './db.js';
import { buildApp } from './app.js';

const env = loadEnv();
const prisma = createPrisma(env.DATABASE_URL);
const app = await buildApp(env, prisma);

const shutdown = async () => {
	await app.close();
	await prisma.$disconnect();
	process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: env.HOST, port: env.PORT });
