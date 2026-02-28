# Slate API — Acceptance Test Plan

Run these in order. Use Postman (or similar) with a single Environment: `baseUrl`, `x-api-key`, `accessToken`.

---

## 0. Prerequisites

- Server running (e.g. `npm run watch` or `npm run serve`).
- `.env`: `PORT`, API key for `x-api-key`, and for email flows: `EMAIL_PROVIDER`/`RESEND_API_KEY` or SMTP. For receipt scan: `OPENAI_API_KEY`.
- At least one **verified** user (email + password) for login.
- At least one **client** with a valid **email** (for send flows).

---

## 1. Auth

| # | Method | URL | Headers | Body | Expect |
|---|--------|-----|---------|------|--------|
| 1.1 | POST | `{{baseUrl}}/login` | `Content-Type: application/json`, `x-api-key` | `{"email":"<user>","password":"<pass>"}` | 200, `data.tokens.accessToken`. Save to env as `accessToken`. |

All following requests: add `Authorization: Bearer {{accessToken}}` and `x-api-key`.

---

## 2. PDF download (binary PDF)

Use a valid resource id you own (from GET list or create response).

| # | Method | URL | Expect |
|---|--------|-----|--------|
| 2.1 | GET | `{{baseUrl}}/proposals/:id/pdf` | 200, `Content-Type: application/pdf`, body is binary PDF. |
| 2.2 | GET | `{{baseUrl}}/invoices/:id/pdf` | 200, `Content-Type: application/pdf`, body is binary PDF. |
| 2.3 | GET | `{{baseUrl}}/contracts/:id/pdf` | 200, `Content-Type: application/pdf`, body is binary PDF. |

In Postman: “Send and download” or inspect response headers; do not expect JSON.

---

## 3. Send document + email

Resource must be DRAFT; client must have email.

| # | Method | URL | Body | Expect |
|---|--------|-----|------|--------|
| 3.1 | POST | `{{baseUrl}}/proposals/:id/send` | (none) | 200, `data.proposal.status === "SENT"`, `sentAt` set. |
| 3.2 | POST | `{{baseUrl}}/invoices/:id/send` | (none) | 200, `data.invoice.status === "SENT"`, `sentAt` set. |
| 3.3 | POST | `{{baseUrl}}/contracts/:id/send` | (none) | 200, `data.contract.status === "SENT"`. |

---

## 4. Batch send + contract sign

| # | Method | URL | Body | Expect |
|---|--------|-----|------|--------|
| 4.1 | POST | `{{baseUrl}}/invoices/batch-send` | `{"invoiceIds":["<id1>","<id2>"]}` (DRAFT, client email) | 200, `data.count` = length, `data.invoices` all SENT, `data.results` with `invoiceId`, `sent`, optional `error`. |
| 4.2 | POST | `{{baseUrl}}/contracts/:id/sign` | `{"signatureUrl":"https://example.com/sig.png"}` | 200, `data.contract.status === "SIGNED"`, `signedAt` set. |

---

## 5. Proposal → contract

| # | Method | URL | Body | Expect |
|---|--------|-----|------|--------|
| 5.1 | POST | `{{baseUrl}}/proposals/:id/convert-to-contract` | (none) | 200, `data.contract` (id, contractNumber, status DRAFT), `data.proposalId`. Proposal must be APPROVED. |

---

## 6. Receipt scan

| # | Method | URL | Body | Expect |
|---|--------|-----|------|--------|
| 6.1 | POST | `{{baseUrl}}/expenses/scan-receipt` | `{"receiptImage":"<base64>"}` (min ~100 chars) | 200, `data.extractedData` has `vendor`, `amount`, `date`, `category`. Or 400 if no OPENAI_API_KEY / invalid image. |

---

## 7. Error cases (optional)

| # | Request | Expect |
|---|---------|--------|
| 7.1 | POST send on non-DRAFT proposal/invoice/contract | 400, message about status. |
| 7.2 | POST send with client that has no email | 400, message about client email. |
| 7.3 | GET pdf with invalid id | 404. |
| 7.4 | Any protected route without `Authorization` or invalid token | 401. |

---

## Sign-off

- [ ] 1.1 Login returns access token.
- [ ] 2.1–2.3 All three PDF endpoints return binary PDF and correct headers.
- [ ] 3.1–3.3 Send endpoints return 200 and SENT status.
- [ ] 4.1 Batch-send returns count, invoices, results.
- [ ] 4.2 Contract sign returns SIGNED.
- [ ] 5.1 Convert returns contract + proposalId.
- [ ] 6.1 Scan returns extractedData or clear 400.

When all are checked, the API is ready for client integration.
