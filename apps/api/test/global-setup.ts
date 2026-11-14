import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPrisma } from '../src/db.js';
import { testDatabaseUrl } from './test-db.js';

const API_DIR = fileURLToPath(new URL('..', import.meta.url));

// Printed first: Vitest can fail to format errors thrown from a global setup.
function fail(message: string): never {
	process.stderr.write(`\n${message}\n\n`);
	throw new Error(message);
}

// Once per run: create / migrate the test database, then empty it.
export default async function setup(): Promise<void> {
	const url = testDatabaseUrl();
	if (!url) fail('DATABASE_URL or TEST_DATABASE_URL is required for the tests');
	if (url === process.env.DATABASE_URL) {
		fail('TEST_DATABASE_URL must differ from DATABASE_URL: the tests empty their database');
	}
	try {
		execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
			cwd: API_DIR,
			env: { ...process.env, DATABASE_URL: url },
			stdio: 'pipe',
		});
	} catch (err) {
		const output = (err as { stdout?: Buffer; stderr?: Buffer }) ?? {};
		fail(
			`Could not prepare the test database (is PostgreSQL running?)\n${output.stdout ?? ''}${output.stderr ?? ''}`,
		);
	}
	const prisma = createPrisma(url);
	const tables = await prisma.$queryRaw<{ tablename: string }[]>`
		SELECT tablename FROM pg_tables
		WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
	const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
	if (list) await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
	await prisma.$disconnect();
}
