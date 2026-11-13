import type { MeResponse } from '@music-room/shared';

export const ME: MeResponse = {
	id: '0b7c6f1e-2f4a-4c1a-9d5e-3a1b2c3d4e5f',
	email: 'a@b.co',
	displayName: 'Ana',
	relation: 'self',
	publicInfo: {},
	friendsInfo: {},
	privateInfo: {},
	musicPrefs: [],
	hasPassword: true,
	providers: [],
};

export const reply = (status: number, body: unknown) => ({ status, json: async () => body });
