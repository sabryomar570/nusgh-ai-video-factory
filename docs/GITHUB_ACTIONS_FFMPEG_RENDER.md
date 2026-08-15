# NUSGH — GitHub Actions + FFmpeg Render

## الغرض

ينفذ هذا المسار رندرًا فعليًا لفيديو Short عمودي باسم **`FINAL_VIDEO.mp4`** من المشاهد المعتمدة، والتعليق الصوتي العربي الحقيقي، وملف ترجمة SRT. لا يستعمل أي موسيقى، ولا يستخدم GitHub Artifacts لتخزين الفيديو. بعد نجاح التحقق، يعيد الـWorkflow ملف MP4 إلى NUSGH عبر callback موثّق؛ يخزنه النظام في التخزين المدمج ثم يرسله إلى Telegram ويجعل الحالة `WAITING_FOR_OWNER`.

> لا يوجد رفع أو نشر إلى YouTube في هذا المسار. زر «أعجبني» يغيّر قرار المراجعة فقط ولا ينشر شيئًا.

## معمارية التدفق

```text
NUSGH render job
  → GitHub workflow_dispatch
  → GET authenticated manifest from NUSGH
  → FFmpeg creates FINAL_VIDEO.mp4
  → ffprobe + decode validation
  → HMAC + SHA-256 protected callback
  → NUSGH storage
  → Telegram sendVideo
  → WAITING_FOR_OWNER
```

كل مرحلة تتوقف قبل التسليم إذا لم تتوافر المشاهد المعتمدة أو التعليق الصوتي أو SRT أو إذا وُجدت موسيقى أو أعلام سلامة أو إذا لم ينتج FFmpeg ملف MP4 قابلًا للفحص.

## الملفات الرئيسية

| الملف | المسؤولية |
|---|---|
| `.github/workflows/nusgh-render.yml` | Workflow يدوي الاستدعاء يثبت FFmpeg وخطوط Noto، ويرندر ويعيد الملف فورًا. |
| `scripts/render-final-video.mjs` | تنزيل المدخلات الموثقة، تركيب المشاهد والصوت والترجمات، والتحقق من 1080×1920 والصوت وقابلية decode. |
| `server/nusgh/github-render.ts` | إرسال `workflow_dispatch`، بناء Manifest، التحقق من HMAC وSHA-256، التخزين، وتسجيل حالة الرندر. |
| `server/_core/index.ts` | تسجيل مساري manifest وcallback الخادميين. |
| `server/nusgh/telegram.ts` | تسليم الفيديو النهائي لمالك Telegram مع زري «أعجبني» و«إعادة توليد». |

## الأسرار ومتغيرات البيئة

لا تضع أي قيمة في Git أو Workflow YAML أو الرسائل. المتغيرات المطلوبة هي:

| الاسم | المكان | الغرض |
|---|---|---|
| `NUSGH_GITHUB_RENDER_TOKEN` | أسرار NUSGH فقط | Fine-grained PAT للمستودع `sabryomar570/nusgh-ai-video-factory` مع **Actions: Read and write** فقط، لإطلاق الـWorkflow. |
| `NUSGH_RENDER_CALLBACK_SECRET` | أسرار NUSGH **و** GitHub Actions repository secret | سر HMAC عشوائي واحد مشترك للتحقق من manifest وcallback. |
| `TELEGRAM_BOT_TOKEN` | أسرار NUSGH الحالية | إرسال `FINAL_VIDEO.mp4` إلى Telegram. |
| `TELEGRAM_OWNER_USER_ID` | أسرار NUSGH الحالية | استقبال مالك Telegram للفيديو. |
| `ELEVENLABS_API_KEY` | أسرار NUSGH الحالية | إنشاء الصوت الحقيقي قبل الرندر. |

يستنتج الخادم عنوانه العام من `YOUTUBE_OAUTH_REDIRECT_URI` الموجود أصلًا. يمكن تعريف `NUSGH_PUBLIC_BASE_URL` اختياريًا إذا اختلف عنوان التطبيق العام في المستقبل.

## الإعداد اليدوي المطلوب

1. تأكد من تفعيل **GitHub Actions** للمستودع.
2. أضف `NUSGH_RENDER_CALLBACK_SECRET` في **Settings → Secrets and variables → Actions → New repository secret** في المستودع، وبالقيمة نفسها المحفوظة في NUSGH.
3. لا تضف `NUSGH_GITHUB_RENDER_TOKEN` إلى GitHub؛ يبقى داخل أسرار NUSGH فقط.
4. احفظ ونشّر النسخة التي تحتوي ملف Workflow قبل أول تشغيل؛ لا يظهر `workflow_dispatch` على GitHub قبل أن يصل YAML إلى الفرع `main`.
5. راقب أول تشغيل من تبويب **Actions**. لن يرفع Workflow ملفًا كـArtifact؛ يجب أن ينتهي callback برسالة نجاح داخل سجل الخطوة الأخيرة.

## التحقق قبل التسليم

يتحقق المسار من العناصر التالية قبل أن يعامل الملف على أنه نهائي:

| التحقق | مكانه |
|---|---|
| وجود المشاهد المعتمدة ومصادرها المرخصة | NUSGH قبل dispatch |
| وجود صوت حقيقي وSRT متزامن | NUSGH قبل dispatch |
| `Music=OFF` وعدم وجود مسار صوت موسيقي | NUSGH والـWorkflow |
| إنتاج ملف غير فارغ بصيغة MP4 | FFmpeg runner وcallback |
| فيديو 1080×1920 + مسار صوت + مدة موجبة | `ffprobe` في الـWorkflow |
| إمكانية decode للفيديو | FFmpeg في الـWorkflow |
| حجم أقل من 45 MB لاستقبال callback | NUSGH |
| HMAC حديث وبصمة SHA-256 مطابقة لبايتات الملف | NUSGH callback |
| نجاح تسليم Telegram قبل تمييز job مكتملة | NUSGH |

## اختبار محلي

من جذر المشروع شغّل:

```bash
node scripts/test-render-local.mjs
```

ينشئ الاختبار صورة وصوتًا وSRT مؤقتة، ثم يستخدم نفس `render-final-video.mjs` لإنتاج MP4 صالح 1080×1920 مع صوت وترجمة. لا يرسل شيئًا إلى Telegram ولا يتصل بـGitHub.

## اختبار GitHub الكامل بعد النشر

يتطلب اختبارًا كاملاً فيديو لديه صوت معتمد، SRT ومشاهد مرئية معتمدة، ووجود callback secret في GitHub. عندها ينشئ NUSGH Job من النوع `render.github_actions` ويشغّل العامل. يجب التحقق من:

1. وصول Workflow إلى خطوة **Return validated MP4 to NUSGH** بنجاح.
2. وجود سجل `renders` بحالة `completed` ورابط تخزين محفوظ.
3. وصول ملف فيديو MP4 نفسه إلى محادثة Telegram الخاصة بالمالك.
4. بقاء الفيديو في `awaiting_review` وعدم وجود أي محاولة رفع أو نشر إلى YouTube.

## القيود المعروفة

GitHub Actions عامل مؤقت وليس خادم رندر دائمًا. المسار الحالي مناسب لفيديوهات Shorts ذات ملفات صغيرة ويخضع لتوافر Actions وحدود استخدام الحساب. إذا تعذر تنفيذ الـWorkflow أو تجاوز الملف حد الاستقبال أو فشل Telegram، لا يُسجَّل الفيديو على أنه `FINAL_VIDEO.mp4` ولا ينتقل إلى `WAITING_FOR_OWNER`.
