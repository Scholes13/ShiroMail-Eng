import type { ReactNode } from "react";
import i18n from "@/lib/i18n";
import type { OptionComboboxOption } from "@/components/ui/option-combobox";
import type {
  DNSChangeSetItem,
  DomainProviderItem,
  ProviderRecordItem,
} from "../../api";

export function providerRecordMergeKey(record: ProviderRecordItem) {
  return [
    record.type.trim().toUpperCase(),
    record.name.trim().toLowerCase(),
    String(record.priority ?? 0),
  ].join("|");
}

export function getProviderTypeByID(
  providers: DomainProviderItem[] | undefined,
  providerID: number | undefined,
) {
  if (!providerID) {
    return null;
  }
  return providers?.find((item) => item.id === providerID)?.provider ?? null;
}

export function mergeProviderRecords(
  currentRecords: ProviderRecordItem[],
  nextRecords: ProviderRecordItem[],
) {
  const merged = [...currentRecords];
  const indexes = new Map<string, number>();

  merged.forEach((record, index) => {
    indexes.set(providerRecordMergeKey(record), index);
  });

  nextRecords.forEach((record) => {
    const key = providerRecordMergeKey(record);
    const existingIndex = indexes.get(key);
    if (existingIndex === undefined) {
      indexes.set(key, merged.length);
      merged.push(record);
      return;
    }
    merged[existingIndex] = record;
  });
  return merged;
}

export type ProviderCredentials = {
  apiToken: string;
  apiEmail: string;
  apiKey: string;
  apiSecret: string;
};

export const DEFAULT_PROVIDER_PERMISSIONS = ["zones.read", "dns.write"];
export const PROVIDER_PERMISSION_OPTIONS: Record<"cloudflare" | "spaceship", OptionComboboxOption[]> = {
  cloudflare: [
    { value: "tokens.verify", label: "Token Text", keywords: ["tokens.verify", "token verify"] },
    { value: "zones.read", label: "Zone Text", keywords: ["zones.read", "zone read"] },
    { value: "dns.read", label: "DNS Text", keywords: ["dns.read", "dns read"] },
    { value: "dns.write", label: "DNS Text", keywords: ["dns.write", "dns write", "dns edit"] },
  ],
  spaceship: [
    { value: "zones.read", label: "Zone Text", keywords: ["zones.read", "zone read"] },
    { value: "dns.read", label: "DNS Text", keywords: ["dns.read", "dns read"] },
    { value: "dns.write", label: "DNS Text", keywords: ["dns.write", "dns write"] },
  ],
};

export function getProviderPermissionOptions(provider: string) {
  return PROVIDER_PERMISSION_OPTIONS[
    provider === "spaceship" ? "spaceship" : "cloudflare"
  ];
}

export function sanitizeProviderPermissions(provider: string, permissions: string[]) {
  const supportedValues = new Set(
    getProviderPermissionOptions(provider).map((option) => option.value),
  );

  return permissions.filter((permission, index) => {
    if (!supportedValues.has(permission)) {
      return false;
    }
    return permissions.indexOf(permission) === index;
  });
}

export type EditableProviderRecord = ProviderRecordItem & {
  localId: string;
};

export type DnsWorkspaceTab =
  | "providers"
  | "zones"
  | "records";

export function createEditableProviderRecord(
  record?: Partial<ProviderRecordItem>,
): EditableProviderRecord {
  return {
    localId: `record-${Math.random().toString(36).slice(2, 10)}`,
    id: record?.id,
    type: record?.type ?? "TXT",
    name: record?.name ?? "",
    value: record?.value ?? "",
    ttl: record?.ttl ?? 300,
    priority: record?.priority ?? 0,
    proxied: record?.proxied ?? false,
  };
}

export function recordsToEditable(records: ProviderRecordItem[]) {
  return records.map((record) => createEditableProviderRecord(record));
}
export function describeAdminProviderWorkspaceError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("unsupported dns record type")) {
    return "Text，Text Zone Text。";
  }
  if (normalized.includes("invalid request headers")) {
    return "DNS Text，Text。";
  }
  if (normalized.includes("authentication") || normalized.includes("unauthorized") || normalized.includes("forbidden")) {
    return "DNS Text，Text API Token、Text、API Key Text Secret Text，Text。";
  }
  if (normalized.includes("status 400")) {
    return "DNS Text，Text、Text。";
  }
  if (normalized.includes("status 401") || normalized.includes("status 403")) {
    return "DNS Text，Text Provider Text。";
  }
  if (normalized.includes("status 404")) {
    return "Text Zone Text DNS Text，TextDomainText Provider。";
  }
  if (
    normalized.includes("status 429") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit")
  ) {
    return "DNS Text，Text，TextRefresh。";
  }
  if (normalized.includes("status 5")) {
    return "DNS Text，Text。";
  }
  return message;
}

export function editableToProviderRecords(records: EditableProviderRecord[]) {
  return records
    .map((record) => ({
      id: record.id,
      type: record.type.trim().toUpperCase(),
      name: record.name.trim(),
      value: record.value.trim(),
      ttl: Number.isFinite(record.ttl) ? record.ttl : 300,
      priority: Number.isFinite(record.priority) ? record.priority : 0,
      proxied: record.proxied,
    }))
    .filter((record) => record.type !== "" && record.name !== "" && record.value !== "");
}

export function applyVerificationRepairRecords(
  currentRecords: EditableProviderRecord[],
  repairRecords: ProviderRecordItem[],
) {
  const merged = mergeProviderRecords(
    editableToProviderRecords(currentRecords),
    repairRecords.map((record) => ({ ...record })),
  );
  return recordsToEditable(merged);
}
export function describeChangeSetOperations(changeSet: DNSChangeSetItem) {
  const counts = changeSet.operations.reduce(
    (summary, operation) => {
      if (operation.operation === "create") {
        summary.create += 1;
      } else if (operation.operation === "update") {
        summary.update += 1;
      } else if (operation.operation === "delete") {
        summary.delete += 1;
      } else {
        summary.other += 1;
      }
      return summary;
    },
    { create: 0, update: 0, delete: 0, other: 0 },
  );

  const items = [
    counts.create ? `${counts.create} create` : null,
    counts.update ? `${counts.update} update` : null,
    counts.delete ? `${counts.delete} delete` : null,
    counts.other ? `${counts.other} other` : null,
  ].filter(Boolean);

  return items.length ? items.join(" · ") : "Text";
}

export function formatChangeSetTimestamp(value?: string) {
  if (!value) {
    return "Text";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(i18n.language, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function restoreEditableRecordsFromChangeSet(
  baseRecords: ProviderRecordItem[],
  changeSet: DNSChangeSetItem,
) {
  let nextRecords = [...baseRecords];

  changeSet.operations.forEach((operation) => {
    if (operation.before) {
      const beforeKey = providerRecordMergeKey(operation.before);
      nextRecords = nextRecords.filter(
        (record) => providerRecordMergeKey(record) !== beforeKey,
      );
    }

    if (operation.after) {
      const afterKey = providerRecordMergeKey(operation.after);
      const existingIndex = nextRecords.findIndex(
        (record) => providerRecordMergeKey(record) === afterKey,
      );

      if (existingIndex === -1) {
        nextRecords.push(operation.after);
      } else {
        nextRecords[existingIndex] = operation.after;
      }
    }
  });

  return recordsToEditable(nextRecords);
}
export function getProviderCredentialFields(provider: string, authType: string) {
  if (provider === "spaceship") {
    return [
      {
        key: "apiKey" as const,
        label: "API Key",
        placeholder: "Text Spaceship API Key",
        type: "password",
      },
      {
        key: "apiSecret" as const,
        label: "API Secret",
        placeholder: "Text Spaceship API Secret",
        type: "password",
      },
    ];
  }

  if (authType === "api_key") {
    return [
      {
        key: "apiEmail" as const,
        label: "Account Email",
        placeholder: "Text Cloudflare Text（Text Global API Key Text）",
        type: "email",
      },
      {
        key: "apiKey" as const,
        label: "Global API Key",
        placeholder: "Text Cloudflare Global API Key",
        type: "password",
      },
    ];
  }

  return [
    {
      key: "apiToken" as const,
      label: "API Token",
      placeholder: "Text Cloudflare API Token（Text）",
      type: "password",
    },
  ];
}

export function canSubmitProviderCredentials(
  provider: string,
  authType: string,
  credentials: ProviderCredentials,
  allowEmpty = false,
) {
  const hasAnyCredential =
    credentials.apiToken.trim() !== "" ||
    credentials.apiEmail.trim() !== "" ||
    credentials.apiKey.trim() !== "" ||
    credentials.apiSecret.trim() !== "";
  if (allowEmpty && !hasAnyCredential) {
    return true;
  }
  if (provider === "spaceship") {
    return credentials.apiKey.trim() !== "" && credentials.apiSecret.trim() !== "";
  }
  if (authType === "api_key") {
    return credentials.apiEmail.trim() !== "" && credentials.apiKey.trim() !== "";
  }
  return credentials.apiToken.trim() !== "";
}

export function getProviderAuthModeMeta(provider: string, authType: string) {
  if (provider === "spaceship") {
    return {
      title: "Spaceship API Key + Secret",
      description: "Text API Key Text API Secret，Text Zone Text DNS Text。",
    };
  }

  if (authType === "api_key") {
    return {
      title: "Cloudflare Global API Key + Email",
      description: "Text Global API Key，Text API Token Text。",
    };
  }

  return {
    title: "Cloudflare API Token",
    description: "Text API Token，Text Zone Read / DNS Read / DNS Edit Text Token。",
  };
}

export const ADMIN_PROVIDERS_PAGE_SIZE = 6;
export const ADMIN_ZONES_PAGE_SIZE = 8;
export const ADMIN_RECORDS_PAGE_SIZE = 10;
export const ADMIN_CHANGESETS_PAGE_SIZE = 8;
export const ADMIN_CHANGESET_EDITOR_PAGE_SIZE = 8;
export const ADMIN_DOMAINS_CACHE_KEY = "shiro-email.admin-domains.cache";
export const ADMIN_PROVIDERS_CACHE_KEY = "shiro-email.admin-domain-providers.cache";
export const ADMIN_WORKSPACE_CACHE_KEY = "shiro-email.admin-domains.workspace";
export const PERSISTED_QUERY_STALE_TIME = 60_000;
export const PROVIDER_ZONE_FAILURE_COOLDOWN_MS = 45_000;

export function parsePositiveIntParam(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
    total: items.length,
  };
}

export function isProviderRateLimitedError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("status 429") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit")
  );
}

export type SectionToggleProps = {
  expanded: boolean;
  title: string;
  description: string;
  meta?: ReactNode;
  onToggle: () => void;
};

