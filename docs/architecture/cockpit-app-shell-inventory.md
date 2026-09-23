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
| Diagnostics | Currently embedded in the historical tabbed Cockpit GUI | No | Treat as an embedded product/feature surface for now; this does **not** establish permanent Cockpit ownership. |
| Marlin Audit | Currently embedded Marlin provider surface in the Cockpit tabbed GUI | No | Guest feature; composition in Cockpit is not architectural ownership. |
| Marlin Doctor | Currently embedded Marlin provider surface in the Cockpit tabbed GUI | No | Guest feature; composition in Cockpit is not architectural ownership. |
| Setup Wizard content | Current implementation contains Marlin setup assumptions | No | Keep as provider/product feature; only reuse generic wizard frame. |
| Niji | Currently embedded Niji provider/product surface in the Cockpit tabbed GUI | No | Guest feature; composition in Cockpit is not architectural ownership. |
| Sealdex | Currently embedded Sealdex provider/product surface in the Cockpit tabbed GUI | No | Guest feature; composition in Cockpit is not architectural ownership. |
| LASSO scratchpad | Currently embedded domain/workspace surface in the Cockpit tabbed GUI | No | Guest feature; composition in Cockpit is not architectural ownership. |
| Eco status/run/escalation/artifact metrics | Currently embedded operational surface in the Cockpit tabbed GUI | No | Keep out of reusable shell; historical placement does not establish permanent Cockpit ownership. |
| Marlin/Sealdex assets | Product branding | No | Brand assets stay outside App Shell core. |
| `web/install.*` | Separate constrained installer template | Not the same shell | Keep separate. It is an installer/application template, not evidence that the main Cockpit shell is reusable. |

## Ownership clarification: composition is not ownership

The historical tabbed Cockpit implementation combined two different concerns:

1. **Cockpit-owned shell/infrastructure** — navigation, layout, host integration, state infrastructure, and generic interaction primitives.
2. **Guest application/provider surfaces** — Marlin, Niji, Sealdex, LASSO, diagnostics, and operational/eco views that happened to be mounted inside Cockpit tabs.

That composition is why those surfaces still appear in the current GUI inventory. **They are not being designated as permanent Cockpit responsibilities.** The tabbed implementation made *where a surface was rendered* look like *who owns the surface*. The App Shell work is intended to separate those concepts.

- **Cockpit tabs are a Cockpit navigation mechanism.**
- **The contents of those tabs are not automatically Cockpit-owned.**
- A provider or application surface may be rendered as a Cockpit tab while remaining owned by that provider/application.
- When the App Shell is extracted, those surfaces should enter through the application-definition/feature boundary rather than being baked into the reusable shell.

### Target composition

```text
                 APP SHELL
                     │
             ┌───────┴────────┐
             │                │
          COCKPIT          OTHER APP
             │                │
       ┌─────┼──────┐         └── its own features
       │     │      │
    Marlin  Niji  Sealdex
    surface surface surface
       │
    LASSO / other guest surfaces
```

The key distinction is:

> **Cockpit can host a surface without owning its domain semantics.**

This is the intended reconciliation of the current tabbed GUI with the newer reusable App Shell direction.

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

The following are **currently embedded product/provider concerns**, not a declaration that Cockpit should own them permanently:

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


## Phase 1 — cockpit.js function/render/event-handler classification

**Status:** COMPLETED / EXTRACTION MAP (2026-09-23)

The function-level pass confirms the architectural problem: cockpit.js is a composition bundle, not a clean shell module. Reusable pieces are interleaved with Cockpit product behavior and provider workflows. This classification is an extraction map; it does not authorize extracting everything marked reusable.

### Classification rules

- **Shell infrastructure** — lifecycle, host transport, shell state plumbing, navigation/lifecycle orchestration, and composition mechanisms that can survive independently of Cockpit product content.
- **Generic UI primitive** — presentation or interaction building blocks reusable by another application without importing Cockpit/provider semantics.
- **Cockpit core** — functionality belonging to Cockpit as the universal operational host/control surface.
- **Provider feature** — Marlin, Niji, Sealdex, Audit/Doctor, agent/provider, or LASSO/domain behavior currently mounted by Cockpit.
- **Compatibility code** — migration/proxy behavior retained for the existing GUI programming model rather than forming the future shell API.

### Function map

| Function | Class | Extraction disposition |
|---|---|---|
| findProviderCommand | Provider feature | Provider catalog adapter. |
| providerCommandTitle | Provider feature | Provider metadata helper. |
| providerCommandInputSummary | Generic UI + provider integration | Generic display; provider metadata supplies model. |
| providerCommandRequiresConfirmation | Provider feature | Provider-contract interpretation stays outside shell. |
| renderCommandPalette | Generic UI + provider integration | Extract palette UI; inject command model. |
| cloneStateValue | Shell infrastructure | Reusable state utility. |
| setSnapshotPath | Shell infrastructure | State plumbing. |
| readRawStatePath | Shell infrastructure | State plumbing. |
| makeStateProxy | Compatibility code | Do not expose in App Shell API. |
| readStatePath | Compatibility code | Legacy state facade. |
| writeStatePath | Compatibility code | Legacy state facade. |
| deleteStatePath | Compatibility code | Legacy state facade. |
| renderSnapshot | Cockpit core | Split composition before extraction. |
| renderRuns | Cockpit core | Run semantics stay Cockpit; table primitive reusable. |
| renderSelectedRun | Cockpit core | Generic detail presentation can be extracted. |
| renderEscalations | Cockpit core | Generic approval/action presentation can be extracted; escalation semantics stay out. |
| renderArtifacts | Cockpit core | Generic table/action UI reusable; artifact semantics stay out. |
| renderPolicy | Cockpit core | Policy surface; editor primitive reusable. |
| renderDevelopmentReadiness | Provider feature | Marlin/setup surface. |
| renderGovernance | Cockpit core | Governance surface; generic issue-table UI reusable. |
| statusLabel | Generic UI primitive | Generic status helper. |
| renderDiagnostics | Cockpit core / embedded feature | Currently embedded; not permanent shell ownership. |
| computeGovernanceState | Cockpit core | Cockpit governance semantics. |
| renderProviderSummary | Shell infrastructure / provider integration | Generic provider-status presentation. |
| renderEditorPlaneBar | Cockpit core | Cockpit operational summary. |
| formatTimeLoc | Generic UI primitive | Generic time presentation helper. |
| renderHelmMode | Cockpit core | Mode semantics stay Cockpit/HELM; selector/history UI reusable. |
| renderWizard | Shell infrastructure | Generic wizard composition; inject steps. |
| renderWizardMarlinStep | Provider feature | Marlin feature. |
| renderMarlinPackageResults | Provider feature | Marlin workflow. |
| renderMarlinPackageApproval | Provider feature | Marlin workflow; generic approval UI reusable. |
| renderMarlinInstallResult | Provider feature | Marlin workflow. |
| syncAuditRepositories | Provider feature | Audit integration. |
| resetAuditResults | Provider feature | Audit workflow state. |
| runAuditCommand | Provider feature | Audit invocation. |
| handleAuditProviderResult | Provider feature | Audit result handling. |
| openAuditApproval | Provider feature | Audit workflow; generic dialog reusable. |
| closeAuditApproval | Provider feature | Audit workflow. |
| confirmAuditApproval | Provider feature | Audit approval workflow. |
| approvalScope | Provider/authority boundary | Keep authority logic outside shell. |
| canonicalStringify | Shell infrastructure | Generic deterministic serialization utility if still required. |
| approvalToken | Provider/authority boundary | Do not extract; token authority remains host/provider/backend-owned. |
| syncDoctorRepositories | Provider feature | Doctor integration. |
| runDoctorCommand | Provider feature | Doctor invocation. |
| openDoctorApproval | Provider feature | Doctor approval workflow. |
| closeDoctorApproval | Provider feature | Doctor workflow. |
| confirmDoctorApproval | Provider feature | Doctor workflow. |
| registerDoctorOperationFromForm | Provider feature | Doctor form semantics. |
| handleDoctorProviderResult | Provider feature | Doctor result handling. |
| renderDoctorWorkflow | Provider feature | Doctor surface. |
| renderDoctorHealth | Provider feature | Doctor surface. |
| renderDoctorOperationsTable | Provider feature + generic table UI | Feature semantics stay out; table UI reusable. |
| collectOperationInput | Provider feature | Doctor input semantics. |
| inputsComplete | Generic UI + provider integration | Generalize only after separating provider rules. |
| updateExecutionButtons | Generic UI + provider integration | Generalize form-state behavior. |
| runAgentCommand | Provider feature | Agent workflow. |
| openAgentApproval | Provider feature | Agent approval workflow. |
| closeAgentApproval | Provider feature | Agent workflow. |
| confirmAgentApproval | Provider feature | Agent workflow. |
| registerAgentTemplateFromForm | Provider feature | Agent workflow. |
| handleAgentProviderResult | Provider feature | Agent result handling. |
| renderAgentRosterWorkflow | Provider feature | Agent surface. |
| renderAgentRosterTable | Provider feature + generic table UI | Feature semantics stay out. |
| renderAuditWorkflow | Provider feature | Audit is a guest surface despite current Cockpit placement. |
| auditStageLabel | Provider feature | Audit semantics. |
| renderAuditResult | Provider feature + generic result UI | Result presentation reusable. |
| evidenceBundle | Provider feature | Audit evidence semantics. |
| auditFindings | Provider feature | Audit semantics. |
| exportAuditEvidence | Provider feature | Audit evidence export. |
| renderNiji | Provider feature | Niji surface. |
| handleNijiProofProviderResult | Provider feature | Niji workflow. |
| renderNijiProof | Provider feature | Niji proof workflow. |
| renderSealdexPlan | Provider feature | Sealdex surface. |
| collectSealdexEntryFields | Provider feature | Sealdex data-entry semantics. |
| handleSealdexEntryProviderResult | Provider feature | Sealdex workflow. |
| renderSealdexEntry | Provider feature | Sealdex surface. |
| renderSealdexEntryFields | Provider feature + generic form UI | Field renderer reusable after schema injection. |
| renderWorkspaceExplorer | Cockpit core | Workspace composition is Cockpit infrastructure; tree UI reusable. |
| renderWorkspaceSelection | Generic UI primitive | Generic selected-item metadata presentation. |
| renderWorkspaceRepos | Cockpit core + generic list UI | Repository semantics stay out; list UI reusable. |
| mergeLassoLanes | Provider/domain feature | LASSO/Compose semantics are guest functionality. |
| syncRunFilterOptions | Cockpit core + generic control | Generic select behavior reusable; run semantics stay out. |
| filteredRuns | Cockpit core | Run model semantics. |
| parsePolicy | Cockpit core + generic editor | JSON editor validation pattern reusable; policy semantics stay out. |
| setActiveTab | Shell infrastructure | Strong extraction candidate; inject tab definitions. |
| renderList | Generic UI primitive | Strong extraction candidate. |
| showNotice | Generic UI primitive | Strong extraction candidate. |
| clearNotice | Generic UI primitive | Strong extraction candidate. |
| post | Shell infrastructure | Host adapter seam. |
| invokeProviderCommand | Shell infrastructure / provider integration | Neutral intent construction; authority stays host/provider. |
| normalizeSnapshot | Shell infrastructure / Cockpit adapter | Generalize through injected state adapter. |
| emptySnapshot | Cockpit core | Current snapshot is Cockpit-shaped; do not freeze in shell. |
| staticPreviewSnapshot | Cockpit core / preview | Product-specific preview data; not shell. |
| emptyRecords | Cockpit core | Cockpit record model. |
| recordId | Generic UI primitive | Generic record identity helper. |
| emptyTableRow | Generic UI primitive | Strong extraction candidate. |
| emptyDiv | Generic UI primitive | Strong extraction candidate. |
| emptyMetadata | Generic UI primitive | Strong extraction candidate. |
| metadataRow | Generic UI primitive | Strong extraction candidate. |
| cell | Generic UI primitive | Strong extraction candidate. |
| option | Generic UI primitive | Strong extraction candidate. |
| clear | Generic UI primitive | DOM helper. |
| byId | Generic UI primitive | DOM lookup helper. |
| workspaceId | Cockpit core | Current workspace identity model. |
| yesNo | Generic UI primitive | Generic display helper. |

### Event-handler map

**Shell / generic candidates:** refresh, command-palette open/close/filter, tab selection, wizard back/next, host message delivery, generic notice/timer behavior, workspace-tree selection, and generic run-table selection.

**Cockpit-core handlers:** run copy/rerun, launcher submission, policy validate/save/revert/open, artifact undo/open/delete, mode activation, workspace reveal/status actions, and escalation decision presentation.

**Provider-feature handlers:** Marlin package search/resolve/approval/install; Audit validate/preview/approval/evidence; Doctor refresh/health/add-operation/approval; Agent roster/detect/add-template/approval; Niji proof; Sealdex plan/entry/approval; LASSO merge/clear.

### Concrete extraction map

cockpit.js
├── APP SHELL CANDIDATES
│   ├── host adapter / post()
│   ├── lifecycle + message delivery
│   ├── navigation / setActiveTab()
│   ├── wizard composition
│   ├── state infrastructure
│   └── generic UI primitives
├── COCKPIT CORE
│   ├── operational snapshot composition
│   ├── runs / escalations / artifacts
│   ├── governance
│   ├── HELM mode integration
│   └── workspace operational composition
├── GUEST / PROVIDER SURFACES
│   ├── Marlin
│   ├── Audit / Doctor
│   ├── Agents
│   ├── Niji
│   ├── Sealdex
│   └── LASSO
└── COMPATIBILITY
    └── legacy state proxy

### Phase 1 finding

The extraction seam is now concrete enough to proceed to Phase 2 without redesigning Cockpit itself. Shell primitives should be extracted from the bottom of the dependency tree upward; provider surfaces should be detached from the shell rather than rewritten as shell features.

The first extraction targets are the lowest-risk, highest-reuse pieces: DOM/presentation helpers, notice handling, navigation, host adapter, state infrastructure, and generic workflow primitives. Large render/composition functions should be split only after those seams exist.

No CKP.20.00 implementation PASS is created by this classification alone. The next architectural step is **Phase 2 — define the minimal App Shell interfaces/contracts from this map**.
