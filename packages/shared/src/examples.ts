import { z } from 'zod';
import * as auth from './auth.js';
import * as catalog from './catalog.js';
import * as devices from './devices.js';
import { ErrorBody } from './errors.js';
import * as events from './events.js';
import { HealthResponse } from './health.js';
import * as playlists from './playlists.js';
import * as social from './social.js';
import * as users from './users.js';

// One example per request body and answer, shown in the API documentation. They are
// attached here, in one place, and checked against their schemas by the tests.
export const EXAMPLES: { schema: z.ZodType; value: unknown }[] = [];
function example<T extends z.ZodType>(schema: T, value: z.input<T>): void {
	EXAMPLES.push({ schema, value });
	z.globalRegistry.add(schema, { example: value });
}

const ID = {
	alice: '2f29243a-774a-44f0-bb2b-c653b61e7bf1',
	bob: '720f94cf-09c4-4c43-8daa-bd6f622e286a',
	event: '7bae8d33-fb98-466a-aa16-476866475b06',
	playlist: '2c05c603-1fb9-4fa9-a23b-b7a2fef32718',
	entry: 'cead1fa6-371b-42b6-80ad-23da1d84b493',
	device: '7cd56655-f024-40f0-ac73-72f7cfb13c85',
};
const alice = { id: ID.alice, displayName: 'Alice' };
const bob = { id: ID.bob, displayName: 'Bob' };
const track = {
	id: 3135563,
	title: 'Veridis Quo',
	artist: 'Daft Punk',
	album: 'Discovery',
	coverUrl: 'https://cdn-images.dzcdn.net/images/cover/discovery/250x250.jpg',
	previewUrl: 'https://cdnt-preview.dzcdn.net/api/1/1/veridis-quo.mp3',
	durationSec: 345,
};
const tokens = {
	accessToken: '<access token, a JWT>',
	refreshToken: '<refresh token>',
	expiresIn: 900,
};
const zone = {
	lat: 40.4168,
	lng: -3.7038,
	radiusM: 200,
	startsAt: '2026-11-14T20:00:00.000Z',
	endsAt: '2026-11-15T02:00:00.000Z',
};
const me = {
	...alice,
	relation: 'self' as const,
	publicInfo: { city: 'Madrid', bio: 'Always on the dance floor' },
	friendsInfo: { phone: '+34 600 000 001' },
	privateInfo: { birthday: '1995-04-12' },
	musicPrefs: ['Electro', 'Pop'],
	email: 'alice@musicroom.local',
	hasPassword: true,
	providers: ['google' as const],
};
const eventSummary = {
	id: ID.event,
	name: 'Friday party',
	owner: alice,
	visibility: 'PRIVATE' as const,
	voteLicense: 'INVITED' as const,
	isOwner: false,
	invited: true,
};
const playlistSummary = {
	id: ID.playlist,
	name: 'Road trip',
	owner: alice,
	visibility: 'PUBLIC' as const,
	editLicense: 'INVITED' as const,
	isOwner: false,
	member: true,
};
const playlistState = {
	playlistId: ID.playlist,
	version: 8,
	entries: [{ id: ID.entry, track, position: 'a0', addedBy: bob }],
};
const myDevice = {
	id: ID.device,
	name: 'Living room phone',
	platform: 'android',
	model: 'Pixel 8',
	appVersion: '1.0.0',
	lastSeenAt: '2026-11-14T10:42:23.000Z',
	current: true,
	online: true,
	grants: [{ user: bob, expiresAt: null }],
};

example(ErrorBody, { error: { code: 'NOT_FOUND', message: 'Event not found' } });
example(HealthResponse, { status: 'ok', db: 'ok' });

example(auth.RegisterBody, {
	email: 'alice@musicroom.local',
	password: 'musicroom1',
	displayName: 'Alice',
});
example(auth.LoginBody, { email: 'alice@musicroom.local', password: 'musicroom1' });
example(auth.EmailBody, { email: 'alice@musicroom.local' });
example(auth.VerifyBody, { token: '<token from the verification mail>' });
example(auth.ResetBody, { token: '<token from the reset mail>', password: 'newpass99' });
example(auth.RefreshBody, { refreshToken: tokens.refreshToken });
example(auth.ChangePasswordBody, { currentPassword: 'musicroom1', newPassword: 'newpass99' });
example(auth.TokenPair, tokens);
example(auth.MeResponse, me);
example(social.GoogleAuthBody, { idToken: '<Google id token>' });
example(social.FacebookAuthBody, { accessToken: '<Facebook access token>' });

example(users.UpdateMeBody, {
	displayName: 'Alice',
	publicInfo: { city: 'Madrid' },
	friendsInfo: { phone: '+34 600 000 001' },
	privateInfo: { birthday: '1995-04-12' },
	musicPrefs: ['Electro', 'Pop'],
});
example(users.UserProfile, {
	...bob,
	relation: 'friend',
	publicInfo: { city: 'Paris' },
	musicPrefs: ['Rock', 'Jazz'],
	friendsInfo: { bio: 'Plays guitar on Sundays' },
});
example(users.UserList, { items: [bob], hasMore: false });
example(users.FriendRequestBody, { userId: ID.bob });
example(users.FriendRequestResult, { status: 'requested' });
example(users.FriendList, [bob]);
example(users.FriendRequests, { incoming: [bob], outgoing: [] });

example(catalog.Track, track);
example(catalog.TrackList, { items: [track] });
example(catalog.GenreList, [
	{ id: 132, name: 'Pop' },
	{ id: 152, name: 'Rock' },
]);

example(events.CreateEventBody, {
	name: 'Friday party',
	visibility: 'PRIVATE',
	voteLicense: 'INVITED',
});
example(events.UpdateEventBody, { voteLicense: 'LOCATION', zone });
example(events.EventList, { items: [eventSummary], hasMore: false });
example(events.EventDetail, { ...eventSummary, zone: null, canVote: true, canSkip: true });
example(events.EventStateForUser, {
	eventId: ID.event,
	version: 7,
	current: { entryId: ID.entry, track, startedAt: '2026-11-14T21:02:23.000Z' },
	queue: [
		{
			id: '0b6f5c1e-3c0b-4d0e-9a55-0d1f6f6c2a10',
			track: { ...track, id: 67238732, title: 'Instant Crush' },
			votes: 2,
			suggestedBy: bob,
		},
	],
	myVotes: ['0b6f5c1e-3c0b-4d0e-9a55-0d1f6f6c2a10'],
});
example(events.SuggestBody, { deezerId: 3135563 });
example(events.VoteBody, { coords: { lat: 40.4169, lng: -3.7037 } });
example(events.InviteBody, { userId: ID.bob });
example(events.InviteList, [bob]);
example(events.NextBody, { currentEntryId: ID.entry });

example(playlists.CreatePlaylistBody, { name: 'Road trip', editLicense: 'INVITED' });
example(playlists.UpdatePlaylistBody, { visibility: 'PRIVATE' });
example(playlists.PlaylistList, { items: [playlistSummary], hasMore: false });
example(playlists.PlaylistDetail, { ...playlistSummary, canEdit: true });
example(playlists.PlaylistState, playlistState);
example(playlists.AddEntryBody, { deezerId: 3135563, afterEntryId: null });
example(playlists.MoveEntryBody, { afterEntryId: ID.entry });
example(playlists.MemberBody, { userId: ID.bob });
example(playlists.MemberList, [bob]);

example(devices.MyDeviceList, [myDevice]);
example(devices.RenameDeviceBody, { name: 'Living room phone' });
example(devices.GrantBody, { expiresAt: '2026-11-15T02:00:00.000Z' });
example(devices.ControllableList, [
	{
		id: ID.device,
		name: 'Living room phone',
		platform: 'android',
		owner: alice,
		online: true,
		expiresAt: null,
	},
]);
