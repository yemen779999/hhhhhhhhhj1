/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, LiveServerMessage, Modality } from "@google/genai";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import * as XLSX from "xlsx";

dotenv.config();

// Initialize the Google GenAI client with telemetry headers and server-side safety
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing large JSON payloads (necessary for base64 files and images)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const BASE_SYSTEM_INSTRUCTIONS = `
    أنت الآن "مساعد المحاسبة الصوتي الذكي المتكامل" (ANAS Voice AI) والمدير التنفيذي الكامل لنظام ANAS المحاسبي الذكي.
    
    مهمتك هي توفير تجربة شبيهة بـ Gemini Live من Google:
    1. استمع للمستخدم وحلل كلامه بدقة (خاصة الأرقام والعملات بلهجة يمنية وسعودية).
    2. استخدم أداة "update_ui_state" لتحديث "خطوات التفكير" (Thinking Steps) في الوقت الفعلي أثناء معالجة الطلب.
    3. استخدم أداة "update_ui_state" لتحديث "معاينة القيد" (Preview) فور استخراج البيانات من كلام المستخدم.
    4. استخدم أداة "execute_action" للتنقل أو تنفيذ إجراءات عامة.
    5. استخدم "create_journal_entry" و "add_account" للعمليات المحاسبية.
    6. **هام جداً**: اطلب تأكيداً صريحاً من المستخدم قبل حذف أي بيانات أو ترحيل قيود نهائية أو إغلاق فترات محاسبية. لا تستخدم "delete_record" إلا بعد حصولك على "نعم" أو "أكد" من المستخدم.
    7. **الذكاء المستندي**: عندما يقوم المستخدم برفع مستند، سيتم إرسال سياق المستند المحلل إليك كنص نظام. استخدم هذا السياق لمساعدة المستخدم في استيراد البيانات أو الإجابة على استفساراته حول المستند.
    
    كن ودوداً، احترافياً، ومباشراً. لا تكرر الكلمات. ادعم المقاطعة الصوتية. أنت تفهم السياق المحاسبي الكامل (ميزانية، أرباح وخسائر، قيود يومية، إلخ).`;

  // API Route: Check system health
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // API Route: Parse PDF, Image, or Office files using Gemini
  app.post("/api/parse-document", async (req, res) => {
    try {
      const { fileData, mimeType, fileName, accountContext } = req.body;

      if (!fileData) {
        return res.status(400).json({ error: "الرجاء توفير ملف مرمز بـ Base64 للتحليل." });
      }

      // Check if API key is configured
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "معذرة، لم يتم العثور على مفتاح الكود السري GEMINI_API_KEY في بيئة العمل."
        });
      }

      // Clean base64 string
      const cleanBase64 = String(fileData).replace(/^data:[^;]+;base64,/, "").trim();

      // Normalize MIME Type for Gemini compatibility
      let safeMime = String(mimeType || "").toLowerCase().trim();
      if (!safeMime || safeMime === "image/jpg") {
        safeMime = "image/jpeg";
      } else if (safeMime === "application/x-pdf") {
        safeMime = "application/pdf";
      } else if (fileName && String(fileName).toLowerCase().endsWith(".pdf")) {
        safeMime = "application/pdf";
      } else if (fileName && (String(fileName).toLowerCase().endsWith(".png"))) {
        safeMime = "image/png";
      } else if (fileName && (String(fileName).toLowerCase().endsWith(".webp"))) {
        safeMime = "image/webp";
      }

      let accountContextPrompt = "";
      if (accountContext) {
        accountContextPrompt = `
      **سياق الحساب المحاسبي المحدد للمطابقة والمقارنة (Target Account Context):**
      - اسم الحساب المستهدف: "${accountContext.name || ''}"
      - نوع الحساب: ${accountContext.type === 'supplier' ? 'مورد (عادة دائن)' : 'عميل (عادة مدين)'}
      - هاتف الحساب: ${accountContext.phone || 'غير مسجل'}
      - عملة الحساب المعتمدة: ${accountContext.currency || 'YER'}
      - الرصيد الافتتاحي: ${accountContext.openingBalance || 0}
      - آخر 10 حركات مسجلة لهذا الحساب: ${JSON.stringify(accountContext.recentTransactions || [])}
      - قائمة بأسماء الحسابات الأخرى الموجودة في النظام (للاقتراح عند عدم التطابق): ${JSON.stringify(accountContext.allAccounts || [])}

      **تحليل المطابقة الذكي المطلوب (matchAnalysis):**
      1. matchScore (رقم من 0 إلى 100):
         - قارن اسم العميل أو المورد أو الطرف الآخر الوارد في المستند مع اسم الحساب المستهدف "${accountContext.name}".
         - استخدم مطابقة تقريبية وضبابية (Fuzzy Matching): تقبل الاختلافات الطفيفة، مثل البادئات واللواحق ("شركة"، "مؤسسة"، "الشيخ"، "مكتب"، "العميل"، "الأخ"، "للتجارة والاستيراد") أو الأخطاء الإملائية الطفيفة. إذا كان الاسم قريباً أو هو نفس الكيان، امنحه تقييماً عالياً (80 - 100).
         - إذا كان الاسم غير مذكور صراحة لكن الفاتورة تبدو متوافقة مع نوع الحساب وعملته، امنحه تقييماً متوسطاً (50 - 70).
         - إذا كان المستند صراحة لشخص أو جهة أخرى تماماً مختلفة، امنحه تقييماً منخفضاً (0 - 39).
      2. warnings (مصفوفة تحذيرات واضحة بالعربية):
         - قارن اسم الطرف في المستند مع اسم الحساب: إن اختلفا، أضف: "اسم الطرف في الفاتورة (X) يختلف عن اسم الحساب المحدد (Y)".
         - قارن العملة: إن كانت عملة المستند غير عملة الحساب (${accountContext.currency})، أضف: "عملة الفاتورة (X) لا تطابق عملة الحساب (${accountContext.currency})".
         - قارن المبالغ: إذا كان إجمالي الفاتورة أو القيد أكبر بأضعاف من متوسط حركات هذا الحساب السابقة، أضف تحذيراً: "المبلغ (X) أكبر بشكل غير معتاد عن متوسط حركات هذا الحساب".
         - قارن التواريخ: إن كان تاريخ الفاتورة قديماً جداً أو يسبق الحركات الأولى، نبه على ذلك.
      3. isConsistent (boolean):
         - true إذا كان المستند ملائماً لهذا الحساب بشكل عام أو التطابق مقبول (matchScore >= 40) ولا يوجد تناقض جذري يثبت أنه لجهة غريبة.
         - false إذا كان هناك تناقض صريح وتأكدت أنه لشخص أو شركة أخرى تماماً مختلفة أو مستند غير محاسبي.
      4. suggestedAlternativeAccount (string | null):
         - إذا كان matchScore منخفضاً (أقل من 50) وكان اسم الطرف في المستند قريباً جداً من اسم حساب آخر من قائمة الحسابات الأخرى المرفقة، ضع اسم ذلك الحساب هنا، وإلا ضع null.
      `;
      }

      const prompt = `
      أنت "خبير استخبارات المستندات المحاسبية" (Enterprise Accounting AI Vision Expert).
      مهمتك هي تحليل المستند المرفق (فاتورة، كشف حساب، سند، عقد، إلخ) واستخراج البيانات المحاسبية بدقة متناهية.

      ${accountContextPrompt}

      استخرج البيانات التالية إن وجدت:
      - نوع المستند (Document Type).
      - اسم الشركة، العميل، المورد (Company, Customer, Supplier Name).
      - أرقام مرجعية (Invoice, Journal, Transaction, Tax Numbers).
      - التواريخ (Issue Date, Due Date).
      - المبالغ (Subtotal, Tax Amount, Grand Total).
      - بيانات البنك (Bank Name, IBAN, Account Numbers).
      - العملة واللغة (Currency, Language).
      - تفاصيل البنود (Line Items).

      **قاعدة بيانات استخراج القيود اليومية (Ledger Entries):**
      قم بمحاولة استخراج الجدول الأساسي للعمليات المالية (القيود) إذا وجد، مع تحديد:
      - التاريخ (Date بصيغة YYYY-MM-DD حصراً)
      - البيان (Description)
      - الكمية (Quantity) - إذا لم توجد افترض 1
      - سعر الوحدة (Unit Price)
      - الزيادات إن وجدت (extraCharges) - افتراضياً 0
      - إجمالي البند (Total)
      - نوع القيد إن أمكن (type: 'debit' أو 'credit')

      قم بإرجاع النتيجة بصيغة JSON مطابقة للمخطط التالي:
      {
        "documentType": "string",
        "language": "string",
        "confidenceScore": number,
        "extractedData": {
          "companyName": "string",
          "customerName": "string",
          "supplierName": "string",
          "invoiceNumber": "string",
          "referenceNumber": "string",
          "journalNumber": "string",
          "taxNumber": "string",
          "issueDate": "string",
          "dueDate": "string",
          "currency": "string",
          "subtotal": number,
          "taxAmount": number,
          "grandTotal": number,
          "bankInfo": { "bankName": "string", "iban": "string", "accountNumber": "string" },
          "items": [
            { "description": "string", "quantity": number, "unitPrice": number, "total": number }
          ],
          "ledgerEntries": [
            { "date": "string", "description": "string", "quantity": number, "unitPrice": number, "extraCharges": number, "total": number, "type": "debit" }
          ]
        },
        "accountingIntelligence": {
          "suggestedDebitAccount": "string",
          "suggestedCreditAccount": "string",
          "suggestedTransactionType": "string",
          "validationWarnings": ["string"]
        },
        "matchAnalysis": {
          "matchScore": number,
          "isConsistent": boolean,
          "warnings": ["string"],
          "suggestedAlternativeAccount": "string or null"
        }
      }

      اللغة المستهدفة هي العربية. كن دقيقاً جداً في الأرقام، وتأكد من أن النتيجة هي كائن JSON صالح فقط بدون أي وسوم markdown إضافية.`;

      // Check if file is spreadsheet (Excel/CSV)
      const isSpreadsheet = safeMime.includes("sheet") || 
        safeMime.includes("excel") || 
        safeMime.includes("csv") || 
        (fileName && (fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls") || fileName.toLowerCase().endsWith(".csv")));

      const contents: any[] = [];

      if (isSpreadsheet) {
        try {
          const buffer = Buffer.from(cleanBase64, "base64");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheetTexts: string[] = [];
          for (const sName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            sheetTexts.push(`--- صفحة Excel: ${sName} ---\n${csv}`);
          }
          contents.push({
            text: `محتويات ملف Excel/جدول البيانات:\n\n${sheetTexts.join("\n\n")}\n\n${prompt}`
          });
        } catch (excelErr: any) {
          console.warn("Failed to parse Excel buffer in server, fallback to prompt:", excelErr);
          contents.push({ text: prompt });
        }
      } else {
        // PDF or Image
        contents.push({
          inlineData: {
            data: cleanBase64,
            mimeType: safeMime,
          },
        });
        contents.push({
          text: prompt,
        });
      }

      let response: any;
      const modelsToTry = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
      let lastErr: any;
      for (const m of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents,
            config: {
              responseMimeType: "application/json",
            }
          });
          if (response) break; // Success
        } catch (err: any) {
          console.warn(`Model ${m} failed in /api/parse-document:`, err?.message || err);
          lastErr = err;
        }
      }

      if (!response) {
        throw new Error("فشلت جميع نماذج الذكاء الاصطناعي في تحليل المستند: " + (lastErr?.message || ""));
      }

      let jsonText = (response.text || "").trim();
      if (!jsonText) {
        throw new Error("لم يتم استلام نص من نموذج الذكاء الاصطناعي.");
      }

      // Remove markdown code blocks if wrapped in ```json ... ```
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      }

      // Ensure we extract the outer JSON object cleanly
      const firstBrace = jsonText.indexOf("{");
      const lastBrace = jsonText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
      }

      let parsedData: any;
      try {
        parsedData = JSON.parse(jsonText);
      } catch (jsonErr) {
        console.error("JSON parsing error, attempting repair on:", jsonText.substring(0, 200));
        // Remove trailing commas before closing braces or brackets
        const sanitized = jsonText
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, " "); // Strip unescaped control chars
        try {
          parsedData = JSON.parse(sanitized);
        } catch (secondErr) {
          console.error("Second parse attempt failed, building fallback:", secondErr);
          parsedData = {
            documentType: "مستند محاسبي مستورد",
            confidenceScore: 0.85,
            extractedData: {
              customerName: accountContext?.name || "حساب من المستند",
              currency: accountContext?.currency || "YER",
              totalAmount: 0,
              items: [],
              ledgerEntries: []
            },
            matchAnalysis: {
              matchScore: 70,
              isConsistent: true,
              warnings: ["تعذر التحليل التفصيلي لبعض الحقول المعقدة، يرجى مراجعة وتعديل جدول القيود يدوياً."]
            }
          };
        }
      }

      res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Gemini Parsing error:", error);
      res.status(500).json({ error: error.message || "حدث خطأ أثناء تحليل المستند." });
    }
  });

  // API Route: AI Manager Command Prompt (Executive theme, database & voice controller)
  app.post("/api/ai-control", async (req, res) => {
    try {
      const { prompt, currentTheme, database, activeTab, screenContext, conversationState } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "الرجاء توفير أمر صحيح ومفهوم للمدير الذكي." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "معذرة، لم يتم العثور على مفتاح الكود السري GEMINI_API_KEY في الإعدادات."
        });
      }

      const systemPrompt = `
      أنت الآن "مساعد المحاسبة الصوتي الذكي المتكامل" (ANAS Voice AI) وخبير الذكاء الاصطناعي للمستندات (AI Document Intelligence).
      أنت مهندس أنظمة ذكاء اصطناعي، خبير OCR ورؤية حاسوبية، ومعماري أنظمة محاسبية محترف.
      تم تصميمك لتجربة شبيهة بـ Gemini Live من Google، حيث تفهم الصوت وسياق الشاشة، وتنفذ الأوامر فوراً وتفهم المستندات المحاسبية بعمق.

      مهمتك الأساسية هي:
      1. تحليل وفهم وتصنيف المستندات المحاسبية (فواتير، كشوفات، عقود) بدقة محاسبية 100%.
      2. اقتراح القيود المحاسبية (مدين/دائن) بناءً على المستندات المرفوعة.
      3. إدارة النظام الصوتي والتفاعل مع سياق الشاشة الحالي.
      
      يجب أن تتصرف كمحاسب محترف تماماً:
      - عند استلام صورة فاتورة، استخرج (التاريخ، المبلغ، المورد، البنود).
      - قدم نصائح محاسبية ومالية ذكية.
      - سجل جميع العمليات التي تنفذها لضمان الشفافية.

      البيئة الحالية للتطبيق:
      1. الصفحة أو التبويب النشط حالياً (activeTab): "${activeTab || "dashboard"}"
         التبويبات المتاحة هي:
         - "dashboard" (لوحة التحكم الرئيسية)
         - "accounts" (كشوف الحسابات والعملاء والموردين)
         - "ledger" (دفتر قيود الـ 30 يوماً والطباعة)
         - "invoice" (إنشاء الفواتير والمنتجات)
         - "reports" (التقارير المالية والتحليلية)
         - "subscription" (الاشتراكات والترقية)
         - "gateway" (الإعدادات وبوابة النظام)
         - "backup" (النسخ الاحتياطي السحابي)
         - "recycle" (سلة المحذوفات)
         - "activity-log" (سجل العمليات)

      2. سياق الشاشة الفعلي وعناصرها المرئية حالياً (screenContext):
         "${screenContext || "لا يوجد عناصر مرئية محددة حالياً"}"

      3. معلومات المظهر الحالية للتطبيق:
         اللون المميز (accentColor): "${currentTheme?.accentColor || "blue"}"
         شكل الحواف (borderShape): "${currentTheme?.borderShape || "rounded-2xl"}"
         أيقونة العلامة (brandIcon): "${currentTheme?.brandIcon || "Building2"}"

      4. حالة الحوار المستمر والتدفقات النشطة (conversationState):
         ${JSON.stringify(conversationState || {})}

      مهمتك وسيناريوهات المعالجة الإلزامية:
      - أولاً: الإدخال الصوتي للقيود اليومية:
        إذا قال المستخدم "سجل قيد يومية" أو قيداً صريحاً مثل "من حساب الصندوق إلى حساب المبيعات بمبلغ خمسين ألف ريال بتاريخ اليوم، البيان: بيع نقدي"، قم باستخراج:
        - الحساب المدين (مثال: "الصندوق") والحساب الدائن (مثال: "المبيعات").
        - المبلغ (مثال: 50000).
        - البيان (البيان: "بيع نقدي" أو ما يماثله).
        - التاريخ (صيغة YYYY-MM-DD، اليوم هو ${new Date().toISOString().split('T')[0]}).
        قم بإنشاء وتحديث مصفوفة dailyEntries أو transactions المقترحة في database. واعرض القيد للمراجعة.
        إذا لم تكن الحسابات موجودة في مصفوفة الحسابات المرفقة، اقترح إنشائها أو اربطها بأقرب حساب موجود.

      - ثانياً: إنشاء الحسابات بالصوت:
        إذا قال "أنشئ حساب جديد باسم مصروف الكهرباء ضمن المصروفات" أو "أضف حساب البنك الأهلي ضمن الأصول"، قم بإضافة عنصر جديد في مصفوفة accounts بمعرف فريد يبدأ بـ 'acc_' ونوع حساب ملائم ('supplier' للموردين والمصروفات، 'buyer' للعملاء والأصول).

      - ثالثاً: إدارة العملاء والموردين:
        عند قول "أضف عميل جديد اسمه أحمد محمد" أو "أضف مورد جديد اسمه مؤسسة الخليج":
        تحقق مما إذا كان رقم الهاتف والعنوان والرصيد الافتتاحي متوفرين في الأمر.
        إذا لم تكن متوفرة، لا تنشئ الحساب مباشرة؛ بدلاً من ذلك، ادخل في حوار تفاعلي (Flow) واطلبهم صراحة: "أهلاً بك، ما هو رقم الهاتف، العنوان، والرصيد الافتتاحي للعميل أحمد محمد؟"، وقم بحفظ حالة التدفق في updatedConversationState كـ { "activeFlow": "add_customer", "customerDraft": { "name": "أحمد محمد", "type": "buyer" } }.
        عند تزويدك بالمعلومات في الدور التالي، قم بإنشائه فوراً!

      - رابعاً: تسجيل الديون بالصوت:
        مثال: "سجل دين على العميل أحمد محمد بقيمة مائة ألف ريال يستحق بعد شهر".
        ابحث عن العميل "أحمد محمد" أو "أحمد" في مصفوفة الحسابات، ثم أضف له قيداً مديناً (transactionType: 'debit') بالمبلغ والتاريخ المحدد.

      - خامساً: تسجيل القبض والدفع:
        "العميل أحمد سدد عشرين ألف ريال نقداً" -> قم بإنشاء سند قبض (قيد دائن للحساب 'credit' بقيمة 20000).
        "ادفع للمورد مؤسسة الخليج خمسة وثلاثين ألف ريال من البنك" -> قم بإنشاء سند صرف للمورد (قيد مدين 'debit' بقيمة 35000).

      - سادساً: البحث بالصوت:
        "ابحث عن فاتورة العميل أحمد" -> أرجع navigateTab: "invoice" وصدر نص رد يشير إلى فتح صفحة الفواتير وعرض نتائج البحث لـ "أحمد".
        "افتح حساب البنك" -> أرجع navigateTab: "accounts" مع selectedAccountId المطابق لحساب البنك.

      - سابعاً: إنشاء الفواتير بالصوت (حوار مستمر ومتعدد الخطوات):
        1. إذا قال "أنشئ فاتورة مبيعات للعميل أحمد":
           ابحث عن حساب "أحمد". ثم ابدأ التدفق بوضع updatedConversationState كـ:
           { "activeFlow": "create_invoice", "invoiceDraft": { "customerName": "أحمد", "accountId": "acc_3", "items": [], "type": "sale" } }
           واسأله صراحة: "تم بدء فاتورة مبيعات للعميل أحمد. ماذا تريد أن تضيف كمنتج أول وسعر وكمية؟"
        2. إذا قال "أضف المنتج شاشة كمية 3 سعر 200":
           أضف العنصر إلى مسودة الفاتورة في updatedConversationState.
           واسأله: "تم إضافة شاشة (الكمية 3، السعر 200 ريال). هل تريد إضافة منتج آخر أم تود حفظ الفاتورة الآن؟"
        3. إذا قال "أضف المنتج طابعة كمية 2":
           أضف المنتج الآخر واسأله عن السعر أو احسبه وتابعه.
        4. إذا قال "احفظ الفاتورة":
           قم بنقل مسودة الفاتورة لإنشاء عنصر حقيقي في مصفوفة invoices بـ ID فريد 'inv_' وإرجاعها في databaseUpdated.invoices مع تصفير الـ conversationState.

      - ثامناً: التحكم الكامل بالصوت:
        ادعم التنقل الفوري: "افتح صفحة العملاء" -> navigateTab: "accounts"، "افتح التقارير" -> navigateTab: "reports"، "ارجع" -> navigateTab: "dashboard"، "أغلق النافذة"، "اطبع"، "صدر PDF"، "صدر Excel" -> أرجع executeAction المناسب!

      - تاسعاً: فهم الشاشة الحالية (Screen Context):
        إذا كان المستخدم في صفحة كشوف الحسابات (activeTab: "accounts") وكان سياق الشاشة يعرض العميل "أحمد عبد الله"، وقال المستخدم "عدل رقم هاتف هذا العميل":
        افهم فوراً من screenContext من هو العميل واطلب تعديله أو قم بتعديله مباشرة إلى صيغة دولية يمنية +967 إن ذكر أرقاماً.

      - عاشراً: التأكيد قبل العمليات الحساسة (إلزامي):
        للعمليات الحساسة مثل: "حذف حساب"، "حذف فاتورة"، "حذف عميل"، "ترحيل القيود"، "إغلاق السنة المالية".
        يجب عليك أولاً طلب تأكيد صوتي صريح. لا تقم بالعملية مباشرة!
        أرجع: requiresConfirmation: true مع حفظ العملية المعلقة في updatedConversationState كـ { "pendingAction": { "action": "delete_account", "id": "acc_x" } }.
        وقل في responseText: "إن هذه عملية حساسة جداً قد تؤدي لفقدان البيانات. هل أنت متأكد تماماً من [حذف الحساب]؟ يرجى قول 'نعم متأكد' أو 'تأكيد الاستمرار' للتنفيذ."
        إذا قال في الدور التالي "نعم متأكد" أو "تأكيد"، قم بتنفيذ العملية المعلقة فوراً في قاعدة البيانات وسجلها في سجل النشاطات!

      يجب أن تكون الاستجابة بصيغة JSON مطابقة تماماً للمخطط التالي وبدون أي لغويات أو علامات markdown إضافية خارج الـ JSON:
      {
        "responseText": "رد صوتي ونصوص باللغة العربية بلهجة يمنية لطيفة ومحترمة تليق بـ Gemini Live، تشرح بدقة الإجراء الذي تم اتخاذه أو تطرح الأسئلة اللازمة لإكمال الحوار.",
        "themeUpdated": {
          "accentColor": "emerald", // اختياري
          "borderShape": "rounded-3xl", // اختياري
          "brandIcon": "Gem" // اختياري
        },
        "databaseUpdated": {
          "accounts": [], // اختياري: المصفوفة كاملة بعد التعديل أو الإضافة
          "dailyEntries": [], // اختياري: المصفوفة كاملة بعد التعديل أو الإضافة
          "transactions": [], // اختياري: مصفوفة القيود الفرعية كاملة بعد التعديل أو الإضافة
          "invoices": [] // اختياري: مصفوفة الفواتير كاملة بعد التعديل أو الإضافة
        },
        "navigateTab": "accounts", // اختياري: التبويب المراد الانتقال إليه فورياً
        "selectedAccountId": "acc_3", // اختياري: لتحديد الحساب المفتوح
        "executeAction": "print", // اختياري: "print" | "export_pdf" | "export_excel" | "toggle_day_night" | "pwa_install"
        "requiresConfirmation": false, // اجعلها true للعمليات الحساسة لطلب تأكيد المستخدم قبل التنفيذ
        "updatedConversationState": {} // لتتبع الحوار المستمر في الدور القادم
      }

      البيانات الحالية للتحليل والتعديل:
      الحسابات الحالية (Accounts): ${JSON.stringify(database?.accounts || [])}
      القيود اليومية (Daily Ledger Entries): ${JSON.stringify(database?.dailyEntries || [])}
      القيود التفصيلية للحسابات (Transactions): ${JSON.stringify(database?.transactions || [])}
      الفواتير الحالية (Invoices): ${JSON.stringify(database?.invoices || [])}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: {
          role: "user",
          parts: [{ text: prompt + "\n\n" + systemPrompt }]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              responseText: { type: Type.STRING },
              themeUpdated: {
                type: Type.OBJECT,
                properties: {
                  accentColor: { type: Type.STRING },
                  borderShape: { type: Type.STRING },
                  brandIcon: { type: Type.STRING }
                }
              },
              databaseUpdated: {
                type: Type.OBJECT,
                properties: {
                  accounts: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                        phone: { type: Type.STRING },
                        address: { type: Type.STRING },
                        openingBalance: { type: Type.NUMBER },
                        type: { type: Type.STRING },
                        createdAt: { type: Type.STRING },
                        currency: { type: Type.STRING },
                        status: { type: Type.STRING }
                      },
                      required: ["id", "name"]
                    }
                  },
                  dailyEntries: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        dayNumber: { type: Type.NUMBER },
                        date: { type: Type.STRING },
                        description: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        unitPrice: { type: Type.NUMBER },
                        extraCharges: { type: Type.NUMBER },
                        total: { type: Type.NUMBER },
                        accountId: { type: Type.STRING },
                        accountType: { type: Type.STRING },
                        transactionType: { type: Type.STRING },
                        currency: { type: Type.STRING }
                      },
                      required: ["id", "description"]
                    }
                  },
                  transactions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        accountId: { type: Type.STRING },
                        date: { type: Type.STRING },
                        description: { type: Type.STRING },
                        type: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        quantity: { type: Type.NUMBER },
                        unitPrice: { type: Type.NUMBER },
                        extraCharges: { type: Type.NUMBER },
                        dayNumber: { type: Type.NUMBER },
                        sourceEntryId: { type: Type.STRING },
                        currency: { type: Type.STRING }
                      },
                      required: ["id", "accountId", "date", "description", "type", "amount"]
                    }
                  },
                  invoices: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        invoiceNumber: { type: Type.STRING },
                        date: { type: Type.STRING },
                        accountId: { type: Type.STRING },
                        notes: { type: Type.STRING },
                        total: { type: Type.NUMBER },
                        currency: { type: Type.STRING },
                        type: { type: Type.STRING },
                        items: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              description: { type: Type.STRING },
                              quantity: { type: Type.NUMBER },
                              unitPrice: { type: Type.NUMBER }
                            },
                            required: ["id", "description", "quantity", "unitPrice"]
                          }
                        }
                      },
                      required: ["id", "invoiceNumber", "date", "accountId", "total", "currency", "items"]
                    }
                  }
                }
              },
              navigateTab: { type: Type.STRING },
              selectedAccountId: { type: Type.STRING },
              executeAction: { type: Type.STRING },
              requiresConfirmation: { type: Type.BOOLEAN },
              updatedConversationState: { type: Type.OBJECT }
            },
            required: ["responseText"]
          }
        }
      });

      const parsedResponse = JSON.parse(response.text?.trim() || "{}");
      res.json({ success: true, ...parsedResponse });
    } catch (error: any) {
      console.error("AI Executive control error:", error);
      res.status(500).json({ error: error.message || "فشل ملقم المدير التنفيذي للذكاء الاصطناعي في الاستجابة." });
    }
  });


  // API Route: AI Account Analysis
  app.post("/api/analyze-account", async (req, res) => {
    try {
      const { account, transactions } = req.body;

      if (!account || !transactions) {
        return res.status(400).json({ error: "بيانات الحساب والحركات مطلوبة." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "API Key missing." });
      }

      const prompt = `
      قم بتحليل البيانات المالية للحساب التالي:
      اسم الحساب: ${account.name}
      النوع: ${account.type}
      الرصيد الافتتاحي: ${account.openingBalance}
      
      سجل الحركات:
      ${JSON.stringify(transactions)}

      المطلوب:
      1. تحليل نمط الدفع الخاص بهذا العميل (هل يسدد بانتظام؟ هل يتأخر؟ هل الدفعات عشوائية؟).
      2. توقع احتمالية سداد الديون المستقبلية.
      3. قدم نصيحة مختصرة للمحاسب للتعامل مع هذا العميل (هل يستحق تسهيلات؟ هل يجب تقليصها؟).

      كن مختصراً ومباشراً باللغة العربية.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: { role: "user", parts: [{ text: prompt }] },
      });

      res.json({ success: true, analysis: response.text });
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء التحليل." });
    }
  });

  // Vite Middleware configuration for development, with fallback to static production assets
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode with static direct paths...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`ANAS Accounting sync-enabled server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("connection", async (clientWs, req) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const voiceName = url.searchParams.get("voice") || "Aoede";

      if (!process.env.GEMINI_API_KEY) {
        clientWs.send(JSON.stringify({ error: "API Key missing" }));
        clientWs.close();
        return;
      }
      
      let session: any;
      try {
        session = await ai.live.connect({
          model: "gemini-3.1-flash-live-preview",
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              try {
                const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audio) {
                  clientWs.send(JSON.stringify({ audio }));
                }
                if (message.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ interrupted: true }));
                }
                const toolCall = message.toolCall;
                if (toolCall) {
                  clientWs.send(JSON.stringify({ toolCall }));
                }
              } catch (e) {
                console.error("Error processing live message", e);
              }
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            },
            systemInstruction: {
              parts: [{ text: BASE_SYSTEM_INSTRUCTIONS }]
            },
            tools: [{
              functionDeclarations: [
                {
                  name: "execute_action",
                  description: "Execute a UI action like navigating to a tab or opening a record.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      navigateTab: { type: Type.STRING, description: "Tab to navigate to (dashboard, accounts, ledger, invoice, reports)" },
                      selectedAccountId: { type: Type.STRING, description: "ID of the account to select or open" },
                      action: { type: Type.STRING, description: "Generic action name (print, export_pdf, export_excel)" }
                    }
                  }
                },
                {
                  name: "create_journal_entry",
                  description: "Create a new journal entry in the ledger.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      date: { type: Type.STRING, description: "Date of the entry (YYYY-MM-DD)" },
                      description: { type: Type.STRING, description: "Description of the entry" },
                      amount: { type: Type.NUMBER },
                      debitAccountId: { type: Type.STRING },
                      creditAccountId: { type: Type.STRING },
                      currency: { type: Type.STRING }
                    },
                    required: ["date", "description", "amount", "debitAccountId", "creditAccountId"]
                  }
                },
                {
                  name: "add_account",
                  description: "Add a new account, customer, or supplier.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      type: { type: Type.STRING, enum: ["supplier", "buyer", "other"] },
                      phone: { type: Type.STRING },
                      address: { type: Type.STRING },
                      openingBalance: { type: Type.NUMBER },
                      currency: { type: Type.STRING }
                    },
                    required: ["name", "type"]
                  }
                },
                {
                  name: "delete_record",
                  description: "Delete a record (invoice, account, journal entry). ALWAYS requires user confirmation.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      recordType: { type: Type.STRING, enum: ["invoice", "account", "entry"] },
                      recordId: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ["recordType", "recordId"]
                  }
                },
                {
                  name: "update_ui_state",
                  description: "Update the live thinking steps and accounting preview in the UI.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      thinkingSteps: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            label: { type: Type.STRING },
                            status: { type: Type.STRING, enum: ["pending", "active", "completed"] }
                          }
                        }
                      },
                      preview: {
                        type: Type.OBJECT,
                        properties: {
                          debitAccount: { type: Type.STRING },
                          creditAccount: { type: Type.STRING },
                          amount: { type: Type.NUMBER },
                          description: { type: Type.STRING },
                          date: { type: Type.STRING },
                          validationStatus: { type: Type.STRING, enum: ["validating", "valid", "invalid"] },
                          warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                      },
                      assistantStatus: { type: Type.STRING, enum: ["idle", "listening", "thinking", "executing", "speaking", "completed"] }
                    }
                  }
                }
              ]
            }],
          },
        });
        console.log("Connected to Gemini Live session");
      } catch (err) {
        console.error("Failed to connect to Gemini Live session:", err);
        clientWs.send(JSON.stringify({ error: "Failed to connect to AI service" }));
        clientWs.close();
        return;
      }

      // The session connection doesn't emit close events like websockets do, we manage it via the client's close event.

      clientWs.on("message", (data) => {
        try {
          const { audio, text, setup, toolResponse } = JSON.parse(data.toString());
          if (audio) {
            session.sendRealtimeInput({
              audio: { data: audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (text) {
            session.sendClientContent({
              turns: [{ role: "user", parts: [{ text }] }],
              turnComplete: true,
            });
          }
          if (toolResponse) {
            session.sendToolResponse(toolResponse);
          }
        } catch (err) {
          console.error("Error parsing client ws message", err);
        }
      });

      clientWs.on("close", () => {
        session.close();
      });

    } catch (err) {
      console.error("Failed to setup Live API websocket", err);
      clientWs.send(JSON.stringify({ error: "Live API failed to connect" }));
      clientWs.close();
    }
  });
}

startServer().catch(err => {
  console.error("Fatal error during server startup:", err);
});
