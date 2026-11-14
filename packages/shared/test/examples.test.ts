import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/index.js';

describe('documentation examples', () => {
	it('every example is valid for its schema', () => {
		expect(EXAMPLES.length).toBeGreaterThan(40);
		for (const { schema, value } of EXAMPLES) {
			const parsed = schema.safeParse(value);
			expect(parsed.success, JSON.stringify(value)).toBe(true);
		}
	});
});
