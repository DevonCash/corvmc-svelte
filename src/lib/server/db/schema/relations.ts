import { defineRelations } from 'drizzle-orm';
import * as schema from './index';

export const relations = defineRelations(schema, (t) => ({
	user: {
		instruments: t.many.userInstrument(),
		genres: t.many.userGenre(),
		sessions: t.many.session(),
		accounts: t.many.account(),
		bandMembers: t.many.bandMember()
	},
	userInstrument: {
		user: t.one.user({ from: t.userInstrument.userId, to: t.user.id })
	},
	userGenre: {
		user: t.one.user({ from: t.userGenre.userId, to: t.user.id })
	},
	session: {
		user: t.one.user({ from: t.session.userId, to: t.user.id })
	},
	account: {
		user: t.one.user({ from: t.account.userId, to: t.user.id })
	},
	band: {
		genres: t.many.bandGenre(),
		members: t.many.bandMember(),
		events: t.many.event()
	},
	bandGenre: {
		band: t.one.band({ from: t.bandGenre.bandId, to: t.band.id })
	},
	bandMember: {
		band: t.one.band({ from: t.bandMember.bandId, to: t.band.id }),
		user: t.one.user({ from: t.bandMember.userId, to: t.user.id })
	},
	reservation: {
		createdBy: t.one.user({ from: t.reservation.createdByUserId, to: t.user.id }),
		recurringSeries: t.one.recurringSeries({
			from: t.reservation.recurringSeriesId,
			to: t.recurringSeries.id
		})
	},
	event: {
		reservation: t.one.reservation({ from: t.event.reservationId, to: t.reservation.id }),
		createdBy: t.one.user({ from: t.event.createdByUserId, to: t.user.id }),
		band: t.one.band({ from: t.event.bandId, to: t.band.id })
	},
	equipmentCategory: {
		equipment: t.many.equipment()
	},
	equipment: {
		category: t.one.equipmentCategory({ from: t.equipment.categoryId, to: t.equipmentCategory.id }),
		loans: t.many.equipmentLoan()
	},
	equipmentLoan: {
		equipment: t.one.equipment({ from: t.equipmentLoan.equipmentId, to: t.equipment.id }),
		user: t.one.user({ from: t.equipmentLoan.userId, to: t.user.id })
	},
	ticket: {
		event: t.one.event({ from: t.ticket.eventId, to: t.event.id }),
		user: t.one.user({ from: t.ticket.userId, to: t.user.id }),
		checkedInBy: t.one.user({ from: t.ticket.checkedInByUserId, to: t.user.id })
	},
	eventRsvp: {
		event: t.one.event({ from: t.eventRsvp.eventId, to: t.event.id }),
		user: t.one.user({ from: t.eventRsvp.userId, to: t.user.id })
	},
	paymentCache: {
		user: t.one.user({ from: t.paymentCache.userId, to: t.user.id }),
		reservation: t.one.reservation({ from: t.paymentCache.reservationId, to: t.reservation.id })
	},
	creditTransaction: {
		user: t.one.user({ from: t.creditTransaction.userId, to: t.user.id })
	},
	notification: {
		user: t.one.user({ from: t.notification.userId, to: t.user.id })
	},
	notificationPreference: {
		user: t.one.user({ from: t.notificationPreference.userId, to: t.user.id })
	},
	role: {
		users: t.many.modelHasRole(),
		permissions: t.many.roleHasPermission()
	},
	permission: {
		users: t.many.modelHasPermission(),
		roles: t.many.roleHasPermission()
	},
	modelHasRole: {
		role: t.one.role({ from: t.modelHasRole.roleId, to: t.role.id }),
		user: t.one.user({ from: t.modelHasRole.userId, to: t.user.id })
	},
	modelHasPermission: {
		permission: t.one.permission({ from: t.modelHasPermission.permissionId, to: t.permission.id }),
		user: t.one.user({ from: t.modelHasPermission.userId, to: t.user.id })
	},
	roleHasPermission: {
		permission: t.one.permission({ from: t.roleHasPermission.permissionId, to: t.permission.id }),
		role: t.one.role({ from: t.roleHasPermission.roleId, to: t.role.id })
	},
	subscriber: {
		user: t.one.user({ from: t.subscriber.userId, to: t.user.id }),
		audienceMembers: t.many.audienceMember()
	},
	audience: {
		members: t.many.audienceMember(),
		campaigns: t.many.campaignAudience()
	},
	audienceMember: {
		subscriber: t.one.subscriber({ from: t.audienceMember.subscriberId, to: t.subscriber.id }),
		audience: t.one.audience({ from: t.audienceMember.audienceId, to: t.audience.id })
	},
	campaign: {
		sentBy: t.one.user({ from: t.campaign.sentById, to: t.user.id }),
		audiences: t.many.campaignAudience()
	},
	campaignAudience: {
		campaign: t.one.campaign({ from: t.campaignAudience.campaignId, to: t.campaign.id }),
		audience: t.one.audience({ from: t.campaignAudience.audienceId, to: t.audience.id })
	},
	contentFlag: {
		reportedBy: t.one.user({ from: t.contentFlag.reportedByUserId, to: t.user.id }),
		resolvedBy: t.one.user({ from: t.contentFlag.resolvedByUserId, to: t.user.id })
	},
	helpCategory: {
		articles: t.many.helpArticle()
	},
	helpArticle: {
		category: t.one.helpCategory({ from: t.helpArticle.categoryId, to: t.helpCategory.id }),
		createdBy: t.one.user({ from: t.helpArticle.createdByUserId, to: t.user.id })
	},
	platformInvite: {
		band: t.one.band({ from: t.platformInvite.bandId, to: t.band.id }),
		invitedBy: t.one.user({ from: t.platformInvite.invitedById, to: t.user.id })
	},
	inboxThread: {
		messages: t.many.inboxMessage(),
		notes: t.many.inboxNote(),
		assignedTo: t.one.user({ from: t.inboxThread.assignedToUserId, to: t.user.id })
	},
	inboxMessage: {
		thread: t.one.inboxThread({ from: t.inboxMessage.threadId, to: t.inboxThread.id }),
		author: t.one.user({ from: t.inboxMessage.authorUserId, to: t.user.id })
	},
	inboxNote: {
		thread: t.one.inboxThread({ from: t.inboxNote.threadId, to: t.inboxThread.id }),
		author: t.one.user({ from: t.inboxNote.authorUserId, to: t.user.id })
	}
}));
