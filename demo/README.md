# Chainroom demo repository

This is an intentionally faulty token-balance formatter used to demonstrate a real engineering workflow. It is a controlled fixture, not an actual customer incident or production deployment.

A USDC balance of `75000000` atomic units with `decimals=6` should display `75`. After a simulated integration regression it displays `0.000000000075`. The 18-decimal asset cases still pass.

Run `npm test` with Node 22.13 or later. The starting revision has two failing USDC regressions and four passing tests. No dependency installation, RPC access, wallet or credentials are needed.

Chainroom Engineer must reproduce the failure, make a minimal fix on a separate branch and preserve exact arithmetic. Sentinel reviews that commit independently. A human approves the reviewed commit before a PR is published.
