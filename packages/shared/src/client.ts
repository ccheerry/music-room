import { z } from 'zod';

const Value = z.string().min(1).max(100).catch('unknown');

// Sent by the app on every request; anything missing or invalid is logged as 'unknown'.
export const ClientHeaders = z.object({
	'x-platform': z.enum(['ios', 'android', 'web', 'unknown']).catch('unknown'),
	'x-device': Value,
	'x-app-version': Value,
});
export type ClientHeaders = z.infer<typeof ClientHeaders>;
