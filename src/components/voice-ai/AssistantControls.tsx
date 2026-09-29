import React, { useRef } from "react";
import { Mic, MicOff, Square, Keyboard, Volume2, VolumeX, X, Paperclip, Camera, Monitor, MonitorOff } from "lucide-react";
import { motion } from "motion/react";

interface AssistantControlsProps {
  isListening: boolean;
  onToggleListening: () => void;
  onClose: () => void;
  userCommand: string;
  setUserCommand: (val: string) => void;
  onSendPrompt: (prompt?: string) => void;
  isProcessing: boolean;
  autoSpeak: boolean;
  setAutoSpeak: (val: boolean) => void;
  onFileUpload: (file: File) => void;
  onToggleScreenShare: () => void;
  isScreenSharing: boolean;
}

export const AssistantControls: React.FC<AssistantControlsProps> = ({
  isListening,
  onToggleListening,
  onClose,
  userCommand,
  setUserCommand,
  onSendPrompt,
  isProcessing,
  autoSpeak,
  setAutoSpeak,
  onFileUpload,
  onToggleScreenShare,
  isScreenSharing
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="flex items-center justify-between gap-6 p-6 bg-slate-950/80 backdrop-blur-3xl border-t border-slate-800/50">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setAutoSpeak(!autoSpeak)}
          className={`p-3 rounded-2xl border transition-all ${
            autoSpeak 
              ? "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800" 
              : "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
          }`}
          title={autoSpeak ? "إيقاف القراءة التلقائية" : "تفعيل القراءة التلقائية"}
        >
          {autoSpeak ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        <div className="relative">
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept="image/*,application/pdf,.xlsx,.xls,.doc,.docx,text/plain,text/csv"
          />
          <input 
            type="file" 
            className="hidden" 
            ref={cameraInputRef} 
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400 hover:bg-slate-800 transition-colors"
            title="إرفاق مستند أو صورة"
          >
            <Paperclip className="w-5 h-5" />
          </button>
        </div>

        <button 
          onClick={() => cameraInputRef.current?.click()}
          className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400 hover:bg-slate-800 transition-colors"
          title="فتح الكاميرا"
        >
          <Camera className="w-5 h-5" />
        </button>

        <button 
          onClick={onToggleScreenShare}
          className={`p-3 rounded-2xl border transition-all ${
            isScreenSharing 
              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20" 
              : "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800"
          }`}
          title={isScreenSharing ? "إيقاف مشاركة الشاشة" : "مشاركة الشاشة"}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        <button 
          onClick={onClose}
          className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800 text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 max-w-2xl relative">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            onSendPrompt();
          }}
          className="relative"
        >
          <input
            type="text"
            value={userCommand}
            onChange={(e) => setUserCommand(e.target.value)}
            disabled={isProcessing}
            placeholder="سجل قيد يومي، أضف مورد، اسأل عن الشاشة..."
            className="w-full pl-14 pr-6 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 transition-all font-medium"
          />
          <button 
            type="submit"
            disabled={isProcessing || !userCommand.trim()}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-50 transition-all"
          >
            <Keyboard className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="relative">
        <motion.div
          animate={{ scale: isListening ? [1, 1.2, 1] : 1 }}
          transition={{ repeat: Infinity, duration: 2 }}
          className={`absolute -inset-4 rounded-full blur-2xl opacity-20 ${isListening ? 'bg-emerald-500' : 'bg-indigo-500'}`}
        />
        <button
          onClick={onToggleListening}
          className={`relative z-10 p-5 rounded-full shadow-2xl transition-all active:scale-95 ${
            isListening 
              ? "bg-rose-500 text-white shadow-rose-500/20" 
              : "bg-indigo-600 text-white shadow-indigo-600/20"
          }`}
        >
          {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        </button>
      </div>
    </div>
  );
};
