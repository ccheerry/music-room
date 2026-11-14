import type { Track } from '@music-room/shared';
import { type AudioPlayer, type AudioStatus, createAudioPlayer } from 'expo-audio';
import { create } from 'zustand';

type LoadOptions = {
	startMs?: number;
	autoplay?: boolean;
	// Who drives the player (an event, a playlist, a remote controller…).
	source?: string;
	onEnd?: () => void;
	// Provided by sources that have a list (a playlist played in order).
	controls?: Controls;
};

export type Controls = { next?: () => void; prev?: () => void };

type PlayerState = {
	track: Track | null;
	source: string | null;
	controls: Controls;
	playing: boolean;
	positionMs: number;
	durationMs: number;
	volume: number;
	load: (track: Track, options?: LoadOptions) => void;
	play: () => void;
	pause: () => void;
	seek: (ms: number) => void;
	setVolume: (volume: number) => void;
	stop: () => void;
};

// One audio player for the whole app, created on first use.
let audio: AudioPlayer | null = null;
let onEnd: (() => void) | undefined;

function getAudio(set: (s: Partial<PlayerState>) => void): AudioPlayer {
	if (audio) return audio;
	audio = createAudioPlayer(null, { updateInterval: 500 });
	audio.addListener('playbackStatusUpdate', (status: AudioStatus) => {
		set({
			playing: status.playing,
			positionMs: Math.round(status.currentTime * 1000),
			durationMs: Math.round(status.duration * 1000),
		});
		if (status.didJustFinish) onEnd?.();
	});
	return audio;
}

export const usePlayer = create<PlayerState>()((set, get) => ({
	track: null,
	source: null,
	controls: {},
	playing: false,
	positionMs: 0,
	durationMs: 0,
	volume: 1,
	load: (track, options = {}) => {
		const player = getAudio(set);
		onEnd = options.onEnd;
		set({
			track,
			source: options.source ?? null,
			controls: options.controls ?? {},
			positionMs: options.startMs ?? 0,
			playing: false,
		});
		if (!track.previewUrl) return;
		player.replace({ uri: track.previewUrl });
		player.volume = get().volume;
		if (options.startMs) void player.seekTo(options.startMs / 1000);
		if (options.autoplay ?? true) player.play();
	},
	play: () => {
		if (get().track?.previewUrl) getAudio(set).play();
	},
	pause: () => audio?.pause(),
	seek: (ms) => void audio?.seekTo(ms / 1000),
	setVolume: (volume) => {
		const clamped = Math.min(1, Math.max(0, volume));
		if (audio) audio.volume = clamped;
		set({ volume: clamped });
	},
	stop: () => {
		audio?.pause();
		onEnd = undefined;
		set({
			track: null,
			source: null,
			controls: {},
			playing: false,
			positionMs: 0,
			durationMs: 0,
		});
	},
}));
