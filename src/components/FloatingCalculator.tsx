import React, { useState, useEffect, useRef } from 'react';
import { Calculator, X, Sparkles, Copy, Check } from 'lucide-react';

export default function FloatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const [copied, setCopied] = useState(false);
  const calculatorRef = useRef<HTMLDivElement>(null);

  // Handle outside clicks to close or just normal focus management
  const handleClear = () => {
    setDisplayValue('');
  };

  const handleBackspace = () => {
    setDisplayValue(prev => prev.slice(0, -1));
  };

  const handleAppend = (char: string) => {
    // Avoid double operators or multiple decimals in one segment if possible
    setDisplayValue(prev => {
      const lastChar = prev.slice(-1);
      const operators = ['+', '-', '*', '/'];
      if (operators.includes(char) && operators.includes(lastChar)) {
        return prev.slice(0, -1) + char; // replace last operator
      }
      return prev + char;
    });
  };

  const handleCalculate = () => {
    if (!displayValue) return;
    try {
      // Safe evaluation of basic math expressions only
      // eslint-disable-next-line no-new-func
      const sanitized = displayValue.replace(/[^0-9+\-*/().]/g, '');
      const result = new Function(`return (${sanitized})`)();
      if (result === Infinity || result === -Infinity || isNaN(result)) {
        setDisplayValue('خطأ');
      } else {
        // Round to 4 decimal places to prevent float precision issues
        const rounded = Math.round(result * 10000) / 10000;
        setDisplayValue(rounded.toString());
      }
    } catch (e) {
      setDisplayValue('خطأ');
    }
  };

  const handleCopy = () => {
    if (!displayValue || displayValue === 'خطأ') return;
    navigator.clipboard.writeText(displayValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(err => {
      console.warn('[Calculator] Clipboard copy failed:', err);
      // Fallback: just show error or do nothing
    });
  };

  // Keyboard support for the calculator when it is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleAppend(e.key);
      } else if (['+', '-', '*', '/'].includes(e.key)) {
        handleAppend(e.key);
      } else if (e.key === '.') {
        handleAppend('.');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleCalculate();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (e.key === 'c' || e.key === 'C') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, displayValue]);

  return (
    <div className="no-print">
      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center cursor-pointer select-none group border ${
          isOpen
            ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 scale-100 hover:scale-110'
        }`}
        title={isOpen ? "إغلاق الآلة الحاسبة" : "الآلة الحاسبة العائمة السريعة"}
      >
        {isOpen ? <X size={20} className="animate-in fade-in duration-200" /> : <Calculator size={20} className="stroke-[2.2] animate-pulse" />}
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 text-xs font-black mr-0 group-hover:mr-2 whitespace-nowrap">
          {isOpen ? 'إغلاق الحاسبة' : 'حاسبة سريعة'}
        </span>
      </button>

      {/* Calculator Window Pop-up */}
      {isOpen && (
        <div
          ref={calculatorRef}
          className="fixed bottom-24 right-6 z-50 w-72 glass border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300"
          dir="rtl"
        >
          {/* Header */}
          <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <Calculator size={15} className="text-indigo-400" />
              <span className="text-xs font-black text-white">آلة حاسبة عائمة</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded-md font-mono border border-white/10">سريعة</span>
            </div>
          </div>

          {/* Screen Display */}
          <div className="p-4 bg-black/20 border-b border-white/10 text-left">
            <div className="min-h-6 text-[11px] font-mono text-slate-500 break-all overflow-x-auto text-left" dir="ltr">
              {displayValue || '0'}
            </div>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
              <button
                onClick={handleCopy}
                disabled={!displayValue || displayValue === 'خطأ'}
                className="p-1 text-slate-400 hover:text-indigo-400 rounded-md transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="نسخ الناتج للحافظة"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
              <span className="text-lg font-black font-mono text-white truncate max-w-xs" dir="ltr">
                {displayValue || '0'}
              </span>
            </div>
          </div>

          {/* Grid of keys */}
          <div className="p-3 bg-transparent grid grid-cols-4 gap-2 text-center text-xs font-bold">
            {/* Row 1 */}
            <button
              onClick={handleClear}
              className="py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-2xl cursor-pointer transition-all border border-rose-500/20"
            >
              C
            </button>
            <button
              onClick={() => handleAppend('(')}
              className="py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              (
            </button>
            <button
              onClick={() => handleAppend(')')}
              className="py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              )
            </button>
            <button
              onClick={() => handleAppend('/')}
              className="py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl cursor-pointer transition-all border border-indigo-500/20 font-mono"
            >
              ÷
            </button>

            {/* Row 2 */}
            <button
              onClick={() => handleAppend('7')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              7
            </button>
            <button
              onClick={() => handleAppend('8')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              8
            </button>
            <button
              onClick={() => handleAppend('9')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              9
            </button>
            <button
              onClick={() => handleAppend('*')}
              className="py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl cursor-pointer transition-all border border-indigo-500/20 font-mono"
            >
              ×
            </button>

            {/* Row 3 */}
            <button
              onClick={() => handleAppend('4')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              4
            </button>
            <button
              onClick={() => handleAppend('5')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              5
            </button>
            <button
              onClick={() => handleAppend('6')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              6
            </button>
            <button
              onClick={() => handleAppend('-')}
              className="py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl cursor-pointer transition-all border border-indigo-500/20 font-mono"
            >
              -
            </button>

            {/* Row 4 */}
            <button
              onClick={() => handleAppend('1')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              1
            </button>
            <button
              onClick={() => handleAppend('2')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              2
            </button>
            <button
              onClick={() => handleAppend('3')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              3
            </button>
            <button
              onClick={() => handleAppend('+')}
              className="py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl cursor-pointer transition-all border border-indigo-500/20 font-mono"
            >
              +
            </button>

            {/* Row 5 */}
            <button
              onClick={() => handleAppend('0')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              0
            </button>
            <button
              onClick={() => handleAppend('.')}
              className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl cursor-pointer transition-all border border-white/10 font-mono"
            >
              .
            </button>
            <button
              onClick={handleBackspace}
              className="py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl cursor-pointer transition-all flex items-center justify-center font-mono border border-white/10"
              title="حذف الرقم الأخير"
            >
              ⌫
            </button>
            <button
              onClick={handleCalculate}
              className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl cursor-pointer transition-all shadow-lg shadow-indigo-500/20 font-mono"
            >
              =
            </button>
          </div>

          <div className="bg-white/5 px-4 py-2 border-t border-white/10 text-[9px] text-slate-500 text-center select-none">
            اختصارات الكيبورد (الأرقام، الرموز، Enter، Backspace) نشطة.
          </div>
        </div>
      )}
    </div>
  );
}
