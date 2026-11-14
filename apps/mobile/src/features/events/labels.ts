import type { VoteLicense, Visibility } from '@music-room/shared';

export const VISIBILITY_LABELS: Record<Visibility, string> = {
	PUBLIC: 'Public: anyone can find it',
	PRIVATE: 'Private: invited people only',
};

export const LICENSE_LABELS: Record<VoteLicense, string> = {
	EVERYONE: 'Everyone who can see it votes',
	INVITED: 'Only invited people vote',
	LOCATION: 'People at the place, during a time window',
};
