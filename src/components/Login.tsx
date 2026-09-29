import React, { useState } from 'react';
import { Building2, Mail, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { loginWithEmail, registerWithEmail, resetPassword, googleSignIn, guestLogin } from '../auth';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isReset) {
        await resetPassword(email);
        setMessage('تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني.');
        setIsReset(false);
      } else if (isLogin) {
        await loginWithEmail(email, password);
        onLogin();
      } else {
        await registerWithEmail(email, password);
        onLogin();
      }
    } catch (err: any) {
      let errorMessage = 'حدث خطأ. يرجى المحاولة مرة أخرى.';
      if (err.code === 'auth/user-not-found') errorMessage = 'المستخدم غير موجود.';
      else if (err.code === 'auth/wrong-password') errorMessage = 'كلمة المرور غير صحيحة.';
      else if (err.code === 'auth/email-already-in-use') errorMessage = 'البريد الإلكتروني مسجل مسبقاً.';
      else if (err.code === 'auth/invalid-email') errorMessage = 'البريد الإلكتروني غير صالح.';
      else if (err.code === 'auth/weak-password') errorMessage = 'كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل).';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/30">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">نظام ANAS المحاسبي</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isReset ? 'استعادة كلمة المرور' : isLogin ? 'تسجيل الدخول للوصول إلى حساباتك' : 'إنشاء حساب جديد في النظام'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 text-sm font-bold">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        
        {message && (
          <div className="mb-6 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center gap-2 text-sm font-bold">
            <AlertCircle size={18} />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">البريد الإلكتروني</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <Mail size={16} className="text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-4 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="أدخل البريد الإلكتروني"
                dir="ltr"
              />
            </div>
          </div>

          {!isReset && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">كلمة المرور</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <Lock size={16} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-4 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="أدخل كلمة المرور"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw size={20} className="animate-spin" /> : null}
            <span>{isReset ? 'إرسال رابط الاستعادة' : isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}</span>
          </button>
        </form>

        {!isReset && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">أو</span>
              </div>
            </div>

            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await googleSignIn();
                  if (res) onLogin();
                } catch (err: any) {
                  setError('فشل تسجيل الدخول بواسطة جوجل.');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>تسجيل الدخول بواسطة Google</span>
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  await guestLogin();
                  onLogin();
                } catch (err: any) {
                  setError('فشل تسجيل الدخول كضيف.');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full mt-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>تسجيل الدخول كضيف</span>
            </button>
          </>
        )}

        <div className="mt-6 text-center space-y-3">
          {!isReset && (
            <button
              onClick={() => setIsReset(true)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline block w-full"
            >
              نسيت كلمة المرور؟
            </button>
          )}

          <button
            onClick={() => {
              setIsReset(false);
              setIsLogin(!isLogin);
              setError('');
              setMessage('');
            }}
            className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isReset ? 'العودة لتسجيل الدخول' : isLogin ? 'لا تملك حساباً؟ إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول'}
          </button>
        </div>

      </div>
    </div>
  );
}
