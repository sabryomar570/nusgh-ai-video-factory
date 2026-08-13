export type AssetReviewInput = {
  sourceType: "generated" | "stock" | "public_domain" | "owner_supplied";
  sourceUrl?: string;
  licenseId?: string;
  commercialUseConfirmed: boolean;
  attributionRequired: boolean;
  attributionText?: string;
  visualRole: "scene" | "thumbnail" | "brand" | "watermark";
};

export function reviewAsset(input: AssetReviewInput) {
  if (input.visualRole === "brand" || input.visualRole === "watermark") {
    return { status: "requires_review" as const, reason: "هوية نُسغ المرئية لا تُستبدل أو تُشتق من أصل خارجي." };
  }
  if (input.sourceType !== "generated" && (!input.sourceUrl || !input.licenseId)) {
    return { status: "requires_review" as const, reason: "الأصل الخارجي يحتاج مصدرًا ورخصة قابلة للتدقيق." };
  }
  if (!input.commercialUseConfirmed) {
    return { status: "requires_review" as const, reason: "لم يتم إثبات حق الاستخدام التجاري للأصل." };
  }
  if (input.attributionRequired && !input.attributionText?.trim()) {
    return { status: "requires_review" as const, reason: "الرخصة تتطلب نص نسبة واضحًا قبل الاستخدام." };
  }
  return { status: "approved" as const, reason: "المصدر والرخصة وحقوق الاستخدام التجاري مكتملة." };
}
