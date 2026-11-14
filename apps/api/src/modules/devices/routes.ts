import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
	ControllableList,
	DeviceIdParams,
	ErrorBody,
	GrantBody,
	GrantParams,
	MyDeviceList,
	RenameDeviceBody,
} from '@music-room/shared';
import type { DevicesService } from './service.js';

const tags = ['devices'];
const security = [{ bearerAuth: [] }];
const NoContent = z.null().describe('Done');
const errors = { 400: ErrorBody, 401: ErrorBody, 404: ErrorBody };

export const devicesRoutes =
	(devices: DevicesService): FastifyPluginAsyncZod =>
	async (app) => {
		app.addHook('preHandler', app.authenticate);

		app.get(
			'/devices',
			{
				schema: {
					summary: 'My devices, with who may control each one',
					tags,
					security,
					response: { 200: MyDeviceList, 401: ErrorBody },
				},
			},
			async (req) => devices.list(req.user.sub, req.user.deviceId),
		);

		app.get(
			'/devices/controllable',
			{
				schema: {
					summary: 'Devices I can control: mine and those friends granted me',
					tags,
					security,
					response: { 200: ControllableList, 401: ErrorBody },
				},
			},
			async (req) => devices.controllable(req.user.sub),
		);

		app.patch(
			'/devices/:id',
			{
				schema: {
					summary: 'Rename one of my devices',
					tags,
					security,
					params: DeviceIdParams,
					body: RenameDeviceBody,
					response: { 204: NoContent, ...errors },
				},
			},
			async (req, reply) => {
				await devices.rename(req.user.sub, req.params.id, req.body.name);
				return reply.code(204).send(null);
			},
		);

		app.delete(
			'/devices/:id',
			{
				schema: {
					summary: 'Remove one of my devices',
					description: 'Logs the device out and revokes every control grant on it.',
					tags,
					security,
					params: DeviceIdParams,
					response: { 204: NoContent, ...errors },
				},
			},
			async (req, reply) => {
				await devices.remove(req.user.sub, req.params.id);
				return reply.code(204).send(null);
			},
		);

		app.put(
			'/devices/:id/grants/:userId',
			{
				schema: {
					summary: 'Let a friend control this device',
					description:
						'Optional expiresAt. 403 NOT_FRIENDS when the user is not a friend.',
					tags,
					security,
					params: GrantParams,
					body: GrantBody,
					response: { 204: NoContent, ...errors, 403: ErrorBody },
				},
			},
			async (req, reply) => {
				await devices.grant(
					req.user.sub,
					req.params.id,
					req.params.userId,
					req.body.expiresAt,
				);
				return reply.code(204).send(null);
			},
		);

		app.delete(
			'/devices/:id/grants/:userId',
			{
				schema: {
					summary: 'Take control back',
					description:
						'Effective immediately: the friend is removed from the live remote.',
					tags,
					security,
					params: GrantParams,
					response: { 204: NoContent, ...errors },
				},
			},
			async (req, reply) => {
				await devices.revoke(req.user.sub, req.params.id, req.params.userId);
				return reply.code(204).send(null);
			},
		);
	};
