# Build status

Started November 3, 2026. This file reports evidence, not target behavior.

- [x] Codex CLI 0.166.0, Node 22.23.4 and Git 2.47.3 available in Debian/WSL.
- [x] Official Switch documentation MCP added to existing Codex configuration.
- [x] Codex provider reachability passed outside the sandbox; original thread-history integrity failure remains untouched.
- [x] Docker Engine 26.1.5 and Compose 2.26.1 installed in Debian.
- [x] Switch server 0.31.0 Compose file downloaded and local secrets generated.
- [x] Three-agent Switch template and detailed blueprint written.
- [x] TypeScript demo run: four tests pass and two USDC tests fail with actual incorrect balances.
- [ ] Switch, Mattermost and database containers healthy.
- [x] Official controller installed; release-2026-10 signature verified, package SHA-256 `8f096275edde4b87dacea9c565c96b30eef756156274149c64cc40b582ac09bf`.
- [x] Native Codex app-server inspected: `accountType=null`, `requiresOpenaiAuth=false`; existing AgentRouter credential present, no OpenAI sign-in required.
- [x] Separate demo Git repository at `.runtime/demo-repo`, initial commit `c719c0f5d7c56140dd7891f9a1ba63ad6b84d096`, actual baseline evidence `.runtime/evidence/baseline.json`.
- [ ] Controller enrolled and online.
- [ ] Installed server validates and provisions template.
- [ ] Codex replies to a human Mattermost message through Switch.
- [ ] Triage delegates through Switch to Engineer.
- [ ] Engineer creates isolated worktree and tested commit.
- [ ] Sentinel independently verifies the commit.
- [ ] Human approval on reviewed SHA recorded.
- [ ] Deterministic publication gate implemented and failure cases tested.
- [ ] Real GitHub PR published.
- [ ] Minimal live evidence dashboard.
- [ ] Actual demo video and public submission repository.

Existing global Codex thread-history database fails its integrity check. Switch creates separate native session homes; the existing database was not repaired or deleted.

Current infrastructure startup is downloading images; no containers are ready and no live Mattermost reply has been verified. A first verbose download was interrupted and restarted with quiet progress. The live workflow and dashboard remain future build gates.

Verification completed: all JavaScript scripts pass syntax checks, both templates parse as YAML (one-agent smoke and three-agent workflow), the reviewed Compose checksum matches, bootstrap preserves existing credentials, the independent demo working tree is clean, and private credentials/runtime/downloads are excluded from Git. API helpers await a running-server check.
