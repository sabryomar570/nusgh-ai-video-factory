import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Activity,
  Clapperboard,
  Cpu,
  Database,
  Lightbulb,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { label: "نظرة عامة", icon: Activity, active: true },
  { label: "استوديو الإنتاج", icon: Clapperboard },
  { label: "بنك الأفكار", icon: Lightbulb },
  { label: "الطوابير", icon: Timer },
  { label: "المزودون", icon: Cpu },
  { label: "البيانات", icon: Database },
  { label: "الأمان", icon: ShieldCheck },
  { label: "الإعدادات", icon: SlidersHorizontal },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [compact, setCompact] = useState(false);

  if (loading) return <div className="min-h-screen bg-[#11110f]" />;
  if (!user) {
    return (
      <div className="nusgh-shell grid min-h-screen place-items-center px-6">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#171714] p-9 text-center shadow-2xl">
          <p className="mb-3 text-xs tracking-[.22em] text-[#e9b850]">NUSGH / PRIVATE CONTROL</p>
          <h1 className="text-3xl font-semibold text-[#f1eadc]">نُسغ</h1>
          <p className="mt-4 text-sm leading-7 text-[#a69f94]">لوحة إنتاج داخلية محمية. سجّل دخولك للمتابعة إلى مركز التحكم.</p>
          <Button onClick={() => startLogin()} className="mt-8 w-full bg-[#e9b850] text-[#17130c] hover:bg-[#f1c96c]">تسجيل الدخول الآمن</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="nusgh-shell flex w-full overflow-x-hidden" dir="rtl">
      <aside className={`sticky top-0 hidden h-screen shrink-0 border-l border-white/8 bg-[#151512]/90 backdrop-blur-xl transition-[width] duration-200 md:flex md:flex-col ${compact ? "w-[76px]" : "w-[260px]"}`}>
        <div className="flex h-24 items-center justify-between px-5">
          {!compact && <div><p className="text-xl font-semibold text-[#f1eadc]">نُسغ</p><p className="mt-1 font-mono text-[9px] tracking-[.22em] text-[#a58e5c]">AI VIDEO FACTORY</p></div>}
          <button aria-label="طي القائمة" onClick={() => setCompact(!compact)} className="rounded-xl p-2 text-[#b9b1a4] transition hover:bg-white/6 hover:text-[#f1eadc]">
            {compact ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navigation.map(item => (
            <div key={item.label} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${item.active ? "bg-[#e9b850]/12 text-[#f1c96c]" : "text-[#8e897e]"}`} title={compact ? item.label : undefined}>
              <item.icon size={17} strokeWidth={item.active ? 2.2 : 1.7} className="shrink-0" />
              {!compact && <span className="flex-1">{item.label}</span>}
              {!compact && !item.active && <span className="text-[9px] text-[#5f5b54]">قريبًا</span>}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/8 p-4">
          <div className={`flex items-center ${compact ? "justify-center" : "gap-3"}`}>
            <Avatar className="h-9 w-9 border border-[#e9b850]/25"><AvatarFallback className="bg-[#282219] text-xs text-[#f1c96c]">{user.name?.charAt(0) || "ن"}</AvatarFallback></Avatar>
            {!compact && <div className="min-w-0 flex-1"><p className="truncate text-xs text-[#e8e1d4]">{user.name || "المالك"}</p><p className="mt-1 text-[10px] text-[#777168]">Owner · وصول خاص</p></div>}
            {!compact && <button aria-label="تسجيل الخروج" onClick={logout} className="text-[#777168] transition hover:text-[#f1eadc]"><LogOut size={16} /></button>}
          </div>
        </div>
      </aside>
      <main className="min-w-0 w-full flex-1"><div className="mx-auto w-full max-w-[1540px] p-4 sm:p-7 lg:p-9">{children}</div></main>
    </div>
  );
}
