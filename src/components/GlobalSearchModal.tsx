import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, BookOpen, Receipt, FileText } from 'lucide-react';
import { Database } from '../utils';
import { Account, Transaction as LedgerTransaction, InvoiceRecord as Invoice } from '../types';

interface GlobalSearchModalProps {
  db: Database;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, id?: string) => void;
}

export default function GlobalSearchModal({ db, isOpen, onClose, onNavigate }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = {
    accounts: [] as Account[],
    transactions: [] as LedgerTransaction[],
    invoices: [] as Invoice[],
  };

  if (query.trim().length > 1) {
    const q = query.toLowerCase();
    results.accounts = db.accounts.filter(a => 
      a.name.toLowerCase().includes(q) || 
      (a.phone && a.phone.includes(q)) || 
      (a.address && a.address.toLowerCase().includes(q))
    ).slice(0, 5);

    results.transactions = db.transactions.filter(t => 
      t.description.toLowerCase().includes(q) || 
      t.amount.toString().includes(q)
    ).slice(0, 5);

    results.invoices = db.invoices.filter(i => 
      (db.accounts.find(a => a.id === i.accountId)?.name.toLowerCase().includes(q)) || 
      (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(q))
    ).slice(0, 5);
  }

  const hasResults = results.accounts.length > 0 || results.transactions.length > 0 || results.invoices.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 sm:px-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200" dir="rtl">
        {/* Search Input Area */}
        <div className="flex items-center p-4 border-b border-slate-700/50 bg-slate-800/50">
          <Search size={24} className="text-indigo-400 ml-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن حساب، فاتورة، رقم، تفاصيل..."
            className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-slate-500 font-medium"
          />
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-xl transition-colors shrink-0">
            <X size={20} className="text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length <= 1 ? (
            <div className="p-8 text-center text-slate-500">
              <Search size={48} className="mx-auto mb-4 text-slate-600 opacity-50" />
              <p className="font-medium text-sm">اكتب كلمة للبحث في السجلات المحاسبية</p>
            </div>
          ) : !hasResults ? (
            <div className="p-8 text-center text-slate-500">
              <p className="font-medium text-sm">لم يتم العثور على نتائج لـ "{query}"</p>
            </div>
          ) : (
            <div className="p-2 space-y-4">
              
              {/* Accounts */}
              {results.accounts.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 flex items-center gap-2">
                    <Users size={14} /> الحسابات ({results.accounts.length})
                  </div>
                  <div className="space-y-1">
                    {results.accounts.map((acc, idx) => (
                      <button
                        key={`${acc.id}_${idx}`}
                        onClick={() => { onClose(); onNavigate('accounts', acc.id); }}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/80 transition-colors text-right group"
                      >
                        <div>
                          <span className="font-bold text-sm text-slate-200 block group-hover:text-indigo-400 transition-colors">{acc.name}</span>
                          <span className="text-xs text-slate-500 block">{acc.type === 'buyer' ? 'عميل' : acc.type === 'supplier' ? 'مورد' : 'مصروف'}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-300" dir="ltr">
                          {db.getAccountBalance(acc.id)?.toLocaleString('ar-SA')} {db.primaryCurrency}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions */}
              {results.transactions.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 flex items-center gap-2">
                    <BookOpen size={14} /> القيود اليومية ({results.transactions.length})
                  </div>
                  <div className="space-y-1">
                    {results.transactions.map(tx => (
                      <button
                        key={tx.id}
                        onClick={() => { onClose(); onNavigate('ledger', tx.id); }}
                        className="w-full flex justify-between p-3 rounded-xl hover:bg-slate-800/80 transition-colors text-right group"
                      >
                        <div>
                          <span className="font-bold text-sm text-slate-200 block group-hover:text-indigo-400 transition-colors truncate max-w-sm">{tx.description}</span>
                          <span className="text-xs text-slate-500 block">{db.accounts.find(a => a.id === tx.accountId)?.name || 'حساب محذوف'} • {tx.date}</span>
                        </div>
                        <span className={`font-mono text-xs font-bold shrink-0 text-left ${tx.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">
                          {tx.type === 'credit' ? '+' : '-'}{tx.amount?.toLocaleString('ar-SA')} {db.primaryCurrency}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices */}
              {results.invoices.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 flex items-center gap-2">
                    <Receipt size={14} /> الفواتير ({results.invoices.length})
                  </div>
                  <div className="space-y-1">
                    {results.invoices.map(inv => (
                      <button
                        key={inv.id}
                        onClick={() => { onClose(); onNavigate('invoice', inv.id); }}
                        className="w-full flex justify-between p-3 rounded-xl hover:bg-slate-800/80 transition-colors text-right group"
                      >
                        <div>
                          <span className="font-bold text-sm text-slate-200 block group-hover:text-indigo-400 transition-colors">فاتورة مبيعات - {db.accounts.find(a => a.id === inv.accountId)?.name}</span>
                          <span className="text-xs text-slate-500 block font-mono">رقم: {inv.invoiceNumber} • {inv.date}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-300 shrink-0 text-left" dir="ltr">
                          {inv.total?.toLocaleString('ar-SA')} {db.primaryCurrency}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
