import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Camera, 
  FileSpreadsheet, 
  Check, 
  AlertTriangle, 
  AlertCircle, 
  Trash2, 
  Plus, 
  RefreshCw, 
  ArrowRightLeft, 
  FileCode, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Info,
  SlidersHorizontal,
  X,
  Copy,
  Edit2,
  Download,
  Calendar,
  History,
  ArrowUpDown
} from 'lucide-react';
import { Account, Transaction, DocumentMatchAnalysis } from '../types';
import { Database } from '../utils';

export interface AccountSmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAcc: Account;
  db: Database;
  onDatabaseUpdate: () => void;
  onSelectAccount?: (accountId: string) => void;
  onTriggerToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
}

export interface PreviewImportRow {
  id: string;
  selected: boolean;
  date: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extraCharges: number;
  total: number; // formula: (quantity * unitPrice) + extraCharges
  type: 'debit' | 'credit';
  originalCurrency?: string;
  confidence?: 'high' | 'medium' | 'low';
  isEdited?: boolean;
}

export interface ImportHistoryRecord {
  id: string;
  timestamp: string;
  source: string;
  importedCount: number;
  skippedDuplicates: number;
  matchScore?: number;
  totalAmount: number;
  currency: string;
}

export type ImportTabMode = 'excel' | 'pdf_ai' | 'image_ai' | 'manual_pdf' | 'json';

// Helper to determine icon and colors for uploaded file types
export const getFileIndicator = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) {
    return { icon: <FileText size={14} />, label: 'ملف PDF', colors: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-500/20' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { icon: <FileSpreadsheet size={14} />, label: 'جدول بيانات', colors: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/20' };
  }
  if (['json'].includes(ext)) {
    return { icon: <FileCode size={14} />, label: 'ملف JSON', colors: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-500/20' };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(ext)) {
    return { icon: <Camera size={14} />, label: 'صورة', colors: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30 border-purple-500/20' };
  }
  return { icon: <FileText size={14} />, label: 'مستند', colors: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500/20' };
};

// Helper to convert Eastern Arabic / Persian numerals to Western digits
export const normalizeArabicNumerals = (str: string | number): string => {
  if (typeof str === 'number') return String(str);
  if (!str) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = String(str);
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], 'g'), String(i));
  }
  return result;
};

// Helper to reliably normalize any date value to standard YYYY-MM-DD
export const normalizeIsoDate = (dateVal: any): string => {
  if (!dateVal) return new Date().toISOString().split('T')[0];

  // If Excel serial number (days since Jan 1 1900)
  if (typeof dateVal === 'number' && !isNaN(dateVal)) {
    try {
      const dt = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
      if (!isNaN(dt.getTime())) {
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dt.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {}
  }

  // Convert Arabic numerals and trim
  const str = normalizeArabicNumerals(String(dateVal)).trim().split('T')[0].split(' ')[0];

  // Match standard YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Try parsing with standard Date
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch {}

  return new Date().toISOString().split('T')[0];
};

// Helper to compute Arabic Day Name from any date format
export const getArabicDayName = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const iso = normalizeIsoDate(dateStr);
    const parts = iso.split('-');
    if (parts.length < 3) return '-';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt.getTime())) return '-';
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return dayNames[dt.getDay()] || '-';
  } catch {
    return '-';
  }
};

export const AccountSmartImportModal: React.FC<AccountSmartImportModalProps> = ({
  isOpen,
  onClose,
  selectedAcc,
  db,
  onDatabaseUpdate,
  onSelectAccount,
  onTriggerToast,
}) => {
  const [activeTab, setActiveTab] = useState<ImportTabMode>('excel');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pdfTextData, setPdfTextData] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewImportRow[]>([]);
  const [recalcCounter, setRecalcCounter] = useState(0);
  
  // AI Analysis State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<number>(1);
  const [matchAnalysis, setMatchAnalysis] = useState<DocumentMatchAnalysis | null>(null);
  const [extractedMeta, setExtractedMeta] = useState<{
    docType?: string;
    invoiceNumber?: string;
    currency?: string;
    totalAmount?: number;
    partyName?: string;
  } | null>(null);

  // Currency Conversion state
  const [convertedCurrencyFrom, setConvertedCurrencyFrom] = useState<string | null>(null);

  // Mismatch acknowledgement checkbox
  const [acknowledgeMismatch, setAcknowledgeMismatch] = useState(false);

  // Import History for this account
  const [importHistory, setImportHistory] = useState<ImportHistoryRecord[]>([]);

  // Column Mapping state for Excel
  const [showColMapping, setShowColMapping] = useState(false);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [rawExcelRows, setRawExcelRows] = useState<any[]>([]);
  const [colMapping, setColMapping] = useState<{
    date: string;
    description: string;
    amount: string;
    quantity: string;
    unitPrice: string;
    extraCharges: string;
    debit: string;
    credit: string;
    type: string;
  }>({
    date: '',
    description: '',
    amount: '',
    quantity: '',
    unitPrice: '',
    extraCharges: '',
    debit: '',
    credit: '',
    type: ''
  });

  // Duplicate handling state
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Batch queue state for multi-files
  const [batchQueue, setBatchQueue] = useState<{ name: string; status: 'pending' | 'processing' | 'done' | 'error' }[]>([]);

  // File input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load account import history and saved column mapping
  useEffect(() => {
    if (isOpen && selectedAcc) {
      setPreviewRows([]);
      setImportFile(null);
      setPdfTextData('');
      setMatchAnalysis(null);
      setExtractedMeta(null);
      setAcknowledgeMismatch(false);
      setConvertedCurrencyFrom(null);
      setShowColMapping(false);
      setBatchQueue([]);

      // Load saved column mapping
      try {
        const saved = localStorage.getItem('smartacc_excel_colmap');
        if (saved) {
          setColMapping(prev => ({ ...prev, ...JSON.parse(saved) }));
        }
      } catch (e) {
        // ignore
      }

      // Load import history for this account
      try {
        const histKey = `smartacc_import_hist_${selectedAcc.id}`;
        const storedHist = localStorage.getItem(histKey);
        if (storedHist) {
          setImportHistory(JSON.parse(storedHist));
        } else {
          setImportHistory([]);
        }
      } catch (e) {
        setImportHistory([]);
      }
    }
  }, [isOpen, selectedAcc?.id]);

  if (!isOpen || !selectedAcc) return null;

  // Helper to safely build a preview row
  const createPreviewRow = (data: Partial<PreviewImportRow>): PreviewImportRow => {
    const qty = typeof data.quantity === 'number' && !isNaN(data.quantity) && data.quantity > 0 ? data.quantity : 1;
    const extra = typeof data.extraCharges === 'number' && !isNaN(data.extraCharges) ? data.extraCharges : 0;
    let price = typeof data.unitPrice === 'number' && !isNaN(data.unitPrice) ? data.unitPrice : 0;
    let total = typeof data.total === 'number' && !isNaN(data.total) ? data.total : (qty * price) + extra;

    if (price === 0 && total > 0) {
      price = Math.max(0, (total - extra) / qty);
    }
    if (total === 0 && price > 0) {
      total = (qty * price) + extra;
    }

    const isLowConfidence = data.confidence === 'low' || (price === 0 && total === 0) || !data.description;

    return {
      id: data.id || `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      selected: data.selected !== undefined ? data.selected : true,
      date: normalizeIsoDate(data.date),
      description: (data.description || 'قيد مالي مستورد').trim(),
      quantity: qty,
      unitPrice: Math.round(price * 100) / 100,
      extraCharges: Math.round(extra * 100) / 100,
      total: Math.round(total * 100) / 100,
      type: data.type || (selectedAcc.type === 'supplier' ? 'credit' : 'debit'),
      originalCurrency: data.originalCurrency,
      confidence: isLowConfidence ? 'low' : (data.confidence || 'high'),
      isEdited: data.isEdited || false
    };
  };

  // Prepare Account Context for AI Prompt
  const getAccountContext = () => {
    const accTxs = db.transactions
      .filter(t => t.accountId === selectedAcc.id && !t.deletedAt)
      .slice(-10)
      .map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type
      }));

    const otherAccounts = db.accounts
      .filter(a => a.id !== selectedAcc.id)
      .map(a => a.name);

    return {
      name: selectedAcc.name,
      type: selectedAcc.type,
      phone: selectedAcc.phone || '',
      currency: selectedAcc.currency || 'YER',
      openingBalance: selectedAcc.openingBalance || 0,
      recentTransactions: accTxs,
      allAccounts: otherAccounts
    };
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = err => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Run AI Parsing via /api/parse-document with multi-stage progress
  const processFileWithAi = async (file: File) => {
    setImportFile(file);
    setIsAiLoading(true);
    setLoadingStage(1);
    setMatchAnalysis(null);
    setExtractedMeta(null);
    setAcknowledgeMismatch(false);
    setConvertedCurrencyFrom(null);

    const stageTimer1 = setTimeout(() => setLoadingStage(2), 700);
    const stageTimer2 = setTimeout(() => setLoadingStage(3), 1600);
    const stageTimer3 = setTimeout(() => setLoadingStage(4), 2500);

    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const accountContext = getAccountContext();

      const response = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType,
          fileName: file.name,
          accountContext
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'فشل في استجابة الخادم أثناء تحليل المستند');
      }

      const resData = await response.json();
      const parsed = resData.data;

      if (!parsed) {
        throw new Error('لم يتم استرجاع بيانات صالحة من المستند.');
      }

      const extracted = parsed.extractedData || {};
      const analysis: DocumentMatchAnalysis = parsed.matchAnalysis || {
        matchScore: 80,
        isConsistent: true,
        warnings: [],
        suggestedAlternativeAccount: null
      };

      setMatchAnalysis(analysis);
      setExtractedMeta({
        docType: parsed.documentType || 'مستند مالي',
        invoiceNumber: extracted.invoiceNumber || extracted.referenceNumber || '',
        currency: extracted.currency || '',
        totalAmount: extracted.grandTotal || extracted.subtotal || 0,
        partyName: extracted.customerName || extracted.supplierName || extracted.companyName || ''
      });

      // Transform extracted ledger entries or items into Preview Rows
      const newRows: PreviewImportRow[] = [];
      const defaultDate = extracted.issueDate || extracted.date || new Date().toISOString().split('T')[0];
      const defaultType: 'debit' | 'credit' = selectedAcc.type === 'supplier' ? 'credit' : 'debit';

      // 1. Try ledger entries first
      if (Array.isArray(extracted.ledgerEntries) && extracted.ledgerEntries.length > 0) {
        extracted.ledgerEntries.forEach((entry: any, idx: number) => {
          const qty = Number(entry.quantity) || 1;
          const extra = Number(entry.extraCharges) || 0;
          let price = Number(entry.unitPrice || 0);
          const amt = Math.abs(Number(entry.total || entry.unitPrice || entry.amount || 0));
          if (price === 0 && amt > 0) {
            price = Math.round(((amt - extra) / qty) * 100) / 100;
          }
          const total = (qty * price) + extra;
          if (total > 0 || amt > 0) {
            newRows.push(createPreviewRow({
              id: `row_ai_${Date.now()}_${idx}`,
              selected: true,
              date: entry.date || defaultDate,
              description: entry.description || `قيد رقم ${idx + 1}`,
              quantity: qty,
              unitPrice: price,
              extraCharges: extra,
              total: total > 0 ? total : amt,
              type: (entry.type === 'credit' || entry.type === 'debit') ? entry.type : defaultType,
              originalCurrency: extracted.currency,
              confidence: (entry.unitPrice && entry.quantity) ? 'high' : 'medium'
            }));
          }
        });
      }

      // 2. If no ledger entries, use items list
      if (newRows.length === 0 && Array.isArray(extracted.items) && extracted.items.length > 0) {
        extracted.items.forEach((item: any, idx: number) => {
          const qty = Number(item.quantity) || 1;
          const price = Number(item.unitPrice || 0);
          const total = Number(item.total || (qty * price));
          if (total > 0 || price > 0) {
            newRows.push(createPreviewRow({
              id: `row_ai_${Date.now()}_${idx}`,
              selected: true,
              date: defaultDate,
              description: item.description || `بند رقم ${idx + 1}`,
              quantity: qty,
              unitPrice: price,
              extraCharges: 0,
              total: total > 0 ? total : price * qty,
              type: defaultType,
              originalCurrency: extracted.currency,
              confidence: 'high'
            }));
          }
        });
      }

      // 3. Fallback: single summary row if grand total exists
      if (newRows.length === 0 && (extracted.grandTotal || extracted.subtotal)) {
        const total = Math.abs(Number(extracted.grandTotal || extracted.subtotal));
        newRows.push(createPreviewRow({
          id: `row_ai_${Date.now()}_sum`,
          selected: true,
          date: defaultDate,
          description: `فاتورة / مستند رقم ${extracted.invoiceNumber || ''} - ${extracted.customerName || extracted.supplierName || 'عملية مالية'}`,
          quantity: 1,
          unitPrice: total,
          extraCharges: 0,
          total: total,
          type: defaultType,
          originalCurrency: extracted.currency,
          confidence: 'medium'
        }));
      }

      // Sort rows chronologically by date
      newRows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setPreviewRows(newRows);

      if (newRows.length === 0) {
        onTriggerToast('تم قراءة المستند لكن لم يتم العثور على أسطر قيود مالية محددة. يمكنك إضافة أسطر يدوياً.');
      }
    } catch (err: any) {
      console.error(err);
      onTriggerToast(`خطأ في التحليل: ${err.message || 'حدث خطأ غير متوقع'}`);
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      setIsAiLoading(false);
    }
  };

  // Handle Multi-file / Batch selection for PDF or Images
  const handleBatchFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    if (fileList.length === 1) {
      processFileWithAi(fileList[0]);
      return;
    }

    setBatchQueue(fileList.map(f => ({ name: f.name, status: 'pending' })));
    setIsAiLoading(true);

    const aggregatedRows: PreviewImportRow[] = [];
    const aggregatedWarnings: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setBatchQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'processing' } : item));

      try {
        const base64Data = await fileToBase64(file);
        const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        const response = await fetch('/api/parse-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64Data,
            mimeType,
            fileName: file.name,
            accountContext: getAccountContext()
          })
        });

        if (response.ok) {
          const resData = await response.json();
          const parsed = resData.data;
          const extracted = parsed?.extractedData || {};
          const defaultDate = extracted.issueDate || extracted.date || new Date().toISOString().split('T')[0];
          const defaultType: 'debit' | 'credit' = selectedAcc.type === 'supplier' ? 'credit' : 'debit';

          if (parsed?.matchAnalysis?.warnings) {
            aggregatedWarnings.push(...parsed.matchAnalysis.warnings);
          }

          if (Array.isArray(extracted.ledgerEntries) && extracted.ledgerEntries.length > 0) {
            extracted.ledgerEntries.forEach((entry: any, idx: number) => {
              const qty = Number(entry.quantity) || 1;
              const extra = Number(entry.extraCharges) || 0;
              let price = Number(entry.unitPrice || 0);
              const amt = Math.abs(Number(entry.total || entry.unitPrice || entry.amount || 0));
              if (price === 0 && amt > 0) {
                price = Math.round(((amt - extra) / qty) * 100) / 100;
              }
              const total = (qty * price) + extra;
              if (total > 0 || amt > 0) {
                aggregatedRows.push(createPreviewRow({
                  id: `batch_${i}_${idx}_${Date.now()}`,
                  selected: true,
                  date: entry.date || defaultDate,
                  description: `${entry.description || 'قيد مالي'} (${file.name})`,
                  quantity: qty,
                  unitPrice: price,
                  extraCharges: extra,
                  total: total > 0 ? total : amt,
                  type: (entry.type === 'credit' || entry.type === 'debit') ? entry.type : defaultType,
                  originalCurrency: extracted.currency
                }));
              }
            });
          } else if (extracted.grandTotal || extracted.subtotal) {
            const total = Math.abs(Number(extracted.grandTotal || extracted.subtotal));
            aggregatedRows.push(createPreviewRow({
              id: `batch_${i}_sum_${Date.now()}`,
              selected: true,
              date: defaultDate,
              description: `مستند: ${file.name} - ${extracted.invoiceNumber || ''}`,
              quantity: 1,
              unitPrice: total,
              extraCharges: 0,
              total: total,
              type: defaultType,
              originalCurrency: extracted.currency
            }));
          }

          setBatchQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item));
        } else {
          setBatchQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' } : item));
        }
      } catch (e) {
        setBatchQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' } : item));
      }
    }

    aggregatedRows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    setPreviewRows(aggregatedRows);
    setMatchAnalysis({
      matchScore: 85,
      isConsistent: true,
      warnings: Array.from(new Set(aggregatedWarnings)),
      suggestedAlternativeAccount: null
    });
    setIsAiLoading(false);
  };

  // Handle Excel Upload with auto-mapping
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const { read, utils } = await import('xlsx');
        const buffer = evt.target?.result;
        const wb = read(buffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const sheetObjects = utils.sheet_to_json(ws, { defval: '' }) as any[];
        if (sheetObjects.length === 0) {
          onTriggerToast('ملف الإكسل فارغ أو لا يحتوي على صفوف بيانات.');
          return;
        }

        const cols = Object.keys(sheetObjects[0]);
        setExcelColumns(cols);
        setRawExcelRows(sheetObjects);

        const findCol = (savedKey: string, synonyms: string[]): string => {
          if (savedKey && cols.includes(savedKey)) return savedKey;
          for (const col of cols) {
            const lower = col.toLowerCase().trim();
            if (synonyms.some(s => lower.includes(s.toLowerCase()))) return col;
          }
          return '';
        };

        const activeMap = {
          date: findCol(colMapping.date, ['تاريخ', 'التاريخ', 'date', 'dt', 'اليوم']),
          description: findCol(colMapping.description, ['بيان', 'البيان', 'وصف', 'الوصف', 'تفاصيل', 'التفاصيل', 'desc', 'description', 'detail', 'item', 'ملاحظات', 'شرح']),
          amount: findCol(colMapping.amount, ['مبلغ', 'المبلغ', 'قيمة', 'القيمة', 'إجمالي', 'الإجمالي', 'amount', 'val', 'total', 'net']),
          quantity: findCol(colMapping.quantity, ['كمية', 'الكمية', 'عدد', 'العدد', 'qty', 'quantity', 'count']),
          unitPrice: findCol(colMapping.unitPrice, ['سعر', 'السعر', 'سعر الوحدة', 'فردي', 'price', 'unit_price', 'rate']),
          extraCharges: findCol(colMapping.extraCharges, ['زيادات', 'الزيادات', 'رسوم', 'الرسوم', 'إضافي', 'مصاريف', 'extra', 'charges']),
          debit: findCol(colMapping.debit, ['مدين', 'المدين', 'منه', 'عليه', 'debit', 'dr']),
          credit: findCol(colMapping.credit, ['دائن', 'الدائن', 'له', 'إليه', 'credit', 'cr']),
          type: findCol(colMapping.type, ['نوع', 'نوع الحركة', 'النوع', 'حركة', 'type'])
        };

        setColMapping(activeMap);
        applyExcelMapping(sheetObjects, activeMap);
      } catch (err) {
        console.error(err);
        onTriggerToast('حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من صلاحية الملف.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Convert raw Excel objects to PreviewRows
  const applyExcelMapping = (rows: any[], mapping: typeof colMapping) => {
    const parseNum = (val: any) => {
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      if (!val) return 0;
      const cleaned = normalizeArabicNumerals(String(val)).replace(/,/g, '').trim();
      if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        const inner = parseFloat(cleaned.slice(1, -1));
        return isNaN(inner) ? 0 : -inner;
      }
      const res = parseFloat(cleaned);
      return isNaN(res) ? 0 : res;
    };

    const preview = rows.map((row: any, i: number) => {
      const dateRaw = mapping.date ? row[mapping.date] : row['تاريخ'] || row['التاريخ'] || new Date().toISOString().split('T')[0];
      const descRaw = mapping.description ? row[mapping.description] : row['بيان'] || row['البيان'] || 'قيد مالي مستورد';
      
      const debitVal = mapping.debit ? parseNum(row[mapping.debit]) : 0;
      const creditVal = mapping.credit ? parseNum(row[mapping.credit]) : 0;
      let amountVal = mapping.amount ? parseNum(row[mapping.amount]) : 0;

      const qtyVal = mapping.quantity && row[mapping.quantity] ? parseNum(row[mapping.quantity]) : 1;
      const priceVal = mapping.unitPrice && row[mapping.unitPrice] ? parseNum(row[mapping.unitPrice]) : 0;
      const extraVal = mapping.extraCharges && row[mapping.extraCharges] ? parseNum(row[mapping.extraCharges]) : 0;

      let txType: 'debit' | 'credit' = selectedAcc.type === 'supplier' ? 'credit' : 'debit';

      if (!isNaN(creditVal) && creditVal > 0) {
        txType = 'credit';
        amountVal = creditVal;
      } else if (!isNaN(debitVal) && debitVal > 0) {
        txType = 'debit';
        amountVal = debitVal;
      } else if (mapping.type && row[mapping.type]) {
        const typeStr = String(row[mapping.type]).trim();
        if (typeStr.includes('دائن') || typeStr.includes('credit') || typeStr.includes('خصم') || typeStr.includes('-') || typeStr.includes('له')) {
          txType = 'credit';
        } else {
          txType = 'debit';
        }
      } else if (amountVal < 0) {
        amountVal = Math.abs(amountVal);
        txType = selectedAcc.type === 'supplier' ? 'debit' : 'credit';
      }

      const dateFinal = normalizeIsoDate(dateRaw);
      const finalQty = isNaN(qtyVal) || qtyVal <= 0 ? 1 : qtyVal;
      const finalExtra = isNaN(extraVal) ? 0 : extraVal;
      let finalPrice = isNaN(priceVal) ? 0 : priceVal;

      if (finalPrice === 0 && amountVal > 0) {
        finalPrice = Math.max(0, (amountVal - finalExtra) / finalQty);
      }

      const finalTotal = amountVal > 0 && finalPrice === 0 ? amountVal : (finalQty * finalPrice) + finalExtra;

      return createPreviewRow({
        id: `excel_${Date.now()}_${i}`,
        date: dateFinal,
        description: String(descRaw || 'قيد مستورد'),
        quantity: finalQty,
        unitPrice: finalPrice,
        extraCharges: finalExtra,
        total: finalTotal,
        type: txType,
        confidence: finalPrice > 0 ? 'high' : 'low'
      });
    });

    preview.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    setPreviewRows(preview);
  };

  // Save Column Mapping Template to localStorage
  const handleSaveColMapping = () => {
    try {
      localStorage.setItem('smartacc_excel_colmap', JSON.stringify(colMapping));
      if (rawExcelRows.length > 0) {
        applyExcelMapping(rawExcelRows, colMapping);
      }
      setShowColMapping(false);
      onTriggerToast('تم حفظ قالب ربط الأعمدة بنجاح وسيطبق تلقائياً في المرات القادمة.');
    } catch (e) {
      // ignore
    }
  };

  // Manual PDF Text Parser
  const parsePdfText = (text: string) => {
    setPdfTextData(text);
    const lines = text.split('\n');
    const rows: PreviewImportRow[] = [];

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const normalizedLine = normalizeArabicNumerals(trimmed);
      const dateMatch = normalizedLine.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})|(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/);
      const rawDate = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];
      const date = normalizeIsoDate(rawDate);

      let content = normalizedLine.replace(rawDate || '', '').trim();

      let txType: 'debit' | 'credit' = selectedAcc.type === 'supplier' ? 'credit' : 'debit';
      if (content.includes('دائن') || content.includes('له') || content.includes('credit') || content.includes('تسديد') || content.includes('-') || content.includes('خصم')) {
        txType = 'credit';
      } else if (content.includes('مدين') || content.includes('عليه') || content.includes('debit') || content.includes('+') || content.includes('إضافة')) {
        txType = 'debit';
      }

      const numberMatches = content.match(/[-+]?\d{1,3}(,\d{3})*(\.\d+)?|\d+(\.\d+)?/g);
      let amount = 0;
      if (numberMatches) {
        const numbers = numberMatches
          .map(n => parseFloat(n.replace(/,/g, '')))
          .filter(num => !isNaN(num) && num > 0);
        
        if (numbers.length > 0) {
          amount = Math.max(...numbers);
        }
      }

      let description = content;
      if (numberMatches) {
        numberMatches.forEach(num => {
          description = description.replace(num, '');
        });
      }
      description = description
        .replace(/دائن|له|مدين|عليه|credit|debit|خصم|إضافة/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!description) {
        description = 'قيد مالي مستورد';
      }

      rows.push(createPreviewRow({
        id: `pdf_manual_${Date.now()}_${i}`,
        date,
        description,
        quantity: 1,
        unitPrice: isNaN(amount) ? 0 : amount,
        extraCharges: 0,
        total: isNaN(amount) ? 0 : amount,
        type: txType,
        confidence: amount > 0 ? 'high' : 'low'
      }));
    });

    rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    setPreviewRows(rows);
  };

  // Handle JSON Import
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.transactions && Array.isArray(parsed.transactions)) {
          const rows: PreviewImportRow[] = parsed.transactions.map((t: any, i: number) => {
            const q = Number(t.quantity) || 1;
            const p = Number(t.unitPrice) || (t.amount ? t.amount / q : 0);
            const e = Number(t.extraCharges) || 0;
            const tot = Number(t.amount) || ((q * p) + e);
            return createPreviewRow({
              id: `json_${Date.now()}_${i}`,
              date: t.date || new Date().toISOString().split('T')[0],
              description: t.description || 'قيد من كشف حساب JSON',
              quantity: q,
              unitPrice: p,
              extraCharges: e,
              total: tot,
              type: t.type || (selectedAcc.type === 'supplier' ? 'credit' : 'debit'),
              confidence: 'high'
            });
          });

          rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
          setPreviewRows(rows);
          setMatchAnalysis({
            matchScore: 100,
            isConsistent: true,
            warnings: ['تم استيراد البيانات مباشرة من كشف حساب JSON المصدّر مسبقاً.'],
            suggestedAlternativeAccount: null
          });
          onTriggerToast(`تم استيراد ${rows.length} قيد من ملف JSON بنجاح.`);
        } else {
          onTriggerToast('الملف لا يحتوي على كشف حركات متوافق مع النظام.');
        }
      } catch (err) {
        onTriggerToast('خطأ في قراءة ملف JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Convert all rows currency to account currency
  const handleConvertAllCurrencies = () => {
    if (!extractedMeta?.currency || extractedMeta.currency === selectedAcc.currency) return;
    const fromCur = extractedMeta.currency;
    const toCur = selectedAcc.currency || 'YER';

    const converted = previewRows.map(row => {
      const convertedPrice = Math.round(db.convertCurrency(row.unitPrice, fromCur, toCur) * 100) / 100;
      const convertedExtra = Math.round(db.convertCurrency(row.extraCharges, fromCur, toCur) * 100) / 100;
      const newTotal = Math.round(((row.quantity * convertedPrice) + convertedExtra) * 100) / 100;
      return {
        ...row,
        unitPrice: convertedPrice,
        extraCharges: convertedExtra,
        total: newTotal
      };
    });

    setPreviewRows(converted);
    setConvertedCurrencyFrom(fromCur);
    onTriggerToast(`تم تحويل جميع المبالغ من ${fromCur} إلى ${toCur} وفق أسعار الصرف المعتمدة.`);
  };

  // Row manipulation handlers
  const handleToggleSelectAll = (checked: boolean) => {
    setPreviewRows(prev => prev.map(r => ({ ...r, selected: checked })));
  };

  const handleToggleRow = (id: string) => {
    setPreviewRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const handleUpdateRow = (id: string, field: keyof PreviewImportRow, val: any) => {
    setPreviewRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, isEdited: true };

      if (field === 'date') {
        updated.date = normalizeIsoDate(val);
      } else if (field === 'quantity' || field === 'unitPrice' || field === 'extraCharges') {
        const cleanVal = typeof val === 'number' ? val : (parseFloat(normalizeArabicNumerals(String(val)).replace(/,/g, '')) || 0);
        (updated as any)[field] = cleanVal;
        const q = field === 'quantity' ? cleanVal : row.quantity;
        const p = field === 'unitPrice' ? cleanVal : row.unitPrice;
        const e = field === 'extraCharges' ? cleanVal : row.extraCharges;
        updated.total = Math.round(((q * p) + e) * 100) / 100;
      } else if (field === 'total') {
        const cleanTotal = typeof val === 'number' ? val : (parseFloat(normalizeArabicNumerals(String(val)).replace(/,/g, '')) || 0);
        updated.total = cleanTotal;
        const q = row.quantity > 0 ? row.quantity : 1;
        const e = row.extraCharges || 0;
        updated.unitPrice = Math.max(0, Math.round(((cleanTotal - e) / q) * 100) / 100);
      } else {
        (updated as any)[field] = val;
      }
      return updated;
    }));
  };

  const handleDeleteRow = (id: string) => {
    setPreviewRows(prev => prev.filter(r => r.id !== id));
  };

  const handleDuplicateRow = (id: string) => {
    setPreviewRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const source = prev[idx];
      const clone: PreviewImportRow = {
        ...source,
        id: `clone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        description: `${source.description} (تكرار)`,
        isEdited: true
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    onTriggerToast('تم تكرار الصف بنجاح.');
  };

  const handleFocusEdit = (rowId: string) => {
    const el = document.getElementById(`desc_input_${rowId}`);
    if (el) {
      el.focus();
      (el as HTMLInputElement | HTMLTextAreaElement).select();
    }
  };

  const handleAddManualRow = () => {
    const newRow = createPreviewRow({
      id: `manual_${Date.now()}`,
      selected: true,
      date: new Date().toISOString().split('T')[0],
      description: 'قيد إضافي جديد',
      quantity: 1,
      unitPrice: 0,
      extraCharges: 0,
      total: 0,
      type: selectedAcc.type === 'supplier' ? 'credit' : 'debit',
      confidence: 'medium'
    });
    setPreviewRows(prev => [...prev, newRow]);
  };

  const handleSortByDate = () => {
    setPreviewRows(prev => [...prev].sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    onTriggerToast('تم فرز القيود تصاعدياً حسب التاريخ.');
  };

  const handleRecalculateBalances = () => {
    setPreviewRows(prev => [...prev].sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    setRecalcCounter(c => c + 1);
    onTriggerToast('تمت إعادة حساب الأرصدة التراكمية وترتيب الحركات.');
  };

  // Export the Preview Table to Excel for review before importing
  const handleExportPreviewToExcel = async () => {
    if (rowsWithCalculatedBalance.length === 0) return;
    try {
      const { utils, writeFile } = await import('xlsx');
      const exportData = rowsWithCalculatedBalance.map((r, idx) => ({
        'الرقم': idx + 1,
        'حالة التحديد': r.selected ? 'محدد للاستيراد' : 'مستبعد',
        'اليوم': getArabicDayName(r.date),
        'التاريخ': r.date,
        'البيان والتفاصيل': r.description,
        'الكمية أو العدد': r.quantity,
        'السعر (الوحدة)': r.unitPrice,
        'الزيادات': r.extraCharges,
        'الإجمالي': r.calculatedTotal,
        'نوع الحركة': r.type === 'debit' ? 'مدين (عليه) +' : 'دائن (له) -',
        'الرصيد بعد الحركة': r.balanceAfter,
        'العملة': selectedAcc.currency || 'YER'
      }));

      const ws = utils.json_to_sheet(exportData);
      ws['!dir'] = 'rtl';
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'معاينة_القيود');
      writeFile(wb, `معاينة_استيراد_${selectedAcc.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      onTriggerToast('تم تنزيل جدول المعاينة كملف Excel بنجاح للمراجعة.');
    } catch (e) {
      console.error(e);
      onTriggerToast('حدث خطأ أثناء تصدير ملف الإكسل للمعاينة.');
    }
  };

  // Calculate actual initial account balance from openingBalance + all db.transactions for this account
  const currentAccountBalance = useMemo(() => {
    if (!selectedAcc) return 0;
    let balance = Number(selectedAcc.openingBalance || 0);
    const existingTxs = db.transactions.filter(t => t.accountId === selectedAcc.id && !t.deletedAt);
    existingTxs.forEach(t => {
      const amt = Number(t.amount || 0);
      if (selectedAcc.type === 'supplier') {
        if (t.type === 'credit') balance += amt;
        else balance -= amt;
      } else {
        if (t.type === 'debit') balance += amt;
        else balance -= amt;
      }
    });
    return Math.round(balance * 100) / 100;
  }, [selectedAcc, db.transactions]);

  // Compute cumulative running balance chronologically for each row
  const rowsWithCalculatedBalance = useMemo(() => {
    let runningBal = currentAccountBalance;
    return previewRows.map(row => {
      const rowTotal = Math.round(Number(row.total ?? ((Number(row.quantity || 1) * Number(row.unitPrice || 0)) + Number(row.extraCharges || 0))) * 100) / 100;
      if (row.selected) {
        if (selectedAcc.type === 'supplier') {
          if (row.type === 'credit') runningBal += rowTotal;
          else runningBal -= rowTotal;
        } else {
          if (row.type === 'debit') runningBal += rowTotal;
          else runningBal -= rowTotal;
        }
      }
      return {
        ...row,
        calculatedTotal: rowTotal,
        balanceAfter: Math.round(runningBal * 100) / 100
      };
    });
  }, [previewRows, currentAccountBalance, selectedAcc.type, recalcCounter]);

  // Duplicate detection against existing database transactions for this account
  const duplicateRowIds = useMemo(() => {
    if (!selectedAcc?.id) return new Set<string>();
    const existingAccountTxs = db.transactions.filter(t => t.accountId === selectedAcc.id && !t.deletedAt);
    const setOfDupes = new Set<string>();
    previewRows.forEach(row => {
      const isDupe = existingAccountTxs.some(t => {
        const sameDate = t.date === row.date;
        const sameAmount = Math.abs(Number(t.amount) - Number(row.total)) < 0.05;
        const tDesc = (t.description || '').trim();
        const rDesc = (row.description || '').trim();
        const sameDesc = tDesc === rDesc || tDesc.includes(rDesc) || rDesc.includes(tDesc);
        return sameDate && sameAmount && sameDesc;
      });
      if (isDupe) {
        setOfDupes.add(row.id);
      }
    });
    return setOfDupes;
  }, [previewRows, db.transactions, selectedAcc?.id]);

  const handleDeselectDuplicates = () => {
    setPreviewRows(prev => prev.map(r => duplicateRowIds.has(r.id) ? { ...r, selected: false } : r));
    onTriggerToast(`تم إلغاء تحديد ${duplicateRowIds.size} قيد مكرر محتمل.`);
  };

  // Summaries based on SELECTED rows only
  const selectedCalculatedRows = useMemo(() => 
    rowsWithCalculatedBalance.filter(r => r.selected), 
    [rowsWithCalculatedBalance]
  );

  const totalDebit = useMemo(() => 
    selectedCalculatedRows.filter(r => r.type === 'debit').reduce((acc, r) => acc + (r.calculatedTotal || 0), 0), 
    [selectedCalculatedRows]
  );

  const totalCredit = useMemo(() => 
    selectedCalculatedRows.filter(r => r.type === 'credit').reduce((acc, r) => acc + (r.calculatedTotal || 0), 0), 
    [selectedCalculatedRows]
  );

  const netBalanceImpact = useMemo(() => {
    if (selectedAcc.type === 'supplier') {
      return totalCredit - totalDebit;
    } else {
      return totalDebit - totalCredit;
    }
  }, [selectedAcc.type, totalDebit, totalCredit]);

  const finalProjectedBalance = useMemo(() => {
    if (rowsWithCalculatedBalance.length === 0) return currentAccountBalance;
    return rowsWithCalculatedBalance[rowsWithCalculatedBalance.length - 1].balanceAfter;
  }, [rowsWithCalculatedBalance, currentAccountBalance]);

  // Warning if unexpected negative buyer balance
  const isUnexpectedNegativeBuyerBalance = useMemo(() => {
    return selectedAcc.type === 'buyer' && finalProjectedBalance < 0;
  }, [selectedAcc.type, finalProjectedBalance]);

  // Final Import validation
  const isMismatchWarning = matchAnalysis && (!matchAnalysis.isConsistent || matchAnalysis.matchScore < 40);
  const canSave = selectedCalculatedRows.length > 0 && (!isMismatchWarning || acknowledgeMismatch);

  // Final Save with Duplicate Prevention, Activity Log & Undo Feature
  const handleSaveImportedRows = () => {
    if (selectedCalculatedRows.length === 0) {
      onTriggerToast('الرجاء تحديد قيد واحد على الأقل للاستيراد.');
      return;
    }

    const existingAccountTxs = db.transactions.filter(t => t.accountId === selectedAcc.id && !t.deletedAt);

    let duplicatesCount = 0;
    const newTxIds: string[] = [];

    selectedCalculatedRows.forEach(row => {
      // Fuzzy duplicate check against this account's records
      const isDuplicate = existingAccountTxs.some(t => {
        const sameDate = t.date === row.date;
        const sameAmount = Math.abs(Number(t.amount) - Number(row.calculatedTotal)) < 0.05;
        const tDesc = (t.description || '').trim();
        const rDesc = (row.description || '').trim();
        const sameDesc = tDesc === rDesc || tDesc.includes(rDesc) || rDesc.includes(tDesc);
        return sameDate && sameAmount && sameDesc;
      });

      if (skipDuplicates && isDuplicate) {
        duplicatesCount++;
        return;
      }

      // Add transaction to database with quantity, unitPrice, extraCharges, and total amount
      const createdTx = db.addTransaction({
        accountId: selectedAcc.id,
        date: row.date,
        description: row.description,
        type: row.type,
        amount: row.calculatedTotal,
        currency: selectedAcc.currency || 'YER',
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        extraCharges: row.extraCharges
      }, false);

      if (createdTx && createdTx.id) {
        newTxIds.push(createdTx.id);
      }
    });

    const importedCount = newTxIds.length;

    // Log Activity
    const sourceMap: Record<ImportTabMode, string> = {
      excel: 'إكسل (Excel)',
      pdf_ai: 'كشف PDF ذكي',
      image_ai: 'صورة / كاميرا ذكية',
      manual_pdf: 'لصق نص PDF يدوي',
      json: 'كشف حساب JSON'
    };
    const sourceLabel = sourceMap[activeTab];
    const matchScoreStr = matchAnalysis?.matchScore ? `، درجة المطابقة: ${matchAnalysis.matchScore}%` : '';

    db.logActivity(
      db.currentUser || 'Admin',
      'add',
      'transaction',
      selectedAcc.id,
      `استيراد قيود للحساب ${selectedAcc.name}: تم استيراد (${importedCount}) قيد بنجاح، وتجاهل (${duplicatesCount}) قيد مكرر. المصدر: ${sourceLabel}${matchScoreStr}`
    );

    // Save to import history for this account
    if (importedCount > 0) {
      const historyItem: ImportHistoryRecord = {
        id: `hist_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: sourceLabel,
        importedCount,
        skippedDuplicates: duplicatesCount,
        matchScore: matchAnalysis?.matchScore,
        totalAmount: totalDebit + totalCredit,
        currency: selectedAcc.currency || 'YER'
      };
      const updatedHist = [historyItem, ...importHistory].slice(0, 5);
      setImportHistory(updatedHist);
      try {
        localStorage.setItem(`smartacc_import_hist_${selectedAcc.id}`, JSON.stringify(updatedHist));
      } catch (e) {
        // ignore
      }
    }

    onDatabaseUpdate();
    onClose();

    // Undo action handler
    const handleUndo = () => {
      newTxIds.forEach(id => db.deleteTransaction(id));
      db.logActivity(
        db.currentUser || 'Admin',
        'delete',
        'transaction',
        selectedAcc.id,
        `تراجع عن استيراد (${newTxIds.length}) قيد لحساب ${selectedAcc.name}`
      );
      onDatabaseUpdate();
      onTriggerToast(`تم التراجع بنجاح وحذف (${newTxIds.length}) قيد مستورد.`);
    };

    onTriggerToast(
      `تم استيراد ${importedCount} قيد بنجاح لحساب ${selectedAcc.name}${duplicatesCount > 0 ? `، وتجاهل ${duplicatesCount} قيد مكرر` : ''}.`,
      importedCount > 0 ? 'تراجع (Undo)' : undefined,
      importedCount > 0 ? handleUndo : undefined
    );
  };

  // Match score color & badge helper
  const getMatchScoreBadge = () => {
    if (!matchAnalysis) return null;
    const score = matchAnalysis.matchScore;
    let bg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    let icon = <CheckCircle2 size={16} className="text-emerald-500" />;
    let label = 'تطابق عالي ومطابق للحساب';

    if (score < 40 || !matchAnalysis.isConsistent) {
      bg = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      icon = <XCircle size={16} className="text-rose-500" />;
      label = 'تطابق منخفض أو مستند مختلف';
    } else if (score < 75) {
      bg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      icon = <AlertTriangle size={16} className="text-amber-500" />;
      label = 'تطابق جزئي / ملاحظات تدقيق';
    }

    return (
      <div className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-bold">{label} ({score}%)</span>
          </div>
          <span className="text-[11px] font-mono font-bold bg-white/60 dark:bg-slate-900/60 px-2 py-0.5 rounded-md">
            درجة المطابقة: {score}/100
          </span>
        </div>

        {/* Warnings list */}
        {matchAnalysis.warnings && matchAnalysis.warnings.length > 0 && (
          <div className="space-y-1 text-right text-[11px] border-t border-current/15 pt-2">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle size={13} />
              <span>ملاحظات التدقيق والمطابقة:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pr-2">
              {matchAnalysis.warnings.map((w, idx) => (
                <li key={idx} className="leading-relaxed">{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggestion for alternative account */}
        {matchAnalysis.suggestedAlternativeAccount && matchAnalysis.suggestedAlternativeAccount !== selectedAcc.name && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-current/20 mt-1">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              💡 يقترح الذكاء الاصطناعي أن هذا المستند يخص حساب: <strong>"{matchAnalysis.suggestedAlternativeAccount}"</strong>
            </span>
            {onSelectAccount && (
              <button
                type="button"
                onClick={() => {
                  const alt = db.accounts.find(a => a.name === matchAnalysis.suggestedAlternativeAccount);
                  if (alt) {
                    onSelectAccount(alt.id);
                    onTriggerToast(`تم التبديل إلى حساب ${alt.name}`);
                  }
                }}
                className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-md transition-colors"
              >
                تبديل لهذا الحساب الآن
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 no-print" id="import_data_modal">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl w-full max-w-6xl p-4 sm:p-6 shadow-2xl space-y-4 text-right max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b pb-3.5 border-slate-100 dark:border-slate-800 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Sparkles size={18} />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                بوابة الاستيراد الذكي للقيود المالية
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              الحساب الهدف: <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedAcc.name}</span> ({selectedAcc.type === 'supplier' ? 'مورد' : 'عميل'} - عملة الحساب: <span className="font-mono font-bold">{selectedAcc.currency || 'YER'}</span>)
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 pr-1 pl-1 flex-1">
          {/* Channel Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => { setActiveTab('excel'); }}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'excel' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={15} />
              <span>إكسل / CSV</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('pdf_ai'); }}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'pdf_ai' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText size={15} />
              <span>كشف PDF ذكي</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('image_ai'); }}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'image_ai' ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Camera size={15} />
              <span>صورة / كاميرا</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('manual_pdf'); }}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'manual_pdf' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal size={15} />
              <span>لصق نص يدوي</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('json'); }}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'json' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileCode size={15} />
              <span>استيراد JSON</span>
            </button>
          </div>

          {/* TAB 1: EXCEL */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:border-emerald-500 transition-colors text-center relative bg-slate-50/50 dark:bg-slate-850/30">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2">
                  <span className="p-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full">
                    <UploadCloud size={26} />
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">اسحب ملف الإكسل هنا أو اضغط للتصفح</p>
                  <p className="text-[11px] text-slate-400">يدعم صيغ Excel (.xlsx, .xls) وصيغة CSV المجدولة بمطابقة تلقائية للأعمدة</p>
                  {importFile && (
                    <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getFileIndicator(importFile.name).colors}`}>
                      {getFileIndicator(importFile.name).icon}
                      <span className="text-xs font-bold">ملف محمل: {importFile.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Column Mapping Toggle if file loaded */}
              {excelColumns.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowColMapping(!showColMapping)}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 hover:underline"
                    >
                      <SlidersHorizontal size={14} />
                      <span>{showColMapping ? 'إخفاء تخصيص ربط الأعمدة' : 'تخصيص ربط الأعمدة يدوياً وحفظ القالب'}</span>
                    </button>
                    <span className="text-[11px] text-slate-400">
                      تم اكتشاف ({excelColumns.length}) أعمدة في الملف
                    </span>
                  </div>

                  {showColMapping && (
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        اختر العمود المطابق لكل حقل. سيتم حفظ هذا التنسيق في المتصفح لاستخدامه تلقائياً في الملفات المشابهة مستقبلاً:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عمود التاريخ:</label>
                          <select
                            value={colMapping.date}
                            onChange={(e) => setColMapping({ ...colMapping, date: e.target.value })}
                            className="w-full text-xs p-2 bg-white dark:bg-slate-900 border rounded-lg"
                          >
                            <option value="">(تلقائي)</option>
                            {excelColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عمود البيان / الوصف:</label>
                          <select
                            value={colMapping.description}
                            onChange={(e) => setColMapping({ ...colMapping, description: e.target.value })}
                            className="w-full text-xs p-2 bg-white dark:bg-slate-900 border rounded-lg"
                          >
                            <option value="">(تلقائي)</option>
                            {excelColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عمود الكمية (إن وجد):</label>
                          <select
                            value={colMapping.quantity}
                            onChange={(e) => setColMapping({ ...colMapping, quantity: e.target.value })}
                            className="w-full text-xs p-2 bg-white dark:bg-slate-900 border rounded-lg"
                          >
                            <option value="">(افتراضي 1)</option>
                            {excelColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عمود السعر (إن وجد):</label>
                          <select
                            value={colMapping.unitPrice}
                            onChange={(e) => setColMapping({ ...colMapping, unitPrice: e.target.value })}
                            className="w-full text-xs p-2 bg-white dark:bg-slate-900 border rounded-lg"
                          >
                            <option value="">(تلقائي من المبلغ)</option>
                            {excelColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عمود الزيادات / الرسوم:</label>
                          <select
                            value={colMapping.extraCharges}
                            onChange={(e) => setColMapping({ ...colMapping, extraCharges: e.target.value })}
                            className="w-full text-xs p-2 bg-white dark:bg-slate-900 border rounded-lg"
                          >
                            <option value="">(افتراضي 0)</option>
                            {excelColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عمود المبلغ / الإجمالي:</label>
                          <select
                            value={colMapping.amount}
                            onChange={(e) => setColMapping({ ...colMapping, amount: e.target.value })}
                            className="w-full text-xs p-2 bg-white dark:bg-slate-900 border rounded-lg"
                          >
                            <option value="">(تلقائي)</option>
                            {excelColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عمود مدين (إن وجد):</label>
                          <select
                            value={colMapping.debit}
                            onChange={(e) => setColMapping({ ...colMapping, debit: e.target.value })}
                            className="w-full text-xs p-2 bg-white dark:bg-slate-900 border rounded-lg"
                          >
                            <option value="">(تلقائي)</option>
                            {excelColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عمود دائن (إن وجد):</label>
                          <select
                            value={colMapping.credit}
                            onChange={(e) => setColMapping({ ...colMapping, credit: e.target.value })}
                            className="w-full text-xs p-2 bg-white dark:bg-slate-900 border rounded-lg"
                          >
                            <option value="">(تلقائي)</option>
                            {excelColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div className="sm:col-span-4 flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={handleSaveColMapping}
                            className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                          >
                            تطبيق وحفظ القالب
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SMART PDF VIA AI */}
          {activeTab === 'pdf_ai' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-6 sm:p-8 hover:border-indigo-500 transition-colors text-center relative bg-indigo-50/20 dark:bg-indigo-950/20">
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(e) => handleBatchFileSelect(e.target.files)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2">
                  <span className="p-3 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full">
                    <FileText size={26} />
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                    ارفع ملف كشف حساب أو فاتورة PDF (ملف فردي أو متعدد)
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-md">
                    يحلل الذكاء الاصطناعي الجداول الرقمية مباشرة، ويطابق اسم العميل/المورد والعملة والقيود تلقائياً
                  </p>
                  {importFile && !isAiLoading && (
                    <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getFileIndicator(importFile.name).colors}`}>
                      {getFileIndicator(importFile.name).icon}
                      <span className="text-xs font-bold">تم فحص: {importFile.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: IMAGE / CAMERA VIA AI */}
          {activeTab === 'image_ai' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div 
                  onClick={() => cameraInputRef.current?.click()}
                  className="border-2 border-dashed border-purple-200 dark:border-purple-900/50 rounded-2xl p-6 hover:border-purple-500 transition-all text-center cursor-pointer bg-purple-50/20 dark:bg-purple-950/20 flex flex-col items-center justify-center gap-2"
                >
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleBatchFileSelect(e.target.files)}
                    className="hidden"
                  />
                  <span className="p-3 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-full">
                    <Camera size={26} />
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-300">
                    التقاط صورة فورية بالكاميرا
                  </span>
                  <span className="text-[10px] text-slate-400">
                    صوّر الفاتورة الورقية أو السند مباشرة بكاميرا الجوال
                  </span>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:border-indigo-500 transition-all text-center cursor-pointer bg-slate-50/30 dark:bg-slate-850/30 flex flex-col items-center justify-center gap-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => handleBatchFileSelect(e.target.files)}
                    className="hidden"
                  />
                  <span className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                    <UploadCloud size={26} />
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                    تصفح ألبوم الصور / المعرض
                  </span>
                  <span className="text-[10px] text-slate-400">
                    يدعم صور متعددة بصيغ JPG, PNG, WEBP
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MANUAL PDF TEXT */}
          {activeTab === 'manual_pdf' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                الصق نص كشف الحساب من ملف PDF هنا (خيار يدوي بدون ذكاء اصطناعي):
              </label>
              <textarea
                value={pdfTextData}
                onChange={(e) => parsePdfText(e.target.value)}
                placeholder={'مثال: الصق أسطر الجدول بالتنسيق التالي:\n2026-06-03  مبيعات أخشاب زان  15000  مدين\n2026-06-05  تسديد دفعة نقدية  5000  دائن'}
                className="w-full h-32 text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-right"
              />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                يقوم المحلل التلقائي باستخراج التواريخ والأرقام وكلمات (مدين/دائن/له/عليه) تلقائياً لتحويلها لجدول قيود.
              </p>
            </div>
          )}

          {/* TAB 5: JSON BACKUP IMPORT */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-amber-200 dark:border-amber-900/50 rounded-2xl p-6 sm:p-8 hover:border-amber-500 transition-colors text-center relative bg-amber-50/20 dark:bg-amber-950/20">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleJsonUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2">
                  <span className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full">
                    <FileCode size={26} />
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                    ارفع ملف كشف الحساب الاحتياطي بصيغة JSON
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-md">
                    يستورد كافة الحركات والفواتير المحفوظة مسبقاً بدقة 100% دون فقدان أي حقل
                  </p>
                  {importFile && (
                    <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getFileIndicator(importFile.name).colors}`}>
                      {getFileIndicator(importFile.name).icon}
                      <span className="text-xs font-bold">ملف محمل: {importFile.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Multi-Stage AI Loading Progress Indicator */}
          {isAiLoading && (
            <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <RefreshCw size={18} className="text-indigo-600 animate-spin" />
                  <span className="text-xs sm:text-sm font-bold text-indigo-950 dark:text-indigo-200">
                    جاري التحليل الذكي للمستند بواسطة الذكاء الاصطناعي...
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {loadingStage === 1 && 'المرحلة 1 / 4'}
                  {loadingStage === 2 && 'المرحلة 2 / 4'}
                  {loadingStage === 3 && 'المرحلة 3 / 4'}
                  {loadingStage === 4 && 'المرحلة 4 / 4'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className={`p-2 rounded-lg border flex items-center gap-2 ${loadingStage >= 1 ? 'bg-white dark:bg-slate-900 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold' : 'opacity-40 border-slate-200 dark:border-slate-800'}`}>
                  <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center text-[10px]">1</span>
                  <span>قراءة وفحص المستند</span>
                </div>
                <div className={`p-2 rounded-lg border flex items-center gap-2 ${loadingStage >= 2 ? 'bg-white dark:bg-slate-900 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold' : 'opacity-40 border-slate-200 dark:border-slate-800'}`}>
                  <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center text-[10px]">2</span>
                  <span>استخراج البيانات المالية</span>
                </div>
                <div className={`p-2 rounded-lg border flex items-center gap-2 ${loadingStage >= 3 ? 'bg-white dark:bg-slate-900 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold' : 'opacity-40 border-slate-200 dark:border-slate-800'}`}>
                  <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center text-[10px]">3</span>
                  <span>مقارنة بسياق الحساب</span>
                </div>
                <div className={`p-2 rounded-lg border flex items-center gap-2 ${loadingStage >= 4 ? 'bg-white dark:bg-slate-900 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold' : 'opacity-40 border-slate-200 dark:border-slate-800'}`}>
                  <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center text-[10px]">4</span>
                  <span>تجهيز جدول المعاينة</span>
                </div>
              </div>
            </div>
          )}

          {/* Batch files progress list if multi-files */}
          {batchQueue.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">قائمة المستندات المجمعة ({batchQueue.length}):</span>
              <div className="flex flex-wrap gap-2">
                {batchQueue.map((item, idx) => {
                  const indicator = getFileIndicator(item.name);
                  return (
                    <span key={idx} className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${indicator.colors}`}>
                      {item.status === 'processing' && <RefreshCw size={11} className="animate-spin shrink-0" />}
                      {item.status === 'done' && <Check size={12} className="shrink-0" />}
                      {item.status === 'error' && <X size={12} className="shrink-0" />}
                      {item.status !== 'processing' && item.status !== 'done' && item.status !== 'error' && (
                        <span className="shrink-0">{indicator.icon}</span>
                      )}
                      <span className="font-bold truncate max-w-[150px]">{item.name}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Smart Match Analysis Badge & Warnings */}
          {matchAnalysis && getMatchScoreBadge()}

          {/* Currency Mismatch & Auto-conversion Banner */}
          {extractedMeta?.currency && extractedMeta.currency !== selectedAcc.currency && !convertedCurrencyFrom && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-right">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-blue-950 dark:text-blue-200">فارق في العملة: </span>
                  <span className="text-blue-800 dark:text-blue-300">
                    عملة المستند المستخرجة هي ({extractedMeta.currency}) وعملة الحساب هي ({selectedAcc.currency || 'YER'}).
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConvertAllCurrencies}
                className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                تحويل المبالغ تلقائياً إلى {selectedAcc.currency || 'YER'}
              </button>
            </div>
          )}

          {convertedCurrencyFrom && (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <Check size={14} />
              <span>تم تحويل كافة المبالغ من {convertedCurrencyFrom} إلى {selectedAcc.currency || 'YER'} بنجاح.</span>
            </div>
          )}

          {/* PREVIEW TABLE OF ROWS (11 COLUMNS) */}
          {previewRows.length > 0 && (
            <div className="space-y-3 border-t pt-4 border-slate-100 dark:border-slate-800">
              
              {/* Header Bar: Actions & Starting Balance */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      🔍 جدول معاينة وتدقيق القيود المستخرجة ({previewRows.length} قيد - محدد للترحيل: {selectedCalculatedRows.length}):
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                      الرصيد الفعلي الحالي: {currentAccountBalance?.toLocaleString()} {selectedAcc.currency || 'YER'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    * يتم حساب عمود "الرصيد بعد الحركة" تراكمياً بالترتيب الزمني بدءاً من الرصيد الحالي الفعلي للحساب.
                  </p>
                </div>

                {/* Toolbar Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(true)}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline px-1.5 py-1"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(false)}
                    className="text-slate-500 hover:underline px-1.5 py-1"
                  >
                    إلغاء التحديد
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  
                  {/* Sort by Date */}
                  <button
                    type="button"
                    onClick={handleSortByDate}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    title="فرز القيود تصاعدياً حسب التاريخ لضمان تسلسل حساب الرصيد التراكمي"
                  >
                    <ArrowUpDown size={12} className="text-indigo-500" />
                    <span>فرز بالتاريخ</span>
                  </button>

                  {/* Recalculate Balances */}
                  <button
                    type="button"
                    onClick={handleRecalculateBalances}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    title="إعادة حساب الأرصدة التراكمية وتحديث القيم"
                  >
                    <RefreshCw size={12} className="text-blue-500" />
                    <span>إعادة حساب الأرصدة</span>
                  </button>

                  {/* Export Preview to Excel */}
                  <button
                    type="button"
                    onClick={handleExportPreviewToExcel}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    title="تنزيل جدول المعاينة هذا كملف Excel بجميع أعمدته للمراجعة الخارجية"
                  >
                    <Download size={12} />
                    <span>تنزيل Excel للمراجعة</span>
                  </button>

                  {/* Exclude duplicates button */}
                  {duplicateRowIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleDeselectDuplicates}
                      className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                      title="إلغاء تحديد كل القيود التي تم رصد تطابقها مع قيود مسجلة مسبقاً في حساب هذا العميل"
                    >
                      <Copy size={12} />
                      <span>استبعاد المكرر ({duplicateRowIds.size})</span>
                    </button>
                  )}

                  {/* Add Manual Row */}
                  <button
                    type="button"
                    onClick={handleAddManualRow}
                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus size={13} />
                    <span>إضافة قيد +</span>
                  </button>
                </div>
              </div>

              {/* Unexpected Negative Balance Warning for Buyer Accounts */}
              {isUnexpectedNegativeBuyerBalance && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold">تنبيه تدقيق محاسبي: </span>
                    <span>
                      سينتج عن هذه القيود رصيد سالب للعميل ({finalProjectedBalance?.toLocaleString()} {selectedAcc.currency || 'YER'}). 
                      يرجى التأكد من أنواع الحركات (مدين / دائن) ومبالغ السداد قبل الاعتماد النهائي لتجنب تسجيل رصيد عكسي غير متوقع.
                    </span>
                  </div>
                </div>
              )}

              {/* 11-Column Editable Table with Sticky First & Last Columns */}
              <div className="overflow-x-auto max-h-80 border border-slate-200 dark:border-slate-800 rounded-xl relative shadow-xs">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
                    <tr>
                      {/* 1. الرقم والتحديد (Sticky Right in RTL) */}
                      <th className="px-2.5 py-2.5 text-center w-16 sticky right-0 bg-slate-50 dark:bg-slate-850 z-30 border-l border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={previewRows.length > 0 && selectedCalculatedRows.length === previewRows.length}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                            className="rounded-sm accent-indigo-600 cursor-pointer"
                            title="تحديد أو إلغاء تحديد الكل"
                          />
                          <span className="text-[10px] text-slate-500 font-mono">#</span>
                        </div>
                      </th>

                      {/* 2. اليوم */}
                      <th className="px-2.5 py-2.5 text-center min-w-[75px] text-[11px]">اليوم</th>

                      {/* 3. التاريخ */}
                      <th className="px-2.5 py-2.5 text-right min-w-[125px] text-[11px]">التاريخ</th>

                      {/* 4. التفاصيل والبيان */}
                      <th className="px-2.5 py-2.5 text-right min-w-[180px] text-[11px]">التفاصيل والبيان</th>

                      {/* 5. الكمية أو العدد */}
                      <th className="px-2 py-2.5 text-center min-w-[70px] text-[11px]">الكمية</th>

                      {/* 6. السعر */}
                      <th className="px-2 py-2.5 text-center min-w-[85px] text-[11px]">السعر</th>

                      {/* 7. الزيادات */}
                      <th className="px-2 py-2.5 text-center min-w-[75px] text-[11px]">الزيادات</th>

                      {/* 8. الإجمالي */}
                      <th className="px-2.5 py-2.5 text-left min-w-[105px] text-[11px]">الإجمالي</th>

                      {/* 9. نوع الحركة */}
                      <th className="px-2.5 py-2.5 text-center min-w-[120px] text-[11px]">نوع الحركة</th>

                      {/* 10. الرصيد بعد الحركة */}
                      <th className="px-2.5 py-2.5 text-left min-w-[125px] text-[11px]">الرصيد بعد الحركة</th>

                      {/* 11. إجراءات (Sticky Left in RTL) */}
                      <th className="px-2.5 py-2.5 text-center w-28 min-w-[100px] sticky left-0 bg-slate-50 dark:bg-slate-850 z-30 border-r border-slate-200 dark:border-slate-800 text-[11px]">
                        إجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {rowsWithCalculatedBalance.map((row, index) => {
                      const isDuplicate = duplicateRowIds.has(row.id);
                      const isLowConfidence = row.confidence === 'low' || row.unitPrice === 0 || row.calculatedTotal === 0;
                      const rowBg = !row.selected
                        ? 'opacity-40 bg-slate-50/50 dark:bg-slate-900/50'
                        : isDuplicate
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/40'
                          : isLowConfidence
                            ? 'bg-amber-50/70 dark:bg-amber-950/25 hover:bg-amber-100/50 dark:hover:bg-amber-900/30'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40';
                      
                      const stickyRightBg = !row.selected
                        ? 'bg-slate-50 dark:bg-slate-900'
                        : isDuplicate || isLowConfidence
                          ? 'bg-amber-50 dark:bg-slate-900'
                          : 'bg-white dark:bg-slate-900';

                      const stickyLeftBg = !row.selected
                        ? 'bg-slate-50 dark:bg-slate-900'
                        : isDuplicate || isLowConfidence
                          ? 'bg-amber-50 dark:bg-slate-900'
                          : 'bg-white dark:bg-slate-900';

                      const dayName = getArabicDayName(row.date);

                      return (
                        <tr key={row.id} className={`${rowBg} transition-colors group`}>
                          {/* 1. التحديد والرقم */}
                          <td className={`px-2.5 py-2 text-center sticky right-0 ${stickyRightBg} z-10 border-l border-slate-200 dark:border-slate-800 shadow-xs`}>
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={() => handleToggleRow(row.id)}
                                className="rounded-sm accent-indigo-600 cursor-pointer"
                                title={row.selected ? 'استبعاد هذا القيد من الترحيل' : 'تحديد هذا القيد للترحيل'}
                              />
                              <span className="text-[11px] font-bold text-slate-500 font-mono">{index + 1}</span>
                              {isDuplicate && (
                                <span title="تنبيه: قيد مطابق لقيد موجود مسبقاً في هذا الحساب" className="text-amber-500 cursor-help">
                                  <Copy size={11} />
                                </span>
                              )}
                              {isLowConfidence && !isDuplicate && (
                                <span title="تنبيه: قيد يحتاج مراجعة (السعر أو الإجمالي صفر)" className="text-amber-500 cursor-help">
                                  <AlertTriangle size={11} />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. اليوم */}
                          <td className="px-2.5 py-1.5 text-center font-sans text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                              {dayName}
                            </span>
                          </td>

                          {/* 3. التاريخ */}
                          <td className="px-1.5 py-1.5">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => handleUpdateRow(row.id, 'date', e.target.value)}
                              className="w-full text-xs p-1 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 rounded-md focus:bg-white dark:focus:bg-slate-800 font-mono"
                            />
                          </td>

                          {/* 4. التفاصيل والبيان */}
                          <td className="px-1.5 py-1.5">
                            <textarea
                              id={`desc_input_${row.id}`}
                              rows={1}
                              value={row.description}
                              onChange={(e) => handleUpdateRow(row.id, 'description', e.target.value)}
                              className="w-full text-xs p-1 font-sans bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 rounded-md focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 resize-none"
                            />
                          </td>

                          {/* 5. الكمية */}
                          <td className="px-1.5 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.quantity}
                              onChange={(e) => handleUpdateRow(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full text-xs p-1 text-center font-bold bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 rounded-md focus:bg-white dark:focus:bg-slate-800"
                            />
                          </td>

                          {/* 6. السعر */}
                          <td className="px-1.5 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.unitPrice}
                              onChange={(e) => handleUpdateRow(row.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full text-xs p-1 text-left font-bold bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 rounded-md focus:bg-white dark:focus:bg-slate-800"
                            />
                          </td>

                          {/* 7. الزيادات */}
                          <td className="px-1.5 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.extraCharges}
                              onChange={(e) => handleUpdateRow(row.id, 'extraCharges', parseFloat(e.target.value) || 0)}
                              className="w-full text-xs p-1 text-center font-bold bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 rounded-md focus:bg-white dark:focus:bg-slate-800"
                            />
                          </td>

                          {/* 8. الإجمالي (محسوب تلقائياً وليس قابلاً للتعديل المباشر) */}
                          <td className="px-2.5 py-1.5 text-left whitespace-nowrap">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {row.calculatedTotal?.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 mr-1 font-sans">
                              {selectedAcc.currency || 'YER'}
                            </span>
                          </td>

                          {/* 9. نوع الحركة */}
                          <td className="px-1.5 py-1.5 text-center">
                            <select
                              value={row.type}
                              onChange={(e) => handleUpdateRow(row.id, 'type', e.target.value)}
                              className={`text-[11px] font-bold py-1 px-2 rounded-lg border cursor-pointer font-sans ${
                                row.type === 'debit' 
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800' 
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              <option value="debit">مدين (عليه) +</option>
                              <option value="credit">دائن (له) -</option>
                            </select>
                          </td>

                          {/* 10. الرصيد بعد الحركة (محسوب تراكمياً) */}
                          <td className="px-2.5 py-1.5 text-left whitespace-nowrap">
                            <span className={`font-bold ${
                              selectedAcc.type === 'buyer' && row.balanceAfter < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-800 dark:text-slate-100'
                            }`}>
                              {row.balanceAfter?.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 mr-1 font-sans">
                              {selectedAcc.currency || 'YER'}
                            </span>
                          </td>

                          {/* 11. إجراءات (Sticky Left in RTL) */}
                          <td className={`px-2 py-1.5 text-center sticky left-0 ${stickyLeftBg} z-10 border-r border-slate-200 dark:border-slate-800 shadow-xs`}>
                            <div className="flex items-center justify-center gap-1">
                              {/* تعديل */}
                              <button
                                type="button"
                                onClick={() => handleFocusEdit(row.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                                title="تعديل هذا الصف"
                              >
                                <Edit2 size={13} />
                              </button>
                              {/* تكرار الصف */}
                              <button
                                type="button"
                                onClick={() => handleDuplicateRow(row.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                                title="تكرار هذا الصف"
                              >
                                <Copy size={13} />
                              </button>
                              {/* حذف */}
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                title="حذف هذا الصف"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary Footer (Based on Selected Rows Only) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">إجمالي المدين (عليه):</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {totalDebit?.toLocaleString()} {selectedAcc.currency || 'YER'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">إجمالي الدائن (له):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {totalCredit?.toLocaleString()} {selectedAcc.currency || 'YER'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">صافي الأثر على الرصيد:</span>
                  <span className={`font-bold ${netBalanceImpact >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {netBalanceImpact > 0 ? `+${netBalanceImpact?.toLocaleString()}` : netBalanceImpact?.toLocaleString()} {selectedAcc.currency || 'YER'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">الرصيد النهائي المتوقع:</span>
                  <span className={`font-bold ${selectedAcc.type === 'buyer' && finalProjectedBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {finalProjectedBalance?.toLocaleString()} {selectedAcc.currency || 'YER'}
                  </span>
                </div>
              </div>

              {/* Import History of last 5 operations for this account */}
              {importHistory.length > 0 && (
                <div className="bg-slate-50/60 dark:bg-slate-850/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <History size={13} className="text-indigo-500" />
                      <span>سجل آخر عمليات الاستيراد لهذا الحساب ({selectedAcc.name}):</span>
                    </span>
                    <span className="text-[10px] text-slate-400">آخر 5 عمليات</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-[10px]">
                    {importHistory.map((h, i) => (
                      <div key={h.id || i} className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>{new Date(h.timestamp).toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{h.source}</span>
                        </div>
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-600 dark:text-slate-400">القيود: {h.importedCount}</span>
                          {h.matchScore !== undefined && (
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${h.matchScore >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                              {h.matchScore}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explicit confirmation checkbox if matchScore < 40 or isConsistent is false */}
              {isMismatchWarning && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="ack_mismatch_cb"
                      checked={acknowledgeMismatch}
                      onChange={(e) => setAcknowledgeMismatch(e.target.checked)}
                      className="mt-0.5 rounded-sm accent-rose-600 cursor-pointer"
                    />
                    <label htmlFor="ack_mismatch_cb" className="text-xs font-bold text-rose-900 dark:text-rose-200 cursor-pointer leading-relaxed">
                      المستند لا يبدو مطابقاً لبيانات هذا الحساب حسب فحص الذكاء الاصطناعي. أقر بأنني راجعت البيانات وأرغب بترحيل هذه القيود لحساب "{selectedAcc.name}" على مسؤوليتي.
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="border-t pt-3.5 border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer font-sans select-none">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="rounded-sm accent-indigo-600 cursor-pointer"
              />
              <span>تخطي القيود المتطابقة مسبقاً لمنع التكرار تلقائياً</span>
            </label>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {previewRows.length > 0 && (
              <button
                type="button"
                onClick={() => { setPreviewRows([]); setMatchAnalysis(null); setExtractedMeta(null); setImportFile(null); }}
                className="py-2.5 px-4 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                تصفير المعاينة
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveImportedRows}
              disabled={!canSave}
              className={`flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 ${
                canSave 
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 cursor-pointer' 
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check size={16} />
              <span>
                {selectedCalculatedRows.length > 0 
                  ? `اعتماد وترحيل القيود المحددة (${selectedCalculatedRows.length})` 
                  : 'حدد قيود للترحيل'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
