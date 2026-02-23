import cron from 'node-cron';
import Ticket from '../models/ticket.model.js';
import User from '../models/user.model.js';
import RelationshipManager from '../models/relationship.model.js';
import Franchise from '../models/franchise.model.js';
import {
  getRegionalManagerUser,
  getAdminUsers,
  createNotification,
  isWithinWorkingHours,
  calculateSLADeadlineForEscalation,
} from '../services/ticket.service.js';

/**
 * Run every 5 minutes - check for tickets that have exceeded SLA and escalate
 */
function runEscalationCheck() {
  const now = new Date();

  // Only run during working hours (7 AM - 6 PM)
  if (!isWithinWorkingHours(now)) {
    return;
  }

  Ticket.find({
    status: { $nin: ['Resolved'] },
    escalationLevel: { $lte: 2 },
  })
    .populate('raisedBy', 'managedBy managedByModel')
    .lean()
    .then(async (tickets) => {
      for (const ticket of tickets) {
        if (!ticket.slaDeadline || new Date(ticket.slaDeadline) > now) continue;

        if (ticket.escalationLevel === 1) {
          // Escalate to Regional Manager
          const agent = ticket.raisedBy;
          if (!agent) continue;

          let regionalManagerId = null;

          if (agent.managedByModel === 'RelationshipManager') {
            const rm = await RelationshipManager.findById(agent.managedBy)
              .select('regionalManager')
              .lean();
            regionalManagerId = rm?.regionalManager;
          } else if (agent.managedByModel === 'Franchise') {
            const franchise = await Franchise.findById(agent.managedBy)
              .select('regionalManager')
              .lean();
            regionalManagerId = franchise?.regionalManager;
          }

          if (!regionalManagerId) continue;

          const rmUser = await getRegionalManagerUser(regionalManagerId);
          if (!rmUser) continue;

          const { slaDeadline, slaTimerStartedAt } = calculateSLADeadlineForEscalation(now);

          await Ticket.findByIdAndUpdate(ticket._id, {
            escalationLevel: 2,
            assignedRole: 'regional_manager',
            assignedTo: rmUser._id,
            status: 'Escalated to Regional Manager',
            slaDeadline,
            slaTimerStartedAt,
          });

          await createNotification(
            rmUser._id,
            'Service Request escalated from RM – No action within SLA',
            `SRN ${ticket.ticketId} – ${ticket.category} requires your attention`,
            ticket._id,
            'ticket_escalated'
          );

          // Notify previous assignee
          if (ticket.assignedTo) {
            await createNotification(
              ticket.assignedTo,
              'Service Request escalated',
              `SRN ${ticket.ticketId} has been escalated to Regional Manager`,
              ticket._id,
              'ticket_escalated'
            );
          }
        } else if (ticket.escalationLevel === 2) {
          // Escalate to Admin
          const admins = await getAdminUsers();
          const admin = admins[0];
          if (!admin) continue;

          await Ticket.findByIdAndUpdate(ticket._id, {
            escalationLevel: 3,
            assignedRole: 'super_admin',
            assignedTo: admin._id,
            status: 'Escalated to Admin',
            priority: 'High',
          });

          await createNotification(
            admin._id,
            'Critical Service Request Escalated – Immediate Attention Required',
            `SRN ${ticket.ticketId} – ${ticket.category} escalated from Regional Manager`,
            ticket._id,
            'ticket_escalated'
          );

          if (ticket.assignedTo) {
            await createNotification(
              ticket.assignedTo,
              'Service Request escalated to Admin',
              `SRN ${ticket.ticketId} has been escalated to Admin`,
              ticket._id,
              'ticket_escalated'
            );
          }
        }
      }
    })
    .catch((err) => {
      console.error('Ticket escalation job error:', err);
    });
}

/**
 * Start the cron job - run every 5 minutes
 */
export function startTicketEscalationJob() {
  cron.schedule('*/5 * * * *', runEscalationCheck, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  console.log('Ticket escalation cron job started (every 5 minutes)');
}

