import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

export async function registerSwagger(app: FastifyInstance): Promise<void> {
	await app.register(swagger, {
		openapi: { info: { title: 'Music Room API', version: '0.0.0' } },
		transform: jsonSchemaTransform,
	});
	await app.register(swaggerUi, { routePrefix: '/docs' });
}
