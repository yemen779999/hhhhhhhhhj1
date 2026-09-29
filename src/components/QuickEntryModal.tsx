import React, { useState, useEffect } from 'react';
import { X, Plus, FileText, CheckCircle2 } from 'lucide-react';
import type { Database } from '../utils';
import Toast from './Toast';
import ProRestrictionModal from './ProRestrictionModal';

interface QuickEntryModalProps {
  db: Database;
  isOpen: boolean;
  onClose: () => void;
  onDatabaseUpdate: () => void;
  defaultType?: 'debit' | 'credit';
  isPro?: boolean;
  onNavigateToSubscription?: () => void;
}

export default function QuickEntryModal({ db, isOpen, onClose, onDatabaseUpdate, defaultType, isPro = false, onNavigateToSubscription }: QuickEntryModalProps) {
  // Form State
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [extraCharges, setExtraCharges] = useState<number | ''>('');
  const [accountId, setAccountId] = useState<string>('');
  const [currency, setCurrency] = useState<string>(db.primaryCurrency || 'YER');
  const [showSuccess, setShowSuccess] = useState(false);
  const [restrictionModal, setRestrictionModal] = useState({ open: false, message: '' });

  // Set the next available day when the modal opens
  useEffect(() => {
    if (isOpen) {
      setRestrictionModal({ open: false, message: '' });
      const days = db.dailyEntries.map(e => e.dayNumber);
      let nextDay = 1;
      if (days.length > 0) {
        const maxDay = Math.max(...days);
        nextDay = maxDay < 30 ? maxDay + 1 : 30;
      }
      setDayNumber(nextDay);
      // Reset form
      setDescription('');
      setQuantity('');
      setUnitPrice('');
      setExtraCharges('');
      
      // Auto-set account id based on defaultType
      if (defaultType === 'debit') {
        const firstCustomer = db.accounts.find(a => a.type === 'buyer');
        setAccountId(firstCustomer ? firstCustomer.id : '');
      } else if (defaultType === 'credit') {
        const firstSupplier = db.accounts.find(a => a.type === 'supplier');
        setAccountId(firstSupplier ? firstSupplier.id : '');
      } else {
        setAccountId('');
      }
      
      setCurrency(db.primaryCurrency || 'YER');
      setShowSuccess(false);
    }
  }, [isOpen, db.dailyEntries, db.primaryCurrency, defaultType, db.accounts]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check Pro Restriction
    const restriction = db.checkLimitOrPro('operation', isPro);
    if (!restriction.allowed) {
      setRestrictionModal({ open: true, message: 'لقد وصلت للحد الأقصى للعمليات اليومية في هذه النسخة. اشترك في النسخة العادية للعمليات اللامحدودة!' });
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
    setShowSuccess(true);
    
    // Close modal after success animation
    setTimeout(() => {
      onClose();
      setShowSuccess(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="glass w-full max-w-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${
              defaultType === 'debit' 
                ? 'bg-rose-500/10 text-rose-400' 
                : defaultType === 'credit' 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-indigo-500/10 text-indigo-400'
            }`}>
              <FileText size={18} />
            </div>
            <h3 className="font-bold text-white">
              {defaultType === 'debit' 
                ? 'إدخال اسحب مبلغ دين' 
                : defaultType === 'credit' 
                  ? 'إدخال تسديد مبلغ' 
                  : 'إدخال قيد سريع'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {showSuccess ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">تم حفظ القيد بنجاح!</h4>
            <p className="text-sm text-slate-500">تم ترحيل البيانات إلى دفتر اليومية.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">اليوم (1 - 30)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={dayNumber}
                  onChange={(e) => setDayNumber(Number(e.target.value))}
                  className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">التاريخ</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">البيان / تفاصيل السلعة والمباع *</label>
              <datalist id="quick_item_names">
                <option value="بلوط" />
                <option value="نقفه" />
                <option value="لوز" />
                <option value="جوز" />
                <option value="كاجو" />
              </datalist>
              <input
                type="text"
                required
                list="quick_item_names"
                placeholder="مثال: بلوط أو نقفه"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">الكمية</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">سعر المفرد</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">الإجمالي الحالي</label>
                <div className="w-full text-sm bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl px-3 py-2.5 font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  {((Number(quantity || 0) * Number(unitPrice || 0)))?.toLocaleString('en-US', {minimumFractionDigits: 1})} {currency}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                {defaultType === 'debit' 
                  ? 'ربط القيد بحساب العميل (مدين)' 
                  : defaultType === 'credit' 
                    ? 'ربط القيد بحساب المورد (دائن)' 
                    : 'ربط القيد بحساب (اختياري)'}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
              >
                {!defaultType && <option value="">-- مسودة مستقلة لا تؤثر على الأرصدة --</option>}
                {db.accounts
                  .filter(acc => {
                    if (defaultType === 'debit') return acc.type === 'buyer';
                    if (defaultType === 'credit') return acc.type === 'supplier';
                    return true;
                  })
                  .filter((acc, idx, self) => idx === self.findIndex(a => a.id === acc.id))
                  .map((acc, accIdx) => (
                    <option key={`${acc.id}_${accIdx}`} value={acc.id}>
                      {acc.name} ({acc.type === 'supplier' ? 'مورد' : 'عميل'})
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>إضافة القيد الفوري</span>
              </button>
            </div>
          </form>
        )}
      </div>
      <ProRestrictionModal 
        isOpen={restrictionModal.open}
        onClose={() => setRestrictionModal({ ...restrictionModal, open: false })}
        message={restrictionModal.message}
        onUpgrade={() => {
          setRestrictionModal({ ...restrictionModal, open: false });
          onClose();
          onNavigateToSubscription?.();
        }}
      />
    </div>
  );
}
