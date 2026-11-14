import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/test-db.js';

const DATABASE_URL = testDatabaseUrl();

export default defineConfig({
	test: {
		environment: 'node',
		globalSetup: './test/global-setup.ts',
		env: DATABASE_URL ? { DATABASE_URL } : {},
	},
});
