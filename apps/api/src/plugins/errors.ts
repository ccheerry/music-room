import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { ErrorBody } from '@music-room/shared';

const body = (code: string, message: string): ErrorBody => ({ error: { code, message } });

// `extra` is merged into the body next to `error` (e.g. the current state on a conflict).
// `expose` marks errors raised on purpose: their status and code reach the client, 5xx included.
export type HttpError = Error & { statusCode: number; code: string; extra?: object; expose: true };

export function httpError(
	statusCode: number,
	code: string,
	message: string,
	extra?: object,
): HttpError {
	return Object.assign(new Error(message), { statusCode, code, extra, expose: true as const });
}

// Every error leaves as { error: { code, message } }; 5xx details stay in the logs.
export function registerErrorHandlers(app: FastifyInstance): void {
	app.setErrorHandler((err: FastifyError, req, reply) => {
		if (hasZodFastifySchemaValidationErrors(err)) {
			return reply.status(400).send(body('VALIDATION_ERROR', err.message));
		}
		const status = err.statusCode ?? 500;
		if (status >= 500 && !(err as Partial<HttpError>).expose) {
			req.log.error({ err }, 'unhandled error');
			return reply.status(500).send(body('INTERNAL_ERROR', 'Internal server error'));
		}
		const extra = (err as Partial<HttpError>).extra;
		return reply.status(status).send({ ...extra, ...body(err.code ?? 'ERROR', err.message) });
	});

	app.setNotFoundHandler((_req, reply) => reply.status(404).send(body('NOT_FOUND', 'Not found')));
}
