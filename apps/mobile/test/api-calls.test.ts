import * as auth from '@/api/auth';
import * as catalog from '@/api/catalog';
import { request } from '@/api/client';
import * as devices from '@/api/devices';
import * as events from '@/api/events';
import * as playlists from '@/api/playlists';
import { queryClient } from '@/api/query-client';
import * as social from '@/api/social';
import * as users from '@/api/users';
import { useSession } from '@/stores/session';

jest.mock('@/api/client', () => ({ request: jest.fn() }));
const mockRequest = request as jest.MockedFunction<typeof request>;

const ID = '00000000-0000-4000-8000-00000000000a';
const OTHER = '00000000-0000-4000-8000-00000000000b';
const STATE = { eventId: ID, version: 4, current: null, queue: [], myVotes: [OTHER] };
const TOKENS = { accessToken: 'a', refreshToken: 'r', expiresIn: 900 };

beforeEach(() => {
	mockRequest.mockReset();
	mockRequest.mockResolvedValue(undefined);
});

// Every wrapper must hit the documented route with the documented method.
const CALLS: [string, () => Promise<unknown>, string, string][] = [
	[
		'register',
		() => auth.register({ email: 'a@b.co', password: 'x', displayName: 'A' }),
		'POST',
		'/auth/register',
	],
	['verifyEmail', () => auth.verifyEmail('t'), 'POST', '/auth/verify-email'],
	[
		'resendVerification',
		() => auth.resendVerification({ email: 'a@b.co' }),
		'POST',
		'/auth/resend-verification',
	],
	[
		'forgotPassword',
		() => auth.forgotPassword({ email: 'a@b.co' }),
		'POST',
		'/auth/forgot-password',
	],
	[
		'resetPassword',
		() => auth.resetPassword({ token: 't', password: 'x' }),
		'POST',
		'/auth/reset-password',
	],
	['getMe', () => auth.getMe(), 'GET', '/me'],
	[
		'changePassword',
		() => auth.changePassword({ currentPassword: 'a', newPassword: 'b' }),
		'PUT',
		'/me/password',
	],
	[
		'searchTracks',
		() => catalog.searchTracks('daft punk'),
		'GET',
		'/tracks/search?q=daft%20punk',
	],
	['getTrack', () => catalog.getTrack(7), 'GET', '/tracks/7'],
	['getGenres', () => catalog.getGenres(), 'GET', '/genres'],
	['getMyDevices', () => devices.getMyDevices(), 'GET', '/devices'],
	['getControllable', () => devices.getControllable(), 'GET', '/devices/controllable'],
	['renameDevice', () => devices.renameDevice(ID, 'Phone'), 'PATCH', `/devices/${ID}`],
	['removeDevice', () => devices.removeDevice(ID), 'DELETE', `/devices/${ID}`],
	['grant', () => devices.setGrant(ID, OTHER, true), 'PUT', `/devices/${ID}/grants/${OTHER}`],
	[
		'revoke',
		() => devices.setGrant(ID, OTHER, false),
		'DELETE',
		`/devices/${ID}/grants/${OTHER}`,
	],
	['listEvents', () => events.listEvents('mine', 'a b'), 'GET', '/events?scope=mine&q=a%20b'],
	['getEvent', () => events.getEvent(ID), 'GET', `/events/${ID}`],
	['createEvent', () => events.createEvent({ name: 'E' }), 'POST', '/events'],
	['updateEvent', () => events.updateEvent(ID, { name: 'E' }), 'PATCH', `/events/${ID}`],
	['deleteEvent', () => events.deleteEvent(ID), 'DELETE', `/events/${ID}`],
	['getInvites', () => events.getInvites(ID), 'GET', `/events/${ID}/invites`],
	['invite', () => events.setInvited(ID, OTHER, true), 'POST', `/events/${ID}/invites`],
	[
		'uninvite',
		() => events.setInvited(ID, OTHER, false),
		'DELETE',
		`/events/${ID}/invites/${OTHER}`,
	],
	['listPlaylists', () => playlists.listPlaylists('all', ''), 'GET', '/playlists?scope=all&q='],
	['getPlaylist', () => playlists.getPlaylist(ID), 'GET', `/playlists/${ID}`],
	['getEntries', () => playlists.getEntries(ID), 'GET', `/playlists/${ID}/entries`],
	['createPlaylist', () => playlists.createPlaylist({ name: 'P' }), 'POST', '/playlists'],
	[
		'updatePlaylist',
		() => playlists.updatePlaylist(ID, { name: 'P' }),
		'PATCH',
		`/playlists/${ID}`,
	],
	['deletePlaylist', () => playlists.deletePlaylist(ID), 'DELETE', `/playlists/${ID}`],
	['getMembers', () => playlists.getMembers(ID), 'GET', `/playlists/${ID}/members`],
	['addMember', () => playlists.setMember(ID, OTHER, true), 'POST', `/playlists/${ID}/members`],
	[
		'removeMember',
		() => playlists.setMember(ID, OTHER, false),
		'DELETE',
		`/playlists/${ID}/members/${OTHER}`,
	],
	['linkProvider', () => social.linkProvider('google', 't'), 'POST', '/me/link/google'],
	['unlinkProvider', () => social.unlinkProvider('facebook'), 'DELETE', '/me/link/facebook'],
	['updateMe', () => users.updateMe({ displayName: 'A' }), 'PATCH', '/me'],
	['getUser', () => users.getUser(ID), 'GET', `/users/${ID}`],
	['searchUsers', () => users.searchUsers('an a'), 'GET', '/users?q=an%20a'],
	['getFriends', () => users.getFriends(), 'GET', '/friends'],
	['getFriendRequests', () => users.getFriendRequests(), 'GET', '/friends/requests'],
	['sendFriendRequest', () => users.sendFriendRequest(ID), 'POST', '/friends/requests'],
	['acceptFriend', () => users.acceptFriend(ID), 'POST', `/friends/requests/${ID}/accept`],
	['dropFriendRequest', () => users.dropFriendRequest(ID), 'DELETE', `/friends/requests/${ID}`],
	['removeFriend', () => users.removeFriend(ID), 'DELETE', `/friends/${ID}`],
];

describe('api wrappers', () => {
	it.each(CALLS)('%s', async (_name, run, method, path) => {
		await run();
		const [calledPath, init] = mockRequest.mock.calls[0]!;
		expect(calledPath).toBe(path);
		expect(init?.method ?? 'GET').toBe(method);
	});

	it('logs in with a password or a provider token and keeps the session', async () => {
		mockRequest.mockResolvedValue(TOKENS);
		await auth.logIn({ email: 'a@b.co', password: 'x' });
		expect(useSession.getState().accessToken).toBe('a');
		await useSession.getState().signOut();

		await social.socialLogIn('facebook', 'fb-token');
		expect(mockRequest.mock.calls[1]![1]).toMatchObject({ body: { accessToken: 'fb-token' } });
		await social.socialLogIn('google', 'id-token');
		expect(mockRequest.mock.calls[2]![1]).toMatchObject({ body: { idToken: 'id-token' } });
		expect(useSession.getState().status).toBe('signedIn');
	});

	it('logs out here even when the server cannot be reached', async () => {
		await useSession.getState().signIn(TOKENS);
		mockRequest.mockRejectedValue(new TypeError('Network request failed'));
		await auth.logOut();
		expect(useSession.getState().status).toBe('signedOut');
		expect(mockRequest.mock.calls[0]![0]).toBe('/auth/logout');
	});
});

describe('event state', () => {
	const calls: [string, () => Promise<unknown>, string][] = [
		['getEventState', () => events.getEventState(ID), `/events/${ID}/state`],
		['suggestTrack', () => events.suggestTrack(ID, 7), `/events/${ID}/tracks`],
		['vote', () => events.vote(ID, OTHER), `/events/${ID}/tracks/${OTHER}/vote`],
		['unvote', () => events.unvote(ID, OTHER), `/events/${ID}/tracks/${OTHER}/vote`],
		['skipTrack', () => events.skipTrack(ID, null), `/events/${ID}/next`],
	];

	it.each(calls)('%s stores the shared state and my votes apart', async (_name, run, path) => {
		queryClient.clear();
		mockRequest.mockResolvedValue(STATE);
		await run();
		expect(mockRequest.mock.calls[0]![0]).toBe(path);
		expect(queryClient.getQueryData(events.eventKeys.votes(ID))).toEqual([OTHER]);
		expect(queryClient.getQueryData(events.eventKeys.state(ID))).toMatchObject({ version: 4 });
	});

	it('never replaces a newer state with an older answer', async () => {
		queryClient.clear();
		mockRequest.mockResolvedValue(STATE);
		await events.getEventState(ID);
		mockRequest.mockResolvedValue({ ...STATE, version: 2 });
		await events.vote(ID, OTHER);
		expect(queryClient.getQueryData(events.eventKeys.state(ID))).toMatchObject({ version: 4 });
	});
});
