# Policy packages (external repo)

Policy implementations **do not live in apim-mcp**. They are maintained in a separate **apim-policies** repository (or any external policies workspace).

To install policy-development skills (Cursor / Claude Code / generic agents) into that workspace:

```powershell
powershell -File scripts/install-policy-dev-skills.ps1 -TargetWorkspace "C:\path\to\apim-policies" -Platform All -Force
```

```bash
./scripts/install-policy-dev-skills.sh -TargetWorkspace "$HOME/apim-policies" -Platform All -Force
```

See [docs/pt-BR/instalar-skills-policy-dev.md](../docs/pt-BR/instalar-skills-policy-dev.md) / [docs/en/install-policy-dev-skills.md](../docs/en/install-policy-dev-skills.md).

## MCP fragment tools

| Situation | Tool |
|-----------|------|
| Policy on agent workspace | `axway_apim_fragment_validate_submit` (`files` or `archiveBase64`) |
| Policy mounted in MCP image at `/app/policies/` | `axway_apim_fragment_packages_list` → `axway_apim_fragment_validate` |

## This directory

| Path | Purpose |
|------|---------|
| `.sandbox/` | Ephemeral uploads for `validate_submit` (gitignored, auto-purged) |

Optional: mount an external `policies/` tree here in Docker/K8s to bake packages into the MCP image without copying them into this repo.

## Example package

See a package under **apim-policies** (e.g. `policies/example-policy-package/`) — README, scripts, and deploy workflows live in that repo, not here.
