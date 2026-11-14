import { type Coords, EventErrorCode } from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import type { Event } from '../../generated/prisma/client.js';
import { distanceM } from '../../lib/geo.js';
import { httpError } from '../../plugins/errors.js';

// The only place that decides who sees, votes in and manages an event.

export const eventNotFound = () => httpError(404, 'NOT_FOUND', 'Event not found');

export async function isInvited(prisma: PrismaClient, eventId: string, userId: string) {
	const invite = await prisma.eventInvite.findUnique({
		where: { eventId_userId: { eventId, userId } },
	});
	return invite !== null;
}

export async function canView(prisma: PrismaClient, event: Event, userId: string) {
	if (event.visibility === 'PUBLIC' || event.ownerId === userId) return true;
	return isInvited(prisma, event.id, userId);
}

// License part only; returns the reason when refused.
export async function voteRefusal(
	prisma: PrismaClient,
	event: Event,
	userId: string,
	coords: Coords | undefined,
	now = new Date(),
): Promise<{ code: string; message: string } | null> {
	if (event.ownerId === userId) return null;
	if (event.voteLicense === 'EVERYONE') return null;
	if (event.voteLicense === 'INVITED') {
		return (await isInvited(prisma, event.id, userId))
			? null
			: { code: EventErrorCode.CannotVote, message: 'Only invited people can vote' };
	}
	if (!event.voteStartsAt || !event.voteEndsAt || event.lat === null || event.lng === null) {
		return { code: EventErrorCode.CannotVote, message: 'Voting is not set up' };
	}
	if (now < event.voteStartsAt || now > event.voteEndsAt) {
		return { code: EventErrorCode.OutsideWindow, message: 'Voting is closed right now' };
	}
	if (!coords) {
		return { code: EventErrorCode.NeedsLocation, message: 'Share your location to vote' };
	}
	if (distanceM(coords, { lat: event.lat, lng: event.lng }) > (event.radiusM ?? 0)) {
		return { code: EventErrorCode.OutsideZone, message: 'You are too far from the event' };
	}
	return null;
}

// Loads an event the user may see; strangers get the same 404 as a missing event.
export async function loadVisible(prisma: PrismaClient, eventId: string, userId: string) {
	const event = await prisma.event.findUnique({ where: { id: eventId } });
	if (!event || !(await canView(prisma, event, userId))) throw eventNotFound();
	return event;
}

export async function loadOwned(prisma: PrismaClient, eventId: string, userId: string) {
	const event = await loadVisible(prisma, eventId, userId);
	if (event.ownerId !== userId) {
		throw httpError(403, 'FORBIDDEN', 'Only the owner can do this');
	}
	return event;
}
