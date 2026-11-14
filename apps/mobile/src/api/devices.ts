import { ControllableList, MyDeviceList } from '@music-room/shared';

import { request } from '@/api/client';
import { queryClient } from '@/api/query-client';

export const deviceKeys = {
	mine: ['devices', 'mine'] as const,
	controllable: ['devices', 'controllable'] as const,
};

export const getMyDevices = () => request('/devices', { auth: true }, MyDeviceList);
export const getControllable = () =>
	request('/devices/controllable', { auth: true }, ControllableList);

const refresh = () => queryClient.invalidateQueries({ queryKey: ['devices'] });

export async function renameDevice(id: string, name: string) {
	await request(`/devices/${id}`, { method: 'PATCH', body: { name }, auth: true });
	await refresh();
}

export async function removeDevice(id: string) {
	await request(`/devices/${id}`, { method: 'DELETE', auth: true });
	await refresh();
}

export async function setGrant(
	id: string,
	userId: string,
	granted: boolean,
	expiresAt: string | null = null,
) {
	await (granted
		? request(`/devices/${id}/grants/${userId}`, {
				method: 'PUT',
				body: { expiresAt },
				auth: true,
			})
		: request(`/devices/${id}/grants/${userId}`, { method: 'DELETE', auth: true }));
	await refresh();
}
