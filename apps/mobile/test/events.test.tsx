import type { EventState, QueueEntry, Track } from '@music-room/shared';
import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { EventForm } from '@/features/events/event-form';
import { EventQueue } from '@/features/events/event-queue';
import { useEventPlayback } from '@/features/events/use-event-playback';
import { usePlayer } from '@/features/player/player';

const track = (id: number, title: string): Track => ({
	id,
	title,
	artist: 'Artist',
	album: 'Album',
	coverUrl: null,
	previewUrl: `https://cdn.test/${id}.mp3`,
	durationSec: 200,
});
const user = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Ana' };
const entry = (id: string, title: string, votes: number): QueueEntry => ({
	id,
	track: track(votes + 1, title),
	votes,
	suggestedBy: user,
});
const QUEUE = [entry('e1', 'Top', 3), entry('e2', 'Second', 1)];

describe('EventQueue', () => {
	it('renders the server order with ranks and counts', async () => {
		await render(<EventQueue queue={QUEUE} myVotes={[]} canVote onVote={jest.fn()} />);
		expect(screen.getByText('#1 · Artist · 3 votes')).toBeOnTheScreen();
		expect(screen.getByText('#2 · Artist · 1 vote')).toBeOnTheScreen();
	});

	it('shows which entries I voted and toggles on press', async () => {
		const onVote = jest.fn();
		await render(<EventQueue queue={QUEUE} myVotes={['e2']} canVote onVote={onVote} />);
		await fireEvent.press(screen.getByText('Voted'));
		expect(onVote).toHaveBeenCalledWith(QUEUE[1], true);
		await fireEvent.press(screen.getByText('Vote'));
		expect(onVote).toHaveBeenCalledWith(QUEUE[0], false);
	});

	it('hides vote buttons without the right to vote', async () => {
		await render(<EventQueue queue={QUEUE} myVotes={[]} canVote={false} onVote={jest.fn()} />);
		expect(screen.queryByText('Vote')).toBeNull();
	});

	it('invites to suggest when empty', async () => {
		await render(<EventQueue queue={[]} myVotes={[]} canVote onVote={jest.fn()} />);
		expect(screen.getByText('The queue is empty. Suggest a track!')).toBeOnTheScreen();
	});
});

describe('useEventPlayback', () => {
	const state = (entryId: string | null): EventState => ({
		eventId: 'ev',
		version: 1,
		current: entryId
			? {
					entryId,
					track: track(9, 'Now'),
					startedAt: new Date(Date.now() - 10_000).toISOString(),
				}
			: null,
		queue: [],
	});

	beforeEach(() => usePlayer.getState().stop());

	it('plays the current track at the server position on the owner phone', async () => {
		const load = jest.spyOn(usePlayer.getState(), 'load');
		await renderHook(() => useEventPlayback('ev', state('x'), true));
		const [loaded, options] = load.mock.calls[0]!;
		expect(loaded.title).toBe('Now');
		expect(options?.startMs).toBeGreaterThanOrEqual(10_000);
		expect(options?.source).toBe('event:ev');
		load.mockRestore();
	});

	it('does nothing on a guest phone', async () => {
		await renderHook(() => useEventPlayback('ev', state('x'), false));
		expect(usePlayer.getState().track).toBeNull();
	});
});

describe('EventForm', () => {
	it('asks for a place before creating a location event', async () => {
		const onSubmit = jest.fn();
		await render(<EventForm submitLabel="Create event" onSubmit={onSubmit} />);
		await fireEvent.changeText(screen.getByLabelText('Event name'), 'Party');
		await fireEvent.press(screen.getByText('People at the place, during a time window'));
		await fireEvent.press(screen.getByText('Create event'));
		expect(screen.getByText('Set the place first')).toBeOnTheScreen();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('submits the chosen visibility and license', async () => {
		const onSubmit = jest.fn(async () => undefined);
		await render(<EventForm submitLabel="Create event" onSubmit={onSubmit} />);
		await fireEvent.changeText(screen.getByLabelText('Event name'), ' Party ');
		await fireEvent.press(screen.getByText('Private: invited people only'));
		await fireEvent.press(screen.getByText('Only invited people vote'));
		await fireEvent.press(screen.getByText('Create event'));
		expect(onSubmit).toHaveBeenCalledWith({
			name: 'Party',
			visibility: 'PRIVATE',
			voteLicense: 'INVITED',
			zone: null,
		});
	});
});
