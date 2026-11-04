# Run Chainroom

## Run locally

Use Linux or Debian/WSL with Node.js 22.13 or newer, npm, Git, Python 3.11+ (with PyYAML), Docker Engine and Docker Compose v2. The official `codex` CLI and `rtk` must be on the controller's PATH. Authenticate Codex first and confirm it can run with your existing provider. Switch runs locally; provider inference needs network access.

```sh
git clone https://github.com/greyw0rks/chainroom.git
cd chainroom
```

No npm dependencies are needed for Chainroom's scripts or tests. Bootstrap downloads the pinned Switch 0.31.0 Compose file and generates local credentials; the controller installer verifies the signed release before installing it into `.tools/`. Prepare the separate fixture repository, then start the services:

```sh
node scripts/bootstrap.mjs
node scripts/install-controller.mjs
node scripts/prepare-demo.mjs
docker compose --project-name chainroom --env-file .env \
  -f .tools/switch-compose.yml -f deploy/chainroom.override.yml \
  --profile collab --profile gateway up -d
```

Open Gateway at http://127.0.0.1:8080 and Mattermost at http://127.0.0.1:8065. The generated `.env` contains `GATEWAY_ADMIN_EMAIL` / `GATEWAY_ADMIN_PASSWORD` and `MATTERMOST_USER` / `MATTERMOST_USER_PASSWORD`. Keep this file private. Fixture preparation succeeds when it records **four passing and two intentionally failing tests**; the agents will repair those failures during the demo.

Run `npm run check:stack` before enrollment. It checks Switch readiness, the Gateway page and Mattermost's ping endpoint, saves a timestamped result to `.runtime/evidence/stack-health.json`, and exits unsuccessfully while any service is unavailable.

Enroll the controller once, then keep it running in a separate terminal:

```sh
npm run check:stack
npm run enroll
node scripts/run-controller.mjs
```

The wrapper reads `~/.codex/config.toml` and inherits the existing provider credential from the configured environment variable. For a custom provider it creates an ignored, private controller-specific Codex home so Switch can forward the credential. The provider URL and model settings come from your existing Codex configuration. Ensure the configured credential variable is available in the terminal that starts the controller.

Once the controller is connected, provision the agents and private room, verify the builder's Mattermost identity, and grant access:

```sh
npm run status
npm run provision
node scripts/setup-switch.mjs link
node scripts/setup-switch.mjs access full
npm run dashboard
```

Provisioning reads [the checked-in template](../templates/chainroom.template.yaml), creates three separate Codex agent workspaces under `.runtime/workspaces/`, and attaches them to the private **chainroom-incidents** Mattermost channel. Triage coordinates; Engineer reproduces and fixes; Sentinel independently reviews the proposed commit. Use one human report thread for all handoffs, evidence and decisions. Enrollment and provisioning refuse to overwrite existing records; inspect those records before repeating setup.

Open the channel as `builder` and post a report such as the following, substituting your clone's absolute repository path:

> @chainroom-triage Controlled demo regression: 75000000 atomic USDC units with 6 decimals displays 0.000000000075 instead of 75. Reproduce and fix it in /absolute/path/to/chainroom/.runtime/demo-repo, obtain Sentinel's independent review, then request my approval on the exact commit. Keep all handoffs and evidence in this report's thread.

Follow the real evidence at http://127.0.0.1:3018. After Sentinel passes, review the source diff and approve or reject the **full commit SHA** in the dashboard. You can also post `APPROVE CR-001 <full SHA>` or `REJECT CR-001 <full SHA> <reason>` as a human in the original thread. The publication gate is described below; approval alone does not merge or deploy code.

If Windows cannot reach the WSL services, run `node scripts/browser-access.mjs` in another terminal. On the build machine this exposes Gateway at http://127.0.0.1:8082 and Mattermost at http://127.0.0.1:8066. Use numeric addresses. These alternate browser ports are local access helpers, not a public deployment.

## Evidence, Retry and publication

The [publication eligibility inspector](publication-gate.md) checks authenticated authors, independent evidence, human approval and the proposed Git commit. The publication command repeats these checks before pushing the exact commit and opening a PR. Run its automated failure cases with `npm test`. The first live publication passed these checks; each future publication needs its own current review and approval.

Start the local evidence dashboard with `npm run dashboard`, then open http://127.0.0.1:3018. It shows live Switch history, failed-turn Retry and reviewed-commit decisions. Retry sends the controller's native `message.retry` command for the original message, preserving the incident thread. Choose the current model or one of `gpt-6.1-sol`, `gpt-6-astra`, and `gpt-5.6-sol`. Running and completed turns cannot be retried. The CLI equivalent is `npm run retry -- engineer` or `npm run retry -- engineer gpt-6-astra`.

The controller retains the existing Codex provider URL and auth configuration. An optional ignored `.runtime/provider-key-source.json` can select a line from a private credential file using `{ "path": "/absolute/private/provider-keys.txt", "index": 0 }`; otherwise it uses the configured environment variable. Never commit the credential file. Keys never enter the dashboard or Switch messages. Run the controller through `node scripts/run-controller.mjs` to enable the local Retry adapter. See [resume instructions](RESUME.md) for the build machine's current workflow.

Run `npm test` for the publication, snapshot, Switch-history and Retry checks. `npm run demo:test` deliberately fails on the original fixture until the fix is applied in an isolated workspace. The published [demo PR](https://github.com/greyw0rks/chainroom-demo/pull/1) is the successful end-to-end result; [submission details](submission.md) describe the demo and track.

MVP is complete only after a real Mattermost report becomes an independently verified GitHub PR with a human decision. See [build status](build-status.md) for what has actually been verified.
