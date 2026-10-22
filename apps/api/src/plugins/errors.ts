import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { ErrorBody } from '@music-room/shared';

const body = (code: string, message: string): ErrorBody => ({ error: { code, message } });

// Every error leaves as { error: { code, message } }; 5xx details stay in the logs.
export function registerErrorHandlers(app: FastifyInstance): void {
	app.setErrorHandler((err: FastifyError, req, reply) => {
		if (hasZodFastifySchemaValidationErrors(err)) {
			return reply.status(400).send(body('VALIDATION_ERROR', err.message));
		}
		const status = err.statusCode ?? 500;
		if (status >= 500) {
			req.log.error({ err }, 'unhandled error');
			return reply.status(500).send(body('INTERNAL_ERROR', 'Internal server error'));
		}
		return reply.status(status).send(body(err.code ?? 'ERROR', err.message));
	});

	app.setNotFoundHandler((_req, reply) => reply.status(404).send(body('NOT_FOUND', 'Not found')));
}
