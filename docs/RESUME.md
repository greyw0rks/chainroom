# Resume the first build milestone

Project root: `/home/greyw0rks/chainroom`. The blueprint and starter implementation are ready. The first acceptance gate, a real Codex reply through Switch in Mattermost, is still pending.

Docker Engine and Compose are installed in Debian and the Docker service is running. This user has not been added to the Docker group; use `sudo docker ...` in a regular terminal, or the authorized WSL root command for Docker operations. The sandbox blocks the Docker socket.

The pinned Compose stack is currently downloading images through an ongoing tool session, `73347`. Avoid starting another parallel download. Check it with the tool session or inspect Docker status. Do not wipe volumes or replace `.env` credentials to retry.

```sh
cd /home/greyw0rks/chainroom
sudo docker compose --progress quiet --project-name chainroom --env-file .env \
  -f .tools/switch-compose.yml -f deploy/chainroom.override.yml \
  --profile collab --profile gateway up -d
sudo docker compose --project-name chainroom --env-file .env \
  -f .tools/switch-compose.yml -f deploy/chainroom.override.yml \
  --profile collab --profile gateway ps
```

When the Switch API, Gateway and Mattermost are ready, inspect setup-container results and server health. Then:

```sh
node scripts/setup-switch.mjs enroll
node scripts/run-controller.mjs
```

Leave the controller running. In another terminal:

```sh
node scripts/setup-switch.mjs status
node scripts/setup-switch.mjs smoke
```

Inspect the private provisioning result. Open http://localhost:8065 with the local builder credentials from `.env`. Post in the private `chainroom-connection-check` room:

> @chainroom-connection-check The staking dashboard shows incorrect token balances after a deployment. Classify the incident, severity, missing information and recommended next action. Do not modify code.

Record the actual Mattermost message and Codex response as evidence. Only then provision the full workflow with `node scripts/setup-switch.mjs provision`. These API helpers are prepared against the current source contract but await validation against the running 0.31.0 server; adapt to its actual schema if necessary.

The separate demo repository is already prepared in `.runtime/demo-repo` at commit `c719c0f5d7c56140dd7891f9a1ba63ad6b84d096`. The baseline JSON records four passes, two failures and actual incorrect USDC output. Do not fix it manually before the Switch Engineer workflow.

Installed controller: official signed development build `0.31.1-dev.277.g2d72c57`. Its signer, package hash and source commit are recorded in build-status and the blueprint. If the server refuses its contract, determine the supported release from the live server rather than disabling compatibility checks.

The existing Codex AgentRouter configuration and credential remain intact. Native readiness inspection confirmed no OpenAI sign-in is required. Its global thread-history integrity warning remains untouched; use fresh Switch session homes. Keep the provider credential inherited by the controller environment and out of room messages.
