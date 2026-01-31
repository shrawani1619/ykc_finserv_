import fileUploadService from '../services/fileUpload.service.js';
import Document from '../models/document.model.js';
import { getPaginationMeta } from '../utils/helpers.js';

/**
 * Upload document
 */
export const uploadDocument = async (req, res, next) => {
  try {
    const upload = fileUploadService.getUploadMiddleware('file');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      const { entityType, entityId, documentType, description } = req.body;

      if (!entityType || !entityId || !documentType) {
        return res.status(400).json({
          success: false,
          message: 'Entity type, entity ID, and document type are required',
        });
      }

      const document = await fileUploadService.saveDocument({
        entityType,
        entityId,
        documentType,
        fileName: req.file.filename,
        originalFileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user._id,
        description,
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
