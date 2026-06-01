# NestLeads — WhatsApp Template Designs

Ye file mein saare manually bheje jaane wale WhatsApp templates hain.
In sabko **Meta Business Manager → WhatsApp Manager → Message Templates** mein create karna hoga.

---

## Important — Footer Rule

Har template ka footer **same rahega:**

```
Powered By NestLeads | {{COMPANY_NAME}}
```

Jahan `{{COMPANY_NAME}}` automatically aayega **Settings → Company Name** se.

**Example:**
- Agar Settings mein Company Name hai `Sharma Enterprises` toh footer banega:
  `Powered By NestLeads | Sharma Enterprises`
- Agar `Pixelate Nest` hai toh:
  `Powered By NestLeads | Pixelate Nest`

> Settings page → Company Name field fill karo — wahi footer mein aayega automatically.
> Meta template mein footer hardcode karo apni company ka naam — ek baar set karo.

---

## How to Create a Template in Meta

1. Go to: **business.facebook.com**
2. Left menu → **WhatsApp Manager** → **Message Templates**
3. Click **Create Template**
4. Fill: Name, Category, Language, Header (optional), Body, Footer
5. Submit → Meta 1–2 din mein approve karega
6. Approve hone ke baad NestLeads → WhatsApp → **Sync Templates** dabao

> **Tip:** `UTILITY` category ke templates jaldi approve hote hain.

---

## Variable Convention

| Variable | Matlab | Lead Field |
|---|---|---|
| `{{1}}` | Lead ka naam | Name |
| `{{2}}` | Company naam | Company |
| `{{3}}` | Product / Requirement | Requirement |
| `{{4}}` | Amount / Date (context pe depend) | Budget / Date |

---
---

## TEMPLATE 1 — Pehli Baar Contact (New Lead Welcome)

**Kab use karein:** Naya lead aaya — pehli baar WhatsApp bhejna hai.
**Status:** `PENDING CONTACT`
**Meta Template Name:** `welcome_new_lead`
**Category:** UTILITY

---

### Hindi

```
Header (Text):
नमस्ते {{1}} जी 👋

Body:
आपने *{{3}}* के बारे में enquiry की थी।

हमें आपकी enquiry मिल गई है।
हमारा executive जल्द ही आपसे संपर्क करेगा।

अगर आप अभी बात करना चाहते हैं तो reply करें। 😊

Footer:
Powered By NestLeads | Sharma Enterprises
```

### English

```
Header (Text):
Hello {{1}} 👋

Body:
We received your enquiry for *{{3}}*.

Our team will get in touch with you shortly.

Feel free to reply if you'd like to connect right now. 😊

Footer:
Powered By NestLeads | Sharma Enterprises
```

---
---

## TEMPLATE 2 — Call Nahi Uthaya

**Kab use karein:** Call karo aur lead phone na uthaye.
**Status:** `1` / `2` / `3`
**Meta Template Name:** `call_missed_followup`
**Category:** UTILITY

---

### Hindi

```
Header (Text):
कॉल मिस हो गई 📞

Body:
नमस्ते *{{1}}* जी,

हमने *{{3}}* के बारे में आपसे बात करने की कोशिश की,
लेकिन कॉल connect नहीं हो सकी।

कृपया बताएं — *आपके लिए कब बात करना सुविधाजनक होगा?*

हम आपके समय पर call करेंगे। 🙏

Footer:
Powered By NestLeads | Sharma Enterprises
```

### English

```
Header (Text):
We tried calling you 📞

Body:
Hi *{{1}}*,

We attempted to reach you regarding *{{3}}*,
but couldn't connect.

Could you share a *convenient time* for a call?

We'll reach out at your preferred time. 🙏

Footer:
Powered By NestLeads | Sharma Enterprises
```

---
---

## TEMPLATE 3 — Discussion Started

**Kab use karein:** Lead interested hai, baat chal rahi hai.
**Status:** `DISCUSSION` / `DISCUSSION 1` / `DISCUSSION 2` / `DISCUSSION 3`
**Meta Template Name:** `discussion_followup`
**Category:** UTILITY

---

### Hindi

```
Header (Text):
हमारी बातचीत के बारे में 💬

Body:
नमस्ते *{{1}}* जी,

*{{2}}* के साथ हमारी आपसे अच्छी बातचीत हुई।

हम आपकी requirement *{{3}}* के लिए
best solution तैयार कर रहे हैं।

कोई भी सवाल हो तो यहाँ reply करें — हम तुरंत जवाब देंगे। ✅

Footer:
Powered By NestLeads | Sharma Enterprises
```

### English

```
Header (Text):
Following up on our discussion 💬

Body:
Hi *{{1}}*,

Thank you for discussing your requirements with us at *{{2}}*.

We are preparing the best solution for *{{3}}*.

Feel free to message us anytime. ✅

Footer:
Powered By NestLeads | Sharma Enterprises
```

---
---

## TEMPLATE 4 — Quotation Ready (With PDF)

**Kab use karein:** Quotation generate karo aur client ko PDF bhejna ho.
**Status:** `QUOTATION` / `QUOTATION 1` / `QUOTATION 2` / `QUOTATION 3`
**Meta Template Name:** `quotation_ready`
**Category:** UTILITY

> **Important:** Header mein `DOCUMENT` type rakho — NestLeads automatically quotation PDF attach karega.

---

### Hindi

```
Header (Document):
[Quotation PDF yahan attach hoga]

Body:
नमस्ते *{{1}}* जी,

*{{2}}* के लिए आपका quotation तैयार है।

📋 *Details:*
• Requirement: {{3}}
• Amount: ₹{{4}}

Attached document देखें।

कोई changes चाहिए या सवाल हो तो reply करें। 🙏

Footer:
Powered By NestLeads | Sharma Enterprises
```

### English

```
Header (Document):
[Quotation PDF attached]

Body:
Hi *{{1}}*,

Please find attached the quotation for *{{2}}*.

📋 *Summary:*
• Requirement: {{3}}
• Amount: ₹{{4}}

Let us know if you'd like any changes. 🙏

Footer:
Powered By NestLeads | Sharma Enterprises
```

---
---

## TEMPLATE 5 — Visit Scheduled

**Kab use karein:** Client factory/office visit ke liye aane wala ho.
**Status:** `VISIT SCHEDULED`
**Meta Template Name:** `visit_scheduled_confirm`
**Category:** UTILITY

---

### Hindi

```
Header (Text):
Visit Confirmed ✅

Body:
नमस्ते *{{1}}* जी,

आपकी visit confirm हो गई है।

📅 *Date & Time:* {{4}}
🏢 *Location:* हमारा कार्यालय

आने से पहले एक बार confirm कर लें।
Schedule change करना हो तो reply करें। 🙏

Footer:
Powered By NestLeads | Sharma Enterprises
```

### English

```
Header (Text):
Visit Confirmed ✅

Body:
Hi *{{1}}*,

Your factory/office visit has been confirmed.

📅 *Date & Time:* {{4}}
🏢 *Venue:* Our Office / Factory

Please confirm once before visiting.
Reply here if you need to reschedule. 🙏

Footer:
Powered By NestLeads | Sharma Enterprises
```

---
---

## TEMPLATE 6 — Post Visit Follow-up

**Kab use karein:** Client visit karke gaya ho — feedback lena aur next step push karna.
**Status:** `VISITED`
**Meta Template Name:** `post_visit_followup`
**Category:** UTILITY

---

### Hindi

```
Header (Text):
Visit के लिए धन्यवाद 🙏

Body:
नमस्ते *{{1}}* जी,

आपने हमारी facility visit की — बहुत धन्यवाद! 🙏

हमें उम्मीद है आपको सब कुछ अच्छा लगा।

*{{3}}* के बारे में कोई सवाल हो तो बताएं।
हम अगला कदम उठाने के लिए तैयार हैं। ✅

Footer:
Powered By NestLeads | Sharma Enterprises
```

### English

```
Header (Text):
Thank you for visiting 🙏

Body:
Hi *{{1}}*,

Thank you for visiting our facility!

We hope you had a great experience.

Do you have any questions about *{{3}}*?
We're ready to move forward whenever you are. ✅

Footer:
Powered By NestLeads | Sharma Enterprises
```

---
---

## TEMPLATE 7 — Deal Won / Order Confirmed

**Kab use karein:** Deal close ho gayi.
**Status:** `WON`
**Meta Template Name:** `deal_won_welcome`
**Category:** UTILITY

---

### Hindi

```
Header (Text):
स्वागत है! 🎉

Body:
नमस्ते *{{1}}* जी,

*{{2}}* को choose करने के लिए
बहुत-बहुत धन्यवाद! 🙏

आपका order confirm हो गया है।
📦 *Order:* {{3}}

हमारी team जल्द ही आगे की process के लिए संपर्क करेगी।

आपके साथ काम करना हमारे लिए सौभाग्य है! 🎉

Footer:
Powered By NestLeads | Sharma Enterprises
```

### English

```
Header (Text):
Welcome aboard! 🎉

Body:
Hi *{{1}}*,

Thank you for choosing *{{2}}*!

Your order has been confirmed.
📦 *Order:* {{3}}

Our team will be in touch shortly for next steps.

We're excited to work with you! 🎉

Footer:
Powered By NestLeads | Sharma Enterprises
```

---
---

## TEMPLATE 8 — Re-engagement (Cold / Inactive Lead)

**Kab use karein:** Lead bahut time se inactive ho, wapas engage karna ho.
**Tag:** `COLD`
**Meta Template Name:** `re_engage_cold_lead`
**Category:** MARKETING

---

### Hindi

```
Header (Text):
क्या आप अभी भी interested हैं? 🤔

Body:
नमस्ते *{{1}}* जी,

कुछ समय पहले आपने *{{3}}* के बारे में enquiry की थी।

क्या आपकी requirement अभी भी active है?

अगर हाँ, तो reply करें —
हम आपके लिए best offer लेकर तैयार हैं। 💪

Footer:
Powered By NestLeads | Sharma Enterprises
```

### English

```
Header (Text):
Still interested? 🤔

Body:
Hi *{{1}}*,

You had enquired about *{{3}}* some time ago.

Is your requirement still active?

If yes, do reply — we have something special for you. 💪

Footer:
Powered By NestLeads | Sharma Enterprises
```

---
---

## TEMPLATE 9 — Follow-up Date Reminder

**Kab use karein:** Jab follow-up schedule hua ho aur client ko remind karna ho.
**Meta Template Name:** `followup_reminder_lead`
**Category:** UTILITY

---

### Hindi

```
Header (Text):
Follow-up Reminder 📅

Body:
नमस्ते *{{1}}* जी,

हमने *{{4}}* को आपसे बात करने का plan किया था।

क्या आप उस समय available होंगे?

Time change करना हो तो अभी reply करें — हम adjust कर लेंगे। 😊

Footer:
Powered By NestLeads | Sharma Enterprises
```

### English

```
Header (Text):
Follow-up Reminder 📅

Body:
Hi *{{1}}*,

We had scheduled a follow-up with you on *{{4}}*.

Will you be available at that time?

Feel free to reply if you'd like to reschedule. 😊

Footer:
Powered By NestLeads | Sharma Enterprises
```

---

---

## Quick Reference Table

| Lead Status | Template to Use |
|---|---|
| `PENDING CONTACT` | `welcome_new_lead` |
| `1` / `2` / `3` (call missed) | `call_missed_followup` |
| `DISCUSSION` / `DISCUSSION 1–3` | `discussion_followup` |
| `QUOTATION` / `QUOTATION 1–3` | `quotation_ready` |
| `VISIT SCHEDULED` | `visit_scheduled_confirm` |
| `VISITED` | `post_visit_followup` |
| `WON` | `deal_won_welcome` |
| `COLD` tag / long inactive | `re_engage_cold_lead` |
| Any follow-up date | `followup_reminder_lead` |

---

## Footer Mein Company Name Kaise Change Hoga

Meta template mein footer **ek baar hardcode** karna hoga apni company ka naam.
Kyunki Meta templates approve ho jaate hain aur footer dynamic nahi hoti WhatsApp mein.

**Ye karo:**
1. NestLeads → **Settings** → Company Name mein apna naam daalo
2. Meta template mein footer likhte time wahi naam use karo:
   `Powered By NestLeads | Tumhari Company Ka Naam`

**Example:**
- Ek client ka naam hai `Pixelate Nest` → footer: `Powered By NestLeads | Pixelate Nest`
- Doosre client ka naam hai `Sharma Traders` → footer: `Powered By NestLeads | Sharma Traders`

Har client apna alag template banayega — footer mein unka apna naam hoga.

---

## Meta Template Rules (Important)

| Rule | Detail |
|---|---|
| Template name | Sirf lowercase, numbers, underscore — `welcome_new_lead` ✅ |
| Variables | `{{1}}`, `{{2}}` format — koi aur format nahi |
| Footer | Optional but recommended |
| Edit | Approved template edit nahi hoti — naya banana padta hai |
| Category | UTILITY = fast approval, MARKETING = slow approval |
| Free text | Sirf 24 ghante ke andar customer ka reply aane ke baad |
| New outreach | Hamesha approved template se — free text nahi chalega |

---

*Last updated: May 2026 | NestLeads CRM by Pixelate Nest*
