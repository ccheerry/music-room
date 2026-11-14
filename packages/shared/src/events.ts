import { z } from 'zod';
import { DeezerId, Track } from './catalog.js';
import { UserSummary } from './users.js';

export const Visibility = z.enum(['PUBLIC', 'PRIVATE']);
export type Visibility = z.infer<typeof Visibility>;

export const VoteLicense = z.enum(['EVERYONE', 'INVITED', 'LOCATION']);
export type VoteLicense = z.infer<typeof VoteLicense>;

export const Coords = z.strictObject({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180),
});
export type Coords = z.infer<typeof Coords>;

// Where and when a LOCATION event accepts votes.
export const VoteZone = Coords.extend({
	radiusM: z.number().int().min(10).max(50000),
	startsAt: z.iso.datetime(),
	endsAt: z.iso.datetime(),
}).refine((w) => w.startsAt < w.endsAt, {
	message: 'The end must be after the start',
	path: ['endsAt'],
});
export type VoteZone = z.infer<typeof VoteZone>;

const Name = z.string().trim().min(1, 'Enter a name').max(80, 'At most 80 characters');

const zoneRequired = (v: { voteLicense?: VoteLicense; zone?: VoteZone | null }) =>
	v.voteLicense !== 'LOCATION' || !!v.zone;
const zoneMessage = { message: 'A location vote needs a place and a time window', path: ['zone'] };

export const CreateEventBody = z
	.strictObject({
		name: Name,
		visibility: Visibility.default('PUBLIC'),
		voteLicense: VoteLicense.default('EVERYONE'),
		zone: VoteZone.nullable().optional(),
	})
	.refine(zoneRequired, zoneMessage);
export type CreateEventBody = z.input<typeof CreateEventBody>;

// The merged result is checked again by the server (license and zone may change separately).
export const UpdateEventBody = z.strictObject({
	name: Name.optional(),
	visibility: Visibility.optional(),
	voteLicense: VoteLicense.optional(),
	zone: VoteZone.nullable().optional(),
});
export type UpdateEventBody = z.infer<typeof UpdateEventBody>;

export const EventScope = z.enum(['all', 'discover', 'invited', 'mine']);
export type EventScope = z.infer<typeof EventScope>;

export const EventListQuery = z.strictObject({
	scope: EventScope.default('all'),
	q: z.string().trim().max(80).optional(),
	limit: z.coerce.number().int().min(1).max(50).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});
export type EventListQuery = z.infer<typeof EventListQuery>;

export const EventSummary = z.object({
	id: z.uuid(),
	name: z.string(),
	owner: UserSummary,
	visibility: Visibility,
	voteLicense: VoteLicense,
	isOwner: z.boolean(),
	invited: z.boolean(),
});
export type EventSummary = z.infer<typeof EventSummary>;

export const EventList = z.object({ items: z.array(EventSummary), hasMore: z.boolean() });
export type EventList = z.infer<typeof EventList>;

export const EventDetail = EventSummary.extend({
	zone: VoteZone.nullable(),
	// License check without the location part; LOCATION events still need coordinates.
	canVote: z.boolean(),
});
export type EventDetail = z.infer<typeof EventDetail>;

export const QueueEntry = z.object({
	id: z.uuid(),
	track: Track,
	votes: z.number().int().nonnegative(),
	suggestedBy: UserSummary,
});
export type QueueEntry = z.infer<typeof QueueEntry>;

export const NowPlaying = z.object({
	entryId: z.uuid(),
	track: Track,
	startedAt: z.iso.datetime(),
});
export type NowPlaying = z.infer<typeof NowPlaying>;

// Broadcast to event:<id> after every change. The queue is ranked by the server.
export const EventState = z.object({
	eventId: z.uuid(),
	version: z.number().int(),
	current: NowPlaying.nullable(),
	queue: z.array(QueueEntry),
});
export type EventState = z.infer<typeof EventState>;

// REST answer: the shared state plus the entries the caller voted for.
export const EventStateForUser = EventState.extend({ myVotes: z.array(z.uuid()) });
export type EventStateForUser = z.infer<typeof EventStateForUser>;

export const EventIdParams = z.strictObject({ id: z.uuid() });
export const EntryParams = z.strictObject({ id: z.uuid(), entryId: z.uuid() });
export const InviteeParams = z.strictObject({ id: z.uuid(), userId: z.uuid() });

export const SuggestBody = z.strictObject({ deezerId: DeezerId, coords: Coords.optional() });
export type SuggestBody = z.infer<typeof SuggestBody>;

export const VoteBody = z.strictObject({ coords: Coords.optional() });
export type VoteBody = z.infer<typeof VoteBody>;

export const InviteBody = z.strictObject({ userId: z.uuid() });
export type InviteBody = z.infer<typeof InviteBody>;

export const InviteList = z.array(UserSummary);

// "Next" names the entry the caller saw playing: two simultaneous requests skip one track.
export const NextBody = z.strictObject({ currentEntryId: z.uuid().nullable() });
export type NextBody = z.infer<typeof NextBody>;

export const EventErrorCode = {
	CannotVote: 'CANNOT_VOTE',
	OutsideZone: 'OUTSIDE_ZONE',
	OutsideWindow: 'OUTSIDE_WINDOW',
	NeedsLocation: 'LOCATION_REQUIRED',
	NoPreview: 'NO_PREVIEW',
	Stale: 'STALE',
} as const;
