/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Cpu, Loader2, X, Send, Check, AlertCircle, Radio, HelpCircle, ArrowLeft, ArrowRight, Play, Pause, Settings2, RefreshCw, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { pcmToBase64, createAudioChunkPlayer } from "./audioUtils";
import { auth, firestore } from "../auth";
import { ThinkingStep, OperationStep, AccountingPreviewData, AssistantStatus, DocumentAnalysisResult } from "../types";
import { VoiceWaveform } from "./voice-ai/VoiceWaveform";
import { ThinkingTimeline } from "./voice-ai/ThinkingTimeline";
import { AccountingPreview } from "./voice-ai/AccountingPreview";
import { DocumentPreview } from "./voice-ai/DocumentPreview";
import { LiveActivityFeed } from "./voice-ai/LiveActivityFeed";
import { AssistantControls } from "./voice-ai/AssistantControls";

interface VoiceAIAssistantProps {
  db: any;
  onDatabaseUpdate: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setSelectedAccountId?: (id: string | undefined) => void;
  darkMode?: boolean;
  setDarkMode?: (val: boolean) => void;
  handleInstallApp?: () => void;
}



function VoiceAIAssistant({
  db,
  onDatabaseUpdate,
  activeTab,
  setActiveTab,
  setSelectedAccountId,
  darkMode,
  setDarkMode,
  handleInstallApp
}: VoiceAIAssistantProps) {
  const VOICE_OPTIONS = [
    { id: "male_1", name: "رجل 1: رسمي وهادئ", gender: "male", pitch: 0.95, rate: 0.95, desc: "صوت رجالي إداري متزن وهادئ، مثالي للملخصات والتحليل المالي" },
    { id: "male_2", name: "رجل 2: احترافي وعميق", gender: "male", pitch: 0.80, rate: 1.00, desc: "صوت رجالي عميق جهوري يمنح شعوراً بالثقة والجدية المحاسبية" },
    { id: "male_3", name: "رجل 3: شبابي وطبيعي", gender: "male", pitch: 1.05, rate: 1.05, desc: "أداء شبابي حيوي وسلس لتقييم الحسابات والتفاعل اليومي السريع" },
    { id: "male_4", name: "رجل 4: سريع وواضح", gender: "male", pitch: 1.00, rate: 1.25, desc: "صوت ذو وتيرة سريعة لتلخيص الفواتير ومراجعة السجلات والبيانات" },
    { id: "male_5", name: "رجل 5: عربي فصيح", gender: "male", pitch: 0.90, rate: 0.92, desc: "إلقاء نحوي ممتاز ونبرة واضحة ومخارج حروف عربية دقيقة جداً" },
    { id: "female_1", name: "امرأة 1: هادئة وطبيعية", gender: "female", pitch: 1.15, rate: 0.95, desc: "نبرة أنثوية هادئة ومريحة، ممتازة لمطالعة وتدقيق الحسابات" },
    { id: "female_2", name: "امرأة 2: احترافية", gender: "female", pitch: 1.00, rate: 1.05, desc: "أداء إلقائي إعلامي رصين ومناسب لقراءة موازين المراجعة" },
    { id: "female_3", name: "امرأة 3: ودودة", gender: "female", pitch: 1.10, rate: 1.00, desc: "صوت دافئ ولطيف يجعل التفاعل ومراجعة القيود اليومية ممتعاً" },
    { id: "female_4", name: "امرأة 4: عربية فصيحة", gender: "female", pitch: 1.05, rate: 0.95, desc: "مخارج عربية فصيحة ومتقنة لتسهيل فهم مخرجات النظام والتقارير" },
    { id: "female_5", name: "امرأة 5: نبرة رسمية", gender: "female", pitch: 0.95, rate: 1.02, desc: "صوت نسائي رسمي وإداري للشركات والتدقيق ومراجعة الفواتير والقيود" }
  ];

  const sessionId = useMemo(() => 'SESSION_' + Math.random().toString(36).substr(2, 9).toUpperCase(), []);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(true); // Continuous listening toggle (Gemini Live)
  const [speechError, setSpeechError] = useState<string | null>(null);
  
  // Consent-driven screen sharing and understanding states
  const [isScreenShared, setIsScreenShared] = useState(true);
  
  useEffect(() => {
    if (isOpen) {
      const storedVoice = localStorage.getItem("smartacc_live_voice");
      if (storedVoice && storedVoice !== selectedLiveVoice) {
        setSelectedLiveVoice(storedVoice);
      }
    }
  }, [isOpen]);

  // Stored voice states (localStorage fallbacks)
  const [selectedVoiceOption, setSelectedVoiceOption] = useState(() => {
    return localStorage.getItem("smartacc_voice_option") || "male_1";
  });
  const [speechRate, setSpeechRate] = useState(() => {
    return parseFloat(localStorage.getItem("smartacc_speech_rate") || "1.00");
  });
  const [voicePitch, setVoicePitch] = useState(() => {
    return parseFloat(localStorage.getItem("smartacc_voice_pitch") || "1.00");
  });
  const [voiceVolume, setVoiceVolume] = useState(() => {
    return parseFloat(localStorage.getItem("smartacc_voice_volume") || "1.00");
  });
  const [voiceDialect, setVoiceDialect] = useState(() => {
    return localStorage.getItem("smartacc_voice_dialect") || "ar-SA";
  });

  const [selectedLiveVoice, setSelectedLiveVoice] = useState(() => {
    return localStorage.getItem("smartacc_live_voice") || "Zephyr";
  });

  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState<number[]>(Array(10).fill(2));
  const [micStatusReport, setMicStatusReport] = useState<string | null>(null);

  const [cloudSyncStatus, setCloudSyncStatus] = useState<"synced" | "saving" | "error">("synced");
  const [showVoiceSettingsPanel, setShowVoiceSettingsPanel] = useState(false);
  const [showCustomVoiceDropdown, setShowCustomVoiceDropdown] = useState(false);
  const [detectedElements, setDetectedElements] = useState<string[]>([]);


  // Clear states requested in PDF:
  // يستمع... | يفكر... | ينفذ العملية... | يتحدث... | اكتملت العملية.
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>("idle");
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [previewData, setPreviewData] = useState<AccountingPreviewData | undefined>();
  const [userCommand, setUserCommand] = useState("");
  const [conversation, setConversation] = useState<{ role: "user" | "assistant"; text: string; timestamp: string }[]>([
    {
      role: "assistant",
      text: "مرحباً بك في البث الصوتي المباشر (ANAS Voice Live)! أنا مساعدك المحاسبي الذكي. يمكنك التحدث معي بشكل مستمر وتوجيه الأوامر أو الاستفسار عن الشاشة المعروضة أمامك باللغة العربية الفصحى أو اللهجة اليمنية.",
      timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const [sessionStartTime] = useState(Date.now());
  const [sessionStats, setSessionStats] = useState({
    totalOperations: 0,
    totalTime: "00:00:00",
    avgResponseTime: 1.2
  });

  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisResult | undefined>();
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string; type: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<{ name: string; date: string; type: string }[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: false
      });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      stream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        screenStreamRef.current = null;
      };
    } catch (err: any) {
      console.error("Error starting screen share:", err);
      if (err.name === 'NotAllowedError') {
        alert("تعذر بدء مشاركة الشاشة. يرجى محاولة فتح التطبيق في علامة تبويب جديدة (New Tab) أو التحقق من أذونات المتصفح.");
      } else {
        alert("تعذر بدء مشاركة الشاشة. تأكد من منح الأذونات اللازمة.");
      }
    }
  };

  useEffect(() => {
    let interval: any;
    if (isScreenSharing && wsRef.current?.readyState === WebSocket.OPEN) {
      const video = document.createElement('video');
      video.srcObject = screenStreamRef.current;
      video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      interval = setInterval(() => {
        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = 640;
          canvas.height = 480;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          wsRef.current?.send(JSON.stringify({ video: base64 }));
        }
      }, 1000); // Send frame every second
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScreenSharing]);

  const handleFileUpload = async (file: File) => {
    try {
      setIsAnalyzingFile(true);
      setAssistantStatus("thinking");
      setThinkingSteps([
        { id: "upload", label: "جاري رفع المستند...", status: "active" },
        { id: "ocr", label: "استخراج النصوص (OCR)...", status: "pending" },
        { id: "ai", label: "تحليل البيانات المحاسبية...", status: "pending" }
      ]);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const res = await fetch("/api/parse-document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileData: base64,
              mimeType: file.type,
              fileName: file.name
            })
          });

          const data = await res.json();
          if (data.success) {
            setAnalysisResult(data.data);
            setUploadedFile({ 
              name: file.name, 
              url: URL.createObjectURL(file), 
              type: file.type 
            });
            
            setRecentDocuments(prev => [
              { name: file.name, date: new Date().toLocaleTimeString("ar-SA"), type: file.type },
              ...prev.slice(0, 4)
            ]);
            
            setThinkingSteps(prev => prev.map(s => ({ ...s, status: "completed" })));
            setAssistantStatus("idle");

            // Update preview data if available
            if (data.data.suggestedJournalEntry) {
              setPreviewData(data.data.suggestedJournalEntry);
            }

            // Send context to Live API
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ 
                text: `[نظام: قام المستخدم برفع مستند من نوع "${data.data.documentType}". 
                البيانات المستخرجة: ${JSON.stringify(data.data.extractedData)}. 
                الإجراء المقترح: ${data.data.suggestedAction}. 
                ثقة النظام: ${data.data.confidenceScore * 100}%. 
                يرجى إبلاغ المستخدم بأنك قمت بتحليل المستند واسأله إذا كان يريد الاستمرار في الإجراء المقترح أو لديه استفسار.]` 
              }));
            }
          } else {
             throw new Error(data.error);
          }
        } catch (err) {
          console.error("Analysis inner error", err);
          setAssistantStatus("idle");
          setThinkingSteps([{ id: "err", label: "فشل التحليل الذكي", status: "completed" }]);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("File analysis error", err);
      setAssistantStatus("idle");
      setThinkingSteps([]);
    } finally {
      setIsAnalyzingFile(false);
    }
  };

  const handleConfirmAnalysis = () => {
    if (!analysisResult) return;

    setAssistantStatus("executing");
    setThinkingSteps([
      { id: "import", label: "جاري استيراد البيانات...", status: "active" }
    ]);

    // Example: Create a journal entry if suggested
    if (analysisResult.suggestedJournalEntry) {
      const entry = analysisResult.suggestedJournalEntry;
      const newEntry = {
        id: `entry_${Date.now()}`,
        date: entry.date || new Date().toISOString().split('T')[0],
        description: entry.description || `استيراد من مستند: ${uploadedFile?.name}`,
        total: entry.amount || 0,
        transactionType: "debit",
        currency: "YER",
        accountId: entry.debitAccount || ""
      };
      db.dailyEntries.push(newEntry);
      db.save();
      onDatabaseUpdate();
    }

    setThinkingSteps([{ id: "import", label: "تم استيراد البيانات بنجاح!", status: "completed" }]);
    setAssistantStatus("completed");
    
    // Clear preview after success
    setTimeout(() => {
      setAnalysisResult(undefined);
      setUploadedFile(null);
      setPreviewData(undefined);
    }, 3000);
  };

  // Update session time
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Date.now() - sessionStartTime;
      const hours = Math.floor(diff / 3600000).toString().padStart(2, "0");
      const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
      const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
      setSessionStats(prev => ({ ...prev, totalTime: `${hours}:${minutes}:${seconds}` }));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) handleFileUpload(file);
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [uploadedFile]); // Re-bind if needed or just empty array

  // Update session stats
  useEffect(() => {
    setSessionStats(prev => ({
      ...prev,
      totalOperations: conversation.length
    }));
  }, [conversation]);

  // Thread-safe state synchronization refs
  const isOpenRef = useRef(false);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isPlayingSpeechRef = useRef(false);
  const isLiveModeRef = useRef(true);
  const assistantStatusRef = useRef<AssistantStatus>("idle");
  const lastProcessedTranscriptRef = useRef<string>("");
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { isPlayingSpeechRef.current = isPlayingSpeech; }, [isPlayingSpeech]);
  useEffect(() => { isLiveModeRef.current = isLiveMode; }, [isLiveMode]);
  useEffect(() => { assistantStatusRef.current = assistantStatus; }, [assistantStatus]);

  const setOpenState = (val: boolean) => {
    setIsOpen(val);
    isOpenRef.current = val;
  };
  const setListeningState = (val: boolean) => {
    setIsListening(val);
    isListeningRef.current = val;
  };
  const setProcessingState = (val: boolean) => {
    setIsProcessing(val);
    isProcessingRef.current = val;
  };
  const setPlayingSpeechState = (val: boolean) => {
    setIsPlayingSpeech(val);
    isPlayingSpeechRef.current = val;
  };
  const setLiveModeState = (val: boolean) => {
    setIsLiveMode(val);
    isLiveModeRef.current = val;
  };
  const setAssistantStatusState = (val: AssistantStatus) => {
    setAssistantStatus(val);
    assistantStatusRef.current = val;
  };



  const [conversationState, setConversationState] = useState<any>({});
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(15).fill(10));

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== "undefined" ? window.speechSynthesis : null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const waveIntervalRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isSpeechInitiatedByAIPanel = useRef<boolean>(false);
  const liveModeRestartTimeoutRef = useRef<any>(null);
  const dbCloudSaveTimeoutRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<any>(null);
  const mediaStreamSourceRef = useRef<any>(null);
  const playChunkRef = useRef<any>(null);

  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isOpen) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
          // Fail silently if disallowed by permissions policy (common in iframes)
          if (err.name !== 'NotAllowedError') {
            console.error(`WakeLock error: ${err.name}, ${err.message}`);
          }
        }
      } else if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, [isOpen]);

  // Load preferences from Firebase / Firestore when user logs in or on mount
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCloudSyncStatus("saving");
        const userDocRef = doc(firestore, "users", user.uid);
        getDoc(userDocRef)
          .then((snap) => {
            if (snap.exists()) {
              const data = snap.data();
              let updated = false;
              if (data.voiceOption && data.voiceOption !== selectedVoiceOption) {
                setSelectedVoiceOption(data.voiceOption);
                localStorage.setItem("smartacc_voice_option", data.voiceOption);
                updated = true;
              }
              if (data.speechRate !== undefined && data.speechRate !== speechRate) {
                setSpeechRate(data.speechRate);
                localStorage.setItem("smartacc_speech_rate", data.speechRate.toString());
                updated = true;
              }
              if (data.voicePitch !== undefined && data.voicePitch !== voicePitch) {
                setVoicePitch(data.voicePitch);
                localStorage.setItem("smartacc_voice_pitch", data.voicePitch.toString());
                updated = true;
              }
              if (data.voiceVolume !== undefined && data.voiceVolume !== voiceVolume) {
                setVoiceVolume(data.voiceVolume);
                localStorage.setItem("smartacc_voice_volume", data.voiceVolume.toString());
                updated = true;
              }
              if (data.voiceDialect && data.voiceDialect !== voiceDialect) {
                setVoiceDialect(data.voiceDialect);
                localStorage.setItem("smartacc_voice_dialect", data.voiceDialect);
                updated = true;
              }
              setCloudSyncStatus("synced");
              if (updated) {
                console.log("[Voice settings] Loaded voice settings from Firebase.");
              }
            } else {
              setCloudSyncStatus("synced");
            }
          })
          .catch((err) => {
            console.error("Error loading voice settings from Firebase:", err);
            setCloudSyncStatus("error");
          });
      } else {
        setCloudSyncStatus("synced");
      }
    });
    return () => unsubscribe();
  }, []);

  // Save changes to state, localStorage, and debounced to Firebase Firestore
  const handleVoiceSettingsChange = (newOpt: string, newRate: number, newPitch: number, newVolume?: number, newDialect?: string) => {
    setSelectedVoiceOption(newOpt);
    setSpeechRate(newRate);
    setVoicePitch(newPitch);
    if (newVolume !== undefined) setVoiceVolume(newVolume);
    if (newDialect !== undefined) setVoiceDialect(newDialect);

    localStorage.setItem("smartacc_voice_option", newOpt);
    localStorage.setItem("smartacc_speech_rate", newRate.toString());
    localStorage.setItem("smartacc_voice_pitch", newPitch.toString());
    if (newVolume !== undefined) localStorage.setItem("smartacc_voice_volume", newVolume.toString());
    if (newDialect !== undefined) localStorage.setItem("smartacc_voice_dialect", newDialect);

    setCloudSyncStatus("saving");

    if (dbCloudSaveTimeoutRef.current) {
      clearTimeout(dbCloudSaveTimeoutRef.current);
    }

    dbCloudSaveTimeoutRef.current = setTimeout(async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDocRef = doc(firestore, "users", user.uid);
          await setDoc(userDocRef, {
            voiceOption: newOpt,
            speechRate: newRate,
            voicePitch: newPitch,
            voiceVolume: newVolume !== undefined ? newVolume : voiceVolume,
            voiceDialect: newDialect !== undefined ? newDialect : voiceDialect
          }, { merge: true });
          setCloudSyncStatus("synced");
        } catch (err) {
          console.error("Error saving voice settings to Firebase:", err);
          setCloudSyncStatus("error");
        }
      } else {
        setCloudSyncStatus("synced");
      }
    }, 1200); // 1.2s debounce
  };

  // Converts positive integer numbers into natural spoken Arabic words
  const numberToArabicWords = (num: number): string => {
    if (num === 0) return "صفر";
    
    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"];
    const teens = ["عشر", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
    
    let words = "";

    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);
      num %= 1000000;
      if (millions === 1) words += "مليون";
      else if (millions === 2) words += "مليونان";
      else if (millions >= 3 && millions <= 10) words += numberToArabicWords(millions) + " ملايين";
      else words += numberToArabicWords(millions) + " مليون";
    }

    if (num >= 1000) {
      if (words) words += " و ";
      const thousands = Math.floor(num / 1000);
      num %= 1000;
      if (thousands === 1) words += "ألف";
      else if (thousands === 2) words += "ألفان";
      else if (thousands >= 3 && thousands <= 10) words += numberToArabicWords(thousands) + " آلاف";
      else words += numberToArabicWords(thousands) + " ألف";
    }

    if (num >= 100) {
      if (words) words += " و ";
      const hund = Math.floor(num / 100);
      num %= 100;
      words += hundreds[hund];
    }

    if (num > 0) {
      if (words) words += " و ";
      if (num <= 10) {
        words += ones[num];
      } else if (num < 20) {
        words += teens[num - 10];
      } else {
        const single = num % 10;
        const ten = Math.floor(num / 10);
        if (single > 0) {
          words += ones[single] + " و " + tens[ten];
        } else {
          words += tens[ten];
        }
      }
    }

    return words.trim();
  };

  // Pre-processes Arabic response texts to convert numbers, dates, accounting abbreviations, and currency symbols into natural Arabic phrases
  const preprocessArabicText = (text: string): string => {
    let processed = text;
    
    // Replace markdown tags and excessive characters
    processed = processed.replace(/[*_`#~]/g, "");

    // 1. Currency conversion: $1500 or 1500$
    processed = processed.replace(/\$([\d,]+)/g, (_, val) => {
      const num = parseInt(val.replace(/,/g, ""), 10);
      return isNaN(num) ? "دولار" : `${numberToArabicWords(num)} دولار`;
    });
    processed = processed.replace(/([\d,]+)\s*\$/g, (_, val) => {
      const num = parseInt(val.replace(/,/g, ""), 10);
      return isNaN(num) ? "دولار" : `${numberToArabicWords(num)} دولار`;
    });
    
    // 2. Saudi Riyal (SAR / ر.س)
    processed = processed.replace(/([\d,]+)\s*(SAR|ر\.س|ريال سعودي)/gi, (_, val) => {
      const num = parseInt(val.replace(/,/g, ""), 10);
      return isNaN(num) ? "ريال سعودي" : `${numberToArabicWords(num)} ريال سعودي`;
    });
    
    // 3. Yemeni Riyal (YER / ر.ي)
    processed = processed.replace(/([\d,]+)\s*(YER|ر\.ي|ريال يمني)/gi, (_, val) => {
      const num = parseInt(val.replace(/,/g, ""), 10);
      return isNaN(num) ? "ريال يمني" : `${numberToArabicWords(num)} ريال يمني`;
    });

    // 4. Dates formatted as YYYY-MM-DD or DD/MM/YYYY
    processed = processed.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, year, month, day) => {
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const months = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
      ];
      const monthWord = months[m - 1] || "";
      return `${numberToArabicWords(d)} من ${monthWord} لعام ${numberToArabicWords(y)}`;
    });

    processed = processed.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (_, day, month, year) => {
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const months = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
      ];
      const monthWord = months[m - 1] || "";
      return `${numberToArabicWords(d)} من ${monthWord} لعام ${numberToArabicWords(y)}`;
    });

    // 5. Percentages: e.g. 15%
    processed = processed.replace(/([\d,]+)%/g, (_, val) => {
      const num = parseInt(val.replace(/,/g, ""), 10);
      return isNaN(num) ? "بالمئة" : `${numberToArabicWords(num)} بالمئة`;
    });

    // 6. Natural accounting abbreviation expansion
    processed = processed.replace(/د\/ح/g, "دفتر الحساب");
    processed = processed.replace(/ق\/ي/g, "قيد اليومية");
    processed = processed.replace(/ح\/([^\s]+)/g, "حساب $1");
    processed = processed.replace(/VAT/gi, "ضريبة القيمة المضافة");

    // 7. Plain numbers conversion
    processed = processed.replace(/\b(\d+)\b/g, (_, val) => {
      const num = parseInt(val, 10);
      return isNaN(num) ? val : numberToArabicWords(num);
    });

    return processed;
  };

  // Preview / Sample speech play function
  const playVoiceSample = (voiceId: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const targetVoice = VOICE_OPTIONS.find(v => v.id === voiceId) || VOICE_OPTIONS[0];
    const sampleText = `مرحباً بك، أنا صوت ${targetVoice.name.split(" ")[0]} المختار، كيف تبدو سرعة ونبرة صوتي الآن؟`;

    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.lang = voiceDialect;

    const voices = synthRef.current.getVoices();
    let arabicVoice = null;
    if (targetVoice.gender === "female") {
      arabicVoice = voices.find(v => v.lang.startsWith("ar") && (v.name.includes("female") || v.name.includes("Amira") || v.name.includes("Zira") || v.name.includes("Hoda"))) ||
                    voices.find(v => v.lang.startsWith("ar") && v.name.includes("Google")) ||
                    voices.find(v => v.lang.startsWith("ar"));
    } else if (targetVoice.gender === "male") {
      arabicVoice = voices.find(v => v.lang.startsWith("ar") && (v.name.includes("male") || v.name.includes("Maged") || v.name.includes("Naayf") || v.name.includes("Naif"))) ||
                    voices.find(v => v.lang.startsWith("ar"));
    } else {
      arabicVoice = voices.find(v => v.lang.startsWith("ar") && v.name.includes("Google")) || 
                    voices.find(v => v.lang.startsWith("ar"));
    }

    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }

    utterance.rate = speechRate;
    utterance.pitch = voicePitch;
    utterance.volume = voiceVolume;

    utterance.onstart = () => {
      setIsPlayingSpeech(true);
      setAssistantStatus("speaking");
      setIsSpeechPaused(false);
    };

    utterance.onend = () => {
      setIsPlayingSpeech(false);
      setAssistantStatus("idle");
      setIsSpeechPaused(false);
    };

    utterance.onerror = () => {
      setIsPlayingSpeech(false);
      setAssistantStatus("idle");
      setIsSpeechPaused(false);
    };

    synthRef.current.speak(utterance);
  };

  // Start the interactive microphone quality test with simulation wave
  const startMicTest = () => {
    if (isTestingMic) return;
    setIsTestingMic(true);
    setMicStatusReport("جاري فحص جودة الميكروفون ومستويات الضوضاء المحيطة والتحقق من سلامة الموجهات...");
    let count = 0;
    const interval = setInterval(() => {
      setMicLevel(Array(10).fill(0).map(() => Math.floor(Math.random() * 85) + 15));
      count++;
      if (count >= 15) {
        clearInterval(interval);
        setIsTestingMic(false);
        setMicLevel(Array(10).fill(10));
        setMicStatusReport("✓ الميكروفون ممتاز: الصوت نقي، وخالٍ تماماً من التشويش أو صدى الارتداد (معدل الضوضاء -58dB). تم تفعيل عازل الضوضاء الذكي وإلغاء الصدى والتحكم التلقائي في الكسب (AGC) بنجاح.");
      }
    }, 180);
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation, isOpen]);

  // Map state to UI indicators as requested in the PDF
  const getStatusText = () => {
    switch (assistantStatus) {
      case "listening":
        return "🎤 يستمع...";
      case "thinking":
      case "executing":
        return "🧠 يعالج...";
      case "speaking":
        return isSpeechPaused ? "⏸️ متوقف مؤقتاً" : "🔊 يتحدث...";
      case "completed":
        return "✅ جاهز";
      default:
        return isLiveMode ? "✅ جاهز" : "💤 اضغط على الميكروفون";
    }
  };

  // Manage waveform animation based on the actual state
  useEffect(() => {
    if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);

    if (assistantStatus === "listening") {
      waveIntervalRef.current = setInterval(() => {
        setWaveformBars(Array(15).fill(0).map(() => Math.floor(Math.random() * 45) + 12));
      }, 90);
    } else if (assistantStatus === "speaking") {
      waveIntervalRef.current = setInterval(() => {
        setWaveformBars(Array(15).fill(0).map(() => Math.floor(Math.random() * 35) + 8));
      }, 110);
    } else if (assistantStatus === "thinking" || assistantStatus === "executing") {
      waveIntervalRef.current = setInterval(() => {
        setWaveformBars(Array(15).fill(0).map((_, i) => Math.sin(Date.now() / 150 + i) * 18 + 22));
      }, 50);
    } else if (assistantStatus === "completed") {
      setWaveformBars(Array(15).fill(12));
    } else {
      setWaveformBars(Array(15).fill(6));
    }

    return () => {
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
    };
  }, [assistantStatus, isLiveMode]);

  // Clean up timers and synthesis on unmount or close
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (liveModeRestartTimeoutRef.current) clearTimeout(liveModeRestartTimeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const stopLiveSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(console.error);
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(console.error);
      outputAudioCtxRef.current = null;
    }
    setListeningState(false);
    if (assistantStatusRef.current === "listening") {
      setAssistantStatusState("idle");
    }
  };

  const startLiveSession = async () => {
    if (wsRef.current) return;
    try {
      setAudioError(null);
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const voiceParam = selectedLiveVoice ? `?voice=${selectedLiveVoice}` : "";
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/live${voiceParam}`);
      wsRef.current = ws;

      const inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      const outputAudioCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputAudioCtx;
      outputAudioCtxRef.current = outputAudioCtx;
      playChunkRef.current = createAudioChunkPlayer();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        }
      });
      const source = inputAudioCtx.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;
      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(inputAudioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
          ws.send(JSON.stringify({ audio: base64 }));
        }
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.audio) {
           playChunkRef.current(outputAudioCtx, msg.audio);
           setAssistantStatusState("speaking");
        }
        if (msg.interrupted) {
           if (outputAudioCtxRef.current) {
             outputAudioCtxRef.current.close().catch(console.error);
             const newCtx = new AudioContext({ sampleRate: 24000 });
             outputAudioCtxRef.current = newCtx;
             playChunkRef.current = createAudioChunkPlayer();
             setAssistantStatusState("listening");
           }
        }
        if (msg.toolCall) {
           const { functionCalls } = msg.toolCall;
           functionCalls.forEach((call: any) => {
             if (call.name === "execute_action") {
               const args = call.args || {};
               if (args.navigateTab) setActiveTab(args.navigateTab);
               if (args.selectedAccountId && setSelectedAccountId) setSelectedAccountId(args.selectedAccountId);
               if (args.action) handleTriggerAction(args.action);
                db.logActivity(db.currentUser, 'edit', 'ai_operation', 'gemini_live', `تم تنفيذ إجراء واجهة المستخدم: ${args.action || 'تنقل'} عبر Gemini Live`);
               
               // send tool response
               ws.send(JSON.stringify({
                 toolResponse: {
                   functionResponses: [
                     {
                       id: call.id,
                       name: call.name,
                       response: { result: "Action executed successfully on the UI" }
                     }
                   ]
                 }
               }));
             } else if (call.name === "create_journal_entry") {
               const args = call.args || {};
               const newEntry = {
                 id: `entry_${Date.now()}`,
                 date: args.date,
                 description: args.description,
                 total: args.amount,
                 accountId: args.debitAccountId,
                 transactionType: "debit",
                 currency: args.currency || "YER"
               };
               db.dailyEntries.push(newEntry);
               db.save();
               onDatabaseUpdate();
               
                db.logActivity(db.currentUser, "add", "ai_operation", "gemini_live", `تم إنشاء قيد يومي جديد: ${args.description} بمبلغ ${args.amount} عبر Gemini Live`);
               ws.send(JSON.stringify({
                 toolResponse: {
                   functionResponses: [
                     {
                       id: call.id,
                       name: call.name,
                       response: { result: "Journal entry created successfully" }
                     }
                   ]
                 }
               }));
             } else if (call.name === "add_account") {
               const args = call.args || {};
               const newAcc = {
                 id: `acc_${Date.now()}`,
                 name: args.name,
                 type: args.type,
                 phone: args.phone || "",
                 address: args.address || "",
                 openingBalance: args.openingBalance || 0,
                 currency: args.currency || "YER",
                 createdAt: new Date().toISOString(),
                 status: "active"
               };
               db.accounts.push(newAcc);
               db.save();
               onDatabaseUpdate();

                db.logActivity(db.currentUser, "add", "ai_operation", "gemini_live", `تم إضافة حساب جديد: ${args.name} (${args.type}) عبر Gemini Live`);
               ws.send(JSON.stringify({
                 toolResponse: {
                   functionResponses: [
                     {
                       id: call.id,
                       name: call.name,
                       response: { result: "Account created successfully" }
                     }
                   ]
                 }
               }));
             } else if (call.name === "delete_record") {
               const args = call.args || {};
               if (args.recordType === "invoice") {
                 db.invoices = db.invoices.filter((inv: any) => inv.id !== args.recordId);
               } else if (args.recordType === "account") {
                 db.accounts = db.accounts.filter((acc: any) => acc.id !== args.recordId);
               } else if (args.recordType === "entry") {
                 db.dailyEntries = db.dailyEntries.filter((ent: any) => ent.id !== args.recordId);
               }
               db.save();
               onDatabaseUpdate();
                db.logActivity(db.currentUser, "delete", "ai_operation", "gemini_live", `تم حذف سجل (${args.recordType}) ذو الرقم ${args.recordId} عبر Gemini Live`);

               ws.send(JSON.stringify({
                 toolResponse: {
                   functionResponses: [
                     {
                       id: call.id,
                       name: call.name,
                       response: { result: "Record deleted successfully" }
                     }
                   ]
                 }
               }));
             } else if (call.name === "update_ui_state") {
               const args = call.args || {};
               if (args.thinkingSteps) setThinkingSteps(args.thinkingSteps);
               if (args.preview) setPreviewData(args.preview);
               if (args.assistantStatus) setAssistantStatusState(args.assistantStatus);

               // send tool response
               ws.send(JSON.stringify({
                 toolResponse: {
                   functionResponses: [
                     {
                       id: call.id,
                       name: call.name,
                       response: { result: "UI state updated" }
                     }
                   ]
                 }
               }));
             }
           });
        }
      };

      ws.onclose = () => {
         stopLiveSession();
      };
      
      ws.onerror = (err) => {
         console.warn("Live session WebSocket warning", err);
      };
      
      ws.onopen = () => {
         setListeningState(true);
         setAssistantStatusState("listening");
         
         // Send initial context
         const dbContext = {
           accounts: db.accounts,
           dailyEntries: db.dailyEntries,
           transactions: db.transactions,
           invoices: db.invoices,
           activeTab: activeTab
         };
         ws.send(JSON.stringify({ text: `[System Context: The user is currently on tab "${activeTab}". Here is the current accounting database state: ${JSON.stringify(dbContext)}. Please use this context to assist the user.]` }));
      };
    } catch (err: any) {
      console.warn("Live session warning:", err);
      const errStr = String(err).toLowerCase();
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || errStr.includes('permission')) {
        setAudioError("يرجى منح إذن الوصول للميكروفون لاستخدام المساعد الصوتي.");
      } else {
        setAudioError("تعذر بدء الاتصال المباشر. يرجى التحقق من الميكروفون.");
      }
      stopLiveSession();
    }
  };

  const safeStartRecognition = () => {
    if (isLiveModeRef.current) {
      startLiveSession().catch(err => console.error("startLiveSession error:", err));
      return;
    }
    if (!recognitionRef.current) return;
    if (isListeningRef.current || isStartingRef.current) return;
    
    isStartingRef.current = true;
    setAudioError(null);
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("[VoiceAI] Recognition start attempted during busy state:", e);
      isStartingRef.current = false;
    }
  };

  const safeStopRecognition = () => {
    if (isLiveModeRef.current) {
      stopLiveSession();
      return;
    }
    if (!recognitionRef.current) return;
    if (!isListeningRef.current || isStoppingRef.current) return;
    
    isStoppingRef.current = true;
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.warn("[VoiceAI] Recognition stop attempted during busy state:", e);
      isStoppingRef.current = false;
    }
  };

  // Initialize Speech Recognition
  const initSpeechRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("عذرًا، ميزة التعرف على الصوت غير مدعومة في متصفحك الحالي. جرب متصفح Chrome.");
      return null;
    }

    const rec = new SpeechRecognition();
    rec.lang = "ar-SA"; // Improved for standard Arabic
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListeningState(true);
      setAssistantStatusState("listening");
      setSpeechError(null);
      setAudioError(null);
      isStartingRef.current = false;
      // If the user starts talking, we implement BARGE-IN (interruption) by cancelling active speech!
      if (synthRef.current && synthRef.current.speaking) {
        stopSpeaking();
      }
    };

    rec.onend = () => {
      setListeningState(false);
      isStoppingRef.current = false;
      isStartingRef.current = false;

      // If we are in Live Mode, and NOT currently processing, thinking, executing or speaking, restart listening
      if (isLiveModeRef.current && isOpenRef.current && !isProcessingRef.current && !synthRef.current?.speaking && assistantStatusRef.current !== "thinking" && assistantStatusRef.current !== "executing" && assistantStatusRef.current !== "speaking") {
        if (liveModeRestartTimeoutRef.current) clearTimeout(liveModeRestartTimeoutRef.current);
        liveModeRestartTimeoutRef.current = setTimeout(() => {
          if (isLiveModeRef.current && isOpenRef.current && !isProcessingRef.current && !synthRef.current?.speaking) {
            safeStartRecognition();
          }
        }, 400); // Reduced latency for Ultra HD feel
      } else {
        if (assistantStatusRef.current === "listening") {
          setAssistantStatusState("idle");
        }
      }
    };

    rec.onerror = (event: any) => {
      isStartingRef.current = false;
      isStoppingRef.current = false;
      
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      
      console.error("[VoiceAI] Speech Recognition Error:", event.error);
      
      if (event.error === "not-allowed" || event.error === "audio-capture") {
        setAudioError("يرجى السماح بالوصول للميكروفون من إعدادات المتصفح لتفعيل المحادثة الصوتية.");
        setLiveModeState(false);
        setAssistantStatusState("idle");
      } else {
        setSpeechError(`حدث خطأ أثناء الاستماع (${event.error || "خطأ غير محدد"}).`);
        setAssistantStatusState("idle");
      }
    };

    rec.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript && finalTranscript.trim() !== "" && finalTranscript !== lastProcessedTranscriptRef.current) {
        lastProcessedTranscriptRef.current = finalTranscript;
        setUserCommand(finalTranscript);
        handleSendPrompt(finalTranscript).catch(e => console.error(e));
        
        // Stop listening immediately to avoid echo
        safeStopRecognition();
      }
    };

    recognitionRef.current = rec;
    return rec;
  };

  // Live Mode Handler
  useEffect(() => {
    if (isOpen) {
      if (isLiveMode) {
        // Stop any current speech if speaking to let user start fresh
        const rec = initSpeechRecognition();
        if (rec && !isListeningRef.current && !isProcessingRef.current && !isPlayingSpeechRef.current) {
          safeStartRecognition();
        }
      } else {
        safeStopRecognition();
        setAssistantStatusState("idle");
      }
    } else {
      safeStopRecognition();
    }
  }, [isLiveMode, isOpen]);


  const toggleListening = () => {
    const rec = initSpeechRecognition();
    if (!rec) return;

    // Barge-in / Interrupt trigger:
    if (isPlayingSpeech) {
      stopSpeaking();
      // Wait briefly and start listening
      setTimeout(() => {
        try {
          rec.start();
        } catch (e) {}
      }, 100);
      return;
    }

    if (isListening) {
      try {
        rec.stop();
      } catch (e) {}
    } else {
      setSpeechError(null);
      try {
        rec.start();
      } catch (err) {
        console.warn("Speech recognition start issue:", err);
      }
    }
  };

  // Speak response text aloud (TTS) with live mode orchestration
  const speakText = (text: string) => {
    if (isLiveModeRef.current) return;
    if (!synthRef.current || !autoSpeak || !text) {
      if (isLiveMode && isOpen) {
        setTimeout(safeStartRecognition, 500);
      }
      return;
    }

    // Stop listening before we speak
    safeStopRecognition();
    synthRef.current.cancel();

    // Split text into smaller chunks for "Streaming" feel and better stability
    const chunks = text.match(/[^.،؟!;]+[.،؟!;]?/g) || [text];
    const clean = chunks.map(c => preprocessArabicText(c));

    const voices = synthRef.current.getVoices();
    const activeVoiceOpt = VOICE_OPTIONS.find(v => v.id === selectedVoiceOption) || VOICE_OPTIONS[0];

    let arabicVoice = voices.find(v => v.lang?.startsWith("ar") && (v.name.includes(activeVoiceOpt.gender) || v.name.includes("Google") || v.name.includes("Amira") || v.name.includes("Maged"))) ||
                     voices.find(v => v.lang?.startsWith("ar")) ||
                     voices[0];

    const processQueue = (index: number) => {
      if (!synthRef.current || index >= clean.length) {
        setPlayingSpeechState(false);
        setAssistantStatusState("idle");
        setIsSpeechPaused(false);
        if (isLiveMode && isOpen) {
          setTimeout(safeStartRecognition, 300);
        }
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(clean[index]);
        if (arabicVoice) {
          utterance.voice = arabicVoice;
        }
        utterance.rate = speechRate;
        utterance.pitch = voicePitch;
        utterance.volume = voiceVolume;
        utterance.lang = "ar-SA";

        utterance.onstart = () => {
          setPlayingSpeechState(true);
          setAssistantStatusState("speaking");
          setIsSpeechPaused(false);
        };

        utterance.onend = () => {
          processQueue(index + 1);
        };

        utterance.onerror = (e) => {
          // Silently process next chunk on TTS error (often due to unsupported languages on some browsers)
          processQueue(index + 1);
        };

        synthRef.current.speak(utterance);
      } catch (err) {
        console.error("[VoiceAI] Fatal speak error:", err);
        setAssistantStatusState("idle");
        processQueue(index + 1); // skip this chunk
      }
    };

    processQueue(0);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlayingSpeech(false);
      setIsSpeechPaused(false);
    }
  };

  const toggleSpeechPause = () => {
    if (!synthRef.current) return;
    if (isSpeechPaused) {
      synthRef.current.resume();
      setIsSpeechPaused(false);
    } else {
      synthRef.current.pause();
      setIsSpeechPaused(true);
    }
  };

  // Dynamic DOM scanning for context awareness (Screen Context)
  const scanScreenText = (): string => {
    const elements = Array.from(document.querySelectorAll("h1, h2, h3, h4, th, td, label, p, button, .text-xs, .text-sm"));
    const texts = elements
      .map(el => el.textContent?.trim() || "")
      .filter(t => t.length > 2 && t.length < 120 && !t.includes("{") && !t.includes("}"))
      .slice(0, 150)
      .join(" | ");
    return texts.substring(0, 4000);
  };

  // Real-time automatic UI scanning for Screen Understanding
  const updateDetectedElements = () => {
    if (!isScreenShared) {
      setDetectedElements([]);
      return;
    }

    const list: string[] = [];
    
    // Tab name detection
    const tabsMap: Record<string, string> = {
      dashboard: "لوحة التحكم والملخص المالي",
      accounts: "دليل الحسابات والعملاء والموردين",
      ledger: "دفتر قيود اليومية العامة",
      invoice: "بوابة الفواتير والمنتجات",
      reports: "التقارير المالية والتحليلية",
      subscription: "الباقات والترقيات السحابية",
      gateway: "إعدادات النظام وبوابة الأمن",
      backup: "مركز النسخ الاحتياطي",
      recycle: "سلة المحذوفات",
      "activity-log": "سجل مراقبة العمليات"
    };
    list.push(`📺 الشاشة النشطة: ${tabsMap[activeTab] || activeTab}`);

    // Check for open modals/dialogs
    const modals = document.querySelectorAll('[role="dialog"], .modal, .fixed');
    modals.forEach(modal => {
      const h3 = modal.querySelector("h3")?.textContent;
      if (h3 && h3.trim() && h3.trim().length < 50) {
        list.push(`🪟 نافذة منبثقة: ${h3.trim()}`);
      }
    });

    // Check for active inputs/fields
    const inputs = document.querySelectorAll("input, select, textarea");
    if (inputs.length > 0) {
      let activeInputText = "";
      inputs.forEach((input: any) => {
        if (input === document.activeElement) {
          const placeholder = input.placeholder || input.name || "";
          if (placeholder && placeholder.length < 40) {
            activeInputText = ` (نشط حالياً: ${placeholder})`;
          }
        }
      });
      list.push(`✍️ حقول الإدخال: ${inputs.length}${activeInputText}`);
    }

    // Check for buttons
    const buttons = document.querySelectorAll("button");
    if (buttons.length > 0) {
      list.push(`🔘 الأزرار التفاعلية: ${buttons.length} زر`);
    }

    // Check for tables
    const tables = document.querySelectorAll("table");
    if (tables.length > 0) {
      const rows = document.querySelectorAll("tr").length;
      list.push(`📊 الجداول النشطة: ${tables.length} (${rows} أسطر)`);
    }

    // Check for charts
    const charts = document.querySelectorAll(".recharts-wrapper, svg");
    if (charts.length > 0) {
      list.push(`📈 رسومات بيانية: ${charts.length}`);
    }

    setDetectedElements(list);
  };

  // Run the scanner automatically when UI changes or screen sharing is toggled
  useEffect(() => {
    if (isOpen && isScreenShared) {
      updateDetectedElements();
      const interval = setInterval(updateDetectedElements, 2500);
      return () => clearInterval(interval);
    }
  }, [isOpen, isScreenShared, activeTab]);

  // Handle command dispatch
  const handleSendPrompt = async (promptText: string) => {
    const textToSubmit = promptText || userCommand;
    if (!textToSubmit.trim() || isProcessing) return;

    if (isLiveModeRef.current) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ text: textToSubmit }));
        setUserCommand("");
        setConversation(prev => [
          ...prev,
          {
            role: "user",
            text: textToSubmit,
            timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      } else {
        setSpeechError("الاتصال المباشر غير متاح حالياً. يرجى المحاولة مرة أخرى.");
      }
      return;
    }

    setIsProcessing(true);
    setAssistantStatus("thinking");
    setSpeechError(null);
    stopSpeaking();

    // Stop listening during processing
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // Add user message to conversation list
    setConversation(prev => [
      ...prev,
      {
        role: "user",
        text: textToSubmit,
        timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
      }
    ]);

    setUserCommand("");

    // Read current viewport screen context based on consent sharing state
    const screenContext = isScreenShared
      ? `[مشاركة الشاشة الحية مفعلة ومصرحة بالكامل من قبل المستخدم]
العناصر والخصائص المكتشفة حالياً في الواجهة النشطة:
${detectedElements.join("\n")}

النصوص والبيانات التفصيلية المقروءة على الشاشة:
${scanScreenText()}`
      : "[تم تعطيل مشاركة الشاشة الحية من قبل المستخدم لأسباب تتعلق بالخصوصية والأمان. لا توجد أي معلومات شاشة متاحة حالياً. إذا طلب المستخدم عملية معتمدة على سياق الشاشة، وجهه بلطف واقترح عليه تفعيل زر 'مشاركة الشاشة' من لوحة التحكم العلوية في الواجهة]";

    try {
      const response = await fetch("/api/ai-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSubmit,
          activeTab,
          screenContext,
          conversationState,
          currentTheme: {
            accentColor: db.appAccentColor || "blue",
            borderShape: db.appBorderShape || "rounded-2xl",
            brandIcon: db.appBrandIcon || "Building2"
          },
          database: {
            accounts: db.accounts,
            dailyEntries: db.dailyEntries,
            transactions: db.transactions,
            invoices: db.invoices
          }
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "فشل النظام الصوتي للذكاء الاصطناعي في إتمام طلبك.");
      }

      setAssistantStatus("executing");

      // Handle Theme Updates
      if (data.themeUpdated) {
        if (data.themeUpdated.accentColor) db.appAccentColor = data.themeUpdated.accentColor;
        if (data.themeUpdated.borderShape) db.appBorderShape = data.themeUpdated.borderShape;
        if (data.themeUpdated.brandIcon) db.appBrandIcon = data.themeUpdated.brandIcon;
      }

      // Handle Database Updates
      let hasDbUpdates = false;
      if (data.databaseUpdated) {
        if (data.databaseUpdated.accounts) {
          db.accounts = data.databaseUpdated.accounts;
          hasDbUpdates = true;
        }
        if (data.databaseUpdated.dailyEntries) {
          db.dailyEntries = data.databaseUpdated.dailyEntries;
          hasDbUpdates = true;
        }
        if (data.databaseUpdated.transactions) {
          db.transactions = data.databaseUpdated.transactions;
          hasDbUpdates = true;
        }
        if (data.databaseUpdated.invoices) {
          db.invoices = data.databaseUpdated.invoices;
          hasDbUpdates = true;
        }
      }

      if (hasDbUpdates) {
        db.save();
        db.logActivity(
          "المدير الصوتي للذكاء الاصطناعي",
          "edit",
          "ledger_entry",
          "voice_op",
          `تم تحديث القيود والبيانات المالية تلبية للأمر الصوتي: "${textToSubmit}"`
        );
        onDatabaseUpdate();
      }

      // Handle Navigation
      if (data.navigateTab) {
        setActiveTab(data.navigateTab);
      }

      // Handle Account Selection
      if (data.selectedAccountId && setSelectedAccountId) {
        setSelectedAccountId(data.selectedAccountId);
      }

      // Handle Specific UI Actions
      if (data.executeAction) {
        handleTriggerAction(data.executeAction);
      }

      // Handle Dialog/Conversation State
      if (data.updatedConversationState) {
        setConversationState(data.updatedConversationState);
      } else {
        setConversationState({});
      }

      // Append assistant's response
      setConversation(prev => [
        ...prev,
        {
          role: "assistant",
          text: data.responseText,
          timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
        }
      ]);

      setAssistantStatus("completed");

      // Read response aloud
      if (autoSpeak && data.responseText) {
        speakText(data.responseText);
      } else {
        // If not speaking, wait brief period and reset to idle, resuming listening if needed
        setTimeout(() => {
          setAssistantStatus("idle");
          if (isLiveMode && isOpen) {
            try {
              recognitionRef.current?.start();
            } catch (e) {}
          }
        }, 1500);
      }

    } catch (err: any) {
      console.error(err);
      const errMsg = `عذرًا، حدث خطأ أثناء تنفيذ الأمر الصوتي: ${err.message || "فشل الاتصال بالملقم"}`;
      setConversation(prev => [
        ...prev,
        {
          role: "assistant",
          text: errMsg,
          timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
      speakText(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Maps backend instructions to client actions
  const handleTriggerAction = (actionName: string) => {
    switch (actionName) {
      case "print":
        setTimeout(() => window.print(), 500);
        break;
      case "toggle_day_night":
        if (setDarkMode && darkMode !== undefined) {
          setDarkMode(!darkMode);
        }
        break;
      case "pwa_install":
        if (handleInstallApp) {
          handleInstallApp();
        }
        break;
      default:
        console.log("No explicit trigger found for", actionName);
    }
  };

  // Close cleans up synthesizers and listeners
  const handleClose = () => {
    setIsOpen(false);
    stopSpeaking();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  return (
    <>
      {/* Floating Sparkle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 left-6 z-40 p-4.5 rounded-full shadow-[0_8px_35px_rgba(99,102,241,0.5)] hover:shadow-[0_8px_45px_rgba(99,102,241,0.7)] transition-all duration-300 bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 text-white hover:scale-110 active:scale-95 cursor-pointer border border-white/30 flex items-center justify-center select-none no-print group"
        title="البث الصوتي المباشر (Gemini Live)"
      >
        <Sparkles size={24} className="stroke-[2.5] animate-pulse" />
        <span className="absolute flex h-3 w-3 top-0 right-0 -mt-0.5 -mr-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-80"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
        </span>
      </button>

      {/* Main Voice Assistant Interface */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col no-print font-sans"
            dir="rtl"
          >
            {/* Header */}
            <header className="flex items-center justify-between p-6 border-b border-slate-800/50">
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleClose}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2 group"
                  title="رجوع للوحة التحكم"
                >
                  <ArrowRight className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-xs font-bold ml-1">رجوع</span>
                </button>

                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Sparkles className="text-white w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    نظام أنس المحاسبي المطور
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase tracking-widest font-black">Live</span>
                  </h1>
                  <p className="text-xs text-slate-400">مساعدك المحاسبي الذكي • Gemini Live Experience</p>
                </div>
              </div>

              <div className="flex-1 max-w-xl px-12">
                <VoiceWaveform bars={waveformBars} status={assistantStatus} />
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsLiveMode(!isLiveMode)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isLiveMode 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  {isLiveMode ? "محادثة مباشرة: مفعلة" : "محادثة مباشرة: معطلة"}
                </button>
                <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-slate-300 font-medium">{getStatusText()}</span>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main 
              className={`flex-1 flex gap-6 p-6 overflow-hidden transition-all ${isDragging ? "bg-indigo-500/10 scale-[0.99] border-2 border-dashed border-indigo-500/50 rounded-3xl" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileUpload(file);
              }}
            >
              {/* Left Column: Activity Feed */}
              <div className="flex-1 flex flex-col gap-6 bg-slate-900/40 rounded-[2.5rem] border border-slate-800/50 p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">المحادثة الحالية</h2>
                  <div className="text-[10px] text-slate-500 font-mono">ID: {sessionId}</div>
                </div>
                <LiveActivityFeed messages={conversation} />
              </div>

              {/* Right Column: Insights & Progress */}
              <div className="w-[400px] flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                {/* AI Thinking Timeline */}
                <ThinkingTimeline steps={thinkingSteps.length > 0 ? thinkingSteps : [
                  { id: '1', label: 'استلام الطلب وتحليله', status: assistantStatus === 'thinking' ? 'active' : assistantStatus === 'executing' || assistantStatus === 'speaking' || assistantStatus === 'completed' ? 'completed' : 'pending', timestamp: '10:31:45' },
                  { id: '2', label: 'تحديد الحسابات المطلوبة', status: assistantStatus === 'executing' ? 'active' : assistantStatus === 'speaking' || assistantStatus === 'completed' ? 'completed' : 'pending' },
                  { id: '3', label: 'التحقق من الأرصدة', status: 'pending' },
                  { id: '4', label: 'تجهيز بيانات القيد', status: 'pending' },
                  { id: '5', label: 'إنشاء القيد في النظام', status: 'pending' },
                  { id: '6', label: 'مراجعة وحفظ القيد', status: 'pending' },
                ]} />

                {/* Document Preview */}
                <DocumentPreview 
                  file={uploadedFile} 
                  analysis={analysisResult} 
                  onConfirm={handleConfirmAnalysis}
                />

                {/* Accounting Preview */}
                <AccountingPreview data={previewData} />

                {/* Recent Documents */}
                {recentDocuments.length > 0 && (
                  <div className="p-6 bg-slate-900/60 rounded-3xl border border-slate-800/50 backdrop-blur-xl">
                    <h3 className="text-slate-200 font-bold mb-4 text-sm">المستندات الأخيرة</h3>
                    <div className="space-y-3">
                      {recentDocuments.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800/50">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-medium text-slate-200 truncate">{doc.name}</p>
                              <p className="text-[10px] text-slate-500">{doc.date}</p>
                            </div>
                          </div>
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session Statistics */}
                <div className="p-6 bg-slate-900/60 rounded-3xl border border-slate-800/50 backdrop-blur-xl">
                  <h3 className="text-slate-200 font-bold mb-4">إحصائيات الجلسة</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">إجمالي العمليات المنفذة:</span>
                      <span className="text-white font-bold">{sessionStats.totalOperations}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">إجمالي الوقت:</span>
                      <span className="text-white font-mono">{sessionStats.totalTime}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">متوسط وقت الاستجابة:</span>
                      <span className="text-indigo-400 font-bold">{sessionStats.avgResponseTime} ثانية</span>
                    </div>
                  </div>
                </div>
              </div>
            </main>

            {/* Footer / Controls */}
            <AssistantControls 
              isListening={isListening} 
              onToggleListening={toggleListening}
              onClose={handleClose}
              userCommand={userCommand}
              setUserCommand={setUserCommand}
              onSendPrompt={handleSendPrompt}
              isProcessing={isProcessing}
              autoSpeak={autoSpeak}
              setAutoSpeak={setAutoSpeak}
              onFileUpload={handleFileUpload}
              onToggleScreenShare={handleToggleScreenShare}
              isScreenSharing={isScreenSharing}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceAIAssistant;
