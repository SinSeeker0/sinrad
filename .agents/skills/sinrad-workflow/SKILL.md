---
name: sinrad-workflow
description: Make, diagnose, review, or verify changes in the SINRAD Electron repository using targeted inspection and proportionate tests. Use for SINRAD code, UI, extension, storage, compression, updater, build, and release work; do not use for unrelated questions.
---

# SINRAD Workflow

Keep the workflow reliable without loading unnecessary history or repeatedly running broad checks. The user's current instructions take precedence.

## Inspect narrowly

1. Check `git status --short` once and preserve unrelated work.
2. Locate the relevant code with `rg`; read only likely owners and their tests.
3. Do not read the complete maintenance memory by default. Search `SINRAD_MAINTENANCE_MEMORY.txt` for the affected module or use `Get-Content SINRAD_MAINTENANCE_MEMORY.txt -Tail 160`. Read it fully only for an explicit historical audit.
4. Reuse existing helpers and regression tests before adding new abstractions.

## Change safely

- Every new nested tab/page area must expose Back in its right-click menu to return to its parent. Preserve existing reader back behavior and verify the context-menu click path.

- Give new GUI controls a brief, subtle bubble-pop entrance and appropriate hover/press feedback. Respect `prefers-reduced-motion`; avoid layout shifts and keep notifications ahead of controls that share their space.

- Keep the edit within the user's requested behavior.
- For UI interactions, verify the real click path and visible state rather than only matching source text.
- Add or change tests when they protect behavior, persistence, navigation, IPC, or a past regression. Avoid tests that only repeat implementation wording.
- Do not release, publish, commit, or discard user work unless explicitly requested.

## Verify in proportion to risk

Choose the narrowest check that covers the change:

- For a tiny, isolated CSS or text adjustment, inspect the changed selector and capture the affected view. Do not run the full app suite unless the edit touches shared styles, layout structure, behavior, or another unresolved risk.
- Run `node scripts/sinrad-verify.js <level>` once when automated coverage is warranted:

- `quick`: syntax-check only changed JavaScript files. Use for isolated, low-risk JavaScript edits.
- `standard`: full lint and automated tests. Use for application logic, storage, extension, and backend behavior.
- `ui`: standard checks plus the visible Electron UI smoke test. Use for navigation, layout, reader, menus, dialogs, and user interactions.

Do not rerun an unchanged suite after it passes. Broaden testing only after failures, additional edits, or unresolved risk.

Create and check a packaged build when the change depends on packaged Electron behavior, IPC, updater/install flows, filesystem integration, codecs, native paths, or when the user requests a release candidate. Ordinary static UI polish does not require packaging unless its runtime behavior differs in the packaged app.

## Finish concisely

- Review the final diff for accidental changes and secrets.
- Append a short maintenance-memory entry only for durable product behavior, a regression invariant, a release, or a discovery future work would otherwise repeat. Do not record routine inspections, formatting, or test-only work.
- Report the result, checks run, packaged-build location when applicable, and any real remaining issue. Do not claim an unverified bug is fixed.
