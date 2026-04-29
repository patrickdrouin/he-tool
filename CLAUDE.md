# he-tool Fork — Project Context

This document captures the state of this fork for AI-assisted development sessions. Read this before starting work — it has the project goals, what's been decided, what's been patched, and what's still open.

## Project goal

Set up a web-based MQM annotation tool for **English → French** machine translation evaluation.

- **Annotators:** 4–5 professional translators / bilingual experts
- **Input data:** JSON with `{source, target}` pairs
- **Schema:** modified MQM (starting point: full MQM taxonomy, will be pruned/adjusted)
- **Deployment:** self-hosted with Podman, multi-user with persistent storage
- **Time horizon:** weeks of annotation work, not a one-off

## Why this tool

Evaluated two open-source options:

1. **Anthea** (Google, `google-research/anthea`) — client-side static web app, MQM-purpose-built, good research provenance. Annotations stored in browser localStorage which is awkward for multi-user. UX felt off for our team.
2. **yaraku/he-tool** (this fork's upstream) — Flask + React + PostgreSQL, has user accounts, server-side persistence, project management UI. Smaller project (6 stars, 1 maintainer org) so we accept the maintenance burden of carrying patches.

Decided on he-tool. Trade-off accepted: we own a fork and patch it as needed.

## Architecture

- **`backend/`** — Flask + SQLAlchemy + Flask-JWT-Extended + Flask-Migrate, managed with Poetry
- **`frontend/`** — React + Vite + TailwindCSS + React Query
- **`public/`** — built static assets (output of `npm run build`)
- **DB:** PostgreSQL in production; SQLite fallback for demo (pre-seeded with `yaraku@yaraku.com` / `yaraku` user and a "Sample Evaluation")
- **Container runtime:** Podman (see below). Single image, multi-stage build (Node for frontend bundle, Python for backend), gunicorn serves both API and built frontend on port 8000.

## Container runtime: Podman

We run everything with Podman, not Docker. The existing `Dockerfile` works as-is — Podman accepts both `Dockerfile` and `Containerfile` names, and the build steps are OCI-standard.

### One-time setup (macOS)

```bash
brew install podman
podman machine init
podman machine start
```

(Podman on macOS runs containers in a small Linux VM, similar to how Docker Desktop or Colima work. The VM persists across reboots; you only need `podman machine start` after a host reboot.)

On Linux, `podman` runs natively and rootless by default — no VM, no daemon. Just install via your package manager (`apt install podman`, `dnf install podman`, etc.).

### Running the app

```bash
podman build -t he-tool .
podman run --rm -p 8000:8000 he-tool
# open http://localhost:8000
```

Exactly the same flags as Docker. If you're scripting around it, `alias docker=podman` works for almost everything in this project.

### Compose

Use `podman compose` (the newer integrated form) or install `podman-compose` separately:

```bash
brew install podman-compose      # macOS
# or
pip install podman-compose       # any platform
```

Then `podman compose up` works on the same `docker-compose.yml` / `compose.yaml` files Docker uses. We'll need a compose file once we add PostgreSQL — see the work items section.

### Podman gotchas worth knowing

- **macOS:** if you get "connection refused" or "no such socket" errors, check `podman machine list` — the VM may have stopped. `podman machine start` to bring it back up.
- **Rootless port binding:** ports below 1024 require extra setup. Port 8000 (our default) is fine.
- **Volume mounts on Linux with SELinux:** add `:Z` to the mount spec (e.g., `-v ./data:/data:Z`) so SELinux relabels the directory. Not relevant on macOS.
- **No daemon means no `systemctl start podman`** — the rootless mode is a per-user concept. There's a system service for rootful mode if you ever need it, but we don't.

## Patches applied so far

### 1. Right-click contextmenu fallback (committed)

**File:** `frontend/src/components/MarkingItem.jsx`, around line 240.

**Problem:** `onContextMenu` was attached only to per-word `<span>` elements via `getContextMenuByIndex`. Right-clicking on padding, line gaps, or any pixel not directly on a word span fell through to the browser's native menu instead of the annotation popup.

**Fix:** added an `onContextMenu={(e) => e.preventDefault()}` fallback to the parent `<div>` so the native menu is suppressed across the whole annotation area. Per-span handlers still run first via event bubbling, so existing behavior for "right-click on a word to mark it" is unchanged.

```jsx
<div
  className="col-sm-10 markingText tw-select-text tw-whitespace-pre-wrap"
  onContextMenu={(e) => e.preventDefault()}
>
```

**Worth upstreaming as a PR** — it's a clear bug fix that benefits everyone with no behavior change for existing users.

## MQM schema customization

This deserves its own section because (a) it's the single biggest customization we'll do, and (b) we'll iterate on it repeatedly as annotators give feedback.

### Where the schema lives today

The default MQM categories are scattered across at least three places — they need to stay in sync:

- **Backend enum / model:** `backend/src/human_evaluation_tool/models/marking.py` defines `errorCategory` and `errorSeverity` columns. The valid values are likely an Enum or a constant defined nearby.
- **Backend export labels:** `backend/src/human_evaluation_tool/resources/evaluation.py` references `CATEGORY_NAME` and `SEVERITY_NAME` dicts that map enum values → human-readable strings used in the TSV export.
- **Frontend category list:** somewhere under `frontend/src/` — likely `constants/`, `config/`, or co-located with the marking popup component. This is what populates the right-click menu items.

**First task for any schema work:** locate all three and confirm the exact files. Grep starting points:
```bash
grep -rn "CATEGORY_NAME\|errorCategory\|ErrorCategory" backend/src
grep -rn "category\|severity" frontend/src/components/MarkingPopup* frontend/src/constants 2>/dev/null
```

### Recommended approach: extract to a single JSON config

Rather than editing three files every time we tweak the taxonomy, extract the schema to one config file (e.g., `config/mqm_schema.json` at the repo root) and have both backend and frontend read it at startup:

```json
{
  "categories": [
    {
      "id": "accuracy_mistranslation",
      "label": "Accuracy / Mistranslation",
      "parent": "accuracy",
      "description": "Target text doesn't accurately reflect source meaning"
    },
    {
      "id": "fluency_grammar",
      "label": "Fluency / Grammar",
      "parent": "fluency",
      "description": "Grammatical errors in the target language"
    }
  ],
  "severities": [
    { "id": "minor",    "label": "Minor",    "weight": 1 },
    { "id": "major",    "label": "Major",    "weight": 5 },
    { "id": "critical", "label": "Critical", "weight": 10 }
  ]
}
```

- **Backend:** load the JSON on app start, validate, expose via `/api/schema` endpoint. Replace the enum with a string column (or keep enum + regenerate it from JSON via migration).
- **Frontend:** fetch `/api/schema` on app load, populate the category picker dynamically.
- **Schema changes:** edit the JSON, restart the backend, hard-refresh the browser. No code changes, no rebuilds.

This is a refactor (~half-day of work) but pays for itself within 2–3 schema iterations.

### Quick-path alternative: edit constants in place

If we need a fast first iteration before the refactor, the manual path is:
1. Edit the backend enum / constants (one file)
2. Update `CATEGORY_NAME` / `SEVERITY_NAME` dicts in `evaluation.py` to match
3. Update the frontend category list to match
4. Write a DB migration if any existing markings reference removed categories
5. `podman build` + `podman run`, hard-refresh browser

Workable for the first cut, painful by the third.

## Open work items

### High priority

- **Customize MQM schema for en→fr** — see dedicated section above. Default categories are tuned for Japanese-English. Severity weights also need review.
- **Switch demo to PostgreSQL via Podman compose.** SQLite fallback won't hold up to 5 concurrent annotators with frequent writes. Need a `compose.yaml` that brings up Postgres alongside the app, with proper migrations on first boot.
- **JSON-to-documents import script.** Source data is `[{source, target}, ...]` JSON. Need a script (or Flask CLI command) that creates an evaluation project, ingests source/target pairs as documents + system outputs, and assigns annotators.

### Medium priority

- **Multi-annotator assignment strategy.** Decide: same segments to all (for IAA) vs. partitioned (for throughput) vs. hybrid (100% single-annotated + 10–20% double for agreement monitoring). Implement in the import script.
- **Aggregation / scoring pipeline.** Export endpoint at `backend/src/human_evaluation_tool/resources/evaluation.py` produces TSV with `<v>...</v>` markup per marking. Verify the format works with downstream analysis tools (Marot? custom?) or write our own aggregator.

### Open architectural decision: overlapping annotations

**Status:** unresolved. Need a decision before any code work.

**Current behavior:** frontend rejects overlapping markings with a toast; backend has no constraint and would accept them; export code (`evaluation.py` lines 181–188) uses positional `list.insert()` which would silently corrupt output for overlaps.

**Standard MQM practice** discourages overlaps because severity-weighted scoring becomes ambiguous (does a word in two Major errors count once or twice?). WMT MQM guidelines tell raters to pick the most salient single error.

**If we decide to support overlaps**, three things change:
1. Remove the guard in `MarkingItem.jsx` (~lines 211–219)
2. Change `getClassByIndex` and `getContextMenuByIndex` to handle multiple markings per word (visual treatment + disambiguation popup) — ~70 lines of frontend work
3. Rewrite the export code to handle overlapping spans correctly (the current `insert()` approach can't work — needs a token-tagging or offset-tracking approach)

**Workaround if we don't:** annotators split spans when two errors co-occur on the same words (lossy on boundaries but zero code change and unambiguous scoring).

**Decision needed:** is there a real annotation case driving this (e.g., "fluency error and terminology error must coexist on the same word in our modified MQM"), or is the current restriction acceptable?

## Known issues / gotchas

- **Default MQM categories are Japanese-English** — must be replaced before real annotation work begins. See MQM Schema Customization section.
- **Export code is fragile for overlaps** (see above).
- **Right-click is the primary annotation interaction** — annotators on touchpads need to know how to right-click (two-finger tap on Mac trackpads).
- **SQLite fallback** is only safe for the single-user demo. Concurrent writes from 5 annotators will hit lock contention.
- **No CSRF protection visible in JWT auth flow** — worth a security review before exposing this beyond a trusted internal network.

## Branch strategy

- **`main`** — tracks `upstream/main` (yaraku/he-tool). Only merges from upstream, never direct work.
- **Feature branches** for everything: `fix/contextmenu-fallback`, `feat/mqm-schema-config`, `feat/postgres-compose`, `feat/json-import`, etc.
- **Open PRs upstream** for any fix that's generally useful (the contextmenu fix is the obvious first candidate). Keeps our carry-load smaller.

## Useful file locations

| What | Where |
| --- | --- |
| Right-click annotation logic | `frontend/src/components/MarkingItem.jsx` |
| Annotation page composition | `frontend/src/features/annotations/AnnotateInstance.jsx` |
| Auth forms | `frontend/src/features/authentication/` |
| Marking model (DB) | `backend/src/human_evaluation_tool/models/marking.py` |
| Marking REST resource | `backend/src/human_evaluation_tool/resources/marking.py` |
| Export endpoint + category labels | `backend/src/human_evaluation_tool/resources/evaluation.py` (lines 170–200) |
| Containerfile | `Dockerfile` (repo root — works with Podman as-is) |

## Things NOT to do without checking first

- **Don't change the data model without a migration.** Flask-Migrate is set up; use it.
- **Don't add features that diverge from upstream unless necessary.** Every divergence is maintenance debt. Prefer upstreaming bug fixes; only fork-only patches for truly project-specific needs.
- **Don't assume English-French specifics are handled.** This codebase was built for Japanese-English; tokenization, character handling, and category labels may all have ja-en assumptions baked in.
- **Don't `docker ...` by reflex.** This project uses Podman. Commands look identical but mixing the two on the same machine produces confusing "image not found" errors when an image is in one runtime's storage and you query the other.

---

*Last updated: 2026-04-15. Update this file as decisions are made and patches land.*
