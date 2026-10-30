import type { Mail } from '../../mail/mailer.js';

// Templates only hold fixed text and URL-safe tokens: nothing to escape.
const link = (path: 'verify' | 'reset', token: string) =>
	`musicroom://${path}?token=${encodeURIComponent(token)}`;

const html = (text: string, url?: string) =>
	`<p>${text}</p>${url ? `<p><a href="${url}">${url}</a></p>` : ''}`;

export function verifyMail(to: string, token: string): Mail {
	const url = link('verify', token);
	const text = 'Confirm your email to start using Music Room. The link expires in 24 hours.';
	return {
		to,
		subject: 'Confirm your Music Room email',
		text: `${text}\n\n${url}\n`,
		html: html(text, url),
	};
}

export function resetMail(to: string, token: string): Mail {
	const url = link('reset', token);
	const text =
		'Open this link to choose a new password. It expires in 1 hour. If you did not ask for it, ignore this mail.';
	return {
		to,
		subject: 'Reset your Music Room password',
		text: `${text}\n\n${url}\n`,
		html: html(text, url),
	};
}

export function alreadyRegisteredMail(to: string): Mail {
	const text =
		'Someone tried to create a Music Room account with this email, which already has one. If it was you, log in or use "Forgot password". Otherwise, ignore this mail.';
	return { to, subject: 'Your Music Room account', text: `${text}\n`, html: html(text) };
}
