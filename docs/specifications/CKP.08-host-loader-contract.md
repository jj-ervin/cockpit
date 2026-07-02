# CKP.08 Host Loader Contract

Status: active slice
Updated: 2026-07-02

## Scope

CKP.08 extracts Cockpit's webview UI (`web/cockpit.html`, `web/cockpit.css`,
`web/cockpit.js`) out of `eco-vscode` into a host-agnostic bundle owned by this
repo. This document is the contract a host must implement to mount that
bundle. `web/cockpit.js` contains no host-specific API calls (no
`acquireVsCodeApi()`, no Electron IPC, no browser-only APIs) — every host
interaction goes through the two mechanisms below.

## What the bundle expects from a host

1. **`window.cockpitHost.postMessage(message)`** must be set before
   `cockpit.js` executes. The bundle calls this to send `eco.cockpit.ready`,
   `eco.cockpit.refresh`, and future action messages to the host.
2. **`window.postMessage(data, "*")`** (the standard web platform API, not a
   host-specific one) is how the host delivers state back to the bundle. The
   bundle listens via `window.addEventListener('message', ...)` and only acts
   on `{ type: 'eco.cockpit.state', payload }` messages.

The bundle does not call `cockpit.host_bridge` (the Python stdin/stdout JSON
bridge) directly — that stays a host responsibility. The host owns the
process boundary; the bundle only owns rendering and the two message-passing
primitives above.

## What a host must provide

| Responsibility | Detail |
| --- | --- |
| Mount point | Load `cockpit.html`, `cockpit.css`, `cockpit.js` into a rendering surface (VS Code `WebviewPanel`, Electron `BrowserWindow`, or a plain `<iframe>`/page). |
| Template substitution | `cockpit.html` contains `${cspSource}`, `${nonce}`, `${cockpitCssUri}`, `${cockpitJsUri}`, `${cockpitHostBootstrap}` placeholders. A host must substitute real values (or empty/permissive ones for hosts without a CSP model, e.g. a local Electron shell). |
| `window.cockpitHost` | `${cockpitHostBootstrap}` must be replaced with a `<script nonce="${nonce}">window.cockpitHost = { postMessage(msg) { /* host-specific send */ } };</script>` block, placed before the `cockpit.js` `<script>` tag so `window.cockpitHost` exists when the bundle runs. |
| Bridge relay | Call `cockpit.host_bridge` (subprocess, stdin/stdout JSON) for `health`/`get_state`/`list_records`/`get_record`, and relay the result to the bundle as `window.postMessage({ type: 'eco.cockpit.state', payload: ... }, '*')`. |
| Lifecycle | Re-render on `eco.cockpit.refresh` by re-running the bridge relay step. |

## Reference implementation: VS Code loader (eco-vscode)

`eco-vscode`'s loader is the first host implementation. It:

1. Resolves the `cockpit` Python package per `cockpitBridgeConfig.ts`'s existing
   sibling-checkout / setting / active-environment order (unchanged by this
   contract).
2. Fills the HTML template placeholders with `webview.cspSource`, a generated
   nonce, and `webview.asWebviewUri(...)` results for `cockpit.css`/`cockpit.js`.
3. Substitutes `${cockpitHostBootstrap}` with a script that calls
   `acquireVsCodeApi()` once and sets
   `window.cockpitHost = { postMessage: vscode.postMessage.bind(vscode) }`
   — the only place `acquireVsCodeApi()` appears anywhere in the Cockpit UI
   surface.
4. Listens for `webview.onDidReceiveMessage` and relays `eco.cockpit.ready`/
   `eco.cockpit.refresh` to the Python bridge, posting the result back via
   `webview.postMessage({ type: 'eco.cockpit.state', payload })`.

## Future hosts

An Electron host follows the same shape: `window.cockpitHost.postMessage`
sends over Electron IPC to the main process, which calls the same
`cockpit.host_bridge` subprocess and relays the result back via
`webContents.executeJavaScript` or a preload-script `postMessage` bridge. A
plain-browser host (e.g. a future local dev server) can skip the CSP/nonce
substitution entirely and call `cockpit.host_bridge` from a small local HTTP
shim.

## Non-Goals

- This contract does not add write operations, package mutation, or approval
  execution. Those remain governed by the adapter/bridge boundary declared in
  CKP.04.00 and CKP.07 (Marlin governance panel).
- This contract does not require every future host to use VS Code's CSP/nonce
  model — hosts without a content-security-policy concept may substitute
  permissive/empty values.
