import {
	type CreateEventBody,
	type EventDetail,
	type EventList,
	type EventListQuery,
	type EventSummary,
	type UpdateEventBody,
	type UserSummary,
	type VoteZone,
	CreateEventBody as CreateSchema,
} from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import type { Event, Prisma } from '../../generated/prisma/client.js';
import { httpError } from '../../plugins/errors.js';
import { isUniqueViolation } from '../auth/service.js';
import { isInvited, loadOwned, loadVisible, voteRefusal } from './access.js';

const owner = { select: { id: true, displayName: true } } as const;
type EventWithOwner = Event & { owner: UserSummary };

const zoneOf = (e: Event): VoteZone | null =>
	e.lat === null || e.lng === null || !e.radiusM || !e.voteStartsAt || !e.voteEndsAt
		? null
		: {
				lat: e.lat,
				lng: e.lng,
				radiusM: e.radiusM,
				startsAt: e.voteStartsAt.toISOString(),
				endsAt: e.voteEndsAt.toISOString(),
			};

const zoneColumns = (zone: VoteZone | null | undefined) =>
	zone === undefined
		? {}
		: {
				lat: zone?.lat ?? null,
				lng: zone?.lng ?? null,
				radiusM: zone?.radiusM ?? null,
				voteStartsAt: zone ? new Date(zone.startsAt) : null,
				voteEndsAt: zone ? new Date(zone.endsAt) : null,
			};

export type EventHooks = {
	// After an event is deleted or a user loses access to it.
	onDeleted: (eventId: string) => void;
	onAccessLost: (eventId: string, userId: string) => Promise<void>;
};

export function createEventsService({
	prisma,
	hooks,
}: {
	prisma: PrismaClient;
	hooks: EventHooks;
}) {
	const summary = (e: EventWithOwner, userId: string, invited: boolean): EventSummary => ({
		id: e.id,
		name: e.name,
		owner: e.owner,
		visibility: e.visibility,
		voteLicense: e.voteLicense,
		isOwner: e.ownerId === userId,
		invited,
	});

	async function list(
		userId: string,
		{ scope, q, limit, offset }: EventListQuery,
	): Promise<EventList> {
		const reachable: Prisma.EventWhereInput[] = [
			{ visibility: 'PUBLIC' },
			{ ownerId: userId },
			{ invites: { some: { userId } } },
		];
		const scoped: Record<typeof scope, Prisma.EventWhereInput> = {
			all: { OR: reachable },
			discover: { visibility: 'PUBLIC', ownerId: { not: userId } },
			invited: { invites: { some: { userId } } },
			mine: { ownerId: userId },
		};
		const rows = await prisma.event.findMany({
			where: { ...scoped[scope], ...(q && { name: { contains: q, mode: 'insensitive' } }) },
			include: { owner, invites: { where: { userId }, select: { userId: true } } },
			orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
			skip: offset,
			take: limit + 1,
		});
		return {
			items: rows.slice(0, limit).map((e) => summary(e, userId, e.invites.length > 0)),
			hasMore: rows.length > limit,
		};
	}

	async function detail(userId: string, eventId: string): Promise<EventDetail> {
		const event = await loadVisible(prisma, eventId, userId);
		const withOwner = await prisma.event.findUniqueOrThrow({
			where: { id: eventId },
			include: { owner },
		});
		const refusal = await voteRefusal(prisma, event, userId, undefined);
		const locationOnly = refusal?.code === 'LOCATION_REQUIRED';
		return {
			...summary(withOwner, userId, await isInvited(prisma, eventId, userId)),
			zone: zoneOf(event),
			canVote: refusal === null || locationOnly,
		};
	}

	async function create(userId: string, body: CreateEventBody): Promise<EventDetail> {
		const { zone, ...rest } = CreateSchema.parse(body);
		const event = await prisma.event.create({
			data: { ...rest, ownerId: userId, ...zoneColumns(zone ?? null) },
		});
		return detail(userId, event.id);
	}

	async function update(
		userId: string,
		eventId: string,
		body: UpdateEventBody,
	): Promise<EventDetail> {
		const event = await loadOwned(prisma, eventId, userId);
		const { zone, ...rest } = body;
		const license = rest.voteLicense ?? event.voteLicense;
		const nextZone = zone === undefined ? zoneOf(event) : zone;
		if (license === 'LOCATION' && !nextZone) {
			throw httpError(
				400,
				'VALIDATION_ERROR',
				'A location vote needs a place and a time window',
			);
		}
		await prisma.event.update({
			where: { id: eventId },
			data: { ...rest, ...zoneColumns(zone), version: { increment: 1 } },
		});
		return detail(userId, eventId);
	}

	async function remove(userId: string, eventId: string): Promise<void> {
		await loadOwned(prisma, eventId, userId);
		await prisma.event.delete({ where: { id: eventId } });
		hooks.onDeleted(eventId);
	}

	async function invite(userId: string, eventId: string, inviteeId: string): Promise<void> {
		await loadOwned(prisma, eventId, userId);
		if (!(await prisma.user.findUnique({ where: { id: inviteeId } }))) {
			throw httpError(404, 'NOT_FOUND', 'User not found');
		}
		try {
			await prisma.eventInvite.create({ data: { eventId, userId: inviteeId } });
		} catch (err) {
			if (!isUniqueViolation(err)) throw err;
		}
	}

	async function uninvite(userId: string, eventId: string, inviteeId: string): Promise<void> {
		const event = await loadOwned(prisma, eventId, userId);
		await prisma.eventInvite.deleteMany({ where: { eventId, userId: inviteeId } });
		if (event.visibility === 'PRIVATE') await hooks.onAccessLost(eventId, inviteeId);
	}

	async function invites(userId: string, eventId: string): Promise<UserSummary[]> {
		await loadOwned(prisma, eventId, userId);
		const rows = await prisma.eventInvite.findMany({
			where: { eventId },
			include: { user: owner },
			orderBy: { createdAt: 'asc' },
		});
		return rows.map((r) => r.user);
	}

	return { list, detail, create, update, remove, invite, uninvite, invites };
}

export type EventsService = ReturnType<typeof createEventsService>;
