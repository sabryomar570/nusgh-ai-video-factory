export type GrowthMetrics = { views: number; watchTimeMinutes: number; averageViewDurationSeconds?: number | null; subscribersGained: number; likes: number; comments: number; shares: number };
export type GrowthRecommendation = { area: "hook" | "retention" | "engagement" | "conversion" | "baseline"; priority: "low" | "medium" | "high"; observation: string; suggestion: string; requiresOwnerApproval: true };

export function suggestGrowthExperiments(metrics: GrowthMetrics, videoDurationSeconds?: number): GrowthRecommendation[] {
  const recommendations: GrowthRecommendation[] = [];
  if (metrics.views < 100) recommendations.push({ area: "baseline", priority: "medium", observation: "لا توجد عينة مشاهدة كافية لاستخلاص نمط موثوق.", suggestion: "استمر في اختبار أفكار Evergreen وHooks متعددة قبل تغيير هوية القناة أو معدلات النشر.", requiresOwnerApproval: true });
  const retention = videoDurationSeconds && metrics.averageViewDurationSeconds ? Math.round((metrics.averageViewDurationSeconds / videoDurationSeconds) * 100) : null;
  if (retention !== null && retention < 35) recommendations.push({ area: "retention", priority: "high", observation: `متوسط الاحتفاظ التقديري ${retention}% أقل من النطاق المريح.`, suggestion: "اختبر بداية أقصر ومشهدًا ملموسًا قبل الشرح، مع الاحتفاظ بفكرة مركزية واحدة دون صدمة أو تضليل.", requiresOwnerApproval: true });
  const engagementRate = metrics.views ? ((metrics.likes + metrics.comments + metrics.shares) / metrics.views) * 100 : 0;
  if (metrics.views >= 100 && engagementRate < 1) recommendations.push({ area: "engagement", priority: "medium", observation: `تفاعل تقريبي ${engagementRate.toFixed(1)}% مقارنة بالمشاهدات.`, suggestion: "اختبر سؤالًا ختاميًا بسيطًا مرتبطًا بالفكرة العملية، من دون طلب تفاعل مصطنع أو مضلل.", requiresOwnerApproval: true });
  if (metrics.views >= 100 && metrics.subscribersGained === 0) recommendations.push({ area: "conversion", priority: "low", observation: "لم يتحول الوصول الحالي إلى مشتركين جدد في اللقطة المتاحة.", suggestion: "راجع اتساق الوعد التحريري والهوية البصرية في النهاية، ولا تغيّر القيم التحريرية فقط لتحسين التحويل.", requiresOwnerApproval: true });
  return recommendations;
}
