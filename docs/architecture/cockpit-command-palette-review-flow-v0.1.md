# Cockpit Command Palette Review Flow v0.1

Status: proof implementation — 2026-09-26

Boundary: catalog -> resolver -> command interface -> parameter interaction -> review -> explicit approval -> existing host invocation.

The flow is orchestration only. It does not own provider execution, authorization, credentials, execution policy, or approval authority.

Safety properties: unknown commands fail closed; invalid parameters cannot reach review or invocation; review is inert; invocation requires explicit approval; the final message remains the existing eco.cockpit.invokeProviderCommand intent.

This proof does not rewrite the existing palette UI or replace provider-specific approval dialogs.