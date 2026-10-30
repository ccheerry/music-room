import { createHash, randomBytes } from 'node:crypto';

// 256-bit, URL-safe: used for refresh, verification and reset tokens.
export const randomToken = (): string => randomBytes(32).toString('base64url');

// Tokens are random and high-entropy, so a fast hash is enough; only the hash is stored.
export const hashToken = (token: string): string =>
	createHash('sha256').update(token).digest('hex');
