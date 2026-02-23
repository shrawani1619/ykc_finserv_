import Form16 from '../models/form16.model.js';

/**
 * Create Form 16 / TDS
 */
export const createForm16 = async (req, res, next) => {
  try {
    const { formType, attachmentName, attachment, attachmentDate, fileName, fileSize, mimeType } = req.body;

    if (!attachment) {
      return res.status(400).json({
        success: false,
        error: 'Attachment is required',
      });
    }

    if (!attachmentDate) {
      return res.status(400).json({
        success: false,
        error: 'Attachment date is required',
      });
    }

    const form16 = await Form16.create({
      formType: formType || 'form16',
      attachmentName: attachmentName || '',
      attachment,
      attachmentDate: new Date(attachmentDate),
      fileName,
      fileSize,
      mimeType,
      status: req.body.status || 'active',
      metadata: req.body.metadata || {},
    });

    res.status(201).json({
      success: true,
      data: form16,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Form 16 / TDS
 */
export const getForm16List = async (req, res, next) => {
  try {
    const forms = await Form16.find().sort({ attachmentDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: forms,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Form 16 By ID
 */
export const getForm16ById = async (req, res, next) => {
  try {
    const form = await Form16.findById(req.params.id);

    if (!form) {
      return res.status(404).json({
        success: false,
        error: 'Form 16 / TDS record not found',
      });
    }

    res.status(200).json({
      success: true,
      data: form,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Form 16 / TDS
 */
export const updateForm16 = async (req, res, next) => {
  try {
    const { formType, attachmentName, attachment, attachmentDate, fileName, fileSize, mimeType, status } = req.body;

    const form = await Form16.findById(req.params.id);

    if (!form) {
      return res.status(404).json({
        success: false,
        error: 'Form 16 / TDS record not found',
      });
    }

    if (formType !== undefined) form.formType = formType;
    if (attachmentName !== undefined) form.attachmentName = attachmentName;
    if (attachment !== undefined) form.attachment = attachment;
    if (attachmentDate !== undefined) form.attachmentDate = new Date(attachmentDate);
    if (fileName !== undefined) form.fileName = fileName;
    if (fileSize !== undefined) form.fileSize = fileSize;
    if (mimeType !== undefined) form.mimeType = mimeType;
    if (status !== undefined) form.status = status;
    if (req.body.metadata !== undefined) form.metadata = req.body.metadata;

    await form.save();

    res.status(200).json({
      success: true,
      data: form,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Form 16 / TDS
 */
export const deleteForm16 = async (req, res, next) => {
  try {
    const form = await Form16.findById(req.params.id);

    if (!form) {
      return res.status(404).json({
        success: false,
        error: 'Form 16 / TDS record not found',
      });
    }

    await Form16.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Form 16 / TDS record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

