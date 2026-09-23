# Cockpit GUI / Reusable App Shell Inventory

**Status:** CURRENT ARCHITECTURE INVENTORY / EXTRACTION INPUT  
**Updated:** 2026-09-23  
**Current-state authority:** `docs/architecture/cockpit-current-state.md`

## Purpose

Inventory the existing browser GUI before creating a reusable App Shell implementation PASS. The goal is to distinguish reusable shell infrastructure from Cockpit product/domain surfaces and identify the smallest safe extraction seam.

This document is an inventory and boundary decision aid. It does not claim that a reusable App Shell has been extracted or that Mode 2 is proven.

## Evidence inspected

Primary GUI artifacts:

- `web/cockpit.html`
- `web/cockpit.css`
- `web/cockpit.js`
- `web/cockpitState.js`
- `web/tests/cockpitState.test.js`
- `web/install.html`
- `web/install.css`
- `web/install.js`

Relevant existing boundary:

- `window.cockpitHost.postMessage()` host contract
- host-to-bundle `window.postMessage(...)` delivery
- versioned `CockpitState` store
- provider command catalog v1/v1.1

## Inventory

| Area | Current implementation | Reusable App Shell? | Decision |
|---|---|---:|---|
| Document/frame | `cockpit.html` main shell structure | Yes | Extract shell frame/layout primitives; remove Cockpit branding and product tabs from the reusable layer. |
| Global styling | `cockpit.css` layout, typography, controls, panels, tabs, grids | Mostly | Reuse structural tokens/components; keep Cockpit-specific labels/assets/themes out of core. |
| Host bridge seam | `window.cockpitHost.postMessage` + message listener | Yes | Preserve as the primary host-neutral integration seam. Rename only if a future contract migration explicitly warrants it. |
| State store | `web/cockpitState.js` versioned store with UI ownership rules | Yes, with scope | Reuse as a generic application-shell state primitive, but do not move provider workflow state into it. |
| State compatibility proxy | `state.foo.bar` facade in `cockpit.js` | No | Retain only for Cockpit migration compatibility; do not make it part of the reusable shell API. |
| Connection badge / host status | Generic concept; current labels are Cockpit-specific | Yes | Extract a generic connection/status component with injectable label/status model. |
| Refresh / lifecycle controls | Generic shell behavior | Yes | Extract as shell lifecycle hooks/actions; host semantics remain injected. |
| Command palette | Generic presentation, provider-catalog-specific data contract | Conditional | Shell can host a command-discovery surface; provider catalog interpretation belongs to the provider integration layer. |
| Tabs/navigation | Generic mechanism, current tab inventory is product-specific | Yes | Extract navigation primitive/router; inject tab definitions and groups. |
| Panels/cards/lists/forms | Generic UI primitives | Yes | Strong App Shell candidates. |
| Workspace status | Current UI consumes Cockpit/eco state | Conditional | Keep workspace model/provider data outside shell; shell may expose a generic workspace context slot. |
| Approvals | Generic human-approval UX, current actions are provider-specific | Yes, presentation only | Extract approval dialog/state interface; authority and approval token generation remain host/provider/backend-owned. |
| Wizard frame/progress | Generic multi-step interaction pattern | Yes | Extract stepper/wizard primitive; current Marlin setup flow remains a feature/provider module. |
| Run filtering/selection | Generic interaction primitive, current run model is Cockpit-specific | Conditional | Extract filter/selection components, not Cockpit run semantics. |
| Diagnostics | Product-specific current content | No | Remain Cockpit feature/provider surface. |
| Marlin Audit | Marlin/provider surface | No | Guest feature. |
| Marlin Doctor | Marlin/provider surface | No | Guest feature. |
| Setup Wizard content | Current implementation contains Marlin setup assumptions | No | Keep as provider/product feature; only reuse generic wizard frame. |
| Niji | Provider/product surface | No | Guest feature. |
| Sealdex | Provider/product surface | No | Guest feature. |
| LASSO scratchpad | Domain/product surface | No | Guest feature. |
| Eco status/run/escalation/artifact metrics | Cockpit/eco product surface | No | Keep out of reusable shell; expose extension slots/data adapters if needed. |
| Marlin/Sealdex assets | Product branding | No | Brand assets stay outside App Shell core. |
| `web/install.*` | Separate constrained installer template | Not the same shell | Keep separate. It is an installer/application template, not evidence that the main Cockpit shell is reusable. |

## What is genuinely reusable

The current GUI already contains a substantial reusable interaction system:

1. **Application frame**
   - top-level header
   - content region
   - navigation region
   - footer/status region

2. **Navigation primitives**
   - tab selection
   - grouped navigation labels
   - active-state rendering
   - scrollable navigation

3. **Presentation primitives**
   - status cards
   - panels
   - lists
   - tables
   - forms
   - buttons
   - notices
   - empty/error states

4. **Workflow primitives**
   - wizard/step progression
   - progress indication
   - human approval dialog
   - result/error presentation

5. **Host integration**
   - host-neutral message transport
   - lifecycle/refresh messaging
   - connection state presentation

6. **State infrastructure**
   - versioned state envelope
   - revisioning
   - UI-field ownership
   - subscription
   - snapshot replacement

These are the strongest candidates for a reusable **App Shell**.

## What must remain outside the App Shell

The following are Cockpit/product or provider concerns:

- Cockpit-specific status metrics and terminology
- provider/domain workflows
- Marlin Audit and Doctor semantics
- Niji and Sealdex surfaces
- LASSO/Compose semantics
- provider command meanings
- provider approval authority
- provider integrity/attestation
- execution decisions
- credentials, grants, tokens, and secrets
- Cockpit's current compatibility proxy
- product-specific branding and assets

The shell may **render** an approval surface, but it must never become the authority that decides whether an operation is authorized.

## Existing extraction seam

The safest seam is **not** "copy `cockpit.js` into another application."

The seam should be:

`App Shell UI`
→ injected **application definition**
→ injected **host adapter**
→ injected **state model**
→ injected **feature/provider surfaces**

Conceptually:

```
Reusable App Shell
  ├── frame / layout
  ├── navigation
  ├── panels / controls
  ├── workflow primitives
  ├── approval presentation
  ├── connection/lifecycle presentation
  └── extension slots
          │
          ├── application definition
          ├── host adapter
          ├── state contract
          └── feature/provider modules
```

The existing `window.cockpitHost` seam is already close to the required host adapter boundary. The main missing separation is that `cockpit.js` currently contains both reusable rendering/infrastructure and Cockpit/provider feature behavior in one very large bundle.

## Recommended extraction order

Do **not** extract the whole GUI immediately.

### Phase 1 — classify

Inventory functions/renderers/event handlers in `cockpit.js` into:

- shell infrastructure
- generic UI primitive
- Cockpit core
- provider feature
- compatibility code

### Phase 2 — define contracts

Define minimal interfaces for:

- application definition
- navigation item
- host adapter
- state adapter
- feature surface
- approval presentation
- lifecycle/status presentation

### Phase 3 — extract primitives

Move only demonstrably generic pieces behind those interfaces.

### Phase 4 — prove a derived app

Build one separately branded, intentionally small application using the extracted shell.

The derived application should contain enough navigation and workflow behavior to prove reuse, but should not simply rename Cockpit.

## Important architectural conclusion

The existing GUI is **already partially host-agnostic and partially shell-like**, but it is not yet a reusable App Shell.

The correct extraction target is therefore:

> **the reusable interaction infrastructure underneath Cockpit's current product surface — not Cockpit itself.**

Cockpit remains one application of that shell.

This preserves the current product identity:

> **Universal Cockpit, provider surfaces as guests.**

while allowing a future architecture of:

> **App Shell, applications as guests.**

No implementation PASS is created by this inventory alone.
