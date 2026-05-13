import type { MailExtractorRule } from "./api";

export type RuleDraft = Omit<
  MailExtractorRule,
  "id" | "sourceType" | "enabledForUser" | "createdAt" | "updatedAt" | "ownerUserId" | "templateKey"
>;

export function emptyRuleDraft(): RuleDraft {
  return {
    name: "",
    description: "",
    label: "",
    enabled: true,
    targetFields: ["subject"],
    pattern: "",
    flags: "i",
    resultMode: "capture_group",
    captureGroupIndex: 1,
    mailboxIds: [],
    domainIds: [],
    senderContains: "",
    subjectContains: "",
    sortOrder: 100,
  };
}

export function normalizeMailExtractorRule(rule: Partial<MailExtractorRule>): MailExtractorRule {
  const targetFields = Array.isArray(rule.targetFields)
    ? rule.targetFields.filter((field): field is string => typeof field === "string" && field.length > 0)
    : [];
  const mailboxIds = Array.isArray(rule.mailboxIds)
    ? rule.mailboxIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id))
    : [];
  const domainIds = Array.isArray(rule.domainIds)
    ? rule.domainIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id))
    : [];

  return {
    id: Number(rule.id ?? 0),
    ownerUserId: typeof rule.ownerUserId === "number" ? rule.ownerUserId : undefined,
    sourceType: typeof rule.sourceType === "string" ? rule.sourceType : "user",
    templateKey: typeof rule.templateKey === "string" ? rule.templateKey : undefined,
    name: typeof rule.name === "string" ? rule.name : "",
    description: typeof rule.description === "string" ? rule.description : "",
    label: typeof rule.label === "string" ? rule.label : "",
    enabled: rule.enabled !== false,
    enabledForUser: typeof rule.enabledForUser === "boolean" ? rule.enabledForUser : undefined,
    targetFields: targetFields.length ? targetFields : ["subject"],
    pattern: typeof rule.pattern === "string" ? rule.pattern : "",
    flags: typeof rule.flags === "string" ? rule.flags : "i",
    resultMode: typeof rule.resultMode === "string" ? rule.resultMode : "capture_group",
    captureGroupIndex:
      typeof rule.captureGroupIndex === "number" && Number.isFinite(rule.captureGroupIndex)
        ? rule.captureGroupIndex
        : 1,
    mailboxIds,
    domainIds,
    senderContains: typeof rule.senderContains === "string" ? rule.senderContains : "",
    subjectContains: typeof rule.subjectContains === "string" ? rule.subjectContains : "",
    sortOrder: typeof rule.sortOrder === "number" && Number.isFinite(rule.sortOrder) ? rule.sortOrder : 100,
    createdAt: typeof rule.createdAt === "string" ? rule.createdAt : undefined,
    updatedAt: typeof rule.updatedAt === "string" ? rule.updatedAt : undefined,
  };
}

export function toRuleDraft(rule: Partial<MailExtractorRule>): RuleDraft {
  const normalized = normalizeMailExtractorRule(rule);
  return {
    name: normalized.name,
    description: normalized.description,
    label: normalized.label,
    enabled: normalized.enabled,
    targetFields: normalized.targetFields,
    pattern: normalized.pattern,
    flags: normalized.flags,
    resultMode: normalized.resultMode,
    captureGroupIndex: normalized.captureGroupIndex ?? 1,
    mailboxIds: normalized.mailboxIds,
    domainIds: normalized.domainIds,
    senderContains: normalized.senderContains,
    subjectContains: normalized.subjectContains,
    sortOrder: normalized.sortOrder,
  };
}

export function validateRuleDraft(draft: RuleDraft): string | null {
  if (!draft.name.trim()) {
    return "TextRule name。";
  }
  if (!draft.pattern.trim()) {
    return "TextRegular expression。";
  }
  if (!Array.isArray(draft.targetFields) || draft.targetFields.length === 0) {
    return "TextExtraction field。";
  }
  if (!/^[ims]*$/i.test(draft.flags.trim())) {
    return "Flags Text i、m、s。";
  }
  if (draft.resultMode === "capture_group") {
    const captureGroupIndex = Number(draft.captureGroupIndex ?? 1);
    if (!Number.isInteger(captureGroupIndex) || captureGroupIndex < 0) {
      return "Capture groupText 0 Text。";
    }
  }
  try {
    // Text，Text and Text。
    // Text flags Text。
    new RegExp(draft.pattern, draft.flags.trim());
  } catch (error) {
    return `Regular expressionText：${error instanceof Error ? error.message : "Text"}`;
  }
  if (looksLikeRegex(draft.senderContains)) {
    return "“SenderText”Text，Text，Text and Text。";
  }
  if (looksLikeRegex(draft.subjectContains)) {
    return "“SubjectText”Text，Text，Text and Text。";
  }
  return null;
}

function looksLikeRegex(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return /[\\^$.*+?()[\]{}|]/.test(trimmed);
}
