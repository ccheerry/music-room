import type { PlaylistEntry } from '@music-room/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PlaylistEntries } from '@/features/playlists/playlist-entries';

const by = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Ana' };
const entry = (id: string, n: number): PlaylistEntry => ({
	id,
	track: {
		id: n,
		title: `T${n}`,
		artist: 'A',
		album: 'B',
		coverUrl: null,
		previewUrl: null,
		durationSec: 1,
	},
	position: `a${n}`,
	addedBy: by,
});
const ENTRIES = [entry('a', 1), entry('b', 2), entry('c', 3)];

const setup = async (canEdit: boolean) => {
	const props = { onMove: jest.fn(), onRemove: jest.fn(), onPlay: jest.fn() };
	await render(<PlaylistEntries entries={ENTRIES} canEdit={canEdit} {...props} />);
	return props;
};

const rowOf = (id: string) => screen.getByTestId(`entry-${id}`);

describe('PlaylistEntries', () => {
	it('offers move and remove to screen readers on editable rows', async () => {
		const { onMove, onRemove } = await setup(true);
		await fireEvent(rowOf('b'), 'accessibilityAction', {
			nativeEvent: { actionName: 'moveUp' },
		});
		expect(onMove).toHaveBeenCalledWith(ENTRIES[1], null);
		await fireEvent(rowOf('a'), 'accessibilityAction', {
			nativeEvent: { actionName: 'moveDown' },
		});
		expect(onMove).toHaveBeenCalledWith(ENTRIES[0], 'b');
		await fireEvent(rowOf('c'), 'accessibilityAction', {
			nativeEvent: { actionName: 'delete' },
		});
		expect(onRemove).toHaveBeenCalledWith(ENTRIES[2]);
	});

	it('shows drag handles to editors', async () => {
		await setup(true);
		expect(screen.getByTestId('reorder-a', { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it('hides drag handles from viewers', async () => {
		await setup(false);
		expect(screen.queryByTestId('reorder-a', { includeHiddenElements: true })).toBeNull();
	});
});
