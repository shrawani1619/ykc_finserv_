import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import Document from '../models/document.model.js';
import { sanitizeFilename, validateFileType } from '../utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowed file types for uploads
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * File Upload Service
 * Handles file uploads, validation, and storage
 */
class FileUploadService {
  constructor() {
    // Configure multer storage
    this.storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const uploadsDir = path.join(__dirname, '../uploads/documents');
          await fs.mkdir(uploadsDir, { recursive: true });
          cb(null, uploadsDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const sanitized = sanitizeFilename(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(sanitized);
        const nameWithoutExt = path.basename(sanitized, ext);
        cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
      },
    });

    // Configure multer upload
    this.upload = multer({
      storage: this.storage,
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        if (validateFileType(file.mimetype, ALLOWED_FILE_TYPES)) {
          cb(null, true);
        } else {
          cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`));
        }
      },
    });
  }

  /**
   * Get multer upload middleware
   * @param {String} fieldName - Form field name
   * @returns {Function} Multer middleware
   */
  getUploadMiddleware(fieldName = 'file') {
    return this.upload.single(fieldName);
  }

  /**
   * Get multer upload middleware for multiple files
   * @param {String} fieldName - Form field name
   * @param {Number} maxCount - Maximum number of files
   * @returns {Function} Multer middleware
   */
  getMultipleUploadMiddleware(fieldName = 'files', maxCount = 10) {
    return this.upload.array(fieldName, maxCount);
  }

  /**
   * Save document metadata to database
   * @param {Object} documentData - Document data
   * @returns {Promise<Object>} Created document
   */
  async saveDocument(documentData) {
    try {
      const {
        entityType,
        entityId,
        documentType,
        fileName,
        originalFileName,
        filePath,
        fileSize,
        mimeType,
        uploadedBy,
        description,
      } = documentData;

      const document = await Document.create({
        entityType,
        entityId,
        documentType,
        fileName,
        originalFileName,
        filePath,
        fileSize,
        mimeType,
        uploadedBy,
        description,
        verificationStatus: 'pending',
      });

      return document;
    } catch (error) {
      throw new Error(`Error saving document: ${error.message}`);
    }
  }

  /**
   * Delete document file and metadata
   * @param {ObjectId} documentId - Document ID
   * @returns {Promise<Boolean>} Success status
   */
  async deleteDocument(documentId) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Delete file from filesystem
      try {
        await fs.unlink(document.filePath);
      } catch (error) {
        console.error(`Error deleting file: ${error.message}`);
      }

      // Delete document from database
      await Document.findByIdAndDelete(documentId);

      return true;
    } catch (error) {
      throw new Error(`Error deleting document: ${error.message}`);
    }
  }

  /**
   * Get documents for an entity
   * @param {String} entityType - Entity type
   * @param {ObjectId} entityId - Entity ID
   * @returns {Promise<Array>} Documents array
   */
  async getDocuments(entityType, entityId) {
    try {
      const documents = await Document.find({
        entityType,
        entityId,
      })
        .populate('uploadedBy', 'name email')
        .populate('verifiedBy', 'name email')
        .sort({ createdAt: -1 });

      return documents;
    } catch (error) {
      throw new Error(`Error fetching documents: ${error.message}`);
    }
  }

  /**
   * Verify document
   * @param {ObjectId} documentId - Document ID
   * @param {String} status - Verification status
   * @param {ObjectId} verifiedBy - User ID
   * @param {String} remarks - Verification remarks
   * @returns {Promise<Object>} Updated document
   */
  async verifyDocument(documentId, status, verifiedBy, remarks = '') {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      document.verificationStatus = status;
      document.verifiedBy = verifiedBy;
      document.verifiedAt = new Date();
      document.verificationRemarks = remarks;

      await document.save();

      return document;
    } catch (error) {
      throw new Error(`Error verifying document: ${error.message}`);
    }
  }
}

export default new FileUploadService();
