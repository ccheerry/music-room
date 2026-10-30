import { z } from 'zod';

const EnvSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	HOST: z.string().default('0.0.0.0'),
	PORT: z.coerce.number().int().positive().default(3000),
	LOG_LEVEL: z
		.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
		.default('info'),
	DATABASE_URL: z.url(),
	JWT_SECRET: z.string().min(32),
	SMTP_HOST: z.string().default('localhost'),
	SMTP_PORT: z.coerce.number().int().positive().default(1025),
	MAIL_FROM: z.string().default('Music Room <no-reply@musicroom.local>'),
});
export type Env = z.infer<typeof EnvSchema>;

// Crashes at startup when a required variable is missing or malformed.
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
	const parsed = EnvSchema.safeParse(source);
	if (!parsed.success) {
		const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
		throw new Error(`Invalid environment: ${fields}`);
	}
	return parsed.data;
}
