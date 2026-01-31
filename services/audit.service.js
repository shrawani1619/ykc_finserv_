import AuditLog from '../models/auditLog.model.js';

/**
 * Audit Service
 * Tracks all user actions and system changes for compliance
 */
class AuditService {
  /**
   * Log user action
   * @param {Object} auditData - Audit data
   * @returns {Promise<Object>} Created audit log
   */
  async logAction(auditData) {
    try {
      const {
        userId,
        action,
        entityType,
        entityId,
        changes = {},
        previousValues = {},
        newValues = {},
        ipAddress,
        userAgent,
        metadata = {},
      } = auditData;

      const auditLog = await AuditLog.create({
        userId,
        action,
        entityType,
        entityId,
        changes,
        previousValues,
        newValues,
        ipAddress,
        userAgent,
        metadata,
      });

      return auditLog;
    } catch (error) {
      // Don't throw error for audit logging failures to prevent disrupting main flow
      console.error('Error logging audit action:', error);
      return null;
    }
  }

  /**
   * Log create action
   * @param {ObjectId} userId - User ID
   * @param {String} entityType - Entity type
   * @param {ObjectId} entityId - Entity ID
   * @param {Object} newValues - New values
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} Created audit log
   */
  async logCreate(userId, entityType, entityId, newValues, req) {
    return await this.logAction({
      userId,
      action: 'create',
      entityType,
      entityId,
      newValues,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Log update action
   * @param {ObjectId} userId - User ID
   * @param {String} entityType - Entity type
   * @param {ObjectId} entityId - Entity ID
   * @param {Object} previousValues - Previous values
   * @param {Object} newValues - New values
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} Created audit log
   */
  async logUpdate(userId, entityType, entityId, previousValues, newValues, req) {
    const changes = this.calculateChanges(previousValues, newValues);
    
    return await this.logAction({
      userId,
      action: 'update',
      entityType,
      entityId,
      changes,
      previousValues,
      newValues,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Log delete action
   * @param {ObjectId} userId - User ID
   * @param {String} entityType - Entity type
   * @param {ObjectId} entityId - Entity ID
   * @param {Object} previousValues - Previous values
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} Created audit log
   */
  async logDelete(userId, entityType, entityId, previousValues, req) {
    return await this.logAction({
      userId,
      action: 'delete',
      entityType,
      entityId,
      previousValues,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Calculate changes between two objects
   * @param {Object} previous - Previous values
   * @param {Object} current - Current values
   * @returns {Object} Changes object
   */
  calculateChanges(previous, current) {
    const changes = {};

    for (const key in current) {
      if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        changes[key] = {
          from: previous[key],
          to: current[key],
        };
      }
    }

    return changes;
  }

  /**
   * Get audit logs for an entity
   * @param {String} entityType - Entity type
   * @param {ObjectId} entityId - Entity ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Audit logs
   */
  async getEntityLogs(entityType, entityId, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      const skip = (page - 1) * limit;

      const logs = await AuditLog.find({
        entityType,
        entityId,
      })
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AuditLog.countDocuments({
        entityType,
        entityId,
      });

      return {
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new Error(`Error fetching audit logs: ${error.message}`);
    }
  }

  /**
   * Get user activity logs
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Audit logs
   */
  async getUserLogs(userId, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      const skip = (page - 1) * limit;

      const logs = await AuditLog.find({ userId })
        .populate('entityId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AuditLog.countDocuments({ userId });

      return {
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new Error(`Error fetching user logs: ${error.message}`);
    }
  }
}

export default new AuditService();
