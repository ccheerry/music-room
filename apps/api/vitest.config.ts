import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/test-db.js';

const DATABASE_URL = testDatabaseUrl();

export default defineConfig({
	test: {
		environment: 'node',
		globalSetup: './test/global-setup.ts',
		env: DATABASE_URL ? { DATABASE_URL } : {},
		coverage: {
			include: ['src/**'],
			// Generated client, and the two files that only wire real services at startup.
			exclude: ['src/generated/**', 'src/server.ts', 'src/mail/mailer.ts'],
			thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
		},
	},
});
