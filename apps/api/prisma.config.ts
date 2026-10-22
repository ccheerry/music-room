import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
	// Optional here so `prisma generate` works without a database (Docker build, make install).
	datasource: { url: process.env.DATABASE_URL ?? '' },
});
