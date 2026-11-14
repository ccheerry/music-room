import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import { ErrorBody } from '@music-room/shared';

export async function registerSwagger(app: FastifyInstance): Promise<void> {
	await app.register(swagger, {
		openapi: {
			info: { title: 'Music Room API', version: '0.0.0' },
			components: {
				securitySchemes: {
					bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
				},
			},
		},
		transform: jsonSchemaTransform,
	});
	await app.register(swaggerUi, { routePrefix: '/docs' });
	// Every route shares the request budget: document its 429 once, here.
	app.addHook('onRoute', (route) => {
		const responses = route.schema?.response as Record<number, unknown> | undefined;
		if (responses) responses[429] ??= ErrorBody.describe('Too many requests');
	});
}
