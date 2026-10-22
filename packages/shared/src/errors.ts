import { z } from 'zod';

export const ErrorBody = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
