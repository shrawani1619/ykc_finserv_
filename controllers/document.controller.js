import fileUploadService from '../services/fileUpload.service.js';
import Document from '../models/document.model.js';
import { getPaginationMeta } from '../utils/helpers.js';
import User from '../models/user.model.js';
import Lead from '../models/lead.model.js';
import Franchise from '../models/franchise.model.js';
import RelationshipManager from '../models/relationship.model.js';

/**
 * Authorization helper - determines if a user can view documents for an entity
 */
const canViewEntity = async (user, entityType, entityId) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;

  // Agent: can view documents of leads he created
  if (user.role === 'agent') {
    if (entityType === 'lead') {
      const lead = await Lead.findById(entityId).select('agent');
      return !!lead && lead.agent && lead.agent.toString() === user._id.toString();
    }
    return false;
  }

  // Relationship manager or Franchise: can view docs of their agents and leads
  if (user.role === 'relationship_manager' || user.role === 'franchise') {
    // User (agent) documents
    if (entityType === 'user') {
      const agent = await User.findById(entityId).select('managedBy managedByModel');
      if (!agent) return false;
      if (agent.managedByModel === 'RelationshipManager') {
        const rm = await RelationshipManager.findById(agent.managedBy).select('owner');
        if (rm && rm.owner && rm.owner.toString() === user._id.toString()) return true;
      } else if (agent.managedByModel === 'Franchise') {
        const franchiseId = user.franchiseOwned || user.franchise;
        if (agent.managedBy && franchiseId && agent.managedBy.toString() === franchiseId.toString()) return true;
      }
      return false;
    }

    // Lead documents
    if (entityType === 'lead') {
      const lead = await Lead.findById(entityId).select('agent associated associatedModel');
      if (!lead) return false;
      const agent = await User.findById(lead.agent).select('managedBy managedByModel');
      if (!agent) return false;
      if (agent.managedByModel === 'RelationshipManager') {
        const rm = await RelationshipManager.findById(agent.managedBy).select('owner');
        if (rm && rm.owner && rm.owner.toString() === user._id.toString()) return true;
      } else if (agent.managedByModel === 'Franchise') {
        const franchiseId = user.franchiseOwned || user.franchise;
        if (agent.managedBy && franchiseId && agent.managedBy.toString() === franchiseId.toString()) return true;
      }
      return false;
    }

    // Franchise owners can view their own franchise documents
    if (entityType === 'franchise' && user.role === 'franchise') {
      const franchiseId = user.franchiseOwned || user.franchise;
      return franchiseId && franchiseId.toString() === entityId.toString();
    }

    return false;
  }

  // Regional manager: can view docs for entities under their region
  if (user.role === 'regional_manager') {
    if (entityType === 'franchise') {
      const franchise = await Franchise.findById(entityId).select('regionalManager');
      return !!franchise && franchise.regionalManager && franchise.regionalManager.toString() === user._id.toString();
    }
    if (entityType === 'relationship_manager') {
      const rm = await RelationshipManager.findById(entityId).select('regionalManager');
      return !!rm && rm.regionalManager && rm.regionalManager.toString() === user._id.toString();
    }
    if (entityType === 'user') {
      const agent = await User.findById(entityId).select('managedBy managedByModel');
      if (!agent) return false;
      if (agent.managedByModel === 'Franchise') {
        const franchise = await Franchise.findById(agent.managedBy).select('regionalManager');
        return !!franchise && franchise.regionalManager && franchise.regionalManager.toString() === user._id.toString();
      } else if (agent.managedByModel === 'RelationshipManager') {
        const rm = await RelationshipManager.findById(agent.managedBy).select('regionalManager');
        return !!rm && rm.regionalManager && rm.regionalManager.toString() === user._id.toString();
      }
      return false;
    }
    if (entityType === 'lead') {
      const lead = await Lead.findById(entityId).select('agent');
      if (!lead) return false;
      const agent = await User.findById(lead.agent).select('managedBy managedByModel');
      if (!agent) return false;
      if (agent.managedByModel === 'Franchise') {
        const franchise = await Franchise.findById(agent.managedBy).select('regionalManager');
        return !!franchise && franchise.regionalManager && franchise.regionalManager.toString() === user._id.toString();
      } else if (agent.managedByModel === 'RelationshipManager') {
        const rm = await RelationshipManager.findById(agent.managedBy).select('regionalManager');
        return !!rm && rm.regionalManager && rm.regionalManager.toString() === user._id.toString();
      }
      return false;
    }
  }

  return false;
};

/**
 * Upload document
 */
export const uploadDocument = async (req, res, next) => {
  try {
    // Accept any file field names (handles multiple named inputs like pan, aadhaar, gst)
    const upload = fileUploadService.getAnyUploadMiddleware();

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      // Support both single-file (req.file) and any-field uploads (req.files)
      const incomingFile = req.file || (Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : null);
      if (!incomingFile) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      // Debug log of incoming files
      if (req.files && req.files.length > 0) {
        console.log(`Received ${req.files.length} file(s) on upload endpoint. Using first file:`, {
          fieldname: incomingFile.fieldname,
          originalname: incomingFile.originalname,
          mimetype: incomingFile.mimetype,
          size: incomingFile.size,
        });
      } else {
        console.log('Received single file upload:', {
          fieldname: incomingFile.fieldname,
          originalname: incomingFile.originalname,
          mimetype: incomingFile.mimetype,
          size: incomingFile.size,
        });
      }

      const { entityType, entityId, documentType, description } = req.body;

      if (!entityType || !entityId || !documentType) {
        return res.status(400).json({
          success: false,
          message: 'Entity type, entity ID, and document type are required',
        });
      }
      // Process the uploaded file (upload to Cloudinary if configured, else save locally)
      const document = await fileUploadService.processUploadedFile(incomingFile, {
        entityType,
        entityId,
        documentType,
        description,
        uploadedBy: req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: document,
      });
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get documents for an entity
 */
export const getDocuments = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 10, verificationStatus } = req.query;
    const skip = (page - 1) * limit;

    const allowed = await canViewEntity(req.user, entityType, entityId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const query = { entityType, entityId };
    if (verificationStatus) query.verificationStatus = verificationStatus;

    const documents = await Document.find(query)
      .populate('uploadedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Document.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: documents,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get document by ID
 */
export const getDocumentById = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('verifiedBy', 'name email');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }
    // Authorization: ensure user can view this document based on its entity
    const allowed = await canViewEntity(req.user, document.entityType, document.entityId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify document
 */
export const verifyDocument = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status',
      });
    }

    const document = await fileUploadService.verifyDocument(
      req.params.id,
      status,
      req.user._id,
      remarks
    );

    res.status(200).json({
      success: true,
      message: 'Document verified successfully',
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete document
 */
export const deleteDocument = async (req, res, next) => {
  try {
    await fileUploadService.deleteDocument(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download document file
 */
export const downloadDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }
    // Authorization: ensure user can download/view this document
    const allowed = await canViewEntity(req.user, document.entityType, document.entityId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.download(document.filePath, document.originalFileName, (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error downloading file',
        });
      }
    });
  } catch (error) {
    next(error);
  }
};
