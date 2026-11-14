import {
	type Coords,
	type CreateEventBody,
	EventDetail,
	EventList,
	type EventScope,
	type EventState,
	EventStateForUser,
	InviteList,
	type UpdateEventBody,
} from '@music-room/shared';

import { request } from '@/api/client';
import { queryClient } from '@/api/query-client';

export const eventKeys = {
	all: ['events'] as const,
	list: (scope: EventScope, q: string) => ['events', 'list', scope, q] as const,
	detail: (id: string) => ['events', id] as const,
	state: (id: string) => ['events', id, 'state'] as const,
	votes: (id: string) => ['events', id, 'votes'] as const,
	invites: (id: string) => ['events', id, 'invites'] as const,
};

export const listEvents = (scope: EventScope, q: string) =>
	request(`/events?scope=${scope}&q=${encodeURIComponent(q)}`, { auth: true }, EventList);

export const getEvent = (id: string) => request(`/events/${id}`, { auth: true }, EventDetail);

export async function createEvent(body: CreateEventBody) {
	const event = await request('/events', { method: 'POST', body, auth: true }, EventDetail);
	await queryClient.invalidateQueries({ queryKey: eventKeys.all });
	return event;
}

export async function updateEvent(id: string, body: UpdateEventBody) {
	const event = await request(
		`/events/${id}`,
		{ method: 'PATCH', body, auth: true },
		EventDetail,
	);
	queryClient.setQueryData(eventKeys.detail(id), event);
	await queryClient.invalidateQueries({ queryKey: ['events', 'list'] });
	return event;
}

export async function deleteEvent(id: string) {
	await request(`/events/${id}`, { method: 'DELETE', auth: true });
	await queryClient.invalidateQueries({ queryKey: eventKeys.all });
}

// The shared state goes to its own cache entry (patched by broadcasts), my votes to another.
function store(id: string, { myVotes, ...state }: EventStateForUser): EventState {
	queryClient.setQueryData(eventKeys.votes(id), myVotes);
	const cached = queryClient.getQueryData<EventState>(eventKeys.state(id));
	if (!cached || state.version >= cached.version)
		queryClient.setQueryData(eventKeys.state(id), state);
	return state;
}

export const getEventState = async (id: string) =>
	store(id, await request(`/events/${id}/state`, { auth: true }, EventStateForUser));

const post = async (id: string, path: string, body: unknown, method: 'POST' | 'DELETE' = 'POST') =>
	store(
		id,
		await request(`/events/${id}${path}`, { method, body, auth: true }, EventStateForUser),
	);

export const suggestTrack = (id: string, deezerId: number, coords?: Coords) =>
	post(id, '/tracks', { deezerId, coords });
export const vote = (id: string, entryId: string, coords?: Coords) =>
	post(id, `/tracks/${entryId}/vote`, { coords });
export const unvote = (id: string, entryId: string) =>
	post(id, `/tracks/${entryId}/vote`, undefined, 'DELETE');
export const skipTrack = (id: string, currentEntryId: string | null) =>
	post(id, '/next', { currentEntryId });

export const getInvites = (id: string) =>
	request(`/events/${id}/invites`, { auth: true }, InviteList);

export async function setInvited(id: string, userId: string, invited: boolean) {
	await (invited
		? request(`/events/${id}/invites`, { method: 'POST', body: { userId }, auth: true })
		: request(`/events/${id}/invites/${userId}`, { method: 'DELETE', auth: true }));
	await queryClient.invalidateQueries({ queryKey: eventKeys.invites(id) });
}
