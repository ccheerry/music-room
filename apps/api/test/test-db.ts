// Tests never touch the development database: they use TEST_DATABASE_URL, or the
// same server with "_test" appended to the database name.
export function testDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
	if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;
	if (!env.DATABASE_URL) return undefined;
	const url = new URL(env.DATABASE_URL);
	url.pathname = `${url.pathname}_test`;
	return url.toString();
}
