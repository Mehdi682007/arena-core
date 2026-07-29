# Legal and Compliance Risks

This is a product-risk inventory, not legal advice.

## High-priority review areas

- Classification of entry-fee skill competitions versus gambling or prize promotions.
- Payment processing, stored value, money transmission/custody, withdrawals, chargebacks, and KYC/AML.
- Age restrictions and verifiable parental consent.
- Country eligibility, sanctions, geo-restriction, and tax reporting.
- Consumer disclosures, refunds, dispute/appeal fairness, and platform commissions.
- Privacy lawful basis, evidence retention, access/deletion rights, cross-border transfers, and breach response.
- Publisher terms, trademarks, game assets, tournament licenses, and API/data use.
- Accessibility, marketing/notification consent, and automated rating/trust-score transparency.

## MVP safeguards

- Real deposits, withdrawals, transfers, and redeemable prizes are disabled.
- `REAL_MONEY_MODE=false` is a locked feature flag with no production payment adapter.
- UI labels credits as test-only and non-redeemable.
- Jurisdiction, age, and country-eligibility fields are anticipated in policy/domain design.
- Legal documents remain marked `DRAFT — COUNSEL REVIEW REQUIRED`.
- Evidence is private with limited access and auditable retrieval.
- A formal launch checklist requires jurisdiction-specific counsel approval.
