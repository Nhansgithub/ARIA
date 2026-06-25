# ARIA — AI Business Operating System
### Product Requirements Document v1.1

**Product name:** ARIA (Adaptive Revenue Intelligence Assistant)
**Owner:** Solo founder + small team (2–4 contractors)
**Business context:** Service agency — web design, web/app builds, automation consulting
**Primary language:** Bilingual (Vietnamese / English — AI adapts to whichever is used)
**Client source:** Cold outreach + referrals — new clients, varied service types
**Date:** June 2026

---

## 1. Product vision

ARIA is not a dashboard. It is an AI consultant that runs your business behind the scenes and reports to you through conversation. You talk to it the way you'd talk to a smart, experienced business partner who happens to have read every file in your company and never forgets anything.

The CRM, document vault, and pipeline exist as structured data in the backend. You never "open the CRM." You ask ARIA a question and it answers from the CRM. You ask for a proposal and it drafts one from the deal context. You open the app each morning and it tells you what matters today.

The design principle throughout: **the AI does the operating, you do the deciding.**

---

## 2. Core interaction model

Every feature in ARIA maps to one of five interaction modes:

| Mode | Trigger | Example |
|------|---------|---------|
| **Query** | You ask for information | "What's the status on Minh's project?" |
| **Advice** | You ask what to do | "What should I do next with this deal?" |
| **Collaborate** | You ask for a document | "Draft a proposal for the Hanoi restaurant client" |
| **Proactive** | ARIA surfaces unprompted | Daily briefing, stale deal alerts, missing doc warnings |
| **Deal intelligence** | You mention a deal — new or ongoing — and ask ARIA to think with you | "I just spoke to a new F&B client, they want a site and maybe automation — how do I approach this?" |

ARIA never gives you a raw database dump. Every answer is synthesized, contextualized, and followed by a recommended next step where relevant.

**Deal intelligence is the most important mode.** When you mention any deal — even one you've just learned about in the same message — ARIA must synthesize across four layers simultaneously before responding:
1. What it knows about this specific client (history, communication style, hesitations, past interactions)
2. What it knows about deals like this one (same service type, same industry, similar size, past win/loss patterns)
3. What the deal's current stage and stated context imply strategically
4. What domain knowledge about this type of client, market, or service is relevant

The output is not a summary — it is a consultant's read: what this deal really is, what the risks are, what the client probably actually wants, what documents you need at this stage, how to approach the next conversation, and what outcome to aim for. See §6.6 for full specification.

---

## 3. Users

**Primary user: You (the founder)**
- Thinks in both Vietnamese and English
- Comfortable with tech but not interested in operating software
- Needs business judgment more than data entry
- Works across multiple service types simultaneously

**Secondary users: Team members (2–4 contractors)**
- Phase 3 consideration — not in MVP
- Will have limited, scoped access (e.g. view their assigned projects only)

---

## 4. System architecture overview

```
┌─────────────────────────────────────────────┐
│                  UI Shell                    │
│  Chat interface │ Briefing panel │ Doc viewer│
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│              Orchestrator                    │
│  Main system prompt + routing logic          │
│  Decides: which agent to invoke, which       │
│  data to fetch, what to surface proactively  │
└──┬──────────┬───────────┬────────────────┬──┘
   │          │           │                │
┌──▼──┐  ┌───▼───┐  ┌────▼────┐  ┌───────▼──┐
│Sales│  │ Doc   │  │Strategy │  │ Briefing │
│Agent│  │ Agent │  │ Agent   │  │ Agent    │
└──┬──┘  └───┬───┘  └────┬────┘  └───────┬──┘
   │          │           │               │
┌──▼──────────▼───────────▼───────────────▼──┐
│           Artifact Store (Supabase)          │
│  Clients │ Deals │ Documents │ Activity log  │
└─────────────────────────────────────────────┘
```

**Stack:**
- **Frontend + Backend:** Next.js 14 (App Router) — single repo, deployed on Vercel
- **Database + File storage:** Supabase (Postgres + Storage buckets)
- **AI:** Anthropic API — Claude Haiku 4.5 for routine ops, Claude Sonnet 4.6 for advice and doc drafting
- **Background jobs:** Vercel Cron (daily briefing) or Supabase Edge Functions
- **Auth:** Supabase Auth (email/password to start, Google OAuth later)
- **PDF generation:** html-pdf-node or Puppeteer on Vercel serverless

---

## 5. Data models

### 5.1 Client
```
clients
  id                    uuid PK
  name                  text
  company               text
  email                 text
  phone                 text
  source                enum(cold_outreach, referral, repeat)
  language_pref         enum(vi, en)
  industry              text          -- e.g. F&B, retail, professional services
  company_size          enum(solo, small, medium, enterprise)
  communication_style   text          -- AI-maintained: e.g. "formal, slow to decide, needs reassurance"
  known_hesitations     text          -- AI-maintained: e.g. "always pushes back on price, nervous about timelines"
  relationship_stage    enum(cold, warming, trusted, long_term)
  notes                 text          -- AI-maintained free text
  created_at            timestamp
  updated_at            timestamp
```

### 5.2 Deal
```
deals
  id                    uuid PK
  client_id             uuid FK → clients
  service_type          enum(web_design, web_app, automation, other)
  title                 text              -- e.g. "E-commerce site for Phở 24"
  stage                 text              -- flexible per service type (see §6.2)
  stage_history         jsonb             -- [{stage, entered_at, note}]
  value_estimate        numeric
  currency              enum(VND, USD)
  priority              enum(high, medium, low)
  next_action           text              -- AI-maintained
  next_action_due       date
  stale_since           date              -- AI flags when no activity
  client_stated_need    text              -- what the client said they want
  inferred_real_need    text              -- AI-maintained: what they probably actually need
  risk_flags            jsonb             -- [{flag, severity, noted_at}] e.g. vague scope, price sensitivity
  opportunity_signals   jsonb             -- [{signal, noted_at}] e.g. expansion potential, referral likely
  predicted_outcome     enum(likely_win, uncertain, at_risk, likely_lost) -- AI-maintained
  prediction_reason     text              -- AI's reasoning for the prediction
  similar_deals         jsonb             -- [{deal_id, similarity_reason}] — AI-linked past deals
  notes                 text
  created_at            timestamp
  updated_at            timestamp
```

### 5.3 Document
```
documents
  id              uuid PK
  deal_id         uuid FK → deals (nullable — some docs are general)
  client_id       uuid FK → clients (nullable)
  type            enum(proposal, contract, brief, sop, report, invoice, onboarding, other)
  title           text
  status          enum(draft, review, sent, signed, archived)
  content_md      text          -- source markdown, editable
  file_url        text          -- Supabase Storage path to PDF
  version         integer
  created_by      enum(ai, human)
  created_at      timestamp
  updated_at      timestamp
```

### 5.4 Activity log
```
activity_log
  id              uuid PK
  entity_type     enum(client, deal, document)
  entity_id       uuid
  action          text          -- "stage_changed", "doc_created", "note_added"
  actor           enum(ai, user)
  payload         jsonb
  created_at      timestamp
```

### 5.5 Briefing cache
```
briefings
  id              uuid PK
  date            date UNIQUE
  content_md      text          -- markdown of the day's briefing
  flags           jsonb         -- structured list of alerts
  generated_at    timestamp
```

---

## 6. Agent specifications

### 6.1 Orchestrator (always active)

The orchestrator is the system prompt layer that wraps every conversation. It:

- Reads the full business context at session start (injected from DB)
- Classifies the user's intent (query / advice / collaborate / ambiguous)
- Routes to the appropriate specialist agent or handles directly
- Enforces ARIA's personality: direct, professional, bilingual, proactive
- Always ends advice with a concrete recommended next step
- Detects language of user message and responds in same language
- Flags if a request would benefit from a document being created

**System prompt skeleton (to be refined per Phase 1 testing):**

```
You are ARIA, an AI business consultant and operations manager for [owner name]'s 
service agency. You manage the CRM, advise on sales strategy, draft business 
documents, and run daily briefings.

Your personality: direct, professional, warm but not casual. You have strong 
opinions about what good business practice looks like. You challenge assumptions 
when you see a mistake about to happen. You are fluent in both Vietnamese and 
English and switch automatically based on what the user writes.

You have access to the following tools:
- get_client(id or name)
- get_deal(id or title)
- list_deals(filters)
- update_deal(id, fields)
- update_client(id, fields)
- get_document(id or deal+type)
- create_document(deal_id, type, context)
- create_client_stub(name, company, known_fields)   -- for new clients mentioned in conversation
- find_similar_deals(service_type, industry, size)  -- for deal intelligence pattern matching
- log_activity(entity, action, note)
- get_briefing(date)

Business context (injected fresh each session):
{BUSINESS_CONTEXT_BLOCK}

Rules:
1. Never answer a business question from memory alone — always query the DB first.
2. After giving information, always suggest a next action unless the user said 
   they just want the information.
3. When drafting documents, always elicit missing information before generating.
4. Flag stale deals (no activity > 7 days) unprompted when relevant.
5. If a question implies a document should exist but doesn't, say so.
```

---

### 6.2 Sales agent

**Responsibility:** Pipeline intelligence — what's happening, what to do next, what's stuck.

**Pipeline stages (adaptive per service type):**

Because service types vary, stages are stored as free text in the DB but the AI applies standard logic patterns:

| Service type | Typical stages |
|---|---|
| Web design | Lead → Discovery call → Scope agreed → Proposal sent → Negotiation → Contract signed → In delivery → Delivered → Follow-up |
| Web/app build | Lead → Technical discovery → Scoping → Proposal → Contract → Sprint planning → In build → UAT → Launched → Support |
| Automation consulting | Lead → Pain mapping → Solution design → Proposal → Pilot agreement → Pilot → Full engagement → Ongoing |

The AI understands these patterns contextually — it does not enforce a rigid enum. When a deal has an unusual stage, the AI interprets it sensibly.

**Core behaviors:**
- When asked about a client/deal: return name, stage, value estimate, last activity, next action, days since last movement
- When asked "what should I do next": give a specific, actionable recommendation based on the stage and how long it's been there
- When a deal hasn't moved in 7+ days: flag it in briefing and when relevant in conversation
- When a deal reaches "Proposal sent": remind after 3 days if no response logged
- Understands Vietnamese business culture context (relationship-first, trust before pressure)

**Example interaction:**
```
User: Anh ơi, deal với công ty Minh Phát đang thế nào rồi?

ARIA: Deal Minh Phát — Website thương mại điện tử, ước tính 45 triệu VND.
Hiện tại: Proposal đã gửi ngày 18/6, chưa có phản hồi (7 ngày).
Liên hệ gần nhất: Zalo ngày 17/6 — anh Minh nói sẽ xem xét cuối tuần.

Đề xuất: Nên follow up hôm nay. Gửi tin nhắn ngắn hỏi thăm, không cần đề cập 
giá — chỉ hỏi có câu hỏi gì về proposal không. Muốn tôi soạn tin nhắn đó không?
```

---

### 6.3 Document agent

**Responsibility:** Create, store, retrieve, and version all client-facing and internal documents.

**Document types and when to use them:**

| Type | Trigger | Audience |
|---|---|---|
| Proposal | Before contract, after scoping | Client-facing |
| Contract / SOW | After proposal accepted | Client-facing, legal |
| Project brief | After contract signed | Internal + client |
| Onboarding doc | Project kick-off | Client-facing |
| Status report | During delivery, weekly or milestone | Client-facing |
| Invoice | At milestone or project end | Client-facing |
| SOP | For repeatable internal processes | Internal |

**Document creation flow (critical — never skip elicitation):**

```
1. User requests a document type for a deal/client
2. Agent fetches deal + client data from DB
3. Agent identifies what information is present vs. missing
4. Agent asks targeted questions to fill gaps (max 3 questions per turn)
5. Agent presents a draft outline for approval before full generation
6. User approves or requests changes
7. Agent generates full document in markdown
8. Agent offers PDF export and storage
9. Document saved to DB with status = draft, linked to deal
10. Agent asks: "Gửi cho khách không, hay để review thêm?"
```

**Document storage rules:**
- Markdown source always saved (editable later)
- PDF generated on demand, stored in Supabase Storage
- Every save creates a new version — old versions retained
- Documents linked to both client and deal (or standalone if general)
- Status tracked: draft → review → sent → signed/archived

**Naming convention (auto-generated):**
`{ClientName}_{DocumentType}_{YYYY-MM-DD}_v{N}.pdf`

---

### 6.4 Strategy agent

**Responsibility:** High-quality business advice — pricing, positioning, niche expansion, client strategy, handling difficult situations.

**Knowledge domains:**
- B2B service pricing strategy (value-based, project, retainer)
- Sales psychology for agency services
- Niche expansion: when to add services, how to position
- Cold outreach and referral system building
- Proposal and negotiation tactics
- Common pitfalls for small service agencies (scope creep, underpricing, client dependency)
- Automation consulting market positioning
- Vietnamese SME market context

**Invocation triggers:**
- User explicitly asks for strategic advice
- User asks "what should I do" at a business-level (not deal-level)
- Orchestrator detects a pattern across multiple deals suggesting a structural issue
- User asks about expanding to a new niche

**Behavior standards:**
- Always give a specific recommendation, not just options
- Back the recommendation with a reason
- Acknowledge uncertainty when relevant ("Tôi không có đủ thông tin về thị trường cụ thể của anh, nhưng dựa trên những gì tôi biết...")
- Challenge the user if the stated plan has an obvious flaw
- For pricing questions: anchor to value delivered, not cost incurred

**Example interaction:**
```
User: I keep losing deals on price. Should I lower my rates?

ARIA: Almost certainly no — and here's why lowering is likely making it worse.

When clients push back on price, 80% of the time it's a value communication 
problem, not an actual budget problem. If they can't see clearly what they're 
getting and what changes for them after the project, any price feels too high.

Looking at your recent lost deals — Thanh Cong (website, 30M VND) and the 
two unnamed leads in April — all three were lost at proposal stage, not after 
negotiation. That pattern suggests the proposal isn't landing, not that 
you're priced above market.

My recommendation: before your next proposal, do a 20-minute call specifically 
to present the proposal live, not send it cold. Walk them through the outcome 
section first, price last. Conversion rate on presented proposals is typically 
2–3x higher than emailed ones.

Want me to draft a new proposal structure that leads with outcomes?
```

---

### 6.5 Briefing agent

**Responsibility:** Generate the daily business briefing — proactive, unsolicited, delivered each morning.

**Run schedule:** Every day at 7:00 AM (user's timezone), triggered by Vercel Cron.

**Model used:** Claude Haiku 4.5 (cost-efficient — this runs daily with no user interaction needed)

**Briefing structure (always this order):**

```markdown
## Chào buổi sáng — {date}

### Cần xử lý hôm nay
[Max 3 items, ranked by urgency. Specific action required.]

### Pipeline snapshot
[Deals with activity due or overdue. Stage + days stuck + recommended action.]

### Documents pending
[Any docs in draft/review status. Any docs that should exist but don't.]

### This week's focus
[One strategic note — e.g. "You have 3 deals in proposal stage simultaneously. 
Follow up on all three before Friday or momentum drops."]

### Slow-moving deals
[Deals with no activity > 7 days.]
```

**Briefing generation logic:**
1. Query all active deals — check last activity date, stage, next_action_due
2. Query all documents in draft or review
3. Query activity log for past 24h — what changed
4. Detect: stale deals, overdue actions, deals with no proposal doc, deals that should have moved stages
5. Generate briefing in the user's dominant language for that day (default: Vietnamese in morning)
6. Cache result in `briefings` table — serve cached version until next day's cron

**Briefing delivery:**
- Shown automatically when user opens the app (pulled from cache)
- Also accessible via chat: "Cho tôi xem briefing hôm nay"
- Notification badge on app icon if there are high-urgency items

---

### 6.6 Deal Intelligence Engine

**Responsibility:** Deep contextual analysis of any deal — new or ongoing — synthesizing client signals, deal patterns, domain knowledge, and strategic judgment into actionable consulting output.

This is distinct from the Sales agent (§6.2), which handles pipeline operations. The Deal Intelligence Engine is invoked when you need ARIA to *think* about a deal, not just report on it.

---

**When it activates:**

The orchestrator routes to the Deal Intelligence Engine when it detects any of these patterns in your message:
- You describe a new client or opportunity you've just encountered
- You ask how to approach, handle, or think about a specific deal
- You ask what documents you need for a deal
- You ask ARIA to predict, evaluate, or give a read on a deal
- You describe a problem or complication within an ongoing deal
- You ask "what should I do with this client"

It does not require you to use specific words. If you paste notes from a client call and say "what do you think?", the engine activates.

---

**The four-layer synthesis model:**

Every Deal Intelligence response is built from four layers, assembled in this order:

**Layer 1 — Client context** (from CRM)
- Full client profile: industry, company size, relationship stage, communication style
- History: all past deals with this client, outcomes, any friction points
- Known hesitations and behavioral patterns (AI-maintained field)
- If new client with no CRM record: ARIA creates a stub record and notes what's known so far

**Layer 2 — Pattern matching** (from deal history)
- Pull `similar_deals` — deals with same service type and/or same industry
- What was the outcome? What stage did they stall at? What objections came up?
- What documents moved those deals forward?
- ARIA explicitly states when it is reasoning from pattern ("Based on your last 3 F&B website deals...")
- If no similar deals exist yet: ARIA reasons from general domain knowledge and states this clearly

**Layer 3 — Deal-specific analysis** (from stated context)
- What did the client say they want (`client_stated_need`)?
- What do they probably actually want (`inferred_real_need`)? — these are often different
- What are the risk flags in this deal? (vague scope, price sensitivity, unclear decision-maker, tight timeline)
- What are the opportunity signals? (expansion potential, referral relationship, long-term engagement possible)
- What is ARIA's predicted outcome and why?

**Layer 4 — Domain knowledge** (from training + business context)
- What does ARIA know about clients in this industry? (e.g. F&B clients typically have seasonal cash flow pressure, often have a non-technical owner making decisions, tend to underestimate content work)
- What are the common failure modes for this type of project?
- What sales approach works best given the client's relationship stage and communication style?
- What pricing strategy fits this deal?

---

**Output structure for a Deal Intelligence response:**

```
## ARIA's read on [Deal/Client name]

### What I understand so far
[Synthesis of what's known — client context, stated need, deal details]

### What they probably actually need
[Inferred real need — often different from stated. Explain the gap.]

### Risk flags
[Specific risks with severity — e.g. "Scope is vague: HIGH — no technical brief yet,
client mentioned 'just a simple website' which historically signals scope creep"]

### Opportunity signals
[What makes this deal worth pursuing and/or what's the upside beyond the immediate project]

### My prediction
[likely_win / uncertain / at_risk / likely_lost — with reasoning]

### Recommended approach
[Specific tactical advice: what to say, what to probe, what to avoid]

### Documents you need at this stage
[Ordered list — what exists, what's missing, what to create next]

### Next action
[Single most important thing to do in the next 24–48 hours]
```

Not every section appears in every response — ARIA uses judgment. A brand new lead with two sentences of context gets a shorter read than an ongoing deal with a full history. The structure is a thinking framework, not a rigid template.

---

**Handling new deals mentioned mid-conversation:**

When you describe a deal that doesn't exist in the CRM yet, ARIA:
1. Immediately begins reasoning from what you've told it
2. Creates a CRM stub record in the background (client + deal with available fields)
3. Tells you it has created the record
4. Asks 1–2 targeted questions to fill the most critical missing fields
5. Does not ask for exhaustive data entry — it fills gaps as the conversation progresses

This means you never need to "add a client to the CRM" manually. Mentioning them is enough.

---

**Updating intelligence fields over time:**

After every Deal Intelligence session, ARIA updates the following fields in the DB without being asked:
- `inferred_real_need` — refined based on new information
- `risk_flags` — new flags added or severity updated
- `opportunity_signals` — new signals noted
- `predicted_outcome` + `prediction_reason` — updated if the read has changed
- `client.communication_style` — updated if new behavioral signals emerged
- `client.known_hesitations` — updated if new hesitations surfaced

This means ARIA gets smarter about each client over time, without you doing any data maintenance.

---

**Model used:** Claude Sonnet 4.6 always — this is the highest-judgment task in the system. Never route Deal Intelligence to Haiku.

---

**Full example interaction:**

```
User: Hôm nay tôi gặp một khách hàng mới. Họ có một chuỗi quán cà phê 3 chi 
nhánh ở TP.HCM. Muốn làm website và họ cũng đề cập đến việc muốn "tự động hóa 
order và quản lý nhân sự". Họ có vẻ hào hứng nhưng chưa rõ ngân sách. Tôi 
nên tiếp cận thế nào?

ARIA: Đây là deal thú vị — để tôi phân tích.

**Họ thực sự cần gì**
Họ nói muốn website và automation, nhưng với chuỗi F&B 3 chi nhánh, vấn đề 
thật sự thường là: thiếu visibility về hoạt động, khó quản lý nhân sự từ xa, 
và order thủ công gây sai sót. Website chỉ là phần nhìn thấy được — automation 
ops là phần họ thực sự đau.

**Rủi ro cần lưu ý**
- Ngân sách chưa rõ: CAO — "automation" có thể từ 30M đến 300M VND tùy scope
- "Muốn tự động hóa order và nhân sự" quá rộng: CẦN thu hẹp ngay trong buổi 
  discovery, nếu không sẽ scope creep nghiêm trọng
- Chuỗi 3 chi nhánh: có thể có nhiều người ra quyết định (owner + từng manager)
  — cần xác định ai là người quyết định cuối

**Tín hiệu tốt**
- 3 chi nhánh = ngân sách thực sự nếu họ đang mở rộng
- "Automation" = họ đã nhận ra họ có vấn đề vận hành — đây là khách hàng 
  lý tưởng cho automation consulting, không chỉ web
- Nếu làm tốt: đây có thể là long-term engagement (website + automation + support)

**Dự đoán của tôi: Uncertain → có thể là Win lớn**
Phụ thuộc vào ngân sách thực và ai ra quyết định. Tiềm năng cao nhưng cần 
qualify kỹ trong buổi tiếp theo.

**Cách tiếp cận đề xuất**
Đừng pitch gì trong lần gặp tiếp theo. Thay vào đó, làm một buổi "pain mapping" 
30 phút: hỏi họ mô tả một ngày hoạt động bình thường — order, nhân sự, báo cáo 
— và để họ tự nói ra vấn đề. Sau đó bạn phản chiếu lại những gì nghe được và 
hỏi "Nếu giải quyết được 3 vấn đề này, nó trị giá bao nhiêu với anh/chị?"

**Documents cần ở giai đoạn này**
- Chưa cần document nào — còn quá sớm
- Sau buổi pain mapping: tạo một Discovery Summary nội bộ để ghi lại những 
  gì học được
- Sau đó mới đến: Solution Design Brief → Proposal

**Bước tiếp theo ngay bây giờ**
Đặt lịch buổi discovery call trong 3–5 ngày tới. Tôi vừa tạo client stub và 
deal trong CRM. Anh có thể cho tôi thêm tên và số điện thoại của họ không?
```

---

### 7.1 Layout

```
┌────────────────────────────────────────────────────┐
│  ARIA                              [notification]  │
├──────────┬─────────────────────────────────────────┤
│          │                                         │
│  Nav     │         Main panel                      │
│          │                                         │
│  Chat    │  [Chat thread or Document viewer or      │
│  Briefing│   Briefing panel — context-switched]     │
│  Docs    │                                         │
│  Settings│                                         │
│          │                                         │
├──────────┴───────────────────┬─────────────────────┤
│     Chat input               │  [Send]             │
└──────────────────────────────┴─────────────────────┘
```

Three modes, one layout — the main panel switches context:

- **Chat mode** (default): full conversation thread with ARIA
- **Document mode**: triggered when ARIA creates or retrieves a doc — shows rendered markdown with PDF export button
- **Briefing mode**: triggered on app open if unseen briefing exists

### 7.2 Chat interface requirements

- Markdown rendering in all AI responses (headers, bullets, bold, tables)
- Code blocks rendered cleanly (for any technical content)
- Long responses collapsible after first 400 characters with "read more"
- Typing indicator while AI is generating
- User can interrupt generation (stop button)
- Message timestamps
- Copy button on each AI message
- "Start new topic" button — clears chat context but retains DB state
- Language displayed matches language used (no forced switching)

### 7.3 Document viewer

Triggered automatically when ARIA generates or retrieves a document:

- Renders full markdown document in clean reading layout
- Sidebar shows: document type, status pill, linked deal/client, version number, created date
- Action buttons: Edit (opens inline editor), Export PDF, Change status, View history
- PDF export generates styled PDF with basic branding (logo placeholder, footer)
- "Send to client" flow: copies a shareable link or triggers email draft (Phase 3)

### 7.4 Briefing panel

- Appears as the landing screen when app opens if briefing is unseen
- Can be dismissed — returns to chat
- Each item in briefing is clickable → opens chat with that item pre-queued
- Refresh button (re-runs briefing agent on demand, costs one API call)

### 7.5 Mobile behavior

- Fully responsive — single column on mobile
- Chat is the primary view on mobile
- Briefing delivered as push notification summary (Phase 3)
- Document viewer simplified on mobile — PDF download primary CTA

---

## 8. Cost management strategy

This is a real concern and requires deliberate architecture.

### 8.1 Model routing

| Task | Model | Reason |
|---|---|---|
| Daily briefing generation | Haiku 4.5 | Structured, predictable, runs daily |
| Client/deal queries | Haiku 4.5 | Simple retrieval + formatting |
| Document drafting | Sonnet 4.6 | Needs quality reasoning and writing |
| Strategic advice | Sonnet 4.6 | Needs nuanced judgment |
| Deal intelligence analysis | Sonnet 4.6 | Highest-judgment task — never use Haiku |
| Pipeline status checks | Haiku 4.5 | Structured output, no creativity needed |
| Elicitation (doc gathering) | Haiku 4.5 | Conversational, low stakes |
| CRM stub creation | Haiku 4.5 | Structured extraction from conversation |

Estimated token costs at normal usage (10–20 interactions/day):
- Haiku: ~$0.25/M input, ~$1.25/M output → ~$3–8/month
- Sonnet: ~$3/M input, ~$15/M output → ~$10–25/month
- **Total estimate: $15–35/month at daily active use**

### 8.2 Caching rules

- Daily briefing cached after generation — never regenerated within same day unless manually triggered
- Client/deal data cached in session — re-fetched only when data might have changed (after any write operation)
- Document content never cached (always fresh from DB)

### 8.3 Context window discipline

Business context injected at session start is kept under 2,000 tokens (the "living document" — not a full data dump). Actual CRM data is fetched via tool calls only when needed, not pre-loaded.

### 8.4 What never hits the API

- Navigation actions
- Document PDF export
- Filtering/searching in DB
- Any UI state changes

---

## 9. Business context document (living document)

Injected into every session. Maintained by both you and ARIA. Stored in DB, editable via Settings.

**Template:**

```markdown
## Business overview
Agency name: [name]
Owner: [name]
Team: [N] contractors — [brief description of who does what]
Primary services: Web design, web/app builds, automation consulting
Target clients: [description — e.g. Vietnamese SMEs, regional F&B brands]
Pricing range: [e.g. 20M–200M VND per project]
Primary markets: [cities/regions]

## Current focus
Active niches: [e.g. F&B, retail, professional services]
Expanding into: [e.g. process automation for SMEs]
Current capacity: [projects being handled simultaneously]

## Sales approach
Lead sources: Cold outreach (LinkedIn, Zalo), referrals
Avg deal cycle: [e.g. 2–4 weeks from lead to contract]
Common objections: [e.g. price, timeline, trust]

## Operating rules for ARIA
- Always present prices in VND unless client is international
- Default document language: Vietnamese unless client is English-speaking
- Escalate to human decision: contracts over 100M VND, scope changes after contract
- Never commit to timelines without checking team capacity first
- Proposal follow-up cadence: 3 days, then 7 days, then close/archive
```

---

## 10. Phase build plan

### Phase 1 — The brain (zero code)

**Goal:** Get the consultant working today. Learn what you actually ask before building the UI for it.

**Deliverables:**
- [ ] Finalized system prompt (consultant persona, rules, bilingual behavior)
- [ ] Business context document (first version, maintained in Notion or Google Doc)
- [ ] Configured Claude.ai Project with system prompt + context doc attached
- [ ] 5 document templates in markdown: proposal, contract, project brief, onboarding, status report
- [ ] Pipeline stage definitions per service type documented

**Success criteria:** You use it daily for 5+ days and identify which interactions feel clunky or missing — these become Phase 2 priorities.


---

### Phase 2 — The workspace 

**Goal:** Replace the Google Doc context with a real DB. Add CRM, document vault, and briefing panel.

**Deliverables:**
- [ ] Next.js app scaffolded and deployed on Vercel
- [ ] Supabase project: schema from §5 created, Row Level Security enabled
- [ ] Orchestrator + tool definitions (get_client, get_deal, list_deals, update_deal, get_document, create_document, log_activity)
- [ ] Chat interface with markdown rendering
- [ ] Briefing agent + Vercel Cron job (7AM daily)
- [ ] Document viewer with PDF export
- [ ] Manual CRM entry form (simple — for loading existing clients)
- [ ] Business context document moved into DB (editable in Settings)
- [ ] Basic auth (email login)

**Agent behavior in Phase 2:**
- Sales agent: query + stage update + next action recommendation
- Doc agent: create, store, retrieve, version
- Briefing agent: daily automated run
- Strategy agent: invoked via orchestrator when intent classified as strategic

**Not in Phase 2:**
- Team access / multi-user
- Email/calendar integration
- RAG over document library
- Mobile push notifications


---

### Phase 3 — The team (build what Phase 2 proves you need)

**Build based on Phase 2 evidence. Likely candidates:**

- [ ] Team member accounts with role-based access (view assigned projects only)
- [ ] RAG over growing document library (LlamaIndex or pgvector in Supabase)
- [ ] Email integration: Gmail/Outlook — log email activity automatically to deal
- [ ] Proposal auto-send flow with tracking (opened/not opened)
- [ ] Invoice generation + payment status tracking
- [ ] Analytics view: revenue by niche, win rate by service type, avg deal cycle
- [ ] Mobile push notifications for briefing
- [ ] n8n automation: new lead from form → auto-creates client + deal in CRM
- [ ] Niche module: automation consulting-specific pipeline + document templates
- [ ] Multi-language document generation (AI selects VI or EN per client preference)

**Phase 3 readiness criteria (from Phase 2 usage):**
- You have 10+ clients in the CRM
- You are generating 2+ documents per week via ARIA
- You have identified a recurring task that still requires manual work
- Team members are asking to see project status

---

## 11. Document templates (starter set)

These are loaded into the system as defaults. ARIA uses them as scaffolds when drafting.

### 11.1 Proposal template structure
```
1. Understanding your situation [1 paragraph — what the client told you]
2. What we will deliver [specific, measurable outcomes — not tasks]
3. How we work [brief process overview, 3–4 steps]
4. Timeline [milestone-based, not hour-based]
5. Investment [price, what's included, what's not]
6. Next step [single clear CTA]
```

### 11.2 Contract / SOW minimum fields
```
- Parties (legal names)
- Scope of work (referenced from proposal)
- Deliverables (specific list)
- Timeline and milestones
- Payment schedule (deposit, milestone, final)
- Revision policy (N rounds included)
- IP ownership transfer clause
- Termination clause
- Governing law
```

### 11.3 Project brief minimum fields
```
- Project summary (1 paragraph)
- Client goals (3–5 bullets)
- Target audience
- Technical requirements
- Design references / constraints
- Content responsibilities (who provides what)
- Timeline with owner per milestone
- Communication cadence
```

---

## 12. Open questions (to resolve in Phase 1)

These require real usage to answer well — defer until Phase 1 testing:

1. **Pipeline stage naming:** Define exact stage labels per service type based on real deals you've run.
2. **Proposal pricing display:** Should proposals show itemized breakdown or single project price? Depends on client type.
3. **Follow-up cadence:** 3 days / 7 days is a default — validate this matches your actual sales rhythm.
4. **Team visibility in Phase 3:** What exactly should a contractor see? Only their active project, or also pipeline?
5. **CRM migration:** Do you have existing client records in any format (spreadsheet, notes app)? If yes, plan a one-time import script before Phase 2 launch.
6. **PDF branding:** Need logo + color palette for document export headers. Collect before Phase 2.
7. **Notification channel:** Where do you want morning briefing — in-app only, Zalo, or email?

---

## 13. What ARIA is not

To keep scope honest:

- Not a project management tool (no task boards, no time tracking)
- Not an accounting system (no P&L, no tax handling)
- Not a client-facing portal (clients don't log in)
- Not a team chat tool
- Not a replacement for legal review on contracts
- Not autonomous — it recommends and drafts, you approve and send

---

*End of PRD v1.1 — built for a bilingual, solo-led service agency scaling from web/apps into automation consulting.*
*v1.1 additions: Deal Intelligence Engine (§6.6), five-layer interaction model, enriched Client + Deal data models with intelligence fields, new CRM tool calls.*
*Next action: Begin Phase 1 — write the system prompt together.*
