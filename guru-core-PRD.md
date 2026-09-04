# guru-core — Backend MVP Product Requirements

| Field | Value |
|---|---|
| Project | guru-core, the backend for coach.ai |
| Repository | github.com/Quasar-Gang/guru-core |
| Product version | v0.1 MVP |
| Document date | 2026-09-05 |
| Status | v0.2 draft; hosting and local-model selection remain open |

## 1. Product overview

### 1.1 One sentence

A user enters a goal and may add existing documents, Google Calendar data, and role models. The system consolidates the context, asks only necessary follow-up questions, generates three executable plans at different difficulty levels, exports them to Google Calendar or Markdown, tracks task completion, and proposes revisions when the user falls behind.

### 1.2 Primary flow

```text
User input -> AI consolidation and up to two follow-up rounds -> Plan Engine
           -> Easy / Hard / Extremely hard plans -> export, calendar, and revision
```

### 1.3 MVP scope

Included:

- Google sign-in.
- Goal creation. The goal is the only required input. Horizon, weekly capacity, baseline, routine, and time-management preferences are optional.
- Google Calendar import at P0 and file import for CSV, XLSX, Markdown, HTML, PDF, and DOCX.
- At most one trait role model and one persona role model per session. The LLM may recommend up to three personas.
- Readiness evaluation, up to five contextual multiple-choice questions per round, up to two rounds, and forced generation with conservative assumptions when required.
- Easy, Hard, and Extremely hard plans derived from one baseline template.
- Plan listing, activation, renaming, archiving, deletion, and progress display.
- Built-in calendar and todo tasks, completion status, and schedule changes.
- Google Calendar and Markdown export at P0. Google Sheets and Notion are P1.
- Daily check-ins with `done`, `missed`, and `skipped` states.
- User-triggered revisions using either deadline postponement or goal reduction, followed by a reviewable diff.

Deferred beyond MVP:

- Resume parsing and Apple Health.
- User-published role models, marketplace features, and social threads.
- Automated role-model background research and vector search.
- Calendar change detection, automatic rescheduling, and automatic daily revisions.
- The `compress` revision strategy.
- Collaboration and team features.
- A separate API gateway and microservice mesh.

## 2. Architecture

The app calls one API Service. Services do not call each other over HTTP except for API-to-Role-Model requests; background coordination uses Redis queues and the shared database.

### 2.1 Deployable services

| Service | Type | Responsibilities |
|---|---|---|
| API Service | HTTP and workers | Gateway, auth, app endpoints, uploads, imports, exports, queue production, and job polling |
| Plan Engine | Worker only | Context consolidation, readiness evaluation, follow-up questions, plan generation, scheduling, and revision diffs |
| Role Model Service | HTTP only | Role-model reads, team-managed writes, and persona recommendations |

### 2.2 Shared packages

| Package | Public port | Production adapter | Test adapter |
|---|---|---|---|
| `llm` | `LLMPort.complete(...)` | OpenAI-compatible and Anthropic | `FakeLLM` |
| `importers` | `SourcePort`, `ParserPort` | Google Calendar and file parsers | In-memory source and passthrough parser |
| `repo` | One protocol per table | Async SQLAlchemy PostgreSQL repositories | In-memory repositories |
| `storage` | `put`, `get`, `presign` | Cloudflare R2 through the S3 API | In-memory storage |
| `queue` | `enqueue`, `consume` | ARQ on Redis | In-memory queue |
| `cache` | `get`, `set`, `expire` | Redis | Dictionary cache |

### 2.3 Data infrastructure

- PostgreSQL 16 is the single source of durable relational state.
- Redis 7 provides queues, job-status caching, response caching, and rate limiting.
- Cloudflare R2 stores uploaded files and generated artifacts.
- The LLM provider is selected behind `LLMPort` and may be local or hosted.

## 3. Core behavior

### 3.1 Plan-session state machine

```text
collecting -> evaluating -> questioning -> evaluating
                       \-> generating -> done
evaluating or generating -> failed after retries are exhausted
```

`plan_sessions.status` is authoritative. Redis is only a polling cache.

### 3.2 Generation sequence

1. The client creates a plan session with a goal, optional role models, and optional import IDs.
2. The API writes the session and enqueues `plan.generate`.
3. The Plan Engine loads profile, imported documents, selected role models, and connected calendar events.
4. The LLM evaluates readiness against configuration-driven metrics.
5. If information is missing and fewer than two rounds have run, the session becomes `questioning`.
6. The client submits answers and the API enqueues `plan.continue`.
7. When ready or out of rounds, the LLM produces one baseline Hard template.
8. Deterministic code derives Easy and Extremely hard variants and schedules absolute task times.
9. The engine writes plans and tasks, then marks the session `done`.

### 3.3 Onboarding rules

- Only `goal` is required.
- Optional horizon, capacity, and baseline information reduces follow-up questions.
- Uploaded content is sent directly to R2 through a presigned URL, parsed into a normalized `Document`, and included in plan context.
- Calendar connection is independent and can happen at any time.
- Missing calendar access must never block plan generation.
- Follow-up questions must only fill gaps that cannot be inferred from existing context.

### 3.4 Readiness output

```json
{
  "ready": false,
  "missing": ["capacity", "baseline"],
  "questions": [
    {
      "id": "q1",
      "metric_id": "capacity",
      "text": "Context-specific question text",
      "options": ["Concrete option one", "Concrete option two", "Concrete option three"],
      "allow_custom": true,
      "allow_skip": true
    }
  ]
}
```

Each round contains at most five questions. Every question has exactly three contextual options and permits skip or free text. After two rounds, missing required values use conservative defaults and are recorded in `assumptions`.

### 3.5 Plan lifecycle

```text
draft -> active -> archived
active -> draft when another difficulty is activated
archived -> active when restored
draft or archived -> deleted
```

Only one plan from a session may be active. Built-in calendar views and exports operate on the active plan.

### 3.6 Google connection

Sign-in requests only `openid email profile`. Calendar connection is a separate consent flow requesting Calendar read access, Calendar event access, and Sheets access. The client never receives Google tokens; it only receives the application's JWT.

```text
GET  /integrations/google/authorize -> authorize_url
POST /integrations/google/callback  { code } -> connected state and scopes
```

An `invalid_grant` marks the connection revoked. `GET /integrations` then returns `needs_reauth: true`.

### 3.7 Completion and check-ins

Completion lives in `plan_tasks`, not Google Calendar. A daily check-in submits all relevant task results in one request. Calendar is only a projection; after sync, event titles may receive a success or failure prefix.

### 3.8 Revisions

The only trigger is the user's explicit reschedule action. The engine never changes historical `done` or `missed` tasks. It regenerates the template, schedules future tasks, and computes a deterministic diff by `template_key + week_index + occurrence`.

| Strategy | Behavior | Constraint |
|---|---|---|
| `postpone` | Keep the goal and weekly intensity; extend the deadline | May only change deadline and duration |
| `reduce` | Keep the deadline; reduce goal scope | May not change the deadline |

Only one `pending` or `proposed` revision may exist per plan. The user accepts or rejects the proposed diff.

### 3.9 Role-model recommendations

Traits define hard pacing constraints and are selected directly by the user. Personas provide methods and milestones. The service filters active personas by domain and incompatible constraints, then asks the LLM to return up to three candidates with one reason each.

### 3.10 Import normalization

All sources are normalized to:

```yaml
Document:
  events: []
  text_chunks: []
```

The Plan Engine depends on `Document`, not on source-specific formats.

## 4. Plan data format

The LLM outputs relative scheduling intent. A deterministic scheduler converts it into absolute dates and times while respecting availability, existing events, rest requirements, and pacing limits.

### 4.1 Plan template

```yaml
title: string
goal_statement: string
duration_weeks: integer
assumptions: string[]
success_criteria: string[]
phases:
  - index: integer
    name: string
    week_start: integer
    week_end: integer
    focus: string
    milestone:
      title: string
      metric: string
weekly_template:
  - key: string
    title: string
    task_type: session | habit | checkpoint | rest
    day_hint: mon | tue | wed | thu | fri | sat | sun | any | weekend | weekday
    slot_hint: morning | noon | evening | any
    duration_minutes: integer
    description: string
```

### 4.2 Difficulty derivation

| Difficulty | Derivation |
|---|---|
| `hard` | Baseline template unchanged |
| `easy` | Frequency x0.6, duration x0.75, weeks x1.25 |
| `extremely_hard` | Frequency x1.3, duration x1.25, weeks x0.85 |

All results are clamped to the selected trait's pacing constraints. The three variants share the same goal statement and success criteria.

### 4.3 Scheduler rules

1. Expand weeks from the plan start date, defaulting to the next Monday.
2. Resolve day and time hints against user availability and existing events.
3. Move conflicts to the nearest valid slot in the same week.
4. Reject templates that violate session or rest-day limits, retry the LLM within configured limits, then fall back conservatively.
5. Add an all-day checkpoint on the Sunday at the end of every phase.
6. Assign every task a stable `template_key`, `week_index`, and `occurrence` tuple.

### 4.4 Core records

```yaml
plans:
  fields:
    - id
    - user_id
    - session_id
    - title
    - difficulty
    - status
    - goal_statement
    - duration_weeks
    - start_date
    - deadline
    - template
    - structure
    - activated_at
    - archived_at
    - created_at

plan_tasks:
  fields:
    - id
    - plan_id
    - template_key
    - week_index
    - phase_index
    - occurrence
    - task_type
    - title
    - description
    - start_at
    - end_at
    - all_day
    - status
    - completed_at
    - missed_reason
    - external_ref
    - synced_at
    - sort_order
  unique: [plan_id, template_key, week_index, occurrence]
```

### 4.5 Google Calendar projection

- Each plan gets a dedicated secondary calendar named `guru · {plan.title}`.
- Task title becomes event summary. Task description includes plan and week context.
- Absolute times map to date-time events; checkpoints map to all-day events.
- `template_key` selects a stable color.
- Private extended properties contain the guru task and plan IDs.
- Rest tasks are excluded unless the user opts in.
- Synchronization is one-way from guru-core to Google Calendar.
- Initial export uses `full`; later changes use `incremental` based on `synced_at`.

### 4.6 Markdown export

Markdown export is synchronous and returns both a presigned download URL and plain text. It includes the title, goal, schedule, difficulty, success criteria, assumptions, phases, weekly tasks, and progress. Tasks use GitHub-flavored checkboxes; missed tasks are struck through and marked as missed.

## 5. Public API

Base path: `/v1`. All endpoints except authentication require `Authorization: Bearer <JWT>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/google` | Exchange the Google sign-in callback for an application JWT |
| GET | `/integrations` | List provider status, scopes, and reauthorization state |
| GET | `/integrations/{provider}/authorize` | Return an authorization URL |
| POST | `/integrations/{provider}/callback` | Exchange an authorization code and store encrypted tokens |
| DELETE | `/integrations/{provider}` | Revoke and disconnect a provider |
| GET, PUT | `/profile` | Read or update the onboarding profile |
| POST | `/imports/presign` | Create a presigned R2 upload and return `import_id` |
| POST | `/imports/{id}/complete` | Mark upload complete and enqueue parsing |
| POST | `/imports/google-calendar` | Import authorized Calendar data |
| GET | `/imports` | List imports and status |
| POST | `/plan-sessions` | Create a session and enqueue generation |
| GET | `/plan-sessions/{id}` | Return status, questions, or generated plans |
| POST | `/plan-sessions/{id}/answers` | Submit follow-up answers and continue generation |
| GET | `/plans` | List plans with status filtering and completion rate |
| GET | `/plans/{id}` | Get details, assumptions, summary, and progress |
| PATCH | `/plans/{id}` | Rename or activate a plan |
| POST | `/plans/{id}/archive` | Archive a plan |
| DELETE | `/plans/{id}` | Delete a draft or archived plan |
| POST | `/plans/{id}/checkins` | Submit daily task results |
| GET | `/plans/{id}/checkins` | Return history and completion-rate curve |
| POST | `/plans/{id}/revisions` | Start a revision with `postpone` or `reduce` |
| GET | `/plans/{id}/revisions` | List revisions |
| GET | `/plans/{id}/revisions/{revision_id}` | Return rationale and structured diff |
| POST | `/plans/{id}/revisions/{revision_id}/accept` | Apply proposed future tasks |
| POST | `/plans/{id}/revisions/{revision_id}/reject` | Reject a proposal |
| GET | `/plans/{id}/tasks` | List calendar/todo tasks by date range |
| PATCH | `/plans/{id}/tasks/{task_id}` | Update status or time and enqueue incremental export |
| POST | `/plans/{id}/export` | Export to Calendar, Markdown, Sheets, or Notion |
| GET | `/plans/{id}/export` | Return export status and sync timestamps |
| DELETE | `/plans/{id}/export/{target}` | Remove an export and external references |
| GET | `/jobs/{id}` | Poll a background job |
| GET | `/role-models` | List role models by kind and tags |
| GET | `/role-models/tags` | List available tags |
| GET | `/role-models/recommend` | Recommend up to three personas |
| GET | `/role-models/{id}` | Get role-model details |
| POST | `/role-models` | Team-only, API-key-protected creation |
| PUT, DELETE | `/role-models/{id}` | Team-only update or deactivation |

### 5.1 Queues

| Queue | Producer | Consumer | Payload |
|---|---|---|---|
| `import.parse` | API | API worker | `ImportParseJobV1{import_id}` |
| `plan.generate` | API | Plan Engine | `PlanGenerateJobV1{session_id}` |
| `plan.continue` | API | Plan Engine | `PlanContinueJobV1{session_id}` |
| `export.push` | API | API worker | `ExportJobV1{plan_id, target, mode}` |
| `plan.revise` | API | Plan Engine | `PlanReviseJobV1{plan_id, revision_id, strategy}` |

## 6. Technology

- Python 3.12 and FastAPI.
- PostgreSQL 16, SQLAlchemy 2 async, and Alembic.
- Redis 7 and ARQ.
- Cloudflare R2 through the S3 API.
- Pydantic v2, strict mypy, Ruff, and import-linter.
- pytest with fake adapters; unit tests do not require Docker.
- An OpenAI-compatible local provider is the default LLM direction, with hosted adapters available through configuration.

## 7. LLM abstraction and reliability

The unified interface is:

```python
class LLMPort(Protocol):
    async def complete(
        self,
        prompt_name: str,
        context: dict,
        output_schema: type[BaseModel],
        purpose: str,
    ) -> BaseModel: ...
```

Adapters include an OpenAI-compatible provider, Anthropic, and fixtures. Configuration selects provider, endpoint, model, timeouts, retries, and purpose-specific generation settings.

Every structured response passes this chain:

1. JSON extraction and schema validation.
2. Business-rule validation.
3. A correction retry with explicit validation errors.
4. Limited regeneration.
5. A conservative deterministic fallback or a typed failure.

Log provider, model, purpose, latency, token counts, cache status, validation attempts, and terminal error type. Never log raw user documents or secrets.

## 8. Code architecture

Use hexagonal architecture:

```text
cmd/                  process entry points and dependency wiring
services/             deployable API, Plan Engine, and Role Model applications
packages/domain/      entities, value objects, and domain rules
packages/application/ use cases and ports
packages/adapters/    database, queue, storage, importer, and LLM adapters
config/               versioned product and provider configuration
tests/                unit, contract, integration, and end-to-end tests
```

Domain code may not import framework, database, queue, or provider SDKs. All external systems sit behind ports. Only owners write their tables. Dependency direction is enforced by import-linter.

## 9. Engineering discipline

- Public functions and ports use explicit types.
- Pydantic validates every boundary payload.
- Business rules remain in domain or application layers, not route handlers.
- Storage, queues, clocks, IDs, and LLMs must have replaceable adapters.
- Database schema changes require migrations and rollback notes.
- Prompt or model changes require fixture and evaluation updates.
- CI runs formatting, linting, strict typing, unit tests, contract tests, migration checks, and dependency-boundary checks.

## 10. Non-functional requirements

- API reads should normally complete within 500 ms excluding third-party latency.
- Background jobs must be idempotent and safely retryable.
- Uploaded files and OAuth refresh tokens require encryption at rest.
- Logs must exclude credentials and raw imported content.
- Every external call requires a timeout, bounded retries, and typed failure handling.
- The application must expose health, readiness, and structured observability data.

## 11. Role-model schema

Role models are structured prompt context, not biographies.

```yaml
id: uuid
kind: trait | persona
name: string
tags: string[]
active: boolean
updated_at: timestamp
content:
  summary: string
  pacing:
    sessions_per_week: [integer, integer]
    session_minutes: [integer, integer]
    rest_days_min: integer
    progression_rate: number
    missed_policy: none | same-week | next-day
    deload_every_weeks: integer | null
    intensity_bias: low | medium | high
  sections:
    principles: string[]
    weekly_structure: string
    progress_metrics: string[]
    pitfalls: string[]
    applicability:
      good_for: string[]
      not_for: string[]
    example_milestones: string[]
  provenance:
    sources: [{ title: string, url: string }]
    confidence: high | medium | low
    author: string | null
    notes: string | null
```

Traits use `pacing`; personas use `sections`. `summary` is the only required content field. Tags use a lowercase `namespace:value` format. Supported namespaces are `domain`, `goal`, `method`, `level`, `cadence`, `horizon`, `constraint`, and `persona`.

Initial traits:

| Name | Sessions per week | Session minutes | Rest days | Growth cap | Missed policy | Bias |
|---|---:|---:|---:|---:|---|---|
| Easygoing | 2–3 | 20–45 | 2 | 5% | none | low |
| Steady | 4–5 | 30–60 | 1 | 10% | same week | medium |
| Intense | 6 | 60–90 | 1 | 15% | next day | high |

Initial persona directions include Stephen Curry, Eliud Kipchoge, an office-worker fat-loss profile, Steve Kaufmann, Scott Young, a working exam candidate, Warren Buffett, John Bogle, and a first-savings-goal profile. These are seed examples only; the API owns ongoing maintenance.

## 12. Readiness metrics

Required metrics:

- A measurable goal and success criteria.
- A horizon or deadline.
- Weekly frequency, per-session duration, and approximate available time slots.
- A meaningful baseline.

Helpful metrics include calendar context, intensity preference, accountability style, time-management preference, past attempts, general constraints, and role-model fit. A domain probe may add at most two safety- or validity-critical questions not already covered.

Question priority is required metrics, then domain probes, then helpful metrics. After two rounds, conservative defaults are a 12-week horizon, three 30-minute sessions per week, and a beginner baseline. Every fallback must appear in plan assumptions.

## 13. Milestones

1. Repository structure, ports, fake adapters, and CI boundaries.
2. Authentication, profile, role models, imports, and normalized documents.
3. Readiness evaluation, follow-up rounds, plan generation, and deterministic scheduling.
4. Plan management, daily tasks, check-ins, and progress.
5. Google Calendar and Markdown exports.
6. Revision proposal, diff, acceptance, and incremental resynchronization.

## 14. Open decisions

- Hosting platform.
- Local inference model and serving framework.
- Post-MVP candidates: calendar change detection, automatic daily revision, the `compress` strategy, and an additional role-model ranking layer.
