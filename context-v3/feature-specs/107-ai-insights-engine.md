# 107 - AI Business Insights Engine

> Feature-spec file number 107 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 5 — Growth Features**,
> tracker item **#98 AI Insights Engine**.
>
> Depends On: Reporting Engine (v2); Dashboard (v2 spec 85).
>
> ⚠️ OPEN QUESTION: The AI provider (Ollama local vs. OpenAI cloud) must be decided
> before implementation begins. See `context-v3/progress-tracker.md` Open Questions.

## Goal

Add an AI-powered business insights panel to the Dashboard and Financial Reports that
generates natural-language summaries of the business's financial and operational data.

Examples of insights the engine should produce:

- "Your top 5 slow-moving products this quarter: [list]"
- "Receivables are 23% higher than last month — top 3 overdue customers: [list]"
- "GST liability forecast for this quarter based on current month sales: ₹X"
- "Average invoice value dropped 12% in October — likely cause: [analysis]"

The AI engine reads **only from existing reporting queries** — it never accesses raw
financial data directly. It calls the same service functions that the Dashboard and
Reports pages already use.

---

## Project Context

Read before implementation:

1. `context-v3/architecture-context.md` — AI-ready architecture and `--accent-ai` tokens.
2. `context-v3/ui-context.md` — AI Insights Panel section.
3. `context-v3/progress-tracker.md` — Open Questions: AI provider choice.
4. `src/engines/reporting/` — the reporting engine functions that are the data source.

---

## Module Responsibilities

- `AIInsightsEngine` (`src/engines/ai-insights/`) — prompt builder + LLM client
  wrapper; pure; reads from reporting services, produces structured `Insight[]` objects
- `insightsService` — orchestrates: fetch reporting data → build prompt → call LLM →
  parse and validate response → return `Insight[]`
- `InsightsPanel` React component — renders insights on Dashboard and Reports pages
- `CompanySettings` — AI provider configuration (provider, API key or Ollama URL)
- Caching: insights are cached for 1 hour per company (in-memory or Redis-optional)

---

## Data Model

```prisma
// Add to CompanySettings:
  aiInsightsEnabled  Boolean @default(false)
  aiProvider         String?  // "ollama" | "openai"
  aiApiKey           Bytes?   // encrypted (spec 101)
  aiEndpointUrl      String?  // for Ollama: "http://localhost:11434"
  aiModelName        String?  // e.g. "llama3.2" or "gpt-4o-mini"
```

No business data is stored — insights are generated on demand and cached in memory.

---

## Insight Types

```typescript
interface Insight {
  id: string;
  type: "SALES" | "PURCHASE" | "INVENTORY" | "RECEIVABLES" | "PAYABLES" | "GST";
  title: string;         // Short heading
  summary: string;       // 1-2 sentence AI-generated summary
  dataPoints: Array<{    // The structured data the AI used — shown as context
    label: string;
    value: string;
  }>;
  generatedAt: Date;
  confidence: "HIGH" | "MEDIUM" | "LOW";  // derived from data completeness
}
```

---

## AI Prompt Architecture

The prompt builder:
1. Fetches structured data from reporting services (never raw SQL).
2. Builds a structured prompt: "Given this financial data for [company], identify [insight type]."
3. Sends to the configured LLM.
4. Parses the response as JSON matching the `Insight` schema.
5. Falls back to a rule-based insight if the LLM response is malformed.

Rule: The prompt must never include customer names, GSTIN, or PAN in the LLM call
(privacy) — use anonymized labels like "Customer A" internally and map back post-response.

---

## Business Rules

1. AI Insights are clearly labeled "AI-generated" — never presented as audit-grade data.
2. If the AI provider is unavailable, the panel shows "Insights unavailable" — never
   blocks the page.
3. Insights are re-generated on demand — never auto-refreshed without user action.
4. The "Powered by AI" label must always be visible alongside any AI-generated content.
5. A Company Admin can disable AI insights without affecting any other feature.

---

## UI

### Dashboard AI Panel
- Collapsible section below the main KPI cards
- Shows 3–5 insights with type icons and confidence badges
- "Refresh Insights" button (re-generates; shows spinner)
- "Setup AI" link shown when not configured

### Reports AI Summary
- Above each report (Trial Balance, P&L, etc.) — a one-paragraph summary of the report
- Same visual treatment as the Dashboard panel

### Company Settings — AI Insights Section
- Provider selector (Ollama / OpenAI)
- API key field (masked; encrypted per spec 101)
- Endpoint URL (for Ollama)
- Model name field
- "Test Connection" button

---

## Security Considerations

- API keys are stored encrypted (spec 101).
- Customer names, GSTIN, and PAN are never sent to external AI providers.
- The OpenAI API call is server-side only — API key is never exposed to the browser.
- Ollama is localhost-only — safer for privacy-sensitive deployments.

---

## Testing Requirements

- Prompt builder test: given known financial data, produces expected prompt structure
- Insight parser test: valid LLM JSON → `Insight[]`; malformed JSON → fallback insight
- Privacy test: prompt content does not include customer PII
- Provider unavailable test: service returns "unavailable" insight, never throws to caller
- Caching test: second call within 1 hour returns cached result without calling LLM
