/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Database } from '../utils';
import { DailyLedgerEntry, UserRole } from '../types';
import { 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Printer, 
  Edit2, 
  Check, 
  X, 
  Link2, 
  Sparkles, 
  ArrowRightLeft, 
  Info,
  DollarSign,
  TrendingUp,
  Percent,
  Eye,
  EyeOff,
  Lock,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';

import * as XLSX from 'xlsx';
import ProRestrictionModal from './ProRestrictionModal';
import Toast from './Toast';

interface LedgerTabProps {
  db: Database;
  onDatabaseUpdate: () => void;
  role?: UserRole;
  isPro?: boolean;
  onNavigateToSubscription?: () => void;
}

export default function LedgerTab({ db, onDatabaseUpdate, role, isPro = false, onNavigateToSubscription }: LedgerTabProps) {
  // Check if modifications are restricted to Admin only
  const isModificationRestricted = false;

  // Restriction state
  const [restrictionModal, setRestrictionModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [toast, setToast] = useState<{ 
    show: boolean; 
    message: string; 
    actionLabel?: string; 
    onAction?: () => void; 
  }>({ show: false, message: '' });

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Column visibility state (customizable)
  const [visibleColumns, setVisibleColumns] = useState<{
    date: boolean;
    description: boolean;
    accountId: boolean;
    quantity: boolean;
    unitPrice: boolean;
    extraCharges: boolean;
    total: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('smartacc_ledger_visible_cols');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          date: parsed.date ?? true,
          description: parsed.description ?? true,
          accountId: parsed.accountId ?? true,
          quantity: parsed.quantity ?? true,
          unitPrice: parsed.unitPrice ?? true,
          extraCharges: parsed.extraCharges ?? true,
          total: parsed.total ?? true
        };
      }
    } catch (e) {
      // Ignored
    }
    return {
      date: true,
      description: true,
      accountId: true,
      quantity: true,
      unitPrice: true,
      extraCharges: true,
      total: true
    };
  });

  const [searchQuery, setSearchQuery] = useState('');
  
  // Advanced Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit'>('all');
  const [filterAccountId, setFilterAccountId] = useState('all');

  const clearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterType('all');
    setFilterAccountId('all');
    setSearchQuery('');
  };

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    const updated = { ...visibleColumns, [key]: !visibleColumns[key] };
    setVisibleColumns(updated);
    try {
      localStorage.setItem('smartacc_ledger_visible_cols', JSON.stringify(updated));
    } catch (e) {}
  };
  
  // Create / Edit temporary inline input state
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [extraCharges, setExtraCharges] = useState<number | ''>('');
  const [accountId, setAccountId] = useState<string>('');
  const [transactionType, setTransactionType] = useState<'debit' | 'credit'>('debit');
  const [currency, setCurrency] = useState<string>(db.primaryCurrency || 'YER');

  // Side stats for Daily Entries Page 3
  const summaryStats = useMemo(() => {
    const list = db.dailyEntries;
    const primary = db.primaryCurrency;
    
    const getEntryTotalInPrimary = (e: DailyLedgerEntry) => {
      const entryCurr = e.currency || 'YER';
      return db.convertCurrency(e.total, entryCurr, primary);
    };
    const getEntrySalesInPrimary = (e: DailyLedgerEntry) => {
      const entryCurr = e.currency || 'YER';
      return db.convertCurrency(e.quantity * e.unitPrice, entryCurr, primary);
    };
    const getEntryExtraInPrimary = (e: DailyLedgerEntry) => {
      const entryCurr = e.currency || 'YER';
      return db.convertCurrency(e.extraCharges, entryCurr, primary);
    };

    const totalEntriesSum = list.reduce((sum, e) => sum + getEntryTotalInPrimary(e), 0);
    const totalExtraSum = list.reduce((sum, e) => sum + getEntryExtraInPrimary(e), 0);
    const pureSalesSum = list.reduce((sum, e) => sum + getEntrySalesInPrimary(e), 0);
    return {
      count: list.length,
      totalSum: totalEntriesSum,
      extraSum: totalExtraSum,
      salesSum: pureSalesSum
    };
  }, [db.dailyEntries, db.primaryCurrency]);

  // Clean sorting of local 30-day entries list by day number
  const sortedEntries = useMemo(() => {
    let entries = [...db.dailyEntries];
    
    // Search Query Filter
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      entries = entries.filter(e => {
        const acc = db.accounts.find(a => a.id === e.accountId);
        const accName = acc ? acc.name.toLowerCase() : '';
        return (
          e.description.toLowerCase().includes(lowerQ) ||
          e.date.includes(lowerQ) ||
          accName.includes(lowerQ) ||
          e.total.toString().includes(lowerQ)
        );
      });
    }

    // Date Range Filter
    if (filterStartDate) {
      entries = entries.filter(e => e.date >= filterStartDate);
    }
    if (filterEndDate) {
      entries = entries.filter(e => e.date <= filterEndDate);
    }

    // Type Filter
    if (filterType !== 'all') {
      entries = entries.filter(e => e.transactionType === filterType);
    }

    // Account Filter
    if (filterAccountId !== 'all') {
      entries = entries.filter(e => e.accountId === filterAccountId);
    }

    return entries.sort((a, b) => a.dayNumber - b.dayNumber);
  }, [db.dailyEntries, searchQuery, db.accounts, filterStartDate, filterEndDate, filterType, filterAccountId]);

  // Save new entry
  const handleAddNewEntry = (e: React.FormEvent) => {
    e.preventDefault();

    // Check Pro Restriction
    const restriction = db.checkLimitOrPro('operation', isPro);
    if (!restriction.allowed) {
      setRestrictionModal({ 
        open: true, 
        message: restriction.message || 'لقد وصلت للحد الأقصى للعمليات اليومية في هذه النسخة. اشترك في النسخة العادية للعمليات اللامحدودة!' 
      });
      return;
    }

    if (restriction.warning) {
      setToast({ 
        show: true, 
        message: restriction.message || '',
        actionLabel: 'ترقية الآن',
        onAction: onNavigateToSubscription
      } as any);
    }

    if (isModificationRestricted) {
      alert('خطأ: إضافة القيود والحركات مقيدة لمدير النظام فقط بموجب سياسة الحماية الحالية.');
      return;
    }
    if (!description.trim()) {
      alert('الرجاء إدخال تفاصيل أو اسم المادة للعملية');
      return;
    }

    const calculatedTotal = (Number(quantity) * Number(unitPrice));
    const linkedAcc = db.accounts.find(a => a.id === accountId);

    db.addDailyLedgerEntry({
      dayNumber: Number(dayNumber),
      date,
      description,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      extraCharges: Number(extraCharges),
      total: calculatedTotal,
      accountId: accountId || undefined,
      accountType: linkedAcc?.type || undefined,
      transactionType: accountId ? (linkedAcc?.type === 'supplier' ? 'credit' : 'debit') : undefined,
      currency
    });

    onDatabaseUpdate();

    // Reset standard form inputs (Except day and date, for quick repetitive entries!)
    setDescription('');
    setQuantity('');
    setUnitPrice('');
    setExtraCharges('');
    setAccountId('');
    setCurrency(db.primaryCurrency || 'YER');
    
    // Auto increment day number for next input ease
    if (dayNumber < 30) {
      setDayNumber(prev => prev + 1);
    }
  };

  const handleExportExcel = () => {
    if (sortedEntries.length === 0) return;
    const data = sortedEntries.map(e => {
      const linkedAcc = db.accounts.find(a => a.id === e.accountId);
      return {
        'اليوم': e.dayNumber,
        'التاريخ': e.date,
        'البيان والتفاصيل': e.description,
        'الحساب المرتبط': linkedAcc?.name || '',
        'الكمية': e.quantity,
        'السعر': e.unitPrice,
        'إضافي': e.extraCharges,
        'الإجمالي': e.total,
        'العملة': e.currency || db.primaryCurrency || 'YER'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wscols = [
      {wch: 8}, // اليوم
      {wch: 15}, // التاريخ
      {wch: 40}, // البيان
      {wch: 20}, // الحساب
      {wch: 10}, // كمية
      {wch: 15}, // السعر
      {wch: 15}, // إضافي
      {wch: 20}, // الإجمالي
      {wch: 10}, // العملة
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "دفتر اليومية");
    XLSX.writeFile(wb, `Ledger_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Launch edit state for one row
  const startEditing = (entry: DailyLedgerEntry) => {
    if (isModificationRestricted) {
      alert('خطأ: تعديل الأسطر القيود مقيد لمدير النظام فقط بموجب سياسة الحماية الحالية.');
      return;
    }
    setEditingId(entry.id);
    setDayNumber(entry.dayNumber);
    setDate(entry.date);
    setDescription(entry.description);
    setQuantity(entry.quantity);
    setUnitPrice(entry.unitPrice);
    setExtraCharges(entry.extraCharges);
    setAccountId(entry.accountId || '');
    setTransactionType(entry.transactionType || 'debit');
    setCurrency(entry.currency || db.primaryCurrency || 'YER');
  };

  // Save modified row
  const handleSaveEdit = (id: string) => {
    if (isModificationRestricted) {
      alert('خطأ: تعديل وحفظ القيود والسطر مقيد لمدير النظام فقط.');
      return;
    }
    if (!description.trim()) {
      alert('الرجاء إدخال البيان للمادة');
      return;
    }

    const calculatedTotal = (Number(quantity) * Number(unitPrice));
    const linkedAcc = db.accounts.find(a => a.id === accountId);

    db.updateDailyLedgerEntry({
      id,
      dayNumber: Number(dayNumber),
      date,
      description,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      extraCharges: Number(extraCharges),
      total: calculatedTotal,
      accountId: accountId || undefined,
      accountType: linkedAcc?.type || undefined,
      transactionType: accountId ? (linkedAcc?.type === 'supplier' ? 'credit' : 'debit') : undefined,
      currency
    });

    onDatabaseUpdate();
    setEditingId(null);
    
    // Reset fields
    setDescription('');
    setQuantity('');
    setUnitPrice('');
    setExtraCharges('');
    setAccountId('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setQuantity('');
    setUnitPrice('');
    setExtraCharges('');
    setAccountId('');
  };

  const handleDeleteEntry = (id: string) => {
    if (isModificationRestricted) {
      alert('خطأ: حذف السطور القيود مقيد لمدير النظام فقط بموجب سياسة الحماية الحالية.');
      return;
    }
    if (confirm('هل أنت متأكد من حذف هذا السطر المحاسبي؟ سيتم إزالة تأثيره من الكشوفات المالية والحساب المرتبط به تلقائياً.')) {
      db.deleteDailyLedgerEntry(id);
      onDatabaseUpdate();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Pre-fill next missing day in draft to help user
  const nextAvailableDay = useMemo(() => {
    const days = db.dailyEntries.map(e => e.dayNumber);
    if (days.length === 0) return 1;
    const maxDay = Math.max(...days);
    return maxDay < 30 ? maxDay + 1 : 30;
  }, [db.dailyEntries]);

  return (
    <div className="space-y-8" id="ledger_tab_container">
      
      {/* Advanced Search & Filter Bar */}
      <div className="glass border border-white/10 rounded-2xl p-4 shadow-xl no-print space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="بحث سريع في القيود: البيان، المبالغ، أو التفاصيل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 transition-all outline-none text-white"
              dir="rtl"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              showFilters || filterStartDate || filterEndDate || filterType !== 'all' || filterAccountId !== 'all'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Filter size={18} />
            <span>تصفية متقدمة</span>
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 glass border border-white/10 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar size={12} />
                <span>من تاريخ</span>
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar size={12} />
                <span>إلى تاريخ</span>
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
              />
            </div>

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400">نوع العملية</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
              >
                <option value="all">الكل</option>
                <option value="debit">مدين (وارد)</option>
                <option value="credit">دائن (منصرف)</option>
              </select>
            </div>

            {/* Linked Account */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400">الحساب المرتبط</label>
              <select
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
              >
                <option value="all">جميع الحسابات</option>
                {db.accounts
                  .filter((acc, idx, self) => idx === self.findIndex(a => a.id === acc.id))
                  .map((acc, idx) => (
                    <option key={`${acc.id}_${idx}`} value={acc.id}>{acc.name}</option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-4 flex justify-end pt-2">
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>إعادة ضبط الفلاتر</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Page 3 Header Statistics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 no-print" id="ledger_stats_grid">
        <div className="group glass border border-white/10 rounded-2xl p-5 shadow-xl hover:scale-[1.01] transition-all duration-300 space-y-1.5 cursor-pointer interactive-tap">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold leading-none">إجمالي مبيعات المسودة</span>
            <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg icon-bounce group-hover:scale-110 group-hover:rotate-3 transition-all duration-305">
              <DollarSign size={15} />
            </div>
          </div>
          <p className="text-xl font-bold text-white font-mono pt-1" dir="ltr">
            {(summaryStats?.totalSum ?? 0)?.toLocaleString('ar-SA')} {db.primaryCurrency}
          </p>
          <span className="text-[10px] text-slate-500 block pt-0.5">شاملة الإضافيات والتكاليف</span>
        </div>

        <div className="group glass border border-white/10 rounded-2xl p-5 shadow-xl hover:scale-[1.01] transition-all duration-300 space-y-1.5 cursor-pointer interactive-tap">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold leading-none">صافي السعر للقطع</span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg icon-bounce group-hover:scale-110 group-hover:rotate-3 transition-all duration-305">
              <TrendingUp size={15} />
            </div>
          </div>
          <p className="text-xl font-bold text-emerald-400 font-mono pt-1" dir="ltr">
            {(summaryStats?.salesSum ?? 0)?.toLocaleString('ar-SA')} {db.primaryCurrency}
          </p>
          <span className="text-[10px] text-slate-500 block pt-0.5">القيمة الأساسية للبضائع</span>
        </div>

        <div className="group glass border border-white/10 rounded-2xl p-5 shadow-xl hover:scale-[1.01] transition-all duration-300 space-y-1.5 cursor-pointer interactive-tap">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold leading-none">مصاريف وتكاليف إضافية</span>
            <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg icon-bounce group-hover:scale-110 group-hover:rotate-3 transition-all duration-305">
              <Percent size={15} />
            </div>
          </div>
          <p className="text-xl font-bold text-amber-400 font-mono pt-1" dir="ltr">
            {(summaryStats?.extraSum ?? 0)?.toLocaleString('ar-SA')} {db.primaryCurrency}
          </p>
          <span className="text-[10px] text-slate-500 block pt-0.5 font-sans">ضرائب، نقل وتكاليف خدمية</span>
        </div>

        <div className="group glass border border-white/10 rounded-2xl p-5 shadow-xl hover:scale-[1.01] transition-all duration-300 space-y-1.5 cursor-pointer interactive-tap">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold leading-none">نسبة الامتلاء الشهري</span>
            <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg icon-bounce group-hover:scale-110 group-hover:rotate-3 transition-all duration-305">
              <FileSpreadsheet size={15} />
            </div>
          </div>
          <p className="text-lg font-bold text-purple-400 font-mono pt-1" dir="ltr">
            {summaryStats.count} قيد من 30 قيداً
          </p>
          <span className="text-[10px] text-slate-500 block pt-0.5 font-sans">تغطية الأيام الحالية</span>
        </div>
      </div>

      {/* QUICK DATA-ENTRY BOX (Interactive Relational Formulation) */}
      <div className="glass border border-white/10 rounded-2xl p-6 shadow-xl space-y-5 no-print" id="data_entry_form_container">
        {isModificationRestricted && (
          <div className="flex items-center gap-2 p-3.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold shadow-xs">
            <Lock size={15} className="text-rose-500 shrink-0" />
            <span>سياسة الحماية نشطة: تم تقييد إدخال القيود والجداول وتعديل الحركة والمسودات للمدير الإداري فقط.</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-400" />
              <span>إدخال البيانات الفوري وصياغة القيود اليومية (30 يوماً)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              قم بكتابة مبيعات المادة والسعر والكمية لتدوين القيد. يمكنك ربط الكشف مباشرة بحساب المورد أو العميل لترحيل المبالغ وتحديث أرصدتهم فوراً وإبلاغهم.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              id="export_excel_ledger"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl cursor-pointer transition-colors"
            >
              <FileSpreadsheet size={16} />
              <span>تصدير إكسل</span>
            </button>
            <button
              id="print_30days_ledger"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold text-slate-400 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
            >
              <Printer size={16} />
              <span>طباعة PDF</span>
            </button>
          </div>
        </div>

        {/* Quick form controls */}
        <form onSubmit={handleAddNewEntry} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 items-end text-right border-t border-white/10 pt-5">
          
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block">اليوم (1 - 30)</label>
            <input
              id="entry_day_input"
              type="number"
              min="1"
              max="30"
              required
              value={dayNumber}
              onChange={(e) => setDayNumber(Number(e.target.value))}
              placeholder={`اليوم (${nextAvailableDay})`}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="space-y-1 sm:col-span-1 md:col-span-2 lg:col-span-1">
            <label className="text-[11px] font-bold text-slate-400 block">التاريخ</label>
            <input
              id="entry_date_input"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="space-y-1 sm:col-span-2 lg:col-span-2">
            <label className="text-[11px] font-bold text-slate-400 block">البيان / تفاصيل السلعة والمباع *</label>
            <input
              id="entry_desc_input"
              type="text"
              required
              list="ledger_item_names"
              placeholder="مثال: بلوط أو نقفه"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block">الكمية</label>
            <input
              id="entry_qty_input"
              type="number"
              min="0"
              step="any"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-2.5 py-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block">سعر الوحدة ({db.primaryCurrency})</label>
            <input
              id="entry_price_input"
              type="number"
              min="0"
              step="any"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-2.5 py-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block">رسوم / مصاريف إضافية</label>
            <input
              id="entry_extra_input"
              type="number"
              min="0"
              step="any"
              value={extraCharges}
              onChange={(e) => setExtraCharges(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-2.5 py-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block">العملة</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="YER">YER (ريال يمني)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="YER">YER (ر.ي)</option>
            </select>
          </div>

          {/* Relational linking widget dropdown */}
          <div className="space-y-1 sm:col-span-2 lg:col-span-1.5 flex flex-col">
            <label className="text-[11px] font-bold text-indigo-400 block flex items-center gap-1">
              <Link2 size={12} />
              <span>الربط مع الحساب</span>
            </label>
            <select
              id="entry_account_link"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full text-xs bg-indigo-500/10 border border-indigo-400/20 text-white rounded-xl px-2.5 py-2 text-right outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="" className="bg-slate-900 text-white">-- مسودة مستقلة --</option>
              {db.accounts
                .filter(acc => role !== 'Salesperson' || acc.type === 'buyer')
                .filter((acc, idx, self) => idx === self.findIndex(a => a.id === acc.id))
                .map((acc, idx) => (
                  <option 
                    key={`${acc.id}_${idx}`} 
                    value={acc.id}
                    className="bg-slate-900 text-white"
                  >
                    {acc.name} ({acc.type === 'supplier' ? 'مورد' : 'عميل'})
                  </option>
                ))}
            </select>
          </div>

          {/* Dynamic Total Preview */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 block">الإجمالي الحالي</label>
            <div className="w-full text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-2.5 font-mono text-emerald-400 font-bold overflow-hidden text-ellipsis whitespace-nowrap">
              {((Number(quantity || 0) * Number(unitPrice || 0)))?.toLocaleString('en-US', {minimumFractionDigits: 1})} {currency}
            </div>
          </div>

          {/* Save Append Draft button */}
          <div className="lg:col-span-1">
            {isModificationRestricted ? (
              <div 
                className="w-full text-center text-xs font-bold bg-white/5 text-slate-500 py-3 rounded-xl border border-white/10 flex items-center justify-center gap-1 cursor-not-allowed"
                title="مغلق لمدير النظام فقط"
              >
                <Lock size={13} className="text-slate-500" />
                <span>ترحيل مقيد</span>
              </div>
            ) : (
              <button
                id="append_draft_entry_btn"
                type="submit"
                className="w-full text-center text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl cursor-pointer shadow-lg shadow-indigo-500/20 transition-all"
              >
                <Check className="inline-block mr-1" size={15} />
                <span>ترحيل القيد</span>
              </button>
            )}
          </div>

        </form>
      </div>

      {/* CORE 30-DAY LEDGER TABLE */}
      <div className="glass border border-white/10 rounded-2xl p-6 shadow-xl space-y-6" id="draft_table_section">
        
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-white">جدول البيانات والقيود المسجلة</h3>
            <p className="text-xs text-slate-400">ماتم تقييده في دورة الـ 30 يوماً</p>
          </div>
          <p className="text-xs text-slate-500 font-mono no-print">رتبة تسلسلية تصاعدية</p>
        </div>

        {/* PRINT BRANDING (Shows only in PDF printing) */}
        <div className="hidden print-only text-right space-y-4 mb-6 relative overflow-hidden" style={{ direction: 'rtl' }}>
          {db.printShowWatermark && (
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none rotate-12">
              <div className="text-center">
                <span className="text-5xl font-black block tracking-widest">{db.printCompanyName}</span>
                <span className="text-xl block mt-2">نظام محاسبي معتمد ومدقق وآمن</span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-start border-b pb-4">
            <div className="flex items-center gap-4">
              <img src="/icon.jpg" alt="Company Logo" className="w-16 h-16 object-contain rounded-lg" />
              <div className="space-y-1">
                <h1 className={`text-2xl font-black ${
                  db.printThemeColor === 'indigo' ? 'text-indigo-700' :
                  db.printThemeColor === 'blue' ? 'text-blue-700' :
                  db.printThemeColor === 'emerald' ? 'text-emerald-700' :
                  db.printThemeColor === 'slate' ? 'text-slate-800' :
                  db.printThemeColor === 'red' ? 'text-red-700' :
                  db.printThemeColor === 'amber' ? 'text-amber-700' :
                  db.printThemeColor === 'teal' ? 'text-teal-700' : 'text-slate-800'
                }`}>
                  {db.printCompanyName || 'نظام أنس المحاسبي المطور'}
                </h1>
                <p className="text-[10px] text-slate-500 font-bold">{db.printHeaderNote || 'تقرير محاسبي وكشف حساب معتمد'}</p>
              </div>
            </div>
            <div className="text-left text-[10px] text-slate-500 space-y-0.5 font-mono">
              <p>رقم الهاتف: {db.printPhone}</p>
              <p>العنوان: {db.printAddress}</p>
              {db.printTaxNumber && <p>الرقم الضريبي: {db.printTaxNumber}</p>}
              <p>مستخرج بتاريخ: {new Date().toLocaleDateString('ar-SA')} | الساعة: {new Date().toLocaleTimeString('ar-SA')}</p>
            </div>
          </div>
          
          <div className={`grid grid-cols-3 gap-4 text-center p-4 rounded-xl text-xs border ${
            db.printThemeColor === 'indigo' ? 'bg-indigo-50/40 border-indigo-100' :
            db.printThemeColor === 'blue' ? 'bg-blue-50/40 border-blue-100' :
            db.printThemeColor === 'emerald' ? 'bg-emerald-50/40 border-emerald-100' :
            db.printThemeColor === 'slate' ? 'bg-slate-50/70 border-slate-200' :
            db.printThemeColor === 'red' ? 'bg-red-50/40 border-red-100' :
            db.printThemeColor === 'amber' ? 'bg-amber-50/40 border-amber-100' :
            db.printThemeColor === 'teal' ? 'bg-teal-50/40 border-teal-100' : 'bg-slate-50 border-slate-150'
          }`}>
            <div>
              <span className="text-slate-500 block">إجمالي مبلغ القيود:</span>
              <span className="text-sm font-bold font-mono">{(summaryStats?.totalSum ?? 0)?.toLocaleString('ar-SA')} {db.primaryCurrency}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>إجمالي الإضافيات:</span>
              <span className="text-sm font-bold font-mono">{(summaryStats?.extraSum ?? 0)?.toLocaleString('ar-SA')} {db.primaryCurrency}</span>
            </div>
            <div>
              <span className="text-slate-500 block">عدد التداولات:</span>
              <span className="text-sm font-bold font-mono">{summaryStats.count} حركة</span>
            </div>
          </div>
        </div>

        {/* Table Column Customizer Controls */}
        <div className="no-print bg-white/5 border border-white/10 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-right" id="ledger_table_cols_toggle_bar">
          <div className="flex items-center gap-1.5">
            <Eye size={14} className="text-indigo-400" />
            <span className="text-xs font-black text-slate-300">تخصيص أعمدة جدول القيود (إظهار/إخفاء):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" dir="rtl">
            <button
              type="button"
              onClick={() => toggleColumn('date')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                visibleColumns.date 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {visibleColumns.date ? <Eye size={11} /> : <EyeOff size={11} />}
              <span>التاريخ</span>
            </button>
            <button
              type="button"
              onClick={() => toggleColumn('description')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                visibleColumns.description 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {visibleColumns.description ? <Eye size={11} /> : <EyeOff size={11} />}
              <span>البيان والشرح</span>
            </button>
            <button
              type="button"
              onClick={() => toggleColumn('accountId')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                visibleColumns.accountId 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {visibleColumns.accountId ? <Eye size={11} /> : <EyeOff size={11} />}
              <span>الربط الوظيفي</span>
            </button>
            <button
              type="button"
              onClick={() => toggleColumn('quantity')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                visibleColumns.quantity 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {visibleColumns.quantity ? <Eye size={11} /> : <EyeOff size={11} />}
              <span>الكمية</span>
            </button>
            <button
              type="button"
              onClick={() => toggleColumn('unitPrice')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                visibleColumns.unitPrice 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {visibleColumns.unitPrice ? <Eye size={11} /> : <EyeOff size={11} />}
              <span>سعر المفرد</span>
            </button>
            <button
              type="button"
              onClick={() => toggleColumn('extraCharges')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                visibleColumns.extraCharges 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {visibleColumns.extraCharges ? <Eye size={11} /> : <EyeOff size={11} />}
              <span>التكاليف الخارجية</span>
            </button>
            <button
              type="button"
              onClick={() => toggleColumn('total')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                visibleColumns.total 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {visibleColumns.total ? <Eye size={11} /> : <EyeOff size={11} />}
              <span>الإجمالي الصافي</span>
            </button>
          </div>
        </div>

        {/* Table Frame container */}
        <div className="overflow-x-auto border border-white/10 rounded-xl" id="draft_table_scroller">
          <table className="w-full text-right text-xs min-w-[800px] md:min-w-full">
            <thead className="bg-white/5 text-slate-400 uppercase font-bold text-[11px] border-b border-white/10">
              <tr>
                <th className="px-4 py-3.5 text-center">اليوم</th>
                {visibleColumns.date && <th className="px-4 py-3.5">التاريخ</th>}
                {visibleColumns.description && <th className="px-4 py-3.5">البيان والشرح للتأصيل</th>}
                {visibleColumns.accountId && <th className="px-4 py-3.5">الرابط والربط الوظيفي</th>}
                {visibleColumns.quantity && <th className="px-4 py-3.5 text-center">الكمية</th>}
                {visibleColumns.unitPrice && <th className="px-4 py-3.5 text-left">سعر المفرد</th>}
                {visibleColumns.extraCharges && <th className="px-4 py-3.5 text-left">التكاليف الخارجية</th>}
                {visibleColumns.total && <th className="px-4 py-3.5 text-left bg-white/5">الإجمالي الصافي</th>}
                <th className="px-4 py-3.5 text-center no-print">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td 
                    colSpan={
                      2 + 
                      (visibleColumns.date ? 1 : 0) + 
                      (visibleColumns.description ? 1 : 0) + 
                      (visibleColumns.accountId ? 1 : 0) + 
                      (visibleColumns.quantity ? 1 : 0) + 
                      (visibleColumns.unitPrice ? 1 : 0) + 
                      (visibleColumns.extraCharges ? 1 : 0) + 
                      (visibleColumns.total ? 1 : 0)
                    } 
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    لا توجد قيود مسجلة بعد في جدول الـ 30 يوماً المحاسبية. يرجى البدء في إدخال الحركات في النموذج أعلاه.
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => {
                  const isEditing = editingId === entry.id;
                  const linkedAccount = db.accounts.find(a => a.id === entry.accountId);
                  
                  if (isEditing) {
                    return (
                      <tr key={entry.id} className="bg-blue-50/20 dark:bg-blue-950/10" id={`editing_row_${entry.id}`}>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            max="30"
                            required
                            value={dayNumber}
                            onChange={(e) => setDayNumber(Number(e.target.value))}
                            className="w-16 text-center text-xs bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-1 font-mono text-slate-800 dark:text-slate-100"
                          />
                        </td>
                        {visibleColumns.date && (
                          <td className="px-2 py-2">
                            <input
                              type="date"
                              required
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              className="w-28 text-xs bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-1 font-mono text-slate-800 dark:text-slate-100"
                            />
                          </td>
                        )}
                        {visibleColumns.description && (
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              required
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 rounded px-2 py-1 text-slate-800 dark:text-slate-100"
                            />
                          </td>
                        )}
                        {visibleColumns.accountId && (
                          <td className="px-2 py-2">
                            <select
                              value={accountId}
                              onChange={(e) => setAccountId(e.target.value)}
                              className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-1"
                            >
                              <option value="">-- بلا ربط --</option>
                              {db.accounts
                                .filter(acc => role !== 'Salesperson' || acc.type === 'buyer')
                                .filter((acc, idx, self) => idx === self.findIndex(a => a.id === acc.id))
                                .map((acc, idx) => (
                                  <option key={`${acc.id}_${idx}`} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                          </td>
                        )}
                        {visibleColumns.quantity && (
                          <td className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-16 text-center text-xs bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-1 font-mono text-slate-800 dark:text-slate-100"
                            />
                          </td>
                        )}
                        {visibleColumns.unitPrice && (
                          <td className="px-2 py-2 text-left">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={unitPrice}
                              onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-20 text-left text-xs bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-1 font-mono text-slate-800 dark:text-slate-100"
                            />
                          </td>
                        )}
                        {visibleColumns.extraCharges && (
                          <td className="px-2 py-2 text-left">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={extraCharges}
                              onChange={(e) => setExtraCharges(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-20 text-left text-xs bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-1 font-mono text-slate-800 dark:text-slate-100"
                            />
                          </td>
                        )}
                        {visibleColumns.total && (
                          <td className="px-4 py-2 text-left font-mono font-bold text-slate-800 dark:text-slate-150 bg-slate-100/50 dark:bg-slate-800/10 whitespace-nowrap">
                            {((Number(quantity || 0) * Number(unitPrice || 0)))?.toLocaleString('en-US', {minimumFractionDigits: 1})} {currency}
                          </td>
                        )}
                        <td className="px-4 py-2 text-center whitespace-nowrap space-x-1.5 no-print">
                          <button
                            id="save_edit_row_btn"
                            onClick={() => handleSaveEdit(entry.id)}
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors cursor-pointer inline-block"
                            title="حفظ التعديلات"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            id="cancel_edit_row_btn"
                            onClick={handleCancelEdit}
                            className="p-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 dark:bg-slate-750 dark:hover:bg-slate-700 dark:text-slate-200 rounded transition-colors cursor-pointer inline-block"
                            title="تراجع"
                          >
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={entry.id} id={`entry_row_${entry.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                        اليوم {entry.dayNumber}
                      </td>
                      {visibleColumns.date && <td className="px-4 py-3.5 font-mono whitespace-nowrap text-slate-500">{entry.date}</td>}
                      {visibleColumns.description && <td className="px-4 py-3.5 font-medium">{entry.description}</td>}
                      {visibleColumns.accountId && (
                        <td className="px-4 py-3.5">
                          {linkedAccount ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500 block"></span>
                              <span className="font-bold text-slate-700 dark:text-slate-305 max-w-[150px] truncate block" title={linkedAccount.name}>
                                {linkedAccount.name}
                              </span>
                              <span className="text-[9px] px-1 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 block">
                                {linkedAccount.type === 'supplier' ? 'مورد' : 'عميل'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">مسودة عامة حرة</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.quantity && (
                        <td className="px-4 py-3.5 text-center font-mono">
                          {entry.quantity}
                        </td>
                      )}
                      {visibleColumns.unitPrice && (
                        <td className="px-4 py-3.5 text-left font-mono" dir="ltr">
                          {(entry.unitPrice ?? 0)?.toLocaleString('en-US', {minimumFractionDigits: 1})} {entry.currency || 'YER'}
                        </td>
                      )}
                      {visibleColumns.extraCharges && (
                        <td className="px-4 py-3.5 text-left font-mono text-amber-600" dir="ltr">
                          {(entry.extraCharges ?? 0) > 0 ? `+ ${(entry.extraCharges ?? 0)?.toLocaleString('en-US', {minimumFractionDigits: 1})} ${entry.currency || 'YER'}` : `0 ${entry.currency || 'YER'}`}
                        </td>
                      )}
                      {visibleColumns.total && (
                        <td className="px-4 py-3.5 text-left font-mono font-bold text-slate-800 dark:text-slate-105 bg-slate-50/50 dark:bg-slate-800/10 text-[13px] whitespace-nowrap" dir="ltr">
                          {(entry.total ?? 0)?.toLocaleString('en-US', {minimumFractionDigits: 1})} {entry.currency || 'YER'}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap space-x-1.5 no-print">
                        {role !== 'Salesperson' && !isModificationRestricted ? (
                          <>
                            <button
                              id={`start_edit_entry_${entry.id}`}
                              onClick={() => startEditing(entry)}
                              className="p-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-150 rounded transition-colors inline-block cursor-pointer"
                              title="تعديل السطر"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              id={`delete_entry_${entry.id}`}
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-1.5 bg-red-50 dark:bg-red-950/25 text-red-500 hover:bg-red-150 rounded transition-colors inline-block cursor-pointer"
                              title="حذف القيد"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md flex items-center justify-center gap-1">
                            <Lock size={10} />
                            <span>عرض فقط</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sortedEntries.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan={(visibleColumns.date ? 1 : 0) + (visibleColumns.description ? 1 : 0) + (visibleColumns.accountId ? 1 : 0) + 1} className="px-4 py-4 text-left">الإجمالي الكلي:</td>
                  {visibleColumns.quantity && <td className="px-4 py-4 text-center text-slate-800 dark:text-slate-200 font-mono">-</td>}
                  {visibleColumns.unitPrice && <td className="px-4 py-4 text-center font-mono">-</td>}
                  {visibleColumns.extraCharges && <td className="px-4 py-4 text-left font-mono text-amber-600">{(summaryStats?.extraSum ?? 0)?.toLocaleString('en-US', {minimumFractionDigits: 1})}</td>}
                  {visibleColumns.total && <td className="px-4 py-4 text-left font-mono text-emerald-600 bg-slate-100/30 dark:bg-slate-800/20">{(summaryStats?.totalSum ?? 0)?.toLocaleString('en-US', {minimumFractionDigits: 1})} {db.primaryCurrency}</td>}
                  <td className="px-4 py-4 no-print"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PRINT BRANDING (Shows only in PDF printing footer) */}
        <div className="hidden print-only border-t pt-6 mt-6 text-right space-y-4" id="ledger_print_footer">
          <p className="text-[10px] text-slate-500 leading-relaxed text-center font-bold">
            {db.printFooterNote || 'تم استخراج القيود السابقة تلقائياً عبر نظام ANAS المحاسبي.'}
          </p>
          
          {db.printShowSignature && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="border border-slate-200 rounded-xl p-4 text-center">
                <span className="text-[11px] font-black text-slate-700 block mb-8">توقيع مسؤول دفتر القيود والتدقيق</span>
                <span className="text-[10px] text-slate-400 block border-t pt-2 border-dashed">التوقيع والخاتم: .........................</span>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 text-center">
                <span className="text-[11px] font-black text-slate-700 block mb-8">مصادقة المدير العام للمؤسسة</span>
                <span className="text-[10px] text-slate-400 block border-t pt-2 border-dashed">إمضاء المسؤول المعتمد: .........................</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Pro Restriction Modal */}
      <ProRestrictionModal 
        isOpen={restrictionModal.open}
        onClose={() => setRestrictionModal({ ...restrictionModal, open: false })}
        message={restrictionModal.message}
        onUpgrade={() => {
          setRestrictionModal({ ...restrictionModal, open: false });
          onNavigateToSubscription?.();
        }}
      />

      {/* Warning Toast */}
      <Toast 
        show={toast.show}
        message={toast.message}
        onClose={() => setToast({ ...toast, show: false })}
        actionLabel="ترقية الآن"
        onAction={() => {
          setToast({ ...toast, show: false });
          onNavigateToSubscription?.();
        }}
      />
    </div>
  );
}
