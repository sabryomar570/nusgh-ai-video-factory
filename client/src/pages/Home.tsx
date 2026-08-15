import { MessageCircle, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#11110f] px-6 py-12 text-[#f1eadc]">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#191814] p-8 text-center shadow-2xl shadow-black/30 sm:p-12">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#e9b850]/30 bg-[#e9b850]/10 text-[#e9b850]"><MessageCircle size={26} /></div>
        <p className="mt-7 font-mono text-[10px] tracking-[.22em] text-[#b5985e]">NUSGH / TELEGRAM-FIRST</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">مركز تحكم نُسغ موجود في Telegram</h1>
        <p className="mt-5 text-sm leading-8 text-[#aaa296]">هذه الصفحة لم تعد لوحة إدارة للإنتاج. إنشاء الأفكار، ضبط الجدولة، مراجعة الفيديو، إعادة التوليد، وإيقاف الأتمتة تتم من خلال محادثة Telegram الخاصة بالمالك فقط.</p>
        <div className="mt-8 rounded-2xl border border-white/8 bg-black/15 p-5 text-right text-sm leading-8 text-[#d8d0c2]">
          <p className="flex items-center gap-2 font-medium text-[#f1eadc]"><ShieldCheck size={17} className="text-[#e9b850]" /> سياسة التشغيل</p>
          <p className="mt-2">Music = OFF. لا يُرسل أي فيديو إلا بعد التحقق، ولا يبدأ نشر خارجي تلقائيًا.</p>
        </div>
        <p className="mt-7 text-xs leading-6 text-[#756e64]">يستمر هذا النطاق كطبقة خادمية آمنة للـWebhook وOAuth والجدولة وعودة ملفات الرندر فقط.</p>
      </section>
    </main>
  );
}
