import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { ErrorBody } from '@music-room/shared';

const body = (code: string, message: string): ErrorBody => ({ error: { code, message } });

// `extra` is merged into the body next to `error` (e.g. the current state on a conflict).
// `expose` marks errors raised on purpose: their status and code reach the client, 5xx included.
// `headers` are added to the answer (Retry-After on a 429).
export type HttpError = Error & {
	statusCode: number;
	code: string;
	extra?: object;
	headers?: Record<string, string>;
	expose: true;
};

export function httpError(
	statusCode: number,
	code: string,
	message: string,
	extra?: object,
	headers?: Record<string, string>,
): HttpError {
	return Object.assign(new Error(message), {
		statusCode,
		code,
		extra,
		headers,
		expose: true as const,
	});
}

// Every error leaves as { error: { code, message } }; 5xx details stay in the logs.
export function registerErrorHandlers(app: FastifyInstance): void {
	app.setErrorHandler((err: FastifyError, req, reply) => {
		if (hasZodFastifySchemaValidationErrors(err)) {
			return reply.status(400).send(body('VALIDATION_ERROR', err.message));
		}
		// Prisma could not get a connection in time: the database is saturated, not broken.
		if (err.code === 'P2028') {
			req.log.warn({ err: err.message }, 'database saturated');
			return reply
				.status(503)
				.header('retry-after', '1')
				.send(body('BUSY', 'The server is busy, retry shortly'));
		}
		const status = err.statusCode ?? 500;
		if (status >= 500 && !(err as Partial<HttpError>).expose) {
			req.log.error({ err }, 'unhandled error');
			return reply.status(500).send(body('INTERNAL_ERROR', 'Internal server error'));
		}
		const { extra, headers } = err as Partial<HttpError>;
		if (headers) reply.headers(headers);
		return reply.status(status).send({ ...extra, ...body(err.code ?? 'ERROR', err.message) });
	});

	app.setNotFoundHandler((_req, reply) => reply.status(404).send(body('NOT_FOUND', 'Not found')));
}
