---
name: mrfl-first-email
description: Generate the canonical "first email" Gloria Grullon (MRFL Transactions, Florida real estate Transaction Coordinator) sends when a new transaction kicks off — the email that goes out once the contract is signed, the property tab is created in the master Google Sheet, and the calendar events are scheduled. Use this skill whenever the user asks to draft, send, compose, or write the "first email," "TC intro email," "kickoff email," "introduction email," "Transaction Summary email," or any initial communication to all parties on a fresh transaction. The output uses a strict format that must be identical every time: greeting with first names only, brief intro paragraph, full property details block, contacts for all parties (listing agent, co-listing if applicable, buyer's agent, co-buyer if applicable, escrow/buyer title, separate seller title if any, loan processor if separate, loan officer), Critical Deadlines markdown table, optional Closing Cost Contributions section with ★ marker, IMPORTANT NOTES footer with two standard bullets, and the standardized signature block. Do NOT use this skill for deadline reminders, status updates, closing day emails, or client-facing emails (those have different formats).
---

# MRFL First Email

This is the standard introductory email Gloria sends to all parties at the start of a new transaction. **Format consistency is non-negotiable** — Gloria has standardized this across many deals, recipients expect to see exactly this structure, and any deviation is a defect.

The email is the first deliverable in the standard 4-pack:
1. **First email (this skill)**
2. Critical Deadlines xlsx
3. Transaction Summary xlsx
4. Realtor and/or buyer email follow-ups (different skills, different formats)

---

## When to use

Trigger this skill when the user asks for:

- "Draft the first email for [property]"
- "Write the TC intro for [property]"
- "Send the kickoff email for [transaction]"
- "Compose the first/initial/Transaction Summary email"
- "I need the introduction email"
- Or similar phrasings around the first/initial/kickoff transaction email

## When NOT to use

Do not use this skill for:

- Deadline reminder emails (different format)
- Status update emails to one party (different format)
- Closing day emails (different format)
- Casual back-and-forth communication
- Emails to the actual buyer or seller (those have a warmer, simpler format)

---

## Required inputs

Before generating, gather these from the property tab in the master Google Sheet "Transactions Important Dates" (or ask the user). Every field below is in the v21 intake form schema.

### Property
- `prop_address` — full address, e.g., "1001 NW 148th St Miami, FL 33168"
- `prop_tax_id` — folio number, digits only
- `purchase_price` — formatted as `$ XXX,XXX.XX` (note the space after `$`)
- `financing_type` — Cash / Conventional / FHA / VA / Other
- `loan_days` — integer (days for loan approval); skip if Cash

### Effective date
- `effective_date` — must be rendered as `Day_name M/D/YYYY`, e.g., "Thursday 4/16/2026"

### Side & primary agent
- `side_represented` — listing / buyer / dual
- `primary_agent_name` — the agent Gloria works for (e.g., "Carlos Brown")

### Sellers
- `sellers` — full legal names IN ALL CAPS, ampersand-separated, e.g., "ORESTE CASH COVIL & TYRONE TERRELL WILLIAMS"

### Listing agent (always include)
- `lst_agent_name`, `lst_agent_lic`, `lst_agent_phone`, `lst_agent_email`
- `lst_brokerage`, `lst_office_addr`, `lst_office_phone`

### Co-listing agent (only if exists)
- `co_lst_name`, `co_lst_lic`, `co_lst_phone`, `co_lst_email`
- `co_lst_brokerage`, `co_lst_office_addr`, `co_lst_office_phone`

### Buyers
- `buyers` — full legal names IN ALL CAPS, ampersand-separated

### Buyer's agent (always include)
- `byr_agent_name`, `byr_agent_lic`, `byr_agent_phone`, `byr_agent_email`
- `byr_brokerage`, `byr_office_addr`, `byr_office_phone`

### Co-buyer agent (only if exists)
- `co_byr_name`, `co_byr_lic`, `co_byr_phone`, `co_byr_email`

### Title — buyer side / escrow agent
- `byr_title_company`, `byr_title_contact`, `byr_title_email`, `byr_title_phone`

### Title — seller side (only if separate from escrow agent)
- `slr_title_company`, `slr_title_contact`, `slr_title_email`, `slr_title_phone`

### Loan processor (only if a separate role is named)
- `lp_company`, `lp_contact`, `lp_email`, `lp_phone`

### Loan officer (skip entirely if Cash)
- `lo_company`, `lo_contact`, `lo_email`, `lo_phone`

### Milestones (all dates rendered as "Day_name, Month DD, YYYY")
- Effective Date — `Day_name, Month DD, YYYY`
- Escrow Due — date, amount (`$X,XXX.XX`), days after Effective
- Inspection Due — date, days after Effective
- Loan Application Due — date, days after Effective (skip if Cash)
- Loan Approval Due — date, days after Effective (skip if Cash)
- Title Commitment — date, days prior to Closing Date
- Closing Date — date

### Closing Cost Contributions (only if any)
- List of `{source, amount, purpose}` entries
- Compute total = sum of all amounts

---

## Output format

The full email body has these sections, **in this order, exactly**:

### 1. Subject line

```
Transaction Summary: [prop_address]
```

Example: `Transaction Summary: 1001 NW 148th St, Miami, FL 33168`

### 2. Recipients

**To** field — depends on which side Gloria represents.

| Gloria represents | To: recipients |
|---|---|
| **LISTING side** | Buyer's Agent, Buyer Title contact, Seller Title contact (if separate), Loan Officer (if financed), Loan Processor (if separate) |
| **BUYER side** | Seller's Agent, Co-Listing Agent (if applicable), Seller Title contact (if separate), Buyer Title contact, Loan Officer (if financed), Loan Processor (if separate) |

**Cc** field:
- The primary agent Gloria works for (always)
- Any co-agent on the same side (if applicable)

### 3. Greeting

```
Hello [first_names],
```

`first_names` = the **first names only** of all `To:` recipients, comma-separated, with Oxford comma + "and" before the last name.

Examples:
- 1 recipient: "Hello Elba,"
- 2 recipients: "Hello Elba and Michelle,"
- 3 recipients: "Hello Elba, Michelle, and Nelta,"
- 4 recipients: "Hello Elba, Michelle, Nelta, and Jose,"

### 4. Intro paragraph

```
I'm Gloria Grullon, Transaction Coordinator for [primary_agent_name]. Please be sure to copy me on all communications from here on out so I can keep everything on track.
```

### 5. Body paragraph

```
You'll find the key contract dates and contact details for everyone involved listed below. Take a quick look when you have a moment and let me know if anything needs to be corrected or updated.
```

### 6. Closing line (BEFORE the details, not after)

```
Looking forward to a smooth closing with you!
```

> **NOTE:** This line goes BEFORE the property details block, not after. The recipient sees a friendly closing-style line, then the structured data dump.

### 7. PROPERTY DETAILS BLOCK — strict format

This is the core consistency requirement. Render exactly as below. Use plain text with key-value pairs (no markdown bold needed — Gmail will render plainly).

```
Property Address: [prop_address]
Property Tax ID: [prop_tax_id]
Purchase Price: $ [purchase_price_amount]
Financing Type: [financing_type] ([loan_days] days)

EFFECTIVE DATE: [Day_name] [M/D/YYYY]

Seller(s): [SELLERS_ALL_CAPS]
Seller's Agent: [lst_agent_name] Lic# [lst_agent_lic]
Agent Phone: [lst_agent_phone]
Agent Email: [lst_agent_email]
Brokerage: [lst_brokerage]
Office Address: [lst_office_addr]
Office Phone: [lst_office_phone]
```

**If co-listing agent exists, append:**
```

Co-Seller's Agent: [co_lst_name] Lic# [co_lst_lic]
Co-Agent Phone: [co_lst_phone]
Co-Agent Email: [co_lst_email]
Co-Brokerage: [co_lst_brokerage]
Co-Brokerage Office Address: [co_lst_office_addr]
Co-Brokerage Office Phone: [co_lst_office_phone]
```

**Then continue with buyers:**
```

Buyer(s): [BUYERS_ALL_CAPS]
Buyer's Agent: [byr_agent_name] Lic# [byr_agent_lic]
Agent Phone: [byr_agent_phone]
Agent Email: [byr_agent_email]
Brokerage: [byr_brokerage]
Office Address: [byr_office_addr]
Office Phone: [byr_office_phone]
```

**If co-buyer agent exists, append:**
```

Co-Buyer's Agent: [co_byr_name] Lic# [co_byr_lic]
Co-Agent Phone: [co_byr_phone]
Co-Agent Email: [co_byr_email]
```

**Always include Escrow Agent / Buyer Title:**
```

Escrow Agent / Buyer Title
Company: [byr_title_company]
Contact: [byr_title_contact]
Email: [byr_title_email]
Phone: [byr_title_phone]
```

**If separate Seller Title exists, append:**
```

Seller Title
Company: [slr_title_company]
Contact: [slr_title_contact]
Email: [slr_title_email]
Phone: [slr_title_phone]
```

**If separate Loan Processor exists, append:**
```

Loan Processor
Company: [lp_company]
Contact: [lp_contact]
Email: [lp_email]
Mobile: [lp_phone]
```

**If financed (not Cash), append Loan Officer:**
```

Loan Officer
Company: [lo_company]
Contact: [lo_contact]
Email: [lo_email]
Mobile: [lo_phone]
```

> **Section header style:** When rendering "Loan Officer", "Loan Processor", "Seller Title", or "Escrow Agent / Buyer Title", these are bare-line headers (no colon, no bold) followed by the four-line key-value block. Match this exactly.

### 8. Standard loan status note

If financed AND Gloria represents listing side, append (note the en-dash):

```

– Please keep Seller and Broker fully informed about the status of the buyer's mortgage loan application, loan processing, appraisal, and loan approval including property related conditions of loan approval.
```

### 9. CRITICAL DEADLINES table

Render as a markdown table. Empty cells use em-dash (`—`), pending status uses empty checkbox (`☐`), Effective Date and Closing Date are bolded:

```
CRITICAL DEADLINES

| Milestone | Deadline | Status | Amount | Timeframe |
|-----------|----------|:------:|--------|-----------|
| **Effective Date** | [Day_name], [Month DD, YYYY] | — |  | *Contract Start* |
| Escrow Due | [Day_name], [Month DD, YYYY] | ☐ | $[X,XXX.XX] | *[N] days* |
| Inspection Due | [Day_name], [Month DD, YYYY] | ☐ | — | *[N] days* |
| Loan Application Due | [Day_name], [Month DD, YYYY] | ☐ | — | *[N] days* |
| Loan Approval Due | [Day_name], [Month DD, YYYY] | ☐ | [FINANCING_TYPE] | *[N] days* |
| Title Commitment | [Day_name], [Month DD, YYYY] | ☐ | — | *[N] days prior to CD* |
| **Closing Date** | [Day_name], [Month DD, YYYY] | — |  | *Contract End* |
```

**Conventions:**
- Bold Effective Date and Closing Date rows
- Status column is centered (`:------:` alignment)
- Status `—` (em dash) for the Effective Date and Closing Date rows; `☐` (empty checkbox) for actionable milestones
- Amount column shows the dollar amount for Escrow ($X,XXX.XX), the FINANCING_TYPE in caps for Loan Approval (e.g., "CONVENTIONAL"), and `—` otherwise
- Timeframe column uses italic (`*...*`): "Contract Start" / "Contract End" for anchors, "N days" for milestones counted from Effective Date, "N days prior to CD" for Title Commitment
- For Cash deals, omit the Loan Application and Loan Approval rows entirely

### 10. CLOSING COST CONTRIBUTIONS (only if any exist)

```
★ CLOSING COST CONTRIBUTIONS — TOTAL CREDIT TO BUYER: $[total]

| Source | Amount | Purpose |
|--------|--------|---------|
| Seller Contribution | $[amount] | Toward buyer's closing costs and/or prepaids |
| Buyer's Agent Contribution ([agent_name]) | $[amount] | Toward buyer's closing costs |
| Additional Seller Contribution | $[amount] | Toward buyer's closing costs and/or prepaids |
```

**Conventions:**
- ★ (black star) is the visual marker — use it exactly
- TOTAL is the sum of all individual contributions
- "Source" lists who's giving the credit (Seller, Buyer's Agent, etc.)
- "Purpose" describes what the credit is for, lowercase, parallel phrasing

If no concessions/contributions, omit this entire section.

### 11. IMPORTANT NOTES footer

Always present, exactly as written, with bullet character `•`:

```
IMPORTANT NOTES
• All deadlines are calculated from the Effective Date unless otherwise noted (CD = Closing Date).
• Any deadline that falls on a Saturday, Sunday, or national legal holiday shall extend to 5:00 PM of the next business day.
```

### 12. Signature block

```
Gloria Grullon
Transaction Coordinator | MRFL Transactions
📞 401.282.8414
✉ MRFLTransactions@gmail.com
```

---

## Working example (canonical)

This is the actual email Gloria sent for **1001 NW 148th St, Miami, FL 33168** (Carlos Brown's listing, Gloria represents listing side, Conventional financing, with closing cost contributions). Use this as the gold standard reference.

**To:** elba.sellsmiami@gmail.com, info@title2you.com, Nelta@TitleExpertsfl.com, jose.haro@citi.com
**Cc:** carlosbrown@keyes.com, linda@onemegalopolis.com
**Subject:** Transaction Summary: 1001 NW 148th St, Miami, FL 33168

---

Hello Elba, Michelle, Nelta, and Jose,

I'm Gloria Grullon, Transaction Coordinator for Carlos Brown. Please be sure to copy me on all communications from here on out so I can keep everything on track.

You'll find the key contract dates and contact details for everyone involved listed below. Take a quick look when you have a moment and let me know if anything needs to be corrected or updated.

Looking forward to a smooth closing with you!

Property Address: 1001 NW 148th St Miami, FL 33168
Property Tax ID: 3021230011220
Purchase Price: $ 580,000.00
Financing Type: Conventional (21 days)

EFFECTIVE DATE: Thursday 4/16/2026

Seller(s): ORESTE CASH COVIL & TYRONE TERRELL WILLIAMS
Seller's Agent: Carlos Brown Lic# 3257719
Agent Phone: 305.778.8257
Agent Email: carlosbrown@keyes.com
Brokerage: The Keyes Company
Office Address: 2822 NE 187th St Aventura, FL 33180
Office Phone: 305.931.8920

Co-Seller's Agent: Linda Julien Lic# 3296601
Co-Agent Phone: 305.469.5039
Co-Agent Email: linda@onemegalopolis.com
Co-Brokerage: Megalopolis, LLC
Co-Brokerage Office Address: 1801 NE 123 St Ste 314 North Miami, FL 33181
Co-Brokerage Office Phone: 786.258.4848

Buyer(s): RENATO ROJAS & KATHLEEN RIOS
Buyer's Agent: Elba Rojas Lic# 3649544
Agent Phone: 786.525.8808
Agent Email: elba.sellsmiami@gmail.com
Brokerage: Real Estate Sales Force
Office Address: 814 Ponce De Leon Blvd Coral Gables, FL 33134
Office Phone: 305.392.1497

Escrow Agent / Buyer Title
Company: Title 2 You, LLC
Contact: Michelle Becerra
Email: info@title2you.com
Phone: 786.762.4179

Seller Title
Company: Title Experts of SFL & Escrow Services, LLC
Contact: Nelta M. Monde
Email: Nelta@TitleExpertsfl.com
Phone: 954.505.4966

Loan Processor
Company: Citi Bank
Contact: Yuleisy Martinez
Email: Yuleisy.martinez@citi.com
Mobile: 734.295.5295

Loan Officer
Company: Citi Bank
Contact: Jose Haro
Email: jose.haro@citi.com
Mobile: 972.655.0582

– Please keep Seller and Broker fully informed about the status of the buyer's mortgage loan application, loan processing, appraisal, and loan approval including property related conditions of loan approval.

CRITICAL DEADLINES

| Milestone | Deadline | Status | Amount | Timeframe |
|-----------|----------|:------:|--------|-----------|
| **Effective Date** | Thursday, April 16, 2026 | — |  | *Contract Start* |
| Escrow Due | Sunday, April 19, 2026 | ☐ | $3,000.00 | *3 days* |
| Inspection Due | Thursday, April 23, 2026 | ☐ | — | *7 days* |
| Loan Application Due | Tuesday, April 21, 2026 | ☐ | — | *5 days* |
| Loan Approval Due | Thursday, May 7, 2026 | ☐ | CONVENTIONAL | *21 days* |
| Title Commitment | Sunday, May 17, 2026 | ☐ | — | *15 days prior to CD* |
| **Closing Date** | Monday, June 1, 2026 | — |  | *Contract End* |

★ CLOSING COST CONTRIBUTIONS — TOTAL CREDIT TO BUYER: $16,000.00

| Source | Amount | Purpose |
|--------|--------|---------|
| Seller Contribution | $10,000.00 | Toward buyer's closing costs and/or prepaids |
| Buyer's Agent Contribution (Elba Rojas) | $5,000.00 | Toward buyer's closing costs |
| Additional Seller Contribution | $1,000.00 | Toward buyer's closing costs and/or prepaids |

IMPORTANT NOTES
• All deadlines are calculated from the Effective Date unless otherwise noted (CD = Closing Date).
• Any deadline that falls on a Saturday, Sunday, or national legal holiday shall extend to 5:00 PM of the next business day.

Gloria Grullon
Transaction Coordinator | MRFL Transactions
📞 401.282.8414
✉ MRFLTransactions@gmail.com

---

## Format variations

### Cash transaction (no financing)

- Skip Loan Officer section entirely
- Skip Loan Processor section entirely
- Skip the standard loan status note ("– Please keep Seller and Broker fully informed...")
- In Critical Deadlines table, omit Loan Application Due and Loan Approval Due rows
- `Financing Type:` line reads `Financing Type: Cash`

### Single title company (no separate seller title)

- Render as `Escrow Agent / Buyer Title` only
- Skip the entire "Seller Title" section

### No co-agents

- Skip the Co-Seller's Agent block
- Skip the Co-Buyer's Agent block

### No closing cost contributions

- Skip the entire `★ CLOSING COST CONTRIBUTIONS` section
- Go directly from CRITICAL DEADLINES table to IMPORTANT NOTES footer

### Buyer-side representation (Gloria works for buyer's agent)

- Intro reads: "I'm Gloria Grullon, Transaction Coordinator for [buyer_agent_name]."
- Recipient list flips: To: includes Listing Agent + Co-Listing (if any) + Title contacts + LO/LP
- Cc: primary buyer's agent + co-buyer's agent (if any)
- Standard loan note may be omitted or replaced with a buyer-side equivalent (verify with Gloria — current default: omit)

### Dual agency

- Both sides handled by same agent
- Recipients are still the title contact and loan officer
- Intro reads: "I'm Gloria Grullon, Transaction Coordinator for [agent_name]."

---

## Output handling

When the user requests this email, generate the full content as **plain text + markdown** so it can be:

1. **Copied directly into a Gmail compose window** — Gmail interprets markdown tables and bullets reasonably well
2. **Pasted into the email composer artifact** (intake/intake-form.html embeds an HTML version)
3. **Used as a reference** by the user reviewing format consistency

If the user asks for HTML formatting (e.g., for the email composer artifact), convert:
- Markdown tables → `<table>` with inline styles using MRFL brand colors (`#312E81` header, alternating `#FFFFFF` / `#FAFAF7` rows, `#FEF2F2` for any urgent/highlighted row)
- Bold (`**...**`) → `<strong>`
- Italic (`*...*`) → `<em>`
- Bullet `•` → `<li>` inside `<ul>`
- Newlines → `<br>` or `<p>` boundaries appropriately
- Preserve the ★ character and ☐ character as-is

---

## Common mistakes to avoid

1. **Don't full-name in the greeting.** "Hello Elba Rojas" is wrong; "Hello Elba" is right. First names only.
2. **Don't skip the Cc.** The primary agent Gloria works for must be Cc'd so they see the email goes out.
3. **Don't reorder sections.** Recipients expect Property Details → Parties → Title → Loan info → Critical Deadlines → Concessions → Important Notes → Signature, in that order.
4. **Don't add extra sections.** No "What to Expect," no "Timeline Overview" — those are warmer formats for client-facing emails.
5. **Don't change the IMPORTANT NOTES wording.** It's been crafted; preserve it exactly.
6. **Don't use a different signature.** It's the standard MRFL block — Name, Title | Brand, Phone, Email.
7. **Don't include emojis in section headers** of the property details block. They should remain plain.
8. **Don't omit the loan status note** when on the listing side and there's financing. It's a standard expectation.

---

## Skill metadata

- **Owner:** Gloria Grullon (MRFL Transactions)
- **First codified:** 2026-05-07
- **Reference example:** 1001 NW 148th St Miami, FL 33168 (Carlos Brown listing)
- **Related skills:** mrfl-deadline-reminder (TBD), mrfl-status-update (TBD), mrfl-closing-day (TBD)
- **Related deliverables:** Critical_Deadlines_*.xlsx, Transaction_Summary_*.xlsx (built by `deliverables/build_portfolio.py` and `deliverables/build_pdfs.py`)
- **Related documentation:** `docs/ARCHITECTURE.md`, `docs/CLAUDE_PROJECT_SETUP.md`, `docs/PDF_EXTRACTION_FEATURE_SPEC.md`
