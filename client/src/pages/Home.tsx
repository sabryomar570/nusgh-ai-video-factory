import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CircleAlert, Clapperboard, Cpu, FileCheck2, Loader2, Plus, Sparkles, Timer, Waves } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const statusLabel: Record<string, string> = { queued: "بانتظار التشغيل", running: "قيد التنفيذ", completed: "مكتمل", failed: "فشل", retrying: "إعادة محاولة", requires_review: "مراجعة لازمة", draft: "مسودة", awaiting_review: "بانتظار المراجعة", approved: "معتمد", published: "منشور" };
const statusTone: Record<string, string> = { running: "bg-[#e9b850]", completed: "bg-emerald-400", queued: "bg-sky-400", retrying: "bg-orange-400", requires_review: "bg-amber-400", failed: "bg-red-400", draft: "bg-zinc-500" };

export default function Home() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const dashboard = trpc.nusgh.dashboard.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const createIdea = trpc.nusgh.createIdea.useMutation();
  const createVideo = trpc.nusgh.createVideo.useMutation();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"short" | "long_form">("short");
  const [title, setTitle] = useState("");
  const [concept, setConcept] = useState("");

  const create = async () => {
    if (!title.trim() || !concept.trim()) return toast.error("أدخل عنوانًا وفكرة مركزية واضحة.");
    try {
      const idea = await createIdea.mutateAsync({ title, centralIdea: concept, contentPillar: "Everyday Psychology & Hidden Behavior", targetFormat: format });
      await createVideo.mutateAsync({ ideaId: idea.id, title, videoType: format, targetDurationSeconds: format === "short" ? 55 : 480 });
      await Promise.all([utils.nusgh.dashboard.invalidate(), utils.nusgh.videos.invalidate(), utils.nusgh.jobs.invalidate()]);
      toast.success("أُنشئ مشروع الفيديو وأضيفت مهمة البدء إلى الطابور.");
      setOpen(false); setTitle(""); setConcept("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إنشاء مشروع الفيديو."); }
  };

  const snapshot = dashboard.data?.snapshot;
  const jobs = snapshot?.latestJobs ?? [];
  const providers = snapshot?.providerRows ?? [];
  const totalJobs = Object.values(snapshot?.jobStatusCounts ?? {}).reduce((sum, value) => sum + Number(value), 0);
  const activeJobs = Number(snapshot?.jobStatusCounts.running ?? 0) + Number(snapshot?.jobStatusCounts.retrying ?? 0);

  return <DashboardLayout>
    <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div><p className="font-mono text-[10px] tracking-[.22em] text-[#b5985e]">NUSGH / PRIVATE PRODUCTION CONTROL</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#f1eadc] sm:text-4xl">صباح الخير، لنصنع فكرة تستحق أن تبقى.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#9d968b]">مركز التحكم يعرض البيانات الفعلية المخزنة، ويبدأ دائمًا بوضع <span className="text-[#f1c96c]">المراجعة الكاملة</span>.</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="h-12 rounded-xl bg-[#e9b850] px-5 text-[#17130c] hover:bg-[#f2c76b]"><Plus className="ml-2" size={17}/>إنشاء فيديو</Button></DialogTrigger><DialogContent dir="rtl" className="border-white/10 bg-[#1a1916] text-[#f1eadc]"><DialogHeader><DialogTitle>مشروع فيديو جديد</DialogTitle></DialogHeader><div className="space-y-5 pt-2"><div className="grid grid-cols-2 gap-3"><Button variant={format === "short" ? "default" : "outline"} onClick={() => setFormat("short")} className={format === "short" ? "bg-[#e9b850] text-[#17130c]" : "border-white/15 bg-transparent"}>Short</Button><Button variant={format === "long_form" ? "default" : "outline"} onClick={() => setFormat("long_form")} className={format === "long_form" ? "bg-[#e9b850] text-[#17130c]" : "border-white/15 bg-transparent"}>Long-form</Button></div><div><Label>عنوان العمل</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-2 border-white/10 bg-white/5" placeholder="لماذا نصعب على أنفسنا أبسط القرارات؟" /></div><div><Label>الفكرة المركزية</Label><Textarea value={concept} onChange={e => setConcept(e.target.value)} className="mt-2 min-h-28 border-white/10 bg-white/5" placeholder="اكتب موقفًا مألوفًا وفائدة واحدة قابلة للتطبيق." /></div><Button onClick={create} disabled={createIdea.isPending || createVideo.isPending} className="w-full bg-[#e9b850] text-[#17130c] hover:bg-[#f2c76b]">{createIdea.isPending || createVideo.isPending ? <Loader2 className="animate-spin"/> : "إنشاء وإضافة للطابور"}</Button></div></DialogContent></Dialog>
    </header>
    {dashboard.isLoading ? <div className="grid min-h-[45vh] place-items-center"><Loader2 className="animate-spin text-[#e9b850]" /></div> : dashboard.isError ? <section className="rounded-3xl border border-red-400/20 bg-red-400/5 p-7 text-sm text-red-100"><CircleAlert className="mb-3"/>تعذر قراءة بيانات لوحة التحكم. سجّل الدخول بصلاحية المالك ثم حاول مجددًا.</section> : <>
      <section className="organic-line nusgh-grid relative mb-6 overflow-hidden rounded-[2rem] border border-white/8 bg-[#191814] p-6 sm:p-8"><img src="/manus-storage/nusgh-master-visual-identity_0ff90c86.jpg" alt="الهوية البصرية لنُسغ" className="gentle-drift pointer-events-none absolute -left-8 -top-16 h-60 w-auto opacity-60 mix-blend-screen sm:h-72"/><div className="relative max-w-2xl"><Badge className="border border-[#e9b850]/25 bg-[#e9b850]/10 text-[#eec56b] hover:bg-[#e9b850]/10">وضع التشغيل: مراجعة كاملة</Badge><h2 className="mt-5 text-2xl font-semibold text-[#f1eadc]">خط إنتاج واحد، قرار واضح، ومراجعة لا تُتخطّى.</h2><p className="mt-3 text-sm leading-7 text-[#aaa296]">لا نشر تلقائي، لا موسيقى، ولا أصل بصري بلا سجل ترخيص. كل توقف يظل ظاهرًا في الطابور حتى يُعالج.</p><div className="mt-6 flex flex-wrap gap-5 text-xs text-[#b9b0a2]"><span className="flex items-center gap-2"><span className="status-dot bg-emerald-400"/>القاعدة متصلة</span><span className="flex items-center gap-2"><span className="status-dot bg-[#e9b850]"/>المزودون حسب التهيئة</span><span className="flex items-center gap-2"><span className="status-dot bg-sky-400"/>Telegram: webhook مؤمن ومتحقق</span></div></div></section>
      <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Clapperboard} label="مشاريع الفيديو" value={String((snapshot?.latestVideos ?? []).length)} note="أحدث المشاريع"/><Metric icon={Timer} label="وظائف الطابور" value={String(totalJobs)} note={activeJobs ? `${activeJobs} نشطة الآن` : "لا توجد وظيفة نشطة"}/><Metric icon={Cpu} label="مزودون مهيأون" value={String(providers.filter(p => p.isEnabled).length)} note={providers.length ? "من سجل المزودين" : "لم يُضف مزود بعد"}/><Metric icon={FileCheck2} label="أفكار موثقة" value={String(snapshot?.ideaCount ?? 0)} note="بانتظار التقييم أو الإنتاج"/></section>
      <section className="grid gap-6 xl:grid-cols-[1.55fr_.9fr]"><div className="rounded-[1.65rem] border border-white/8 bg-[#181714] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-[#efe8dc]">حالة خط الإنتاج</p><p className="mt-1 text-xs text-[#817a70]">وظائف حقيقية محفوظة في قاعدة البيانات</p></div><Waves size={19} className="text-[#e9b850]"/></div>{jobs.length ? <div className="space-y-2">{jobs.map(job => <div key={job.id} className="flex items-center gap-4 rounded-2xl bg-white/[.025] px-4 py-3"><span className={`status-dot ${statusTone[job.status] ?? "bg-zinc-500"}`}/><div className="min-w-0 flex-1"><p className="truncate text-sm text-[#dfd8ca]">{job.jobType}</p><p className="mt-1 font-mono text-[10px] text-[#756e64]">JOB-{String(job.id).padStart(4,"0")} · {job.attemptCount}/{job.maxAttempts}</p></div><Badge variant="outline" className="border-white/10 text-[10px] text-[#b4ac9e]">{statusLabel[job.status] ?? job.status}</Badge></div>)}</div> : <EmptyState title="لا توجد وظائف بعد" description="أنشئ فيديو جديدًا لإضافة أول مهمة فعلية إلى الطابور." />}</div>
      <div className="rounded-[1.65rem] border border-white/8 bg-[#181714] p-5 sm:p-6"><div className="mb-5"><p className="text-sm font-semibold text-[#efe8dc]">صحة المزودين</p><p className="mt-1 text-xs text-[#817a70]">الحالة مصدرها سجل المزودين، لا محاكاة.</p></div>{providers.length ? <div className="space-y-4">{providers.map(provider => <div key={provider.id}><div className="mb-2 flex justify-between text-xs"><span className="text-[#d9d1c2]">{provider.displayName}</span><span className="font-mono text-[10px] text-[#8d867a]">{provider.status}</span></div><Progress value={provider.status === "available" ? 100 : provider.status === "limited" ? 55 : 12} className="h-1.5 bg-white/5 [&>div]:bg-[#e9b850]" /></div>)}</div> : <EmptyState title="لا يوجد مزود مهيأ" description="ستظهر حالة كل اتصال وحدوده هنا عند ربطه فعليًا." />}</div></section>
    </>}
  </DashboardLayout>;
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof Clapperboard; label: string; value: string; note: string }) { return <article className="rounded-[1.45rem] border border-white/8 bg-[#181714] p-5"><div className="mb-5 flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9b850]/10 text-[#e9b850]"><Icon size={18}/></span><Sparkles size={15} className="text-[#5f584e]"/></div><p className="text-2xl font-semibold text-[#f1eadc]">{value}</p><p className="mt-1 text-xs text-[#b7afa1]">{label}</p><p className="mt-3 text-[10px] text-[#70695f]">{note}</p></article>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="rounded-2xl border border-dashed border-white/10 px-5 py-9 text-center"><p className="text-sm text-[#d9d1c2]">{title}</p><p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-[#777168]">{description}</p></div>; }
