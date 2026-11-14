import { z } from 'zod';
import { DeezerId, Track } from './catalog.js';
import { ErrorBody } from './errors.js';
import { Visibility } from './events.js';
import { UserSummary } from './users.js';

export const EditLicense = z.enum(['EVERYONE', 'INVITED']);
export type EditLicense = z.infer<typeof EditLicense>;

const Name = z.string().trim().min(1, 'Enter a name').max(80, 'At most 80 characters');

export const CreatePlaylistBody = z.strictObject({
	name: Name,
	visibility: Visibility.default('PUBLIC'),
	editLicense: EditLicense.default('EVERYONE'),
});
export type CreatePlaylistBody = z.input<typeof CreatePlaylistBody>;

export const UpdatePlaylistBody = z.strictObject({
	name: Name.optional(),
	visibility: Visibility.optional(),
	editLicense: EditLicense.optional(),
});
export type UpdatePlaylistBody = z.infer<typeof UpdatePlaylistBody>;

export const PlaylistScope = z.enum(['all', 'mine', 'shared', 'public']);
export type PlaylistScope = z.infer<typeof PlaylistScope>;

export const PlaylistListQuery = z.strictObject({
	scope: PlaylistScope.default('all'),
	q: z.string().trim().max(80).optional(),
	limit: z.coerce.number().int().min(1).max(50).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});
export type PlaylistListQuery = z.infer<typeof PlaylistListQuery>;

export const PlaylistSummary = z.object({
	id: z.uuid(),
	name: z.string(),
	owner: UserSummary,
	visibility: Visibility,
	editLicense: EditLicense,
	isOwner: z.boolean(),
	member: z.boolean(),
});
export type PlaylistSummary = z.infer<typeof PlaylistSummary>;

export const PlaylistList = z.object({ items: z.array(PlaylistSummary), hasMore: z.boolean() });
export type PlaylistList = z.infer<typeof PlaylistList>;

export const PlaylistDetail = PlaylistSummary.extend({ canEdit: z.boolean() });
export type PlaylistDetail = z.infer<typeof PlaylistDetail>;

// `position` is a fractional index: entries sort by it, byte order.
export const PlaylistEntry = z.object({
	id: z.uuid(),
	track: Track,
	position: z.string(),
	addedBy: UserSummary,
});
export type PlaylistEntry = z.infer<typeof PlaylistEntry>;

// Broadcast to playlist:<id> after every change, entries in order.
export const PlaylistState = z.object({
	playlistId: z.uuid(),
	version: z.number().int(),
	entries: z.array(PlaylistEntry),
});
export type PlaylistState = z.infer<typeof PlaylistState>;

// Operations name entries by id. afterEntryId null = first; omitted on add = last.
export const AddEntryBody = z.strictObject({
	deezerId: DeezerId,
	afterEntryId: z.uuid().nullable().optional(),
});
export type AddEntryBody = z.infer<typeof AddEntryBody>;

export const MoveEntryBody = z.strictObject({ afterEntryId: z.uuid().nullable() });
export type MoveEntryBody = z.infer<typeof MoveEntryBody>;

export const PlaylistIdParams = z.strictObject({ id: z.uuid() });
export const PlaylistEntryParams = z.strictObject({ id: z.uuid(), entryId: z.uuid() });
export const MemberParams = z.strictObject({ id: z.uuid(), userId: z.uuid() });
export const MemberBody = z.strictObject({ userId: z.uuid() });
export type MemberBody = z.infer<typeof MemberBody>;
export const MemberList = z.array(UserSummary);

// 409 answer when an operation names an entry that no longer exists: the current state comes along.
export const StaleResponse = ErrorBody.extend({ state: PlaylistState });
export type StaleResponse = z.infer<typeof StaleResponse>;
