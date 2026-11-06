# Project overview

## Problem

A relative abroad has €300 for a family in a conflict-affected area. The transfer can succeed and the family can
still be unable to buy food: the bank is unreachable, cash agents take 20%, internet is intermittent and nearby
merchants don't accept the wallet. **Sending money is not the same as making money usable.**

## What LIFELINE does

1. **Understand** (Situation Intelligence): turn a plain-language message into needs, budget, urgency and the
   recipient's practical financial access, keeping anything unstated as "unknown".
2. **Route** (Financial Intelligence): compare routes on fees, usable value, accessibility and risk; flag
   unusual fees; recommend only routes that can actually be used.
3. **Shop** (Commerce Intelligence): build a basket of essentials from Channel3 and verified local merchants
   within the usable budget, keeping an emergency reserve.
4. **Approve and pay**: donor and NGO approve; the backend checks the rules; PayPal Sandbox processes the payment;
   webhooks update the ledger; the dashboard shows the outcome.

## Principles

- AI may assess, compare, explain and recommend. It never authorises a financial action.
- Agent output is untrusted until validated against the contract and the rules.
- Missing data stays unknown.
- The accessibility score explains; it never denies aid or lowers priority.
- A fee flag is a request for review, not proof of fraud.
- Every amount is labelled estimate, confirmed or illustrative.
- Simulations are labelled. The internal ledger is never presented as PayPal-held money.
- Demo data is synthetic. Recipient data is never shown on shared dashboards.

## MVP

1. A donor makes a PayPal Sandbox contribution to a demo campaign; the backend captures it and records it.
2. A synthetic recipient's situation is analysed (Member 1).
3. Routes are compared and scored (Member 2).
4. A basket is built within the usable budget (Member 3).
5. The NGO approves; one sandbox payment action runs, or a clearly labelled simulated payout.
6. Webhook and dashboard views show the lifecycle honestly.

Deadline: **12 November 2026, 12:00 PT**.
