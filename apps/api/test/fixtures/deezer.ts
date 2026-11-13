// Deezer response shapes, trimmed to the fields we read.
export const deezerTrack = (id: number, title = `Track ${id}`) => ({
	id,
	title,
	duration: 215,
	preview: `https://cdn.deezer.test/preview/${id}.mp3`,
	artist: { name: 'Daft Punk' },
	album: { title: 'Discovery', cover_medium: `https://cdn.deezer.test/cover/${id}.jpg` },
});

const json = (body: unknown) =>
	new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

// Answers /search, /track/:id (ids ≥ 900000000 are unknown) and /genre like Deezer does.
export const fakeDeezerFetch = (async (input: string | URL | Request) => {
	const url = new URL(String(input));
	const track = url.pathname.match(/^\/track\/(\d+)$/);
	if (track) {
		const id = Number(track[1]);
		if (id >= 900000000) return json({ error: { type: 'DataException', code: 800 } });
		return json(deezerTrack(id));
	}
	if (url.pathname === '/search') {
		const q = url.searchParams.get('q') ?? '';
		return json({ data: [deezerTrack(1, `${q} one`), deezerTrack(2, `${q} two`)], total: 2 });
	}
	if (url.pathname === '/genre') {
		return json({
			data: [
				{ id: 0, name: 'All' },
				{ id: 132, name: 'Pop' },
			],
		});
	}
	return new Response('not found', { status: 404 });
}) as typeof fetch;
