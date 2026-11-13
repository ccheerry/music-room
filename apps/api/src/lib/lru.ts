// Small LRU with per-entry expiry (Map keeps insertion order).
export function createLru<V>(maxEntries: number, ttlMs: number, now = () => Date.now()) {
	const entries = new Map<string, { value: V; expiresAt: number }>();

	return {
		get(key: string): V | undefined {
			const hit = entries.get(key);
			if (!hit) return undefined;
			entries.delete(key);
			if (hit.expiresAt <= now()) return undefined;
			entries.set(key, hit);
			return hit.value;
		},
		set(key: string, value: V): void {
			entries.delete(key);
			entries.set(key, { value, expiresAt: now() + ttlMs });
			if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
		},
	};
}
