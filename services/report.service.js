import XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Invoice from '../models/invoice.model.js';
import Payout from '../models/payout.model.js';
import Lead from '../models/lead.model.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Report Service
 * Handles Excel and CSV report generation
 */
class ReportService {
  /**
   * Generate leads report
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Report file data
   */
  async generateLeadsReport(filters = {}) {
    try {
      const query = {};

      if (filters.agentId) query.agent = filters.agentId;
      if (filters.franchiseId) query.franchise = filters.franchiseId;
      if (filters.bankId) query.bank = filters.bankId;
      if (filters.status) query.status = filters.status;
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }

      const leads = await Lead.find(query)
        .populate('agent', 'name email')
        .populate('franchise', 'name')
        .populate('bank', 'name')
        .sort({ createdAt: -1 });

      // Prepare data for Excel
      const reportData = leads.map((lead) => ({
        'Case Number': lead.caseNumber || 'N/A',
        'Lead Type': lead.leadType,
        'Mobile': lead.applicantMobile,
        'Email': lead.applicantEmail || 'N/A',
        'Loan Type': lead.loanType,
        'Loan Amount': formatCurrency(lead.loanAmount),
        'Agent': lead.agent?.name || 'N/A',
        'Franchise': lead.franchise?.name || 'N/A',
        'Bank': lead.bank?.name || 'N/A',
        'Status': lead.status,
        'Sanctioned Amount': lead.sanctionedAmount ? formatCurrency(lead.sanctionedAmount) : 'N/A',
        'Disbursed Amount': formatCurrency(lead.disbursedAmount),
        'Commission Amount': lead.actualCommission ? formatCurrency(lead.actualCommission) : 'N/A',
        'Created Date': formatDate(lead.createdAt),
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Report');

      // Generate file
      const exportsDir = path.join(__dirname, '../exports');
      await fs.mkdir(exportsDir, { recursive: true });

      const filename = `leads_report_${Date.now()}.xlsx`;
      const filePath = path.join(exportsDir, filename);

      XLSX.writeFile(workbook, filePath);

      return {
        filename,
        path: filePath,
        rowCount: reportData.length,
      };
    } catch (error) {
      throw new Error(`Error generating leads report: ${error.message}`);
    }
  }

  /**
   * Generate commissions report
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Report file data
   */
  async generateCommissionsReport(filters = {}) {
    try {
      const query = {};

      if (filters.agentId) query.agent = filters.agentId;
      if (filters.franchiseId) query.franchise = filters.franchiseId;
      if (filters.status) query.status = filters.status;

      const invoices = await Invoice.find(query)
        .populate('agent', 'name email')
        .populate('franchise', 'name')
        .populate('lead', 'caseNumber loanType')
        .sort({ createdAt: -1 });

      const reportData = invoices.map((invoice) => ({
        'Invoice Number': invoice.invoiceNumber,
        'Case Number': invoice.lead?.caseNumber || 'N/A',
        'Agent': invoice.agent?.name || 'N/A',
        'Franchise': invoice.franchise?.name || 'N/A',
        'Commission Amount': formatCurrency(invoice.commissionAmount),
        'TDS Amount': formatCurrency(invoice.tdsAmount),
        'TDS %': `${invoice.tdsPercentage}%`,
        'Net Payable': formatCurrency(invoice.netPayable),
        'Status': invoice.status,
        'Invoice Date': formatDate(invoice.invoiceDate),
        'Created Date': formatDate(invoice.createdAt),
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Commissions Report');

      const exportsDir = path.join(__dirname, '../exports');
      await fs.mkdir(exportsDir, { recursive: true });

      const filename = `commissions_report_${Date.now()}.xlsx`;
      const filePath = path.join(exportsDir, filename);

      XLSX.writeFile(workbook, filePath);

      return {
        filename,
        path: filePath,
        rowCount: reportData.length,
      };
    } catch (error) {
      throw new Error(`Error generating commissions report: ${error.message}`);
    }
  }

  /**
   * Generate payouts report
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Report file data
   */
  async generatePayoutsReport(filters = {}) {
    try {
      const query = {};

      if (filters.agentId) query.agent = filters.agentId;
      if (filters.franchiseId) query.franchise = filters.franchiseId;
      if (filters.status) query.status = filters.status;

      const payouts = await Payout.find(query)
        .populate('agent', 'name email')
        .populate('franchise', 'name')
        .populate('invoices')
        .sort({ createdAt: -1 });

      const reportData = payouts.map((payout) => ({
        'Payout Number': payout.payoutNumber,
        'Agent': payout.agent?.name || 'N/A',
        'Franchise': payout.franchise?.name || 'N/A',
        'Total Amount': formatCurrency(payout.totalAmount),
        'TDS Amount': formatCurrency(payout.tdsAmount),
        'Net Payable': formatCurrency(payout.netPayable),
        'Status': payout.status,
        'Account Number': payout.bankDetails?.accountNumber || 'N/A',
        'IFSC': payout.bankDetails?.ifsc || 'N/A',
        'Bank Name': payout.bankDetails?.bankName || 'N/A',
        'Processed Date': payout.processedAt ? formatDate(payout.processedAt) : 'N/A',
        'Payment Date': payout.paymentConfirmation?.confirmedAt ? formatDate(payout.paymentConfirmation.confirmedAt) : 'N/A',
        'Created Date': formatDate(payout.createdAt),
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payouts Report');

      const exportsDir = path.join(__dirname, '../exports');
      await fs.mkdir(exportsDir, { recursive: true });

      const filename = `payouts_report_${Date.now()}.xlsx`;
      const filePath = path.join(exportsDir, filename);

      XLSX.writeFile(workbook, filePath);

      return {
        filename,
        path: filePath,
        rowCount: reportData.length,
      };
    } catch (error) {
      throw new Error(`Error generating payouts report: ${error.message}`);
    }
  }

  /**
   * Generate TDS report
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Report file data
   */
  async generateTDSReport(filters = {}) {
    try {
      const query = {};

      if (filters.agentId) query.agent = filters.agentId;
      if (filters.franchiseId) query.franchise = filters.franchiseId;
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }

      const invoices = await Invoice.find(query)
        .populate('agent', 'name email pan')
        .populate('franchise', 'name')
        .sort({ createdAt: -1 });

      const reportData = invoices.map((invoice) => ({
        'Invoice Number': invoice.invoiceNumber,
        'Agent Name': invoice.agent?.name || 'N/A',
        'Agent PAN': invoice.agent?.kyc?.pan || 'N/A',
        'Franchise': invoice.franchise?.name || 'N/A',
        'Commission Amount': formatCurrency(invoice.commissionAmount),
        'TDS Amount': formatCurrency(invoice.tdsAmount),
        'TDS %': `${invoice.tdsPercentage}%`,
        'Invoice Date': formatDate(invoice.invoiceDate),
        'Financial Year': this.getFinancialYear(invoice.invoiceDate),
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'TDS Report');

      const exportsDir = path.join(__dirname, '../exports');
      await fs.mkdir(exportsDir, { recursive: true });

      const filename = `tds_report_${Date.now()}.xlsx`;
      const filePath = path.join(exportsDir, filename);

      XLSX.writeFile(workbook, filePath);

      return {
        filename,
        path: filePath,
        rowCount: reportData.length,
      };
    } catch (error) {
      throw new Error(`Error generating TDS report: ${error.message}`);
    }
  }

  /**
   * Get financial year from date
   * @param {Date} date - Date
   * @returns {String} Financial year
   */
  getFinancialYear(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    
    if (month >= 4) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }
}

export default new ReportService();
