# AI Safe Skills, Reasoning, and RAG Hardening Plan

Status: research and implementation plan  
Scope: `../ai-safe` backend plus LibreChat client integration points

## Executive Summary

The current backend has useful building blocks, but they are not yet wired as one industry-grade LLM flow.

- Fuzzy matching and typo handling are improved for safe-document prompt projection, but they are not "perfect" or production-grade until covered by measurable regression evals.
- RAG indexing is designed to embed anonymized safe-document text, and the frontend file flow should only send anonymized safe file ids into chat.
- Existing backend tools (`sql_agent`, `search_docs`) are exposed through `/mdp/ai-safe/agent/chat`, but they are not embedded into the normal `/mdp/ai-safe/chat` flow.
- The normal chat flow currently uses Azure OpenAI Chat Completions through `OpenAIService.send_chat`; it does not expose a first-class skill registry, strict tool schemas, tool-choice enforcement, or reasoning-mode controls.
- The best path is to add a provider-neutral `SkillRegistry` and `SkillOrchestrator` between anonymization/RAG preparation and the final LLM call.

## Current Backend Audit

### Safe Chat Flow

Current path:

```text
client
  -> /mdp/ai-safe/anonymize
  -> /mdp/ai-safe/chat
  -> ChatService.send_prompt(...)
  -> LLMServiceFactory.get_llm_service(llm_type)
  -> OpenAIService.send_chat(...)
  -> deanonymize response
```

Key files:

- `../ai-safe/src/services/chat_service.py`
- `../ai-safe/src/services/LLMs/openai_service.py`
- `../ai-safe/src/services/llm_service_factory.py`
- `../ai-safe/src/services/replacement_service.py`

The safe chat flow already performs anonymization before sending text to the LLM, then replaces anonymized values back in the response. That is the right privacy boundary.

### File and RAG Flow

Current safe-document path:

```text
/mdp/ai-safe/anonymize-file
  -> FileService.create_safe_chat_file(...)
  -> FileService.build_anonymized_file(...)
  -> store_safe_chat_document(safe_doc_id, safe_text, pii_summary, ...)
  -> index_safe_chat_document(safe_doc_id)
  -> embedding_service.index_document(doc_id, filename, text, org_id, ...)
```

Key files:

- `../ai-safe/src/services/file_service.py`
- `../ai-safe/src/services/safe_chat_document_store.py`
- `../ai-safe/src/services/embedding_service.py`

The backend embeds the text passed into `store_safe_chat_document`, and that text is derived from anonymized text or from `ReplacementService.replace_entities(raw_text, detected, anonymized)`. This is the correct intent.

Required guardrail:

- The client must not upload raw files to the LLM provider before safe-file creation.
- Chat must only pass `safeDocId` values returned by `/anonymize-file`.
- RAG retrieval must never fall back to raw file ids or raw extracted text.

### Fuzzy Matching and Typo Handling

Current matching logic:

- `chat_service.py` uses `difflib.SequenceMatcher`.
- `_apply_conservative_fuzzy_doc_mapping(...)` only applies fuzzy mapping for `Names` and `Organization`.
- `_bounded_edit_distance(...)` allows small token edits.
- `_score_entity_token_match(...)` requires conservative thresholds and avoids ambiguous replacement.

This is a good conservative patch for safe-document prompt projection. It is not industry-scale yet because:

- There is no dedicated fuzzy library such as RapidFuzz.
- There are no measured thresholds from a regression set.
- OCR noise, German umlauts, transliteration, swapped token order, missing middle names, hyphenation, and multi-entity collisions are not fully covered.
- There is no confidence trace per replacement.
- There is no eval gate that blocks releases when typo behavior regresses.

Recommendation: do not call this "perfect." Call it "conservative and safer than broad fuzzy replacement" until evals prove quality.

### Existing Tools

Current tool path:

```text
/mdp/ai-safe/agent/chat
  -> agent_service.ask(...)
  -> ToolRegistry
  -> sql_agent / search_docs
```

Key files:

- `../ai-safe/src/controllers/agent_controller.py`
- `../ai-safe/src/tools/agent_service.py`
- `../ai-safe/src/tools/tool_registry.py`
- `../ai-safe/src/tools/sql_agent`
- `../ai-safe/src/tools/search_docs`

These tools are useful but currently separate from the normal AI Safe chat flow. The model in normal chat cannot "choose" these tools because `ChatService.send_prompt(...)` never passes tools to `OpenAIService.send_chat(...)`.

## External Research Notes

Official OpenAI guidance supports this direction:

- Function calling lets models call application-provided tools with structured arguments.
- `tool_choice` can force required tool use or force one specific function.
- Strict schemas should be enabled for reliable function arguments.
- Structured Outputs are appropriate when the final model response must match a schema.
- Reasoning models perform better through the Responses API than legacy chat flows.
- Agent workflows should be measured with evals, traces, and datasets.

Sources:

- OpenAI Function Calling: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI Reasoning Models: https://developers.openai.com/api/docs/guides/reasoning
- OpenAI Streaming Responses: https://developers.openai.com/api/docs/guides/streaming-responses
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI Agent Evals: https://developers.openai.com/api/docs/guides/agent-evals
- OpenAI Responses Migration: https://developers.openai.com/api/docs/guides/migrate-to-responses
- LangChain Structured Output: https://docs.langchain.com/oss/python/langchain/structured-output
- LangChain Tools: https://docs.langchain.com/oss/python/langchain/tools
- Pandoc User Guide: https://pandoc.org/MANUAL.html
- python-docx-template: https://docxtpl.readthedocs.io/en/stable/

## Target Architecture

Add a skill layer inside the normal AI Safe chat flow:

```text
Client
  -> anonymize prompt/file
  -> ChatService.send_prompt(...)
       1. validate language and privacy options
       2. build anonymized prompt
       3. attach safe RAG context
       4. SkillOrchestrator.plan(...)
       5. execute required skill calls
       6. call LLM with skill results and reasoning policy
       7. validate final response
       8. deanonymize response
  -> Client renders markdown, citations, artifacts
```

The skill layer must run after anonymization and before final LLM response generation. That keeps raw PII out of skill calls and model calls.

## Streaming and Thinking UX

### Current State

Frontend findings:

- `client/src/hooks/Chat/useMDPChat.ts` already creates an empty assistant placeholder before the MDP response is available.
- `client/src/components/Chat/Messages/Content/Markdown.tsx` renders an empty assistant message as `<span className="result-thinking" />`.
- `client/src/style.css` already has the pulsing thinking indicator CSS.
- `useMDPChat.ts` already has a client-side typewriter loop after the full response returns.

Backend findings:

- `/mdp/ai-safe/chat` is synchronous.
- `ChatService.send_prompt(...)` waits for the full LLM response.
- `OpenAIService.send_chat(...)` calls Azure Chat Completions without `stream=True`.
- The backend performs deanonymization only after the full response returns.

### Phase 1: Client-Side Thinking and Typewriter

This can be shipped without backend streaming.

Flow:

```text
user submits
  -> add user message
  -> add empty assistant message
  -> existing thinking blob appears
  -> wait for full backend response
  -> remove thinking state
  -> type final answer into assistant bubble
```

Implementation notes:

- Keep the current empty assistant placeholder in `useMDPChat.ts`.
- Ensure the placeholder is inserted before `sendChat(...)` awaits.
- Keep `isSubmitting=true` until the first rendered response character.
- Extract the typewriter loop into a small helper if reused for image/RAG/skill responses.
- Do not duplicate the loading UI in message components; the renderer already supports the thinking blob.

Acceptance criteria:

- Empty assistant bubble shows a compact thinking blob while waiting.
- Thinking blob disappears when text starts.
- Final text appears progressively.
- Error responses do not type forever and do not leave the blob stuck.

### Phase 2: Real Backend Streaming

Add a new endpoint rather than changing stable sync behavior:

```text
POST /mdp/ai-safe/chat/stream
```

Event shape:

```text
event: message
data: {"type":"created","session_id":"..."}

event: message
data: {"type":"status","label":"Thinking"}

event: message
data: {"type":"delta","text":"..."}

event: message
data: {"type":"final","data":{...ChatResponseDTO...}}

event: error
data: {"message":"..."}
```

Backend refactor:

- Split `ChatService.send_prompt(...)` into:
  - `prepare_prompt_context(...)`
  - `run_llm(...)`
  - `finalize_chat_response(...)`
- Add `LLMService.send_chat_stream(...)`.
- Add `OpenAIService.send_chat_stream(...)`.
- Use Server-Sent Events through Flask `Response(stream_with_context(...))`.

Privacy constraint:

- Do not stream raw provider output directly as final user-visible text unless incremental deanonymization is tested.
- Safer first version: stream neutral status events and client-side typewriter from the final deanonymized response.
- Better second version: stream deltas with a rolling replacement buffer that safely handles anonymized placeholders split across chunks.

## LangChain Usage

LangChain can help with structured output, tool wrapping, validation, and agent graphs. It should not be introduced as the first dependency for simple chat streaming.

Use LangChain when:

- We need provider-neutral tool definitions.
- We need validated structured outputs for document plans.
- We want retry-on-schema-error behavior.
- We want a graph for multi-step document generation, review, export, and artifact creation.

Avoid LangChain when:

- A direct OpenAI/Azure SDK call is simpler.
- We only need SSE passthrough.
- The privacy boundary is easier to prove with our own small orchestrator.

Recommended compromise:

- Keep `SkillRegistry` and `SkillOrchestrator` as our own backend contracts.
- Optionally implement a `LangChainSkillRunner` behind that contract later.
- Never let LangChain own raw file upload or unanonymized prompt state.

## Skill Contract

Add backend models:

```python
from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class SkillSpec:
    name: str
    description: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    handler: Callable[["SkillContext", dict[str, Any]], "SkillResult"]
    requires_anonymized_input: bool = True
    max_runtime_ms: int = 15000
    enabled: bool = True


@dataclass
class SkillContext:
    session_id: str
    org_id: str
    user_email: str
    language: str
    anonymized_prompt: str
    safe_doc_ids: list[str]
    rag_citations: list[dict]
    reasoning_mode: str


@dataclass
class SkillResult:
    name: str
    content_markdown: str
    citations: list[dict]
    artifacts: list[dict]
    metadata: dict[str, Any]
```

### Initial Skills

Implement these first:

1. `safe_rag_answer`

   - Uses safe document context only.
   - Returns answer markdown plus citations.
   - Refuses when retrieved evidence is insufficient.

2. `document_create`

   - Creates structured markdown documents from a template.
   - Supports reports, emails, summaries, meeting notes, tables, and checklists.
   - Emits `content_markdown` and optional downloadable artifact metadata.

3. `document_transform`

   - Rewrites, summarizes, translates, or formats existing anonymized content.
   - Keeps PII placeholders unchanged.

4. `sql_agent`

   - Wrap existing `src/tools/sql_agent`.
   - Keep DB access read-only.
   - Require explicit mode or high-confidence routing.

5. `search_docs`

   - Wrap existing product-doc search.
   - Use for how-to and product behavior questions.

## Skill Routing

Use a deterministic router before giving the LLM freedom:

```python
class SkillRouter:
    def route(self, request: ChatRequest, context: SkillContext) -> SkillRoute:
        if request.safe_doc_ids and request.intent in {"ask_doc", "summarize_doc"}:
            return SkillRoute(required=["safe_rag_answer"])
        if request.intent in {"create_doc", "write_report", "draft_email"}:
            return SkillRoute(required=["document_create"])
        if request.intent == "product_help":
            return SkillRoute(allowed=["search_docs"])
        return SkillRoute(allowed=["safe_rag_answer", "document_create", "document_transform"])
```

Use model tool calling only after this pre-router has reduced the tool set. This prevents the model from choosing unsafe or irrelevant tools.

## Forcing Tool Use

When a skill is required:

- OpenAI Responses API: use `tool_choice: "required"` or force a specific function.
- Azure Chat Completions fallback: pass `tools` and `tool_choice` where supported.
- If the provider does not support tool forcing, execute the backend skill directly and pass `SkillResult` into the final answer prompt.

Required validation:

```python
if route.required and not trace.called_all(route.required):
    raise SkillExecutionError("Required skill was not called")
```

This is how we make "the model must use the skill" enforceable. A system prompt alone is not enough.

## Reasoning Capability

Add an internal `reasoning_mode`:

```text
off  - current behavior, lowest cost
auto - backend chooses based on task complexity
deep - use reasoning-capable model and larger token budget
```

Do not expose raw chain of thought to users. Store only:

- selected reasoning mode
- selected skill route
- tool calls and outputs
- concise reasoning summary if provider supports it
- final answer

Implementation options:

1. Short term:
   - Keep Azure Chat Completions.
   - Add planner prompts for complex tasks.
   - Use structured JSON for route selection.

2. Preferred:
   - Add a `ResponsesLLMService` for providers/deployments that support Responses API.
   - Use reasoning models with `reasoning.effort`.
   - Preserve response/tool context through `previous_response_id` or stored output items where supported.

3. Fallback:
   - Non-reasoning deployments use deterministic skill routing plus a normal final answer pass.

## Template Rendering

Add backend templates:

```text
../ai-safe/src/skills/templates/
  report.md.j2
  email.md.j2
  meeting_notes.md.j2
  executive_summary.md.j2
  comparison_table.md.j2
```

Use a sandboxed renderer:

```python
from jinja2.sandbox import SandboxedEnvironment
from jinja2 import FileSystemLoader, StrictUndefined


env = SandboxedEnvironment(
    loader=FileSystemLoader(template_dir),
    undefined=StrictUndefined,
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)
```

Render markdown only. Do not render arbitrary HTML from user input.

Skill output:

```json
{
  "name": "document_create",
  "content_markdown": "# Executive Summary\n\n...",
  "citations": [],
  "artifacts": [
    {
      "type": "markdown",
      "filename": "summary.md",
      "download_url": "/mdp/ai-safe/artifacts/{artifact_id}"
    }
  ],
  "metadata": {
    "template": "executive_summary",
    "language": "en"
  }
}
```

## Document Generation and Export

### Current State

LibreChat already has:

- Markdown rendering through `react-markdown` and GFM plugins.
- Office/PDF preview helpers under `packages/api/src/files/documents`.
- Optional LibreOffice preview conversion controlled by `OFFICE_PREVIEW_LIBREOFFICE`.

ai-safe already has:

- DOCX reading/mutation through `python-docx`.
- PDF processing through PyMuPDF/OCR tooling.
- Safe file anonymization, metadata, storage, indexing, and download endpoints.

Missing today:

- No first-class document generation service.
- No Markdown-to-DOCX/PDF export service.
- No uploaded template merge pipeline.
- No artifact metadata in normal chat responses.

### Recommended Ownership

Implement document generation and export in `ai-safe`, not LibreChat.

Reason:

- ai-safe already owns the privacy boundary.
- ai-safe already owns anonymized files and safe downloads.
- Exported artifacts may contain restored user-facing PII after deanonymization, so generation must use the same replacement policy as chat.

### Document Skill Pipeline

```text
User asks for document
  -> prompt is anonymized
  -> skill router selects document_create
  -> LLM returns structured DocumentPlan JSON
  -> backend validates DocumentPlan
  -> backend renders markdown
  -> backend optionally renders DOCX/PDF
  -> artifact is stored
  -> chat returns markdown preview plus download links
```

Structured contract:

```python
class DocumentPlan(BaseModel):
    title: str
    audience: str
    document_type: str
    language: str
    sections: list[DocumentSection]
    tables: list[DocumentTable] = []
    citations: list[Citation] = []
    export_formats: list[str] = ["markdown"]
```

The model should produce the plan, not the final binary. The backend should render and validate the final artifact.

### Export Formats

Preferred stack:

1. Markdown preview

   - Store generated markdown.
   - Render in chat using existing frontend markdown renderer.

2. DOCX export

   - Simple reports: generate DOCX with `python-docx`.
   - User-uploaded DOCX templates: add `docxtpl`.
   - Corporate styling from markdown: use Pandoc with `--reference-doc` if Pandoc is available in deployment.

3. PDF export

   - Highest fidelity from DOCX: generate DOCX, then convert with LibreOffice headless.
   - HTML/CSS reports: render markdown to HTML, then PDF with WeasyPrint if deployment supports system libraries.
   - Avoid hand-building complex PDFs with low-level APIs unless the layout is fixed.

4. HTML export

   - Useful for preview and browser print.
   - Must sanitize rendered HTML.

### Uploaded Template Support

Support two template classes:

1. Style reference template

   - User uploads `.docx`.
   - Backend uses it only for style, margins, headers, footers.
   - Content is generated from validated markdown/DocumentPlan.
   - Best implemented with Pandoc `--reference-doc` or `python-docx` style copying.

2. Merge-field template

   - User uploads `.docx` containing Jinja-like placeholders.
   - Backend extracts required variables.
   - LLM creates structured JSON for those variables.
   - Backend renders with `docxtpl`.
   - Missing variables fail validation before export.

Template safety:

- Only allow `.docx` templates in phase 1.
- Reject macros and unsupported embedded objects.
- Store template metadata separately from uploaded document content.
- Run template data through anonymization/deanonymization policy.
- Never execute arbitrary template code or shell hooks.

### Document Quality Loop

For industry-level documentation, use a multi-pass backend skill:

```text
Planner
  -> creates outline and section intent
Writer
  -> drafts markdown sections
Reviewer
  -> checks completeness, citations, tone, formatting
Formatter
  -> normalizes headings, tables, code blocks
Exporter
  -> renders markdown/docx/pdf
Validator
  -> verifies artifact exists and can be opened
```

This can be implemented as deterministic backend steps first. LangChain or LangGraph can be introduced only if the step orchestration becomes complex enough to justify it.

## Artifact API

Add endpoints:

```text
POST /mdp/ai-safe/artifacts/render
POST /mdp/ai-safe/templates/upload
GET  /mdp/ai-safe/templates
GET  /mdp/ai-safe/artifacts/{artifact_id}/download
GET  /mdp/ai-safe/artifacts/{artifact_id}/preview
```

Artifact metadata:

```json
{
  "artifact_id": "uuid",
  "kind": "document",
  "format": "docx",
  "filename": "generated-report.docx",
  "download_url": "/mdp/ai-safe/artifacts/{artifact_id}/download",
  "preview_url": "/mdp/ai-safe/artifacts/{artifact_id}/preview",
  "source_skill": "document_create",
  "created_at": "2026-05-18T00:00:00Z"
}
```

Frontend behavior:

- Render markdown preview inline.
- Show export buttons for available formats.
- Show template selector in tools only when document skill is active.
- Preserve generated artifacts in chat history.

## Response Beautification

The backend should return structured response metadata, not just a raw string:

```json
{
  "response": "Markdown answer",
  "format": "markdown",
  "citations": [],
  "artifacts": [],
  "skills_used": ["safe_rag_answer"],
  "warnings": []
}
```

The model should be instructed to produce:

- short answer first
- headings only when useful
- tables for comparisons
- code blocks with language names
- citations when RAG context is used
- no fake citations
- no exposed anonymization internals unless the user asks

## Fuzzy Matching Hardening

Upgrade from ad-hoc fuzzy logic to a measured matcher:

1. Add RapidFuzz.

   ```text
   rapidfuzz==3.x
   ```

2. Normalize safely:

   - Unicode normalize with NFKC.
   - Casefold.
   - Strip punctuation only for matching, never for replacement.
   - Preserve original spans for replacement.

3. Use entity-specific scoring:

   - Names: token sort ratio plus edit distance.
   - Organizations: token set ratio, suffix normalization (`Ltd`, `GmbH`, `Inc`).
   - Dates: no fuzzy replacement; use normalized date map only.
   - IDs, emails, phone, IBAN, keys: exact only.

4. Add confidence traces:

   ```json
   {
     "span": "Jonh Smith",
     "entity": "John Smith",
     "replacement": "Person_1",
     "score": 96,
     "method": "rapidfuzz.token_sort_ratio",
     "accepted": true
   }
   ```

5. Reject ambiguous matches:

   - No replacement when top two candidates are close.
   - No single-token replacement below high threshold.
   - No replacement if category does not allow fuzzy matching.

## Evaluation Plan

Add tests before broad rollout:

```text
../ai-safe/tests/services/test_fuzzy_doc_projection.py
../ai-safe/tests/services/test_safe_rag_privacy.py
../ai-safe/tests/services/test_skill_router.py
../ai-safe/tests/services/test_skill_orchestrator.py
../ai-safe/tests/services/test_document_templates.py
../ai-safe/tests/services/test_reasoning_mode.py
client/src/services/mdp/__tests__/files.test.ts
client/src/hooks/Chat/__tests__/safeFileChat.test.tsx
```

Minimum eval cases:

- Exact replacement
- One-character typo in name
- OCR spacing and hyphenation
- German names and umlauts
- Organization suffix variants
- Ambiguous two-name collision
- Email/IBAN/phone exact-only behavior
- Raw file never sent to provider
- RAG embeds safe text only
- Required skill called exactly once
- Template output contains valid markdown
- Response citations match retrieved chunks

Release gate:

```text
precision >= 99.5% for replacements
recall >= 95% for allowed fuzzy categories
0 raw PII provider-upload regressions
0 required-skill bypasses
0 fake citation regressions
```

## Implementation Phases

### Phase 1: Lock Privacy and Evals

- Add the RAG privacy tests.
- Add fuzzy projection tests around current behavior.
- Add a per-turn trace object with `doc_ids`, `skills_used`, and `rag_citations`.
- Make raw provider file upload impossible from the safe-file chat path.

### Phase 2: Skill Core

- Add `src/skills/spec.py`.
- Add `src/skills/registry.py`.
- Add `src/skills/router.py`.
- Add `src/skills/orchestrator.py`.
- Wrap existing `sql_agent` and `search_docs`.
- Add direct backend execution for required skills.

### Phase 3: Document Skills and Templates

- Add markdown templates.
- Add `document_create` and `document_transform`.
- Add artifact persistence and download endpoints.
- Add frontend rendering for artifacts and skill metadata.

### Phase 4: Provider Tool Calling

- Extend `LLMService.send_chat(...)` to accept:

  ```python
  tools: list[dict] | None = None
  tool_choice: str | dict | None = None
  response_format: dict | None = None
  reasoning_mode: str = "off"
  ```

- Add an OpenAI/Azure adapter for tool calls.
- Prefer Responses API where available.
- Keep Chat Completions fallback.

### Phase 5: Reasoning Mode

- Add `reasoning_mode` to chat DTOs.
- Map `auto` and `deep` to provider capability.
- Store reasoning summaries only when available.
- Never store or expose raw chain of thought.

### Phase 6: Frontend UX

- Add tool settings:
  - Language: only supported languages.
  - Reasoning: Auto / Fast / Deep.
  - Skill chips: Document, RAG, Product Docs, SQL where permitted.
- Display `skills_used` quietly near the response metadata.
- Render markdown, tables, code blocks, citations, and artifacts cleanly.

## Parallel Workstreams

Use separate agents/workers with non-overlapping ownership:

1. Frontend streaming UX worker

   - Owns `client/src/hooks/Chat/useMDPChat.ts`.
   - Owns any small typewriter helper and tests.
   - Does not touch backend streaming.

2. Backend streaming worker

   - Owns `../ai-safe/src/controllers/chat_controller.py`.
   - Owns `../ai-safe/src/services/chat_service.py`.
   - Owns `../ai-safe/src/services/LLMs/openai_service.py`.
   - Adds `/chat/stream` without breaking `/chat`.

3. Skill/document worker

   - Owns new `../ai-safe/src/skills/*`.
   - Owns document skill contracts and template rendering.
   - Wraps existing `sql_agent` and `search_docs` only through stable interfaces.

4. Artifact/export worker

   - Owns new artifact storage/download endpoints.
   - Owns DOCX/PDF export stack and template upload.
   - Does not change chat prompt logic except returning artifact metadata.

5. QA/evals worker

   - Owns regression tests for safe RAG, streaming, templates, exports, and fuzzy replacement.
   - Defines release gates before rollout.

## Acceptance Criteria

The work is complete when:

- Normal AI Safe chat can use backend skills without leaving the anonymized boundary.
- Required skill use is enforced by code, not just prompt text.
- Safe document RAG uses only anonymized safe text.
- Fuzzy matching has precision/recall tests and confidence traces.
- Document creation returns template-rendered markdown and downloadable artifacts.
- Reasoning mode is provider-aware and never exposes raw chain of thought.
- All new behavior has unit tests plus at least one end-to-end safe chat test.
