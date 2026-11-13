import { PROFILE_FIELDS } from '@music-room/shared';

export const TIERS = [
	{ key: 'publicInfo', title: 'Public', audience: 'Everyone can see this' },
	{ key: 'friendsInfo', title: 'Friends', audience: 'Only your friends can see this' },
	{ key: 'privateInfo', title: 'Private', audience: 'Only you can see this' },
] as const;

export type TierKey = (typeof TIERS)[number]['key'];

export const FIELD_LABELS: Record<(typeof PROFILE_FIELDS)[number], string> = {
	bio: 'Bio',
	city: 'City',
	birthday: 'Birthday (YYYY-MM-DD)',
	phone: 'Phone',
};

export { PROFILE_FIELDS };
