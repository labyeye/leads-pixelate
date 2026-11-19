# NestLeads — WhatsApp Troubleshooting Playbook

**Kab likha gaya:** 13–14 Oct 2026 (Skylyf Industries / Bagclues Exim tenant ke "message nahi aa raha" issue ke baad)
**Kis ke liye:** developer / support jo kisi client ka WhatsApp message "send hua par pahuncha nahi" tackle kar raha ho.
**Rule of thumb:** pehle **Section 2 (Quick decision flow)** dekho, code mat chhedo. Is poore issue ka asli kaaran code nahi, Meta ki setup thi.

---

## 1. Short summary (TL;DR)

Ek client (skylyf21@gmail.com, tenant _BAGCLUES EXIM PRIVATE LIMITED_) ke liye WhatsApp send fail ho raha tha, jabki doosra client (kalahanutechstudios@gmail.com) theek chal raha tha. Code dono ke liye same tha. Problem ek ke baad ek **5 alag layers** pe thi:

| #   | Symptom                                                                                     | Asli kaaran                                                                                         | Fix                                                      |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Document Vault: "Failed to load documents"                                                  | Production backend pe naya route deploy hi nahi hua tha (`/api/documents` → 404)                    | `git pull` + `pm2 restart`                               |
| 2   | Upload: `Unexpected token 'A'... is not valid JSON`                                         | nginx ne badi file reject ki (plain-text error), frontend ne use JSON samajh ke parse kiya          | nginx `client_max_body_size 30m` + frontend safe parsing |
| 3   | `Application does not have permission for this action` (#10)                                | Token **USER type** tha, aur system user ko WhatsApp account **asset ke roop mein assign nahi** tha | System User token + WABA asset assign                    |
| 4   | `(#132001) Template name does not exist in the translation`                                 | Template us **WABA / language** mein nahi mila (stale local template, `en` vs `en_US`)              | Templates tab → **Sync Templates**                       |
| 5   | `POST /send 200` aur `ACCEPTED`, par message nahi aaya aur **koi delivery status log nahi** | Meta **app us tenant ke WABA se subscribe hi nahi tha** (`subscribed_apps: []`)                     | `POST /{wabaId}/subscribed_apps`                         |

> **Sabse badi seekh:** `/api/whatsapp/send` ka `200` ka matlab sirf "Meta ne request queue kar li" hai. Message deliver hua ya nahi, ye **sirf webhook (SENT/DELIVERED/FAILED)** se pata chalta hai. Webhook nahi aa raha = andhera.

---

## 2. Quick decision flow

```
Client bolta hai "message nahi aaya"
│
├─ UI mein error aaya?
│   ├─ "[Meta 10]"  / "does not have permission"  → Section 4.3 (token / assets)
│   ├─ "[Meta 190]" / "token expired"            → naya System User token, Setup mein update
│   ├─ "[Meta 132001]" / "template does not exist" → Section 4.4 (Sync Templates / language / WABA)
│   ├─ "[Meta 131042]" payment                    → WhatsApp Manager → Payment settings
│   └─ koi aur code                              → Section 5 (error code table)
│
└─ UI mein 200 / "queued", par phone pe nahi aaya
    │
    ├─ pm2 logs mein "ACCEPTED by Meta" hai?
    │     nahi → send hi fail hua, upar wale error dekho
    │
    ├─ uske baad "Message SENT/DELIVERED/FAILED" aaya?
    │     FAILED + reason → reason ke hisaab se fix (Section 5)
    │     DELIVERED       → phone pe aa gaya hoga; recipient ka chat / spam / blocked check
    │     kuch bhi nahi   → ⭐ webhook events nahi aa rahe (Section 4.5)
    │         1. GET /{wabaId}/subscribed_apps khali hai? → POST karke subscribe karo
    │         2. phone number pe webhook_configuration override hai?
    │         3. Meta app ke webhook fields mein `messages` subscribed hai?
    │         4. nginx access.log mein POST /api/whatsapp/webhook aa raha hai? kis app ko ja raha hai?
    │
    └─ Recipient number sahi hai? (WhatsApp pe active, personal number; business-API number nahi)
```

**Pehla kadam hamesha:**

```bash
cd /home/laabhbothra/server/kalahanu-server/leads-pixelate/backend
node scripts/check-wa-tenants.js <user-email>
```

Ye script tenant ka saved WABA, numbers, token type/expiry/scopes, `subscribed_apps` aur webhook config ek saath dikha deti hai. Token print nahi hota.

---

## 3. NestLeads mein WhatsApp kaise kaam karta hai (zaroori context)

```
Lead select ──► POST /api/whatsapp/send  (ya /campaigns)
                    │   (tenant ka apna token + phoneNumberId use hota hai)
                    ▼
         Meta Cloud API  POST /{phoneNumberId}/messages
                    │
                    ▼  200 + wamid         ◄── log: "Template message ACCEPTED by Meta"
                    │
         (kuch second baad, Meta ➜ HamArA webhook)
                    ▼
   POST /api/whatsapp/webhook   statuses: sent → delivered → read  (ya failed)
                    ▼
         log: "Message SENT / DELIVERED / READ / FAILED"
```

**Yaad rakhne wali baatein**

1. **Har tenant ka apna setup** hota hai: `Tenant.integrations.whatsapp` → `accessToken` (encrypted), `wabaId`, `phoneNumbers[]`, `webhookVerifyToken`. Isliye ek client chal sakta hai aur doosra nahi, bina code ke farak ke.
2. **Meta mein 3 level ke IDs** hote hain, jo confuse karte hain:

   | Object                                  | Kahan dikhta hai                       | NestLeads ko chahiye?                     |
   | --------------------------------------- | -------------------------------------- | ----------------------------------------- |
   | **WABA (WhatsApp Business Account) ID** | Business Settings → WhatsApp accounts  | ✅ **haan** (Setup mein WABA ID)          |
   | **Messaging account ID**                | Business Settings → Messaging accounts | ❌ nahi (galat ID daalne pe #10 aata hai) |
   | **Phone Number ID**                     | WABA ke andar phone_numbers            | ✅ (auto import hota hai)                 |

3. **Webhook ek app ka hota hai, tenant ka nahi.** Meta app ka ek hi Callback URL hota hai. Alag Meta app = alag webhook. Kalahanu apni alag app ("KTSLLP") use karta hai jiska webhook `backend.laxmilube.in` pe jaata hai.
4. **App ko har WABA ke saath alag se subscribe karna padta hai** (`/{wabaId}/subscribed_apps`). App-level webhook set karna kaafi nahi.
5. **Templates WABA ke hote hain**, tenant ke nahi. Template ka naam + **language** dono match hone chahiye.
6. Business-initiated message ke liye **approved template** zaroori hai. Free-form text/document sirf lead ke last message ke **24 ghante ke andar** chalta hai.

---

## 4. Issue log — kya hua, kya try kiya, kya kaam kiya

### 4.1 Document Vault: "Failed to load documents"

- **Symptom:** Vault page pe toast "Failed to load documents", list khali.
- **Pakda kaise:** `curl https://leads-backend.pixelatenest.com/api/documents` → `404 Not found — /api/documents`, jabki `/api/leads` → 401 (route exist karta hai). Code `origin/main` mein tha (commit `b013d48`).
- **Kaaran:** Production server purane code pe chal raha tha.
- **Fix:** server pe `git pull && cd backend && npm install && pm2 restart leads-pixelate`. Phir `/api/documents` → 401 (matlab route aa gaya).
- **Seekh:** "Failed to load X" pe pehle prod pe endpoint curl karo (404 vs 401), phir code dekho.

### 4.2 Upload: `Unexpected token 'A', "An error o"... is not valid JSON`

- **Symptom:** Document upload pe ye JavaScript error.
- **Kaaran:** Frontend `res.json()` seedha call karta tha. Server/nginx ne **plain text** error bheja (file badi thi, nginx ki default `client_max_body_size` 1 MB hoti hai), jo JSON nahi tha, isliye parse crash.
- **Fix (2 jagah):**
  1. nginx (`/etc/nginx/sites-available/<leads-backend>`), `location /` ke andar: `client_max_body_size 30m;` → `sudo nginx -t && sudo systemctl reload nginx`.
  2. Frontend: [`api.ts`](../frontend/src/services/api.ts) mein `readUploadResponse()` — text padho, JSON try karo, fail ho toh status-based friendly message (413 → "file too large").
- **Seekh:** backend ki multer limit (25 MB) se nginx ki limit **zyada** rakho (30m).

### 4.3 `Application does not have permission for this action` (Meta #10)

Ye sabse lamba hissa tha. **Ye error Meta ka hai** (Graph API), hamara code sirf message aage bhej raha tha.

**Jo hum ne check kiya aur kya nikla**

| Check                                     | Result                                                         | Matlab                                                                 |
| ----------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `debug_token` → `scopes`                  | `whatsapp_business_management/messaging` the, `is_valid: true` | Scope sahi tha, wajah ye nahi                                          |
| `debug_token` → `type`                    | `USER`, expiry kuch ghante/din                                 | ❌ Production ke liye galat token type                                 |
| `debug_token` → `granular_scopes`         | `target_ids` nahi                                              | Token ko kisi WhatsApp account ka access nahi (shuru mein shak ye tha) |
| Business Settings → System Users → Assets | WABA assign nahi tha                                           | Asli gap                                                               |

> ⚠️ **Dhyaan:** System User tokens ke `granular_scopes` mein aksar `target_ids` dikhte hi nahi, chahe asset assign ho. Isliye `target_ids` ka na hona **akela proof nahi**. Asli test: us token se `GET /{wabaId}/phone_numbers` ya `GET /{phoneNumberId}` chalao — error aaye toh access nahi hai.

**Jo kaam kiya (final fix)**

1. Business Settings → **System Users** → system user chuno.
2. **Add Assets** → **WhatsApp accounts** → client ka WABA → **Full control** → Assign.
3. **Generate token** → App chuno → Expiration **Never** → permissions: `whatsapp_business_management`, `whatsapp_business_messaging`.
4. NestLeads → WhatsApp → Setup mein naya token save karo.
5. Verify: `debug_token` → `type: SYSTEM_USER`, `expires_at: 0`; aur `GET /{phoneNumberId}` number dikhaye.

**Doosre kaaran jo is error mein aate hain (checklist)**

- Token ek **Messaging account ID** ke saath use ho raha hai, WABA ID ke saath nahi (Section 3, point 2).
- Meta app **Development mode** mein hai aur recipient app ke role mein nahi hai.
- WABA kisi **doosre Business** ka hai jo aapke Business se share nahi hua (Partner access chahiye).

### 4.4 `(#132001) Template name does not exist in the translation`

- **Log:** `{"code":132001,"message":"template name (welcome_new_lead) does not exist in en","template":"welcome_new_lead","language":"en"}`
- **Matlab:** Meta ko is **WABA** mein, is **language** mein, ye template nahi mila.
- **Kaaran (teen mein se ek):**
  1. Language mismatch: Meta mein `en_US`, NestLeads `en` bhej raha hai.
  2. Template kisi **aur WABA** mein bana tha (ya sirf local DRAFT hai, Meta ko kabhi submit nahi hua).
  3. Template approved nahi / delete / paused.
- **Check:** `GET /{wabaId}/message_templates?name=<template>&fields=name,language,status`
- **Fix:** Templates tab → **Sync Templates** (local list Meta se overwrite hoti hai, asli language aa jaati hai). Phir dialog mein wahi template chuno jo sync ke baad dikhe.
- **Known limitation:** Sync `metaTemplateName + tenant` ko key banata hai, isliye ek hi naam ke alag-alag language versions ek record mein collapse ho jaate hain. Isliye library templates ke naam mein language suffix hai (`_en`, `_hi`).

### 4.5 ⭐ `200` + `ACCEPTED`, par message nahi aaya aur status logs bilkul nahi

Ye sabse chalaak problem thi, kyunki UI mein koi error hi nahi aata.

**Pehle log kaise dikhte the:** sirf `POST /api/whatsapp/send 200` (koi detail nahi). Isliye humne logging badhai (Section 7).

**Jo humne kiya, aur kya nikla**

| Step | Command / check                                        | Result                                   | Nikala                                                                                                                                     |
| ---- | ------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `pm2 logs ...                                          | grep "Message (SENT                      | DELIVERED                                                                                                                                  | READ | FAILED)"` | khali | Status events aa hi nahi rahe |
| 2    | Developers → App → WhatsApp → Configuration            | Callback URL sahi, `messages` subscribed | App-level webhook theek                                                                                                                    |
| 3    | `sudo grep whatsapp/webhook /var/log/nginx/access.log` | POST aa rahe the, response **2 bytes**   | Hamare handler ka jawab 16 bytes hota (`{"success":true}`). Ye kisi **aur app** ke the (Kalahanu ka webhook `backend.laxmilube.in` pe hai) |
| 4    | `GET /{phoneNumberId}?fields=webhook_configuration`    | sirf `application` URL, override nahi    | Number-level override ka masla nahi                                                                                                        |
| 5    | `GET /{wabaId}/subscribed_apps`                        | **`data: []`**                           | ⭐ **App is WABA se subscribe hi nahi tha**                                                                                                |

**Asli kaaran:** Meta sirf unhi WABA ke events app ke webhook pe bhejta hai jinke saath app `subscribed_apps` se juda ho. Skylyf ke WABA pe app subscribed nahi tha, isliye na SENT aaya, na DELIVERED, na FAILED. Hamara server ko kuch pata hi nahi chalta tha.

**Fix:**

```
POST https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps
Authorization: Bearer <tenant ka SYSTEM_USER token>
→ {"success": true}
```

Verify: `GET .../subscribed_apps` mein app ka naam dikhna chahiye.

> ⚠️ **Subscribe sahi WABA pe karo.** Is case mein do WABA IDs (`1940045376677068`, `2262544880954029`) ek hi number (`1177350812125443`) dikha rahe the. NestLeads mein saved WABA `2262...` tha, aur pehle subscribe `1940...` pe hua tha, isliye problem bani rahi. **Wahi WABA subscribe karo jo NestLeads mein saved hai** (aur safe side ke liye dono).

### 4.6 Test ke dauraan hui confusion (red herrings)

Ye cheezein **kaaran nahi thi**, par time gaya. Aage ke liye note:

- **"Number test jaisa lagta hai"**: Pehle laga `919234112345` fake number hai. Asal mein ye aapka personal number tha, aur Kalahanu ka business number `9234712345` hai (`...12345` ke pehle ke digits mein farak sirf `1` vs `7`). Dono number ek-jaise dikhte hain, isliye test ke time number **dobara character-by-character** match karo.
- **"Business number ko message gaya"**: ye theory galat thi (digits mix hue). Agar sach mein kisi Cloud-API-registered business number ko message jaye, toh wo phone pe nahi aata, uske webhook pe jaata hai.
- **Payment method:** kaaran nahi tha, par future mein template ke liye zaroori hai (error `131042`).
- **App Development mode / `messages` field / WABA ID mismatch / phone-number override:** sab check hue, koi bhi asli kaaran nahi nikla. Asli kaaran sirf `subscribed_apps` tha.
- **Server se apne hi public domain pe `curl`:** timeout (`000`) aata hai (hairpin NAT). Isse kuch pata nahi chalta. `curl http://127.0.0.1:<port>/...` use karo.

---

## 5. Meta error code cheat sheet

Ye table code mein bhi hai (`WA_ERROR_REASONS`, [`whatsappController.js`](../backend/controllers/whatsappController.js)) aur UI error message ke saath hint ban ke jaati hai.

| Code             | Matlab                                     | Kya karna hai                                          |
| ---------------- | ------------------------------------------ | ------------------------------------------------------ |
| 10               | App ko permission nahi                     | Token type / asset assign / sahi WABA ID (Section 4.3) |
| 190              | Token expired / invalid                    | Naya System User token                                 |
| 100 (subcode 33) | Object exist nahi / galat ID               | Phone Number ID / WABA ID check                        |
| 130429           | Rate limit                                 | Thoda ruko, batch chhota karo                          |
| 131026           | Recipient WhatsApp pe nahi / undeliverable | Asli WhatsApp number se test                           |
| 131030           | Recipient allowed list mein nahi           | App Development mode ya sandbox number                 |
| 131042           | Payment problem                            | WABA pe payment method add                             |
| 131045           | Sending number registered nahi             | `POST /{phoneNumberId}/register`                       |
| 131047           | 24h window khatam                          | Approved template use karo                             |
| 131049           | Marketing message limit (frequency cap)    | Baad mein ya Utility template                          |
| 131056           | Same recipient ko bahut tezi se            | Ruko                                                   |
| 132000           | Variables ki ginti template se match nahi  | Mapping check                                          |
| 132001           | Template/language nahi mila                | Sync Templates (Section 4.4)                           |
| 132015 / 132016  | Template paused / disabled (quality)       | Template ko improve karo / naya banao                  |
| 133010           | Number registered nahi                     | Register karo                                          |

---

## 6. Diagnostic toolbox

### 6.1 Graph API calls (token = tenant ka System User token; kabhi chat/screenshot mein share mat karo)

```
# Token ki asli sthiti
GET /debug_token?input_token=<TOKEN>&access_token=<TOKEN>
    → type (SYSTEM_USER chahiye), expires_at (0 = never), is_valid, scopes

# WABA ke numbers (membership ka asli test)
GET /<WABA_ID>/phone_numbers?fields=id,display_phone_number,verified_name,status

# Number ki poori sehat
GET /<PHONE_NUMBER_ID>?fields=display_phone_number,verified_name,status,code_verification_status,platform_type,account_mode,quality_rating,webhook_configuration
    → status CONNECTED, platform_type CLOUD_API, account_mode LIVE

# App is WABA se subscribed hai?
GET  /<WABA_ID>/subscribed_apps          # khali = problem
POST /<WABA_ID>/subscribed_apps          # subscribe karne ke liye

# Template Meta mein hai?
GET /<WABA_ID>/message_templates?name=<naam>&fields=name,language,status,category
```

### 6.2 Server commands

```bash
# Tenant ka poora WhatsApp snapshot (token print nahi hota)
node backend/scripts/check-wa-tenants.js <email1> <email2>

# Ek message ki poori life
pm2 logs leads-pixelate --lines 300 --nostream | grep -E "ACCEPTED|Webhook change|Message (SENT|DELIVERED|READ|FAILED)"

# Meta webhook server tak pahunch raha hai?
sudo grep "whatsapp/webhook" /var/log/nginx/access.log | tail -10

# Handler ko seedha local pe test karo (16 bytes ka {"success":true} aana chahiye)
curl -m 5 -s -i -X POST http://127.0.0.1:<PORT>/api/whatsapp/webhook -H "Content-Type: application/json" -d '{}'

# Errors
pm2 logs leads-pixelate --lines 200 --nostream --err | tail -30
```

### 6.3 Healthy message ke logs (aise dikhne chahiye)

```
[INFO]  Template message ACCEPTED by Meta (waiting for sent/delivered/read) {"wamid":"wamid.HBg...","to":"91...","template":"welcome","language":"en","phoneNumberId":"1177..."}
[INFO]  Webhook change {"field":"messages","statuses":1,"messages":0}
[INFO]  Message SENT to WhatsApp servers      {"wamid":"wamid.HBg..."}
[INFO]  Message DELIVERED to phone            {"wamid":"wamid.HBg...","category":"marketing"}
[INFO]  Message READ by recipient             {"wamid":"wamid.HBg..."}
```

Fail hone par:

```
[ERROR] Message FAILED {"wamid":"...","code":131042,"reason":"Payment issue — add a payment method ..."}
```

### 6.4 Meta ki taraf se dekhne ki jagah

- **WhatsApp Manager → (account chuno) → Account tools → Activity log**: har message ka status/reason (webhook ke bina).
- **Developers → App → WhatsApp → Configuration**: Callback URL, Verify token, webhook fields (`messages` subscribed).
- **Business Settings → Users → System Users**: token generate / assets assign.
- **WhatsApp Manager → Payment settings**: payment method (har WABA ka alag).

---

## 7. Code mein jo humne badla

| Kya                                                                                                          | Kahan                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Meta ka poora error (code/subcode/fbtrace_id/details) structured log; UI message mein `[Meta <code>]` + hint | `backend/controllers/whatsappController.js` → `metaError()`, `WA_ERROR_REASONS`                                                       |
| Send ke time `ACCEPTED by Meta` log (wamid, to, template, language, phoneNumberId)                           | `postWa`, `sendWaMessage`                                                                                                             |
| Webhook lifecycle logs: `SENT / DELIVERED / READ / FAILED` + plain-language reason, `Webhook change`         | `handleWebhook`                                                                                                                       |
| Webhook mein tenant ko `phone_number_id` se bhi match karna (agar saved WABA ID galat/stale ho)              | `handleWebhook`                                                                                                                       |
| Naya diagnostic script                                                                                       | `backend/scripts/check-wa-tenants.js`                                                                                                 |
| Upload response ka safe parsing                                                                              | `frontend/src/services/api.ts` → `readUploadResponse`                                                                                 |
| Templates tab: save karte hi Meta ko auto-submit ("Create & Submit to Meta")                                 | `frontend/src/pages/WhatsappSettingsPage.tsx`                                                                                         |
| Leads: row checkboxes + "Send WhatsApp" dialog (template → doc vault → send)                                 | `components/leads/SendWhatsAppDialog.tsx`, `pages/LeadsPage.tsx`                                                                      |
| 16 ready-made templates (EN + HI), Meta rules ke hisaab se; test se validated                                | `frontend/src/config/whatsappTemplateLibrary.ts`, `components/whatsapp/TemplateLibraryDialog.tsx`, `src/test/templateLibrary.test.ts` |

---

## 8. Naye client ko onboard karne ka checklist

**Meta side**

- [ ] Client ka Business verified hai; WhatsApp Business Account (WABA) bana hai.
- [ ] Number **Cloud API** pe registered, status `CONNECTED`, `account_mode: LIVE`.
- [ ] WABA pe **payment method** add hai.
- [ ] Aapke Meta app ko WABA tak access hai (client Business mein app add kare, ya Partner access de).
- [ ] **System User** banaya, usko WABA **Full control** assign kiya.
- [ ] System User token generate kiya: **Never expire**, `whatsapp_business_management` + `whatsapp_business_messaging`.
- [ ] `POST /{wabaId}/subscribed_apps` kiya, `GET` se verify kiya.
- [ ] App webhook: Callback URL `https://leads-backend.pixelatenest.com/api/whatsapp/webhook`, verify token sahi, field **`messages`** subscribed.
- [ ] App **Live** mode mein (production ke liye).

**NestLeads side**

- [ ] WhatsApp → Setup: token + **WABA ID** (WhatsApp accounts page se, Messaging account ID nahi).
- [ ] Numbers list mein sirf wahi number(s) jo chahiye.
- [ ] Templates tab → **Sync Templates**.
- [ ] Test: ek **asli personal WhatsApp number** pe bhejo; logs mein `ACCEPTED → SENT → DELIVERED` dikhe.
- [ ] `node scripts/check-wa-tenants.js <email>` chalao — token `SYSTEM_USER`, `subscribed_apps` mein app dikhe.

---

## 9. Open items / recommendations

1. **Setup mein auto-subscribe:** `setup` controller ke andar `POST /{wabaId}/subscribed_apps` apne aap call karwa do, taaki naye client pe ye manual step na bache (is issue ka direct root cause).
2. **Kalahanu ka webhook alag app pe hai** (`backend.laxmilube.in`), isliye uske campaigns ke Delivered/Read counts leads backend mein update nahi hote. Chahiye toh ek single webhook receiver bana ke dono pe forward karo.
3. **Template sync multi-language collapse:** sync key mein `language` jodo (`metaTemplateName + language + tenant`), ya hamesha language-suffix naming rakho.
4. **Pagination:** sync `limit=100` hai; 100 se zyada templates wale WABA ke liye paging chahiye.
5. **Graph version:** backend `v20.0` use karta hai; Meta app `v26.0` dikha raha hai. Chalta rahega, par kabhi `WA_API` constant update kar lena.
6. **Token hygiene (security):** is debugging ke dauraan live System User tokens chat/screenshots mein aa gaye. **Un tokens ko Revoke karke naye banao** (Business Settings → System Users → Revoke tokens). Aage se `debug_token` ka output share karte waqt token hatao.
7. **Webhook signature:** `X-Hub-Signature-256` abhi verify nahi hota. Production hardening ke liye app secret se verify karna chahiye.
8. **Delivery status UI:** solo `/send` messages campaign nahi hote, isliye unka status sirf logs mein dikhta hai. Chaho toh unko bhi "WhatsApp Logs" mein record karo.

---

## 10. Is case ke IDs (reference ke liye, secrets nahi)

| Cheez                                   | Value                                                         |
| --------------------------------------- | ------------------------------------------------------------- |
| Meta app                                | SKYLYF INDUSTRIES CRM (`945647941776810`)                     |
| Business                                | Bagclues Exim Private Limited (`1902506130591450`)            |
| Skylyf number                           | `+91 99997 56605`, Phone Number ID `1177350812125443`         |
| WABA IDs jo is number ko dikha rahe the | `2262544880954029` (NestLeads mein saved), `1940045376677068` |
| Messaging account ID (WABA ID **nahi**) | `1285260636927004`                                            |
| Kalahanu app / webhook                  | "KTSLLP" → `backend.laxmilube.in/api/whatsapp/webhook`        |
