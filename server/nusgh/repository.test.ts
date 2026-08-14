import { describe, expect, it } from "vitest";
import { composeArabicNarration } from "./repository";

describe("approved narration preparation", () => {
  it("keeps the approved hook, body, and takeaway in narration order", () => {
    expect(composeArabicNarration({ hook: "هل لاحظت ذلك؟", body: "هذا هو الشرح المبسط.", takeaway: "جرّب أن تتوقف خمس ثوانٍ." })).toBe("هل لاحظت ذلك؟\n\nهذا هو الشرح المبسط.\n\nجرّب أن تتوقف خمس ثوانٍ.");
  });

  it("omits empty optional sections without creating blank narration", () => {
    expect(composeArabicNarration({ hook: "  ", body: "الفكرة الأساسية", takeaway: null })).toBe("الفكرة الأساسية");
  });
});
