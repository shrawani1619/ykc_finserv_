import reportService from '../services/report.service.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Generate leads report
 */
export const generateLeadsReport = async (req, res, next) => {
  try {
    const filters = req.query;
    const report = await reportService.generateLeadsReport(filters);

    res.download(report.path, report.filename, async (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error downloading report',
        });
      }
      // Optionally delete file after download
      // await fs.unlink(report.path);
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate commissions report
 */
export const generateCommissionsReport = async (req, res, next) => {
  try {
    const filters = req.query;
    const report = await reportService.generateCommissionsReport(filters);

    res.download(report.path, report.filename, async (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error downloading report',
        });
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate payouts report
 */
export const generatePayoutsReport = async (req, res, next) => {
  try {
    const filters = req.query;
    const report = await reportService.generatePayoutsReport(filters);

    res.download(report.path, report.filename, async (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error downloading report',
        });
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate TDS report
 */
export const generateTDSReport = async (req, res, next) => {
  try {
    const filters = req.query;
    const report = await reportService.generateTDSReport(filters);

    res.download(report.path, report.filename, async (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error downloading report',
        });
      }
    });
  } catch (error) {
    next(error);
  }
};
