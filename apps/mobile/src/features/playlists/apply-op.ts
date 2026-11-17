import type { PlaylistEntry, PlaylistState, Track, UserSummary } from '@music-room/shared';

export type PlaylistOp =
	| { kind: 'add'; track: Track; afterEntryId?: string | null; by: UserSummary }
	| { kind: 'move'; entryId: string; afterEntryId: string | null }
	| { kind: 'remove'; entryId: string };

const insertAfter = (
	entries: PlaylistEntry[],
	entry: PlaylistEntry,
	afterId: string | null | undefined,
) => {
	if (afterId === undefined) return [...entries, entry];
	const at = afterId === null ? 0 : entries.findIndex((e) => e.id === afterId) + 1;
	// Unknown anchor (removed meanwhile): leave it at the end, the server answer will fix it.
	const index = afterId !== null && at === 0 ? entries.length : at;
	return [...entries.slice(0, index), entry, ...entries.slice(index)];
};

let pendingId = 0;

// Optimistic version of an operation. The version is kept, so the server's answer
// (or any broadcast) always replaces this guess.
export function applyOp(state: PlaylistState, op: PlaylistOp): PlaylistState {
	if (op.kind === 'remove') {
		return { ...state, entries: state.entries.filter((e) => e.id !== op.entryId) };
	}
	if (op.kind === 'move') {
		const entry = state.entries.find((e) => e.id === op.entryId);
		if (!entry) return state;
		const rest = state.entries.filter((e) => e.id !== op.entryId);
		return { ...state, entries: insertAfter(rest, entry, op.afterEntryId) };
	}
	const entry: PlaylistEntry = {
		id: `pending-${++pendingId}`,
		track: op.track,
		position: '',
		addedBy: op.by,
	};
	return { ...state, entries: insertAfter(state.entries, entry, op.afterEntryId) };
}

// Move targets for the up / down buttons, as "after which entry".
export function afterForUp(entries: PlaylistEntry[], index: number): string | null {
	return index <= 1 ? null : entries[index - 2]!.id;
}

export function afterForDown(entries: PlaylistEntry[], index: number): string | null | undefined {
	return index >= entries.length - 1 ? undefined : entries[index + 1]!.id;
}

// Entry the dragged one lands after once dropped at `to`; undefined when nothing moved.
export function afterForDrop(
	entries: PlaylistEntry[],
	from: number,
	to: number,
): string | null | undefined {
	if (from === to) return undefined;
	// Optimistic entries have no server id yet: anchor on the closest real entry above.
	const above = entries.filter((_, i) => i !== from).slice(0, to);
	return above.findLast((e) => !e.id.startsWith('pending-'))?.id ?? null;
}
