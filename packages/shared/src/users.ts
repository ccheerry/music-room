import { z } from 'zod';

const Text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);

// Same shape for every tier, so a field can move between tiers. Empty strings mean "unset".
export const ProfileInfo = z.strictObject({
	bio: Text(300).optional(),
	city: Text(80).optional(),
	birthday: z
		.string()
		.regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use YYYY-MM-DD')
		.optional(),
	phone: Text(30).optional(),
});
export type ProfileInfo = z.infer<typeof ProfileInfo>;
export const PROFILE_FIELDS = ['bio', 'city', 'birthday', 'phone'] as const;

export const MusicPrefs = z
	.array(z.string().trim().min(1).max(40))
	.max(20, 'At most 20 preferences');

export const DisplayName = z
	.string()
	.trim()
	.min(1, 'Enter a name')
	.max(50, 'At most 50 characters');

// How the viewer relates to the user shown.
export const Relation = z.enum(['self', 'friend', 'requested', 'incoming', 'none']);
export type Relation = z.infer<typeof Relation>;

export const UserSummary = z.object({ id: z.uuid(), displayName: z.string() });
export type UserSummary = z.infer<typeof UserSummary>;

// What anyone sees.
export const PublicUser = UserSummary.extend({
	relation: Relation,
	publicInfo: ProfileInfo,
	musicPrefs: z.array(z.string()),
});
export type PublicUser = z.infer<typeof PublicUser>;

// What accepted friends see.
export const FriendUser = PublicUser.extend({ friendsInfo: ProfileInfo });
export type FriendUser = z.infer<typeof FriendUser>;

// What the owner sees.
export const SelfUser = FriendUser.extend({ email: z.email(), privateInfo: ProfileInfo });
export type SelfUser = z.infer<typeof SelfUser>;

// Most detailed first: a friend view never matches SelfUser, a public one never FriendUser.
export const UserProfile = z.union([SelfUser, FriendUser, PublicUser]);
export type UserProfile = z.infer<typeof UserProfile>;

export const UpdateMeBody = z.strictObject({
	displayName: DisplayName.optional(),
	publicInfo: ProfileInfo.optional(),
	friendsInfo: ProfileInfo.optional(),
	privateInfo: ProfileInfo.optional(),
	musicPrefs: MusicPrefs.optional(),
});
export type UpdateMeBody = z.infer<typeof UpdateMeBody>;

export const UserIdParams = z.strictObject({ id: z.uuid() });
export type UserIdParams = z.infer<typeof UserIdParams>;

export const UserSearchQuery = z.strictObject({
	q: z.string().trim().min(1).max(50),
	limit: z.coerce.number().int().min(1).max(50).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});
export type UserSearchQuery = z.infer<typeof UserSearchQuery>;

export const UserList = z.object({ items: z.array(UserSummary), hasMore: z.boolean() });
export type UserList = z.infer<typeof UserList>;

export const FriendRequestBody = z.strictObject({ userId: z.uuid() });
export type FriendRequestBody = z.infer<typeof FriendRequestBody>;

export const FriendRequestResult = z.object({ status: z.enum(['requested', 'friends']) });
export type FriendRequestResult = z.infer<typeof FriendRequestResult>;

export const FriendList = z.array(UserSummary);
export type FriendList = z.infer<typeof FriendList>;

export const FriendRequests = z.object({
	incoming: z.array(UserSummary),
	outgoing: z.array(UserSummary),
});
export type FriendRequests = z.infer<typeof FriendRequests>;
