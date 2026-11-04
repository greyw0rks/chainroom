# Chainroom

Chainroom turns a bug report in chat into a tested fix that a human can review and approve. It is built for small engineering teams who want to see how a fix was made before they trust it.

A builder reports an issue in a private Mattermost channel. Switch connects three Codex agents in that room: Triage understands the report and assigns the work, Engineer reproduces the bug and proposes a fix, and Sentinel checks the exact change independently. Their handoffs, test results and decisions stay in the original report’s thread.

The builder follows the work in chat or the evidence dashboard, reviews the change and approves the exact commit. Chainroom checks the evidence and approval before opening a GitHub pull request. Failed agent turns can be retried in the same thread.

The completed demo fixes an intentionally introduced balance bug: 75 USDC appeared as 0.000000000075. Engineer reproduced it, Sentinel independently verified the fix, and the builder approved the reviewed commit. The [resulting pull request](https://github.com/greyw0rks/chainroom-demo/pull/1) is open; the original failing example remains available.

[Run Chainroom](docs/setup.md) · [See the demo](https://github.com/greyw0rks/chainroom-demo/pull/1) · [Submission details](docs/submission.md)

Built solo for Flip the Switch’s Best Business Workflow track.
