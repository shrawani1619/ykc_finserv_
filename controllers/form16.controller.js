import Form16 from '../models/form16.model.js';

/**
 * Create Form 16 / TDS
 */
export const createForm16 = async (req, res, next) => {
  try {
    const { formType, attachmentName, attachment, attachmentDate, fileName, fileSize, mimeType, user } = req.body;

    if (!attachment) {
      return res.status(400).json({
        success: false,
        error: 'Attachment is required',
      });
    }

    // If user is provided, use it; otherwise use the logged-in user
    const userId = user || req.user._id;

    const form16 = await Form16.create({
      formType: formType || 'form16',
      attachmentName: attachmentName || '',
      attachment,
      attachmentDate: attachmentDate ? new Date(attachmentDate) : undefined,
      fileName,
      fileSize,
      mimeType,
      user: userId,
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
    const userRole = req.user.role;
    let query = {};

    // If user is not admin or accounts_manager, only show their own forms
    if (userRole !== 'super_admin' && userRole !== 'accounts_manager') {
      query.user = req.user._id;
    }

    const forms = await Form16.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });

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
    const form = await Form16.findById(req.params.id).populate('user', 'name email role');

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
    const { formType, attachmentName, attachment, attachmentDate, fileName, fileSize, mimeType, status, user } = req.body;

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
    if (attachmentDate !== undefined) form.attachmentDate = attachmentDate ? new Date(attachmentDate) : undefined;
    if (fileName !== undefined) form.fileName = fileName;
    if (fileSize !== undefined) form.fileSize = fileSize;
    if (mimeType !== undefined) form.mimeType = mimeType;
    if (status !== undefined) form.status = status;
    if (user !== undefined) form.user = user;
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

