import nodemailer from 'nodemailer';
import type { Env } from '../config/env.js';

export type Mail = { to: string; subject: string; text: string; html: string };
export type Mailer = { send(mail: Mail): Promise<void> };

export function createSmtpMailer(env: Env): Mailer {
	const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT });
	return {
		send: async (mail) => {
			await transport.sendMail({ from: env.MAIL_FROM, ...mail });
		},
	};
}
