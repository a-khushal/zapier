# POST Webhook Action: Full Implementation Plan

## Goal
Upgrade `post_webhook` from URL-only to a production-ready action with:
- request configuration (URL/method/headers/body template)
- retries + response logging
- auth options
- test-in-UI
- validation + safety controls
- usable run observability

---

## Current State (Baseline)
- Trigger flow works: `webhook_catch -> post_webhook`.
- Action metadata currently stores only destination URL.
- Worker sends fixed POST with full trigger payload.
- Step status is logged in `ZapRunStep`.
- No retries, no auth, minimal validation, no run-history UI.

---

## Phase 1: Request Configuration (URL + Method + Headers + Body Template)

### 1.1 Metadata contract
Define `post_webhook` metadata shape:

```ts
{
  url: string;
  method: "POST" | "PUT" | "PATCH" | "GET" | "DELETE";
  headers?: Array<{ key: string; value: string }>;
  bodyTemplate?: string; // JSON string with placeholders like {{payload.email}}
}
```

### 1.2 Frontend (create zap)
- Replace URL prompt with a proper action config UI panel.
- Add fields:
  - URL (required)
  - Method (dropdown)
  - Headers (dynamic key/value rows)
  - Body template (textarea)
- Store this in `actionMetadata` for `post_webhook`.
- Validate basic URL format before publish.

### 1.3 Worker execution
- Read `action.metadata`.
- Build headers map from metadata list.
- Resolve body template placeholders from trigger payload:
  - v1 syntax: `{{payload.path.to.value}}`
- If no `bodyTemplate`, send full payload for non-GET methods.
- For GET, skip request body.

### 1.4 Acceptance criteria
- User can configure URL/method/headers/body in UI.
- Worker sends configured request, not hardcoded POST-only request.

---

## Phase 2: Response Logging + Retry Handling

### 2.1 Schema additions
Add retry-aware run logging:
- `ZapRunStepAttempt` table:
  - `id`, `zapRunStepId`, `attemptNumber`
  - `requestSummary` (url/method/header names/body preview)
  - `responseStatus`, `responseBody`, `error`
  - `startedAt`, `completedAt`
- Add `attemptCount` to `ZapRunStep`.

### 2.2 Worker retry policy
- Retry on:
  - network timeout/connection errors
  - HTTP `5xx`
- No retry on `4xx` (except optional 429 in later version).
- Policy:
  - max attempts: 3
  - backoff: 1s, 2s, 4s

### 2.3 Step final status
- If any attempt succeeds -> `SUCCESS`.
- If all attempts fail -> `FAILED`.
- Persist final error summary in `ZapRunStep.error`.

### 2.4 Acceptance criteria
- Failed transient requests retry automatically.
- All attempts visible in DB with status/error details.

---

## Phase 3: Auth Support

### 3.1 Metadata auth contract
Extend metadata:

```ts
auth?: 
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "api_key"; key: string; value: string; addTo: "header" | "query" }
  | { type: "basic"; username: string; password: string };
```

### 3.2 UI
- Add auth type selector.
- Conditional inputs per auth type.

### 3.3 Worker auth injection
- `bearer` -> `Authorization: Bearer <token>`
- `api_key`
  - header mode -> add header
  - query mode -> append query param
- `basic` -> base64 `Authorization: Basic ...`

### 3.4 Acceptance criteria
- Auth-configured requests are sent correctly and logged.

---

## Phase 4: Test Button in UI

### 4.1 API endpoint
Add test endpoint:
- `POST /api/v1/zap/test-post-webhook`
- Input:
  - action metadata config
  - sample payload
- Runs one request immediately and returns response summary.

### 4.2 UI behavior
- Add `Test Action` button in action config.
- Show:
  - request preview
  - response status/body
  - error message

### 4.3 Acceptance criteria
- User can test webhook request before publishing zap.

---

## Phase 5: Validation + Safety Controls

### 5.1 Validation rules
- URL must be valid `http`/`https`.
- Header keys non-empty.
- Body template (if present) must parse as JSON after substitution.
- Method-body compatibility enforced.

### 5.2 Safety (SSRF baseline)
- Block private/local targets in production:
  - `localhost`, `127.0.0.1`, `::1`
  - RFC1918 private IP ranges
  - link-local / loopback / multicast
- Allowlist override for trusted internal domains via env config.

### 5.3 Timeout controls
- Default request timeout: 10s.
- Optional per-action timeout (bounded min/max).

### 5.4 Acceptance criteria
- Unsafe URLs blocked early.
- Long-hanging requests terminate with timeout and retry policy.

---

## Phase 6: Run Observability UX

### 6.1 Backend endpoints
- `GET /api/v1/zap/:zapId/runs`
- `GET /api/v1/zap/run/:zapRunId`
Return:
- run metadata
- steps
- attempt details (status, duration, response/error summaries)

### 6.2 Frontend pages
- Add run history section (dashboard row link or zap details page).
- Per-run details:
  - each action step status
  - attempts timeline
  - latest error/response

### 6.3 Acceptance criteria
- User can inspect why a run failed/succeeded without DB access.

---

## Cross-Cutting Implementation Notes

### Configuration
- New env vars:
  - `POST_WEBHOOK_DEFAULT_TIMEOUT_MS=10000`
  - `POST_WEBHOOK_MAX_TIMEOUT_MS=30000`
  - `POST_WEBHOOK_BLOCK_PRIVATE_NETWORKS=true`
  - `POST_WEBHOOK_DOMAIN_ALLOWLIST=...`

### Backward compatibility
- Existing zaps with metadata `{ url }` must continue to work.
- Missing optional fields should use defaults.

### Error handling standardization
- Normalize worker errors into concise user-facing summaries.
- Keep detailed raw errors in attempt logs for debugging.

---

## Testing Plan

### Unit tests
- Template resolver:
  - nested path resolution
  - missing keys
  - invalid template cases
- auth header/query builder
- URL safety validator
- retry policy decision logic

### Integration tests
- happy path: configured webhook receives transformed payload
- retry path: temporary 500 then success
- permanent 4xx failure path
- timeout path
- blocked SSRF target path

### Manual QA scenarios
- create zap with each auth type
- test button pass/fail cases
- inspect run history UI against DB logs

---

## Delivery Sequence (Recommended)

1. Phase 1 (request config)  
2. Phase 2 (retries + attempt logs)  
3. Phase 3 (auth)  
4. Phase 4 (test button)  
5. Phase 5 (validation/safety)  
6. Phase 6 (run observability UI)

Each phase should be mergeable independently and demoable.

