/**
 * Ready-made WhatsApp templates a tenant can pick, tweak and send to Meta for approval.
 *
 * Written to pass Meta's template rules so approval is likely:
 *  - body never starts or ends with a variable, variables are {{1}}..{{n}} in order
 *  - every variable has a sample value (Meta rejects templates without one)
 *  - no variables in the header; header <= 60 chars, footer <= 60 chars, body <= 1024
 *  - UTILITY only for messages tied to an existing enquiry/order/payment;
 *    anything promotional or "are you still interested" is MARKETING
 *
 * `map` lists the lead field each variable defaults to when sending (see
 * mappingFromNotes). "custom" means the sender types the value (amount, date...).
 */

export type LibraryCategory =
  | "Welcome & enquiry"
  | "Follow-up"
  | "Quotation"
  | "Visit & demo"
  | "Order & payment"
  | "Marketing";

export interface LibraryTemplate {
  id: string;
  title: string;
  when: string;
  group: LibraryCategory;
  category: "UTILITY" | "MARKETING";
  /** DOCUMENT/IMAGE headers need a sample file uploaded before submitting. */
  headerType: "NONE" | "TEXT" | "DOCUMENT";
  headerText?: string;
  /** What each {{n}} means, shown in the picker. */
  vars: string[];
  map: string[];
  samples: string[];
  en: string;
  hi: string;
  footer?: string;
}

const FOOTER = "Powered by NestLeads";

export const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  // ───────────── Welcome & enquiry
  {
    id: "welcome_new_lead",
    title: "Welcome — enquiry received",
    when: "Right after a new lead comes in",
    group: "Welcome & enquiry",
    category: "UTILITY",
    headerType: "TEXT",
    headerText: "We received your enquiry",
    vars: ["Lead name", "Requirement"],
    map: ["name", "requirement"],
    samples: ["Rajesh", "packaging boxes"],
    en: "Hi {{1}}, thank you for your enquiry about {{2}}.\n\nWe have received it and our team will get in touch with you shortly.\n\nReply to this message if you would like to talk right now.",
    hi: "नमस्ते {{1}} जी, {{2}} के बारे में आपकी enquiry के लिए धन्यवाद।\n\nहमें आपकी enquiry मिल गई है और हमारी team जल्द ही आपसे संपर्क करेगी।\n\nअभी बात करना चाहें तो इस message पर reply करें।",
  },
  {
    id: "missed_call",
    title: "We tried calling you",
    when: "Lead did not pick up the call",
    group: "Welcome & enquiry",
    category: "UTILITY",
    headerType: "TEXT",
    headerText: "We tried to reach you",
    vars: ["Lead name", "Requirement"],
    map: ["name", "requirement"],
    samples: ["Rajesh", "packaging boxes"],
    en: "Hi {{1}}, we tried calling you about your enquiry for {{2}} but could not connect.\n\nPlease reply with a convenient time and we will call you then.",
    hi: "नमस्ते {{1}} जी, हमने {{2}} की आपकी enquiry के बारे में आपको call किया था, लेकिन बात नहीं हो पाई।\n\nकृपया सुविधाजनक समय बताएं, हम उसी समय call करेंगे।",
  },
  {
    id: "brochure_share",
    title: "Share brochure / catalogue",
    when: "Lead asks for details — attach a PDF from the Document Vault",
    group: "Welcome & enquiry",
    category: "MARKETING",
    headerType: "DOCUMENT",
    vars: ["Lead name", "Business name"],
    map: ["name", "custom"],
    samples: ["Rajesh", "Sharma Enterprises"],
    en: "Hi {{1}}, thank you for your interest in {{2}}.\n\nPlease find our brochure attached with all the details.\n\nReply to this message if you have any questions or would like a free demo.",
    hi: "नमस्ते {{1}} जी, {{2}} में आपकी रुचि के लिए धन्यवाद।\n\nसभी जानकारी के साथ हमारा brochure attached है।\n\nकोई सवाल हो या free demo चाहिए तो इस message पर reply करें।",
  },

  // ───────────── Follow-up
  {
    id: "discussion_followup",
    title: "After a discussion",
    when: "You spoke with the lead and a solution is being prepared",
    group: "Follow-up",
    category: "UTILITY",
    headerType: "NONE",
    vars: ["Lead name", "Requirement"],
    map: ["name", "requirement"],
    samples: ["Rajesh", "packaging boxes"],
    en: "Hi {{1}}, thank you for discussing your requirement for {{2}} with us.\n\nWe are preparing the best solution for you and will share it shortly.\n\nFeel free to message us here if you have any questions.",
    hi: "नमस्ते {{1}} जी, {{2}} की आपकी requirement पर बात करने के लिए धन्यवाद।\n\nहम आपके लिए best solution तैयार कर रहे हैं और जल्द ही share करेंगे।\n\nकोई सवाल हो तो यहाँ message करें।",
  },
  {
    id: "followup_reminder",
    title: "Gentle follow-up",
    when: "Lead went quiet after the first contact",
    group: "Follow-up",
    category: "MARKETING",
    headerType: "NONE",
    vars: ["Lead name", "Requirement"],
    map: ["name", "requirement"],
    samples: ["Rajesh", "packaging boxes"],
    en: "Hi {{1}}, just following up on your enquiry for {{2}}.\n\nAre you still looking for this? Reply YES and our team will call you back, or reply with a better time to talk.",
    hi: "नमस्ते {{1}} जी, {{2}} की आपकी enquiry के बारे में follow up कर रहे हैं।\n\nक्या आप अभी भी यह खोज रहे हैं? हाँ के लिए YES reply करें, हमारी team आपको call करेगी, या बात करने का बेहतर समय बताएं।",
  },
  {
    id: "reengage_cold",
    title: "Re-engage a cold lead",
    when: "No reply for a long time",
    group: "Follow-up",
    category: "MARKETING",
    headerType: "NONE",
    vars: ["Lead name", "Business name", "Requirement"],
    map: ["name", "custom", "requirement"],
    samples: ["Rajesh", "Sharma Enterprises", "packaging boxes"],
    en: "Hi {{1}}, it has been a while since we last connected.\n\nWe at {{2}} would be happy to help you with {{3}}. Reply to this message if you would like an updated quote or a quick call.",
    hi: "नमस्ते {{1}} जी, हमारी आखिरी बात को काफ़ी समय हो गया है।\n\n{{2}} में हम {{3}} के लिए आपकी मदद करना चाहेंगे। नया quote या call चाहिए तो इस message पर reply करें।",
  },
  {
    id: "followup_date_reminder",
    title: "Callback as promised",
    when: "On the follow-up date you set for the lead",
    group: "Follow-up",
    category: "UTILITY",
    headerType: "NONE",
    vars: ["Lead name", "Requirement"],
    map: ["name", "requirement"],
    samples: ["Rajesh", "packaging boxes"],
    en: "Hi {{1}}, as discussed, we are following up today regarding {{2}}.\n\nPlease let us know a suitable time and we will call you.",
    hi: "नमस्ते {{1}} जी, जैसा बात हुई थी, आज हम {{2}} के बारे में follow up कर रहे हैं।\n\nकृपया सुविधाजनक समय बताएं, हम आपको call करेंगे।",
  },

  // ───────────── Quotation
  {
    id: "quotation_ready",
    title: "Quotation sent (with PDF)",
    when: "Quotation is ready — attach the PDF from the Document Vault",
    group: "Quotation",
    category: "UTILITY",
    headerType: "DOCUMENT",
    vars: ["Lead name", "Requirement", "Amount"],
    map: ["name", "requirement", "custom"],
    samples: ["Rajesh", "packaging boxes", "45,000"],
    en: "Hi {{1}}, your quotation for {{2}} is attached.\n\nTotal amount: ₹{{3}}\n\nPlease review it and reply here if you need any changes or have questions.",
    hi: "नमस्ते {{1}} जी, {{2}} के लिए आपका quotation attached है।\n\nकुल राशि: ₹{{3}}\n\nकृपया देख लें और कोई बदलाव या सवाल हो तो यहाँ reply करें।",
  },
  {
    id: "quotation_followup",
    title: "Quotation follow-up",
    when: "A few days after sending a quotation",
    group: "Quotation",
    category: "MARKETING",
    headerType: "NONE",
    vars: ["Lead name", "Requirement"],
    map: ["name", "requirement"],
    samples: ["Rajesh", "packaging boxes"],
    en: "Hi {{1}}, just checking if you had a chance to review our quotation for {{2}}.\n\nWe are happy to answer any questions or adjust the quote to suit you. Reply here and we will take it forward.",
    hi: "नमस्ते {{1}} जी, क्या आपने {{2}} के लिए हमारा quotation देखा?\n\nकोई सवाल हो या quote में बदलाव चाहिए तो यहाँ reply करें, हम आगे बढ़ाएंगे।",
  },

  // ───────────── Visit & demo
  {
    id: "visit_confirmed",
    title: "Visit confirmed",
    when: "A visit is scheduled with the lead",
    group: "Visit & demo",
    category: "UTILITY",
    headerType: "TEXT",
    headerText: "Visit confirmed",
    vars: ["Lead name", "Date & time", "Location"],
    map: ["name", "custom", "custom"],
    samples: ["Rajesh", "15 Nov, 11:00 AM", "our office, Sector 5"],
    en: "Hi {{1}}, your visit is confirmed for {{2}} at {{3}}.\n\nPlease reply to confirm, or let us know if you need to reschedule.",
    hi: "नमस्ते {{1}} जी, आपकी visit {{2}} को {{3}} पर confirm हो गई है।\n\nकृपया confirm करने के लिए reply करें, या reschedule करना हो तो बताएं।",
  },
  {
    id: "visit_reminder",
    title: "Visit reminder",
    when: "Morning of the visit",
    group: "Visit & demo",
    category: "UTILITY",
    headerType: "NONE",
    vars: ["Lead name", "Time", "Location"],
    map: ["name", "custom", "custom"],
    samples: ["Rajesh", "11:00 AM", "our office, Sector 5"],
    en: "Hi {{1}}, a quick reminder about your visit today at {{2}} at {{3}}.\n\nWe look forward to meeting you. Reply here if anything changes.",
    hi: "नमस्ते {{1}} जी, आज {{2}} बजे {{3}} पर आपकी visit का reminder।\n\nहम आपसे मिलने के लिए उत्सुक हैं। कुछ बदलाव हो तो यहाँ reply करें।",
  },
  {
    id: "post_visit_thanks",
    title: "Thanks for visiting",
    when: "After the lead visited",
    group: "Visit & demo",
    category: "UTILITY",
    headerType: "NONE",
    vars: ["Lead name", "Requirement"],
    map: ["name", "requirement"],
    samples: ["Rajesh", "packaging boxes"],
    en: "Hi {{1}}, thank you for visiting us today.\n\nWe hope everything about {{2}} was clear. Please reply with any questions and we will help you take the next step.",
    hi: "नमस्ते {{1}} जी, आज हमसे मिलने के लिए धन्यवाद।\n\nउम्मीद है {{2}} के बारे में सब कुछ स्पष्ट रहा। कोई सवाल हो तो reply करें, हम अगला कदम उठाने में मदद करेंगे।",
  },
  {
    id: "demo_scheduled",
    title: "Demo scheduled",
    when: "A product demo / meeting is booked",
    group: "Visit & demo",
    category: "UTILITY",
    headerType: "TEXT",
    headerText: "Demo confirmed",
    vars: ["Lead name", "Date & time"],
    map: ["name", "custom"],
    samples: ["Rajesh", "15 Nov, 4:00 PM"],
    en: "Hi {{1}}, your demo is confirmed for {{2}}.\n\nOur team will share the meeting details before the session. Reply here if you would like a different time.",
    hi: "नमस्ते {{1}} जी, आपका demo {{2}} के लिए confirm हो गया है।\n\nहमारी team session से पहले meeting की details share करेगी। समय बदलना हो तो यहाँ reply करें।",
  },

  // ───────────── Order & payment
  {
    id: "order_confirmed",
    title: "Order confirmed",
    when: "Deal won / order placed",
    group: "Order & payment",
    category: "UTILITY",
    headerType: "TEXT",
    headerText: "Order confirmed",
    vars: ["Lead name", "Business name", "Order details"],
    map: ["name", "custom", "custom"],
    samples: ["Rajesh", "Sharma Enterprises", "ORD-1024"],
    en: "Hi {{1}}, thank you for choosing {{2}}.\n\nYour order {{3}} is confirmed. Our team will contact you shortly with the next steps.",
    hi: "नमस्ते {{1}} जी, {{2}} को चुनने के लिए धन्यवाद।\n\nआपका order {{3}} confirm हो गया है। हमारी team अगले steps के लिए जल्द संपर्क करेगी।",
  },
  {
    id: "invoice_sent",
    title: "Invoice sent (with PDF)",
    when: "Invoice is ready — attach the PDF from the Document Vault",
    group: "Order & payment",
    category: "UTILITY",
    headerType: "DOCUMENT",
    vars: ["Lead name", "Invoice number", "Amount"],
    map: ["name", "custom", "custom"],
    samples: ["Rajesh", "INV-2026-018", "45,000"],
    en: "Hi {{1}}, your invoice {{2}} is attached.\n\nAmount due: ₹{{3}}\n\nPlease reply here if you need any clarification.",
    hi: "नमस्ते {{1}} जी, आपका invoice {{2}} attached है।\n\nदेय राशि: ₹{{3}}\n\nकोई स्पष्टीकरण चाहिए तो यहाँ reply करें।",
  },
  {
    id: "payment_reminder",
    title: "Payment reminder",
    when: "Invoice is due or overdue",
    group: "Order & payment",
    category: "UTILITY",
    headerType: "NONE",
    vars: ["Lead name", "Amount", "Invoice number", "Due date"],
    map: ["name", "custom", "custom", "custom"],
    samples: ["Rajesh", "45,000", "INV-2026-018", "20 Nov"],
    en: "Hi {{1}}, a gentle reminder that a payment of ₹{{2}} for invoice {{3}} is due on {{4}}.\n\nPlease reply here if you would like the payment details or have already paid.",
    hi: "नमस्ते {{1}} जी, invoice {{3}} के लिए ₹{{2}} का भुगतान {{4}} को देय है।\n\nPayment details चाहिए या भुगतान हो चुका है तो कृपया यहाँ reply करें।",
  },
  {
    id: "payment_received",
    title: "Payment received",
    when: "After you record a payment",
    group: "Order & payment",
    category: "UTILITY",
    headerType: "NONE",
    vars: ["Lead name", "Amount", "Invoice number"],
    map: ["name", "custom", "custom"],
    samples: ["Rajesh", "45,000", "INV-2026-018"],
    en: "Hi {{1}}, we have received your payment of ₹{{2}} against invoice {{3}}.\n\nThank you! Please reply here if you need a receipt.",
    hi: "नमस्ते {{1}} जी, invoice {{3}} के लिए आपका ₹{{2}} का भुगतान हमें मिल गया है।\n\nधन्यवाद! Receipt चाहिए तो यहाँ reply करें।",
  },

  // ───────────── Marketing
  {
    id: "feedback_request",
    title: "Ask for feedback",
    when: "After delivery / completion of a service",
    group: "Marketing",
    category: "MARKETING",
    headerType: "NONE",
    vars: ["Lead name", "Business name"],
    map: ["name", "custom"],
    samples: ["Rajesh", "Sharma Enterprises"],
    en: "Hi {{1}}, thank you for choosing {{2}}.\n\nWe would love to hear how we did. Please reply with a rating from 1 to 5 and any suggestions you have.",
    hi: "नमस्ते {{1}} जी, {{2}} को चुनने के लिए धन्यवाद।\n\nहम जानना चाहेंगे कि हमारा अनुभव कैसा रहा। कृपया 1 से 5 में rating और कोई सुझाव reply करें।",
  },
  {
    id: "special_offer",
    title: "Offer / festival greeting",
    when: "Seasonal offers to your existing leads",
    group: "Marketing",
    category: "MARKETING",
    headerType: "NONE",
    vars: ["Lead name", "Business name", "Offer details"],
    map: ["name", "custom", "custom"],
    samples: [
      "Rajesh",
      "Sharma Enterprises",
      "10% off on all orders till 30 Nov",
    ],
    en: "Hi {{1}}, warm wishes from {{2}}!\n\nThis season we have a special offer for you: {{3}}.\n\nReply to this message to know more or to place your order.",
    hi: "नमस्ते {{1}} जी, {{2}} की तरफ़ से शुभकामनाएँ!\n\nइस season आपके लिए special offer है: {{3}}।\n\nजानने या order देने के लिए इस message पर reply करें।",
  },
];

/** Meta template name: lowercase, digits, underscore; language suffix keeps EN/HI apart. */
export const libraryName = (t: LibraryTemplate, lang: "en" | "hi") =>
  `${t.id}_${lang}`;

/** Builds the form values for the existing "Create template" dialog. */
export function libraryToForm(t: LibraryTemplate, lang: "en" | "hi") {
  return {
    displayName: lang === "hi" ? `${t.title} (Hindi)` : t.title,
    name: libraryName(t, lang),
    metaTemplateName: libraryName(t, lang),
    category: t.category,
    language: lang,
    headerType: t.headerType,
    headerText: t.headerText || "",
    headerMediaId: "",
    headerMediaName: "",
    headerMediaHandle: "",
    exampleValues: t.samples,
    bodyText: lang === "hi" ? t.hi : t.en,
    footerText: t.footer ?? FOOTER,
    status: "DRAFT",
    // MAP: is read by the Send dialog to pre-fill the variable → lead field mapping.
    notes: `MAP: ${t.map.join(",")} | ${t.vars.map((v, i) => `{{${i + 1}}} ${v}`).join(", ")}`,
  };
}

const MAP_KEYS = [
  "name",
  "company",
  "phone",
  "location",
  "requirement",
  "budget",
  "custom",
];

/** Parses the "MAP: name,requirement,custom" hint stored in a template's notes. */
export function mappingFromNotes(
  notes: string | undefined,
  variableCount: number,
): { position: number; fieldKey: string; customValue: string }[] {
  const hint = /MAP:\s*([a-z,\s]+)/i
    .exec(notes || "")?.[1]
    .split(",")
    .map((s) => s.trim().toLowerCase());
  const out = [];
  for (let i = 1; i <= variableCount; i++) {
    const fromHint = hint?.[i - 1];
    const fieldKey =
      fromHint && MAP_KEYS.includes(fromHint)
        ? fromHint
        : i === 1
          ? "name"
          : i === 2
            ? "company"
            : "custom";
    out.push({ position: i, fieldKey, customValue: "" });
  }
  return out;
}
