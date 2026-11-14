import type { EditLicense } from '@music-room/shared';

export { VISIBILITY_LABELS } from '@/features/events/labels';

export const EDIT_LABELS: Record<EditLicense, string> = {
	EVERYONE: 'Everyone who can see it edits',
	INVITED: 'Only invited members edit',
};
