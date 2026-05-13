export type ApiEndpointReference = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth: string;
  description: string;
};

export type ApiReferenceSection = {
  title: string;
  description: string;
  endpoints: ApiEndpointReference[];
};

export type DocsJSONExample = {
  title: string;
  description: string;
  payload: string;
};

export type DocsFieldGuide = {
  name: string;
  meaning: string;
};

export const apiReferenceSections: ApiReferenceSection[] = [
  {
    title: "Text",
    description: "Text、OAuth、Text、Text TOTP Text。",
    endpoints: [
      { method: "POST", path: "/api/v1/auth/register", auth: "Text", description: "Text，Text。" },
      { method: "POST", path: "/api/v1/auth/login", auth: "Text", description: "Text，Text TOTP Text。" },
      { method: "POST", path: "/api/v1/auth/oauth/:provider/start", auth: "Text", description: "Text OAuth Text。" },
      { method: "POST", path: "/api/v1/auth/oauth/:provider/callback", auth: "Text", description: "Text OAuth Text。" },
      { method: "POST", path: "/api/v1/auth/forgot-password", auth: "Text", description: "Textverification code。" },
      { method: "POST", path: "/api/v1/auth/reset-password", auth: "Text", description: "Textverification codeText。" },
      { method: "GET", path: "/api/v1/account/profile", auth: "Text", description: "Text。" },
      { method: "PATCH", path: "/api/v1/account/profile", auth: "Text", description: "Text、Text。" },
    ],
  },
  {
    title: "DomainText DNS",
    description: "TextDomainText、TextDomainText、DNS Text、Text。",
    endpoints: [
      { method: "GET", path: "/api/v1/domains", auth: "Text / API Key", description: "TextDomain。" },
      { method: "POST", path: "/api/v1/domains", auth: "Text / API Key", description: "TextDomain。" },
      { method: "POST", path: "/api/v1/domains/generate", auth: "Text / API Key", description: "TextDomainTextDomain。" },
      { method: "PUT", path: "/api/v1/domains/:id/provider-binding", auth: "Text", description: "TextDomainText DNS Text。" },
      { method: "POST", path: "/api/v1/domains/:id/verify", auth: "Text", description: "Text DNS Text。" },
      { method: "GET", path: "/api/v1/portal/domain-providers/:id/zones/:zoneId/records", auth: "Text", description: "Text Zone Text。" },
      { method: "POST", path: "/api/v1/portal/domain-providers/:id/zones/:zoneId/change-sets/preview", auth: "Text", description: "Text DNS Text，Text。" },
      { method: "POST", path: "/api/v1/portal/dns-change-sets/:changeSetId/apply", auth: "Text", description: "Text DNS Text and Text。" },
    ],
  },
  {
    title: "Text",
    description: "Text、Text、Body、Text EML Text。",
    endpoints: [
      { method: "GET", path: "/api/v1/dashboard", auth: "Text / API Key", description: "Text、DomainText。" },
      { method: "GET", path: "/api/v1/mailboxes", auth: "Text / API Key", description: "Text。" },
      { method: "POST", path: "/api/v1/mailboxes", auth: "Text / API Key", description: "Text，Text domainId Text localPart。" },
      { method: "POST", path: "/api/v1/mailboxes/:id/extend", auth: "Text / API Key", description: "TextTTL。" },
      { method: "POST", path: "/api/v1/mailboxes/:id/release", auth: "Text / API Key", description: "Text。" },
      { method: "GET", path: "/api/v1/mailboxes/:mailboxId/messages", auth: "Text / API Key", description: "TextCancelText。" },
      { method: "GET", path: "/api/v1/mailboxes/:mailboxId/messages/:id", auth: "Text / API Key", description: "TextCancelTextBody、Text。" },
      { method: "GET", path: "/api/v1/mailboxes/:mailboxId/messages/:id/extractions", auth: "Text / API Key", description: "TextExtraction rulesTextverification code、Text。" },
      { method: "GET", path: "/api/v1/mailboxes/:mailboxId/messages/:id/raw", auth: "Text / API Key", description: "Text EML。" },
      { method: "GET", path: "/api/v1/mailboxes/:mailboxId/messages/:id/raw/parsed", auth: "Text / API Key", description: "Text EML TextBody、Text。" },
      { method: "POST", path: "/api/v1/mailboxes/:mailboxId/messages/receive", auth: "Text / API Key", description: "Text RFC822 Text，Text。" },
    ],
  },
  {
    title: "SMTP Text",
    description: "Text SMTP Text、Text spool Text、Text，Text。",
    endpoints: [
      { method: "POST", path: "/api/v1/admin/configs/mail.delivery/test", auth: "Text", description: "Text SMTP Test message；Text stage、code、hint、retryable Text。" },
      { method: "GET", path: "/api/v1/admin/jobs/inbound-spool", auth: "Text", description: "Text spool Text、Text。" },
      { method: "POST", path: "/api/v1/admin/jobs/inbound-spool/:id/retry", auth: "Text", description: "Text failed spool Text。" },
      { method: "GET", path: "/api/v1/admin/jobs/smtp-metrics", auth: "Text", description: "Text SMTP Text、Text、accepted、spool worker Text。" },
    ],
  },
  {
    title: "API Key、Webhook Text",
    description: "Text API Key、Webhook、Text、Text。",
    endpoints: [
      { method: "GET", path: "/api/v1/portal/api-keys", auth: "Text", description: "Text API Key。" },
      { method: "POST", path: "/api/v1/portal/api-keys", auth: "Text", description: "Text scope TextDomainText API Key。" },
      { method: "GET", path: "/api/v1/portal/webhooks", auth: "Text", description: "Text Webhook。" },
      { method: "POST", path: "/api/v1/portal/webhooks", auth: "Text", description: "Text Webhook Text。" },
      { method: "GET", path: "/api/v1/portal/docs", auth: "Text", description: "Text。" },
      { method: "GET", path: "/api/v1/portal/billing", auth: "Text", description: "Text、DomainText。" },
      { method: "GET", path: "/api/v1/portal/balance", auth: "Text", description: "Text。" },
      { method: "GET", path: "/api/v1/admin/overview", auth: "Text", description: "Text。" },
    ],
  },
];

export const runtimeCapabilities = [
  "Text、OAuth Text TOTP Text。",
  "DomainTextDomain、TextDomain、DNS Text、Text。",
  "Text、Text、Text、TextBody、Text EML Text。",
  "SMTP Text、Text、reject Text inbound spool Text。",
  "Text API Key、Webhook、Text、Text、NoticesText。",
];

export const smtpDiagnosticExamples: DocsJSONExample[] = [
  {
    title: "SMTP test failure payload",
    description: "Text“Text”Text，Text。",
    payload: `{
  "message": "mail delivery TLS handshake failed: server does not advertise STARTTLS",
  "stage": "tls",
  "code": "starttls_unavailable",
  "hint": "The upstream server does not advertise STARTTLS. Switch to SMTPS or plain mode only if your provider explicitly supports it.",
  "retryable": false
}`,
  },
  {
    title: "Inbound spool item with diagnostic",
    description: "Text，Text。",
    payload: `{
  "id": 18,
  "mailFrom": "sender@example.com",
  "status": "failed",
  "errorMessage": "temporary parse failure",
  "diagnostic": {
    "code": "temporary_parse_failure",
    "title": "Temporary Parse Failure",
    "description": "The worker failed while parsing MIME content or message structure. This is often retryable after transient input or runtime issues clear.",
    "retryable": true
  }
}`,
  },
  {
    title: "SMTP metrics rejectedDetails",
    description: "Text reject Text，TextSubject、Text retryable Text。",
    payload: `{
  "sessionsStarted": 14,
  "recipientsAccepted": 21,
  "rejected": {
    "attachment_too_large": 2
  },
  "rejectedDetails": [
    {
      "key": "attachment_too_large",
      "count": 2,
      "diagnostic": {
        "code": "attachment_too_large",
        "title": "Attachment Too Large",
        "description": "The message was rejected because at least one attachment exceeded the active inbound size limit.",
        "retryable": false
      }
    }
  ]
}`,
  },
];

export const smtpDiagnosticFieldGuides: DocsFieldGuide[] = [
  {
    name: "diagnostic",
    meaning: "Human-readable diagnostic object attached to failed spool items and failed background jobs. Includes `title`, `description`, and `retryable`.",
  },
  {
    name: "failureMode",
    meaning: "Query filter for `/api/v1/admin/jobs/inbound-spool`. Supports `all`, `retryable`, and `non_retryable` to narrow failed spool items.",
  },
  {
    name: "rejectedDetails",
    meaning: "Expanded view of SMTP reject counters. Each entry keeps the raw key and count, plus a normalized diagnostic payload for UI or automation.",
  },
  {
    name: "retryable",
    meaning: "Boolean hint for operators and clients. `true` means a retry may succeed after transient conditions clear; `false` usually means the config or target must be fixed first.",
  },
  {
    name: "stage / code / hint",
    meaning: "Structured fields returned by SMTP test delivery failures. `stage` shows where the failure occurred, `code` is stable for logic, and `hint` is the operator-facing remediation note.",
  },
];
