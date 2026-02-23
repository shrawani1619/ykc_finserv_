import User from '../models/user.model.js';
import RelationshipManager from '../models/relationship.model.js';
import Franchise from '../models/franchise.model.js';
import Notification from '../models/notification.model.js';

// Working hours: 7:00 AM - 6:00 PM (11 hours)
const WORK_START_HOUR = 7;
const WORK_END_HOUR = 18;
const SLA_WORKING_HOURS_PER_LEVEL = 2;

/**
 * Get the assigned user (RM or Franchise owner) for an agent based on hierarchy
 * @param {ObjectId} agentUserId - User ID of the agent
 * @returns {Promise<{assignedUser: Object, assignedRole: string}>}
 */
export async function getAssignedUserForAgent(agentUserId) {
  const agent = await User.findById(agentUserId)
    .select('managedBy managedByModel')
    .lean();

  if (!agent || !agent.managedBy) {
    return { assignedUser: null, assignedRole: null };
  }

  if (agent.managedByModel === 'RelationshipManager') {
    const rm = await RelationshipManager.findById(agent.managedBy)
      .select('owner regionalManager')
      .populate('owner', 'name email')
      .lean();

    if (rm?.owner) {
      return {
        assignedUser: rm.owner,
        assignedRole: 'relationship_manager',
        regionalManagerId: rm.regionalManager,
      };
    }
  } else if (agent.managedByModel === 'Franchise') {
    const franchise = await Franchise.findById(agent.managedBy)
      .select('owner regionalManager')
      .populate('owner', 'name email')
      .lean();

    if (franchise?.owner) {
      return {
        assignedUser: franchise.owner,
        assignedRole: 'franchise',
        regionalManagerId: franchise.regionalManager,
      };
    }
  }

  return { assignedUser: null, assignedRole: null };
}

/**
 * Get Regional Manager User for escalation (Level 2)
 * @param {ObjectId} regionalManagerId - Regional Manager User ID
 * @returns {Promise<Object|null>}
 */
export async function getRegionalManagerUser(regionalManagerId) {
  if (!regionalManagerId) return null;
  return User.findById(regionalManagerId).select('name email').lean();
}

/**
 * Get Admin users (super_admin) for escalation (Level 3)
 * @returns {Promise<Object[]>}
 */
export async function getAdminUsers() {
  return User.find({ role: 'super_admin', status: 'active' })
    .select('name email')
    .limit(1)
    .lean();
}

/**
 * Check if a date is within working hours (7 AM - 6 PM)
 * @param {Date} d
 * @returns {boolean}
 */
export function isWithinWorkingHours(d) {
  const hour = d.getHours();
  const minute = d.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const startMinutes = WORK_START_HOUR * 60;
  const endMinutes = WORK_END_HOUR * 60;
  return totalMinutes >= startMinutes && totalMinutes < endMinutes;
}

/**
 * Get the next working day start (7:00 AM)
 * @param {Date} fromDate
 * @returns {Date}
 */
export function getNextWorkingDayStart(fromDate) {
  const next = new Date(fromDate);
  next.setDate(next.getDate() + 1);
  next.setHours(WORK_START_HOUR, 0, 0, 0);
  return next;
}

/**
 * Get start of current working day (7:00 AM)
 * @param {Date} d
 * @returns {Date}
 */
export function getWorkingDayStart(d) {
  const start = new Date(d);
  start.setHours(WORK_START_HOUR, 0, 0, 0);
  return start;
}

/**
 * Get end of current working day (6:00 PM)
 * @param {Date} d
 * @returns {Date}
 */
export function getWorkingDayEnd(d) {
  const end = new Date(d);
  end.setHours(WORK_END_HOUR, 0, 0, 0);
  return end;
}

/**
 * Calculate SLA deadline for Level 2 escalation (2 working hours from now)
 * @param {Date} fromDate
 * @returns {{slaDeadline: Date, slaTimerStartedAt: Date}}
 */
export function calculateSLADeadlineForEscalation(fromDate) {
  const from = new Date(fromDate);
  let slaTimerStartedAt;
  let slaDeadline;

  if (isWithinWorkingHours(from)) {
    slaTimerStartedAt = new Date(from);
    slaDeadline = addWorkingHours(from, SLA_WORKING_HOURS_PER_LEVEL);
  } else {
    slaTimerStartedAt = getNextWorkingDayStart(from);
    slaDeadline = addWorkingHours(slaTimerStartedAt, SLA_WORKING_HOURS_PER_LEVEL);
  }

  return { slaDeadline, slaTimerStartedAt };
}

/**
 * Calculate SLA deadline - 2 working hours from now (or from next 7 AM if outside working hours)
 * @param {Date} createdAt
 * @returns {{slaDeadline: Date, slaTimerStartedAt: Date}}
 */
export function calculateSLADeadline(createdAt) {
  const created = new Date(createdAt);
  let slaTimerStartedAt;
  let slaDeadline;

  if (isWithinWorkingHours(created)) {
    slaTimerStartedAt = new Date(created);
    slaDeadline = addWorkingHours(created, SLA_WORKING_HOURS_PER_LEVEL);
  } else {
    // Outside working hours - timer starts next working day at 7 AM
    slaTimerStartedAt = getNextWorkingDayStart(created);
    slaDeadline = addWorkingHours(slaTimerStartedAt, SLA_WORKING_HOURS_PER_LEVEL);
  }

  return { slaDeadline, slaTimerStartedAt };
}

/**
 * Add N working hours to a date (only counting 7 AM - 6 PM)
 * @param {Date} start
 * @param {number} hours
 * @returns {Date}
 */
function addWorkingHours(start, hours) {
  let current = new Date(start);
  let remaining = hours * 60; // in minutes

  while (remaining > 0) {
    const dayEnd = getWorkingDayEnd(current);
    if (current >= dayEnd) {
      current = getNextWorkingDayStart(current);
      continue;
    }

    const dayStart = getWorkingDayStart(current);
    if (current < dayStart) {
      current = new Date(dayStart);
      continue;
    }

    const minutesUntilDayEnd = (dayEnd - current) / (60 * 1000);
    if (remaining <= minutesUntilDayEnd) {
      current = new Date(current.getTime() + remaining * 60 * 1000);
      remaining = 0;
    } else {
      remaining -= minutesUntilDayEnd;
      current = getNextWorkingDayStart(current);
    }
  }

  return current;
}

/**
 * Generate unique Service Request Number (SRN) (e.g., SRN-2026-000145)
 * Format: SRN-YYYY-XXXXXX (6-digit sequential number per year)
 */
export async function generateTicketId() {
  const year = new Date().getFullYear();
  const prefix = `SRN-${year}-`;
  
  // Find the last ticket for this year to get the next sequence number
  const Ticket = (await import('../models/ticket.model.js')).default;
  const lastTicket = await Ticket.findOne({
    ticketId: { $regex: `^${prefix}` }
  })
    .sort({ ticketId: -1 })
    .select('ticketId')
    .lean();
  
  let sequence = 1;
  if (lastTicket && lastTicket.ticketId) {
    // Extract sequence number from last ticket (e.g., "SRN-2026-000145" -> 145)
    const match = lastTicket.ticketId.match(/-(\d+)$/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }
  
  // Format as 6-digit number with leading zeros
  const sequenceStr = sequence.toString().padStart(6, '0');
  return `${prefix}${sequenceStr}`;
}

/**
 * Create notification for ticket events
 */
export async function createNotification(userId, title, message, relatedTicketId, type = 'ticket_assigned') {
  return Notification.create({
    userId,
    title,
    message,
    relatedTicketId,
    isRead: false,
    type,
  });
}

