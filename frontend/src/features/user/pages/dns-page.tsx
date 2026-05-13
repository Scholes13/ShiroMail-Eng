import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, ChevronUp, Copy, RefreshCcw, Trash2 } from "lucide-react";
import i18n from "@/lib/i18n";
import { DnsVerifyWizard } from "../components/dns-verify-wizard";
import { DomainHealthScore } from "../components/domain-health-score";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MultiOptionCombobox } from "@/components/ui/multi-option-combobox";
import { NoticeBanner } from "@/components/ui/notice-banner";
import { OptionCombobox, type OptionComboboxOption } from "@/components/ui/option-combobox";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceField,
  WorkspaceListRow,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import { getAPIErrorMessage } from "@/lib/http";
import { formatDNSRecordValueForDisplay } from "@/lib/dns-record-display";
import { showSuccess } from "@/lib/toast";
import { useAuthStore } from "@/lib/auth-store";
import { readPersistedState, writePersistedState } from "@/lib/persisted-state";
import {
  applyDomainProviderChangeSet,
  createDomain,
  createDomainProvider,
  deleteDomainProvider,
  fetchDomainProviderChangeSets,
  fetchDomainProviderRecords,
  fetchDomainProviderVerifications,
  fetchDomainProviderZones,
  fetchDomainProviders,
  fetchDomains,
  generateSubdomains,
  previewDomainProviderChangeSet,
  updateDomainProvider,
  validateDomainProvider,
  type UserDNSChangeSetItem,
  type UserDomainProviderItem,
  type UserProviderRecordItem,
  type UserVerificationProfileItem,
  type UserProviderZoneItem,
} from "../api";

type ProviderCredentials = {
  apiToken: string;
  apiEmail: string;
  apiKey: string;
  apiSecret: string;
};

const EMPTY_PROVIDER_CREDENTIALS: ProviderCredentials = {
  apiToken: "",
  apiEmail: "",
  apiKey: "",
  apiSecret: "",
};
const DEFAULT_PROVIDER_PERMISSIONS = ["zones.read", "dns.write"];
const PROVIDER_PERMISSION_OPTIONS: Record<"cloudflare" | "spaceship", OptionComboboxOption[]> = {
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
const PERSISTED_QUERY_STALE_TIME = 60_000;
const PROVIDER_ZONE_FAILURE_COOLDOWN_MS = 45_000;
const USER_DNS_RECORDS_PAGE_SIZE = 8;

function DnsCopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showSuccess(t("dns.copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  }, [value, t]);

  return (
    <Button
      aria-label={t("dns.copied")}
      className={copied ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 transition-opacity"}
      onClick={handleCopy}
      size="icon-sm"
      variant="ghost"
    >
      <Copy className="size-3.5" />
    </Button>
  );
}

function getProviderPermissionOptions(provider: string) {
  return PROVIDER_PERMISSION_OPTIONS[
    provider === "spaceship" ? "spaceship" : "cloudflare"
  ];
}

function sanitizeProviderPermissions(provider: string, permissions: string[]) {
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

function parsePositiveIntParam(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function getUserDomainsCacheKey(userId: string | undefined, suffix: string) {
  return `shiro-email.user-domains.${userId ?? "guest"}.${suffix}`;
}

function getProviderCredentialFields(provider: string, authType: string) {
  if (provider === "spaceship") {
    return [
      { key: "apiKey" as const, label: "API Key", placeholder: "Text Spaceship API Key", type: "password" },
      { key: "apiSecret" as const, label: "API Secret", placeholder: "Text Spaceship API Secret", type: "password" },
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

function canSubmitProvider(provider: string, authType: string, credentials: ProviderCredentials, allowEmpty = false) {
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

function getProviderAuthModeMeta(provider: string, authType: string) {
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

function formatProviderTimestamp(value?: string) {
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

function summarizeVerificationStatus(items: UserVerificationProfileItem[]) {
  return items.reduce(
    (summary, item) => {
      if (item.status === "verified") {
        summary.verified += 1;
      } else if (item.status === "drifted") {
        summary.drifted += 1;
      } else {
        summary.pending += 1;
      }
      return summary;
    },
    { verified: 0, drifted: 0, pending: 0 },
  );
}

function describeProviderWorkspaceError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("unsupported dns record type")) {
    return "Text，Text Zone Text。";
  }
  if (normalized.includes("invalid request headers")) {
    return "DNS Text，Text，Text Cloudflare Text API Token / Global API Key Text。";
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
  if (normalized.includes("status 429")) {
    return "DNS Text，Text。";
  }
  if (normalized.includes("status 5")) {
    return "DNS Text，Text。";
  }
  return message;
}

function isProviderRateLimitedError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("status 429") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit")
  );
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(pageSize, 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    total,
    totalPages,
  };
}

function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  itemLabel,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        Text {page} / {totalPages} Text · Text {total} Text{itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          disabled={page <= 1}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
        >
          Text
        </Button>
        <Button
          disabled={page >= totalPages}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
        >
          Text
        </Button>
      </div>
    </div>
  );
}

function SectionToggle({
  expanded,
  title,
  description,
  meta,
  onToggle,
}: {
  expanded: boolean;
  title: string;
  description: string;
  meta?: ReactNode;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {meta}
        <Button size="sm" type="button" variant="ghost" onClick={onToggle}>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {expanded ? "Text" : "Text"}
        </Button>
      </div>
    </div>
  );
}

function dedupeProviderRecords(records: UserProviderRecordItem[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = [record.type, record.name, record.value, record.ttl, record.priority, record.proxied].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectRepairRecords(items: UserVerificationProfileItem[]) {
  return dedupeProviderRecords(items.flatMap((item) => item.repairRecords ?? []));
}

function getProviderCredentialChecklist(provider: string, authType: string) {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedAuthType = authType.trim().toLowerCase();

  if (normalizedProvider === "spaceship") {
    return [
      "Text Spaceship Text API Key。",
      "Text Key Text API Secret。",
      "Text Key Text Zone / DNS Text。",
      "TextDomainText Spaceship Text。",
    ];
  }

  if (normalizedProvider === "cloudflare" && normalizedAuthType === "api_key") {
    return [
      "Text api_key，Text api_token。",
      "Text Cloudflare Text（Account Email）。",
      "Text Global API Key。",
      "Text Zone，Text DNS。",
    ];
  }

  if (normalizedProvider === "cloudflare") {
    return [
      "Text api_token，Text api_key。",
      "Text Cloudflare API Token。",
      "Text Token Text Zone Read、DNS Read Text DNS Edit Text。",
      "TextDomainText and Text Cloudflare Text。",
    ];
  }

  return [
    "Text Provider Text。",
    "Text、Text IP。",
    "TextDomainText Provider Text，Text Zone Text。",
  ];
}

export function UserDnsPage() {
  const currentUserId = useAuthStore((state) => state.user?.userId);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const autoWorkspaceRequestRef = useRef<string | null>(null);
  const pendingWorkspaceRefreshRef = useRef<number | null>(null);
  const userCacheScope = currentUserId === undefined ? undefined : String(currentUserId);
  const domainsCacheKey = getUserDomainsCacheKey(userCacheScope, "domains-cache");
  const providersCacheKey = getUserDomainsCacheKey(userCacheScope, "providers-cache");
  const workspaceCacheKey = getUserDomainsCacheKey(userCacheScope, "workspace-cache");
  const persistedWorkspace = readPersistedState(workspaceCacheKey, {
    activeProviderWorkspace: null as {
      providerId: number;
      providerName: string;
      provider: string;
      authType: string;
      zones: UserProviderZoneItem[];
    } | null,
    activeZoneWorkspace: null as {
      providerId: number;
      zoneId: string;
      zoneName: string;
      records: UserProviderRecordItem[];
      changeSets: UserDNSChangeSetItem[];
      verifications: UserVerificationProfileItem[];
    } | null,
    expandedRootIds: {} as Record<number, boolean>,
    expandedProviderId: null as number | null,
    expandedZoneKey: null as string | null,
    recordsExpanded: false,
    recordsPage: 1,
    zoneConfigMode: {} as Record<string, "manual" | "provider_api">,
    activePreviewChangeSetId: null as number | null,
  });
  const queryClient = useQueryClient();
  const [isCreateProviderDialogOpen, setCreateProviderDialogOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<number | null>(null);
  const [editingProviderHasBoundDomains, setEditingProviderHasBoundDomains] = useState(false);
  const [isCreateRootDialogOpen, setCreateRootDialogOpen] = useState(false);
  const [isGenerateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [rootDomain, setRootDomain] = useState("");
  const [selectedBaseDomainId, setSelectedBaseDomainId] = useState<number | "">("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [prefixInput, setPrefixInput] = useState("mx\nmx.edge\nrelay.cn.hk");
  const [expandedRootIds, setExpandedRootIds] = useState<Record<number, boolean>>(
    persistedWorkspace.expandedRootIds,
  );
  const [expandedProviderId, setExpandedProviderId] = useState<number | null>(
    persistedWorkspace.expandedProviderId,
  );
  const [providerDraft, setProviderDraft] = useState({
    provider: "cloudflare",
    displayName: "",
    authType: "api_token",
    status: "pending",
    permissionValues: DEFAULT_PROVIDER_PERMISSIONS,
  });
  const [providerCredentials, setProviderCredentials] = useState<ProviderCredentials>(EMPTY_PROVIDER_CREDENTIALS);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [providerWorkspaceError, setProviderWorkspaceError] = useState<{
    title: string;
    message: string;
    detail?: string;
  } | null>(null);
  const [lastProviderWorkspaceAttempt, setLastProviderWorkspaceAttempt] = useState<
    | { kind: "zones"; providerId: number; providerName: string }
    | { kind: "records"; providerId: number; zoneId: string; zoneName: string }
    | null
  >(null);
  const [activeProviderWorkspace, setActiveProviderWorkspace] = useState<{
    providerId: number;
    providerName: string;
    provider: string;
    authType: string;
    zones: UserProviderZoneItem[];
  } | null>(persistedWorkspace.activeProviderWorkspace);
  const [activeZoneWorkspace, setActiveZoneWorkspace] = useState<{
    providerId: number;
    zoneId: string;
    zoneName: string;
    records: UserProviderRecordItem[];
    changeSets: UserDNSChangeSetItem[];
    verifications: UserVerificationProfileItem[];
  } | null>(persistedWorkspace.activeZoneWorkspace);
  const [expandedZoneKey, setExpandedZoneKey] = useState<string | null>(
    persistedWorkspace.expandedZoneKey,
  );
  const [providerDeleteDialog, setProviderDeleteDialog] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [recordsExpanded, setRecordsExpanded] = useState<boolean>(
    persistedWorkspace.recordsExpanded,
  );
  const [recordsPage, setRecordsPage] = useState<number>(persistedWorkspace.recordsPage);
  const [zoneConfigMode, setZoneConfigMode] = useState<Record<string, "manual" | "provider_api">>(
    persistedWorkspace.zoneConfigMode,
  );
  const [activePreviewChangeSetId, setActivePreviewChangeSetId] = useState<number | null>(
    persistedWorkspace.activePreviewChangeSetId,
  );
  const [zoneFailureCooldowns, setZoneFailureCooldowns] = useState<Record<string, number>>({});
  const [dnsVerifyWizardOpen, setDnsVerifyWizardOpen] = useState(false);

  const domainsQuery = useQuery({
    queryKey: ["user-domains"],
    queryFn: fetchDomains,
    staleTime: PERSISTED_QUERY_STALE_TIME,
    placeholderData: () => readPersistedState(domainsCacheKey, [] as Awaited<ReturnType<typeof fetchDomains>>),
  });
  const providersQuery = useQuery({
    queryKey: ["user-domain-providers"],
    queryFn: fetchDomainProviders,
    staleTime: PERSISTED_QUERY_STALE_TIME,
    placeholderData: () =>
      readPersistedState(
        providersCacheKey,
        [] as Awaited<ReturnType<typeof fetchDomainProviders>>,
      ),
  });
  const providerItems = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);
  const domainItems = useMemo(() => domainsQuery.data ?? [], [domainsQuery.data]);
  const boundProviderIds = useMemo(
    () =>
      new Set(
        domainItems
          .map((item) => item.providerAccountId)
          .filter((providerAccountId): providerAccountId is number => typeof providerAccountId === "number"),
      ),
    [domainItems],
  );
  const isEditingProvider = editingProviderId !== null;
  const providerCoreFieldsLocked = isEditingProvider && editingProviderHasBoundDomains;

  const providerMap = useMemo(() => {
    const map = new Map<number, (typeof providerItems)[number]>();
    providerItems.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [providerItems]);

  const ownedDomains = useMemo(
    () => domainItems.filter((item) => item.ownerUserId !== undefined && item.ownerUserId === currentUserId),
    [currentUserId, domainItems],
  );

  const rootDomains = useMemo(
    () => ownedDomains.filter((item) => item.kind === "root"),
    [ownedDomains],
  );

  const requestedProviderId = parsePositiveIntParam(searchParams.get("providerId"));
  const requestedDomainId = parsePositiveIntParam(searchParams.get("domainId"));
  const requestedDomain = useMemo(
    () =>
      requestedDomainId !== null
        ? ownedDomains.find((item) => item.id === requestedDomainId) ?? null
        : null,
    [ownedDomains, requestedDomainId],
  );
  const requestedProvider = useMemo(
    () =>
      requestedProviderId !== null
        ? providerItems.find((item) => item.id === requestedProviderId) ?? null
        : null,
    [providerItems, requestedProviderId],
  );

  const clearInvalidSearchParams = useCallback((keys: Array<"providerId" | "domainId">) => {
    const nextParams = new URLSearchParams(searchParams);
    let changed = false;

    keys.forEach((key) => {
      if (nextParams.has(key)) {
        nextParams.delete(key);
        changed = true;
      }
    });

    if (!changed) {
      return;
    }

    navigate(
      {
        pathname: location.pathname,
        search: nextParams.toString() ? `?${nextParams.toString()}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, navigate, searchParams]);

  function scheduleWorkspaceRefresh(delayMs = 2500) {
    if (!activeZoneWorkspace) {
      return;
    }

    if (pendingWorkspaceRefreshRef.current !== null) {
      window.clearTimeout(pendingWorkspaceRefreshRef.current);
    }

    pendingWorkspaceRefreshRef.current = window.setTimeout(() => {
      pendingWorkspaceRefreshRef.current = null;
      void refreshUserDomainData().catch((error) => {
        setProviderError(getAPIErrorMessage(error, "DNS Text，Text。"));
      });
    }, delayMs);
  }

  const providerOptions = providerItems.map((item) => ({
    value: String(item.id),
    label: item.displayName,
    keywords: [item.provider, item.status],
  }));
  const resetProviderForm = useCallback(() => {
    setEditingProviderId(null);
    setEditingProviderHasBoundDomains(false);
    setProviderDraft({
      provider: "cloudflare",
      displayName: "",
      authType: "api_token",
      status: "pending",
      permissionValues: DEFAULT_PROVIDER_PERMISSIONS,
    });
    setProviderCredentials(EMPTY_PROVIDER_CREDENTIALS);
  }, []);
  const openCreateProviderDialog = useCallback(() => {
    setActionNotice(null);
    setProviderError(null);
    resetProviderForm();
    setCreateProviderDialogOpen(true);
  }, [resetProviderForm]);
  const openEditProviderDialog = useCallback((provider: UserDomainProviderItem) => {
    setActionNotice(null);
    setProviderError(null);
    setEditingProviderId(provider.id);
    setEditingProviderHasBoundDomains(boundProviderIds.has(provider.id));
    setProviderDraft({
      provider: provider.provider,
      displayName: provider.displayName,
      authType: provider.authType,
      status: provider.status,
      permissionValues: sanitizeProviderPermissions(provider.provider, provider.capabilities),
    });
    setProviderCredentials(EMPTY_PROVIDER_CREDENTIALS);
    setCreateProviderDialogOpen(true);
  }, [boundProviderIds]);

  const providerZoneMutation = useMutation({
    mutationFn: async (provider: { id: number; displayName: string }) => {
      const zones = await fetchDomainProviderZones(provider.id);
      const providerMeta = providerMap.get(provider.id);
      return {
        providerId: provider.id,
        providerName: provider.displayName,
        provider: providerMeta?.provider ?? "unknown",
        authType: providerMeta?.authType ?? "unknown",
        zones,
      };
    },
    onSuccess: (payload) => {
      setProviderError(null);
      setProviderWorkspaceError(null);
      setActionNotice(`Text ${payload.providerName} Text Zone Text。`);
      setActiveProviderWorkspace(payload);
      setActiveZoneWorkspace(null);
      setExpandedZoneKey(null);
      setLastProviderWorkspaceAttempt({
        kind: "zones",
        providerId: payload.providerId,
        providerName: payload.providerName,
      });
    },
    onError: (error, provider) => {
      const detail = getAPIErrorMessage(error, "Text Provider Zones Text，Text。");
      const message = describeProviderWorkspaceError(detail);
      setProviderError(message);
      setProviderWorkspaceError({
        title: `${provider.displayName} · Zone Text`,
        message,
        detail,
      });
      setActiveProviderWorkspace({
        providerId: provider.id,
        providerName: provider.displayName,
        provider: providerMap.get(provider.id)?.provider ?? "unknown",
        authType: providerMap.get(provider.id)?.authType ?? "unknown",
        zones: [],
      });
      setActiveZoneWorkspace(null);
      setExpandedZoneKey(null);
      setLastProviderWorkspaceAttempt({
        kind: "zones",
        providerId: provider.id,
        providerName: provider.displayName,
      });
    },
  });

  const providerZoneDetailMutation = useMutation({
    mutationFn: async (input: { providerId: number; zoneId: string; zoneName: string }) => {
      const zoneKey = `${input.providerId}:${input.zoneId}`;
      const cooldownUntil = zoneFailureCooldowns[zoneKey] ?? 0;
      if (cooldownUntil > Date.now()) {
        const waitSeconds = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
        throw new Error(`DNS Text，Text ${waitSeconds} secTextRefreshText Zone。`);
      }
      const [records, changeSets, verifications] = await Promise.all([
        fetchDomainProviderRecords(input.providerId, input.zoneId),
        fetchDomainProviderChangeSets(input.providerId, input.zoneId),
        fetchDomainProviderVerifications(input.providerId, input.zoneId, input.zoneName),
      ]);
      return { ...input, records, changeSets, verifications };
    },
    onSuccess: (payload) => {
      const zoneKey = `${payload.providerId}:${payload.zoneId}`;
      setZoneFailureCooldowns((current) => {
        if (!(zoneKey in current)) {
          return current;
        }
        const next = { ...current };
        delete next[zoneKey];
        return next;
      });
      setProviderError(null);
      setProviderWorkspaceError(null);
      setActionNotice(`Text ${payload.zoneName} Text DNS Text。`);
      setActiveZoneWorkspace(payload);
      setActivePreviewChangeSetId(payload.changeSets.find((item) => item.status !== "applied")?.id ?? payload.changeSets[0]?.id ?? null);
      setExpandedZoneKey(`${payload.providerId}:${payload.zoneId}`);
      setLastProviderWorkspaceAttempt({
        kind: "records",
        providerId: payload.providerId,
        zoneId: payload.zoneId,
        zoneName: payload.zoneName,
      });
    },
    onError: (error, input) => {
      const detail = getAPIErrorMessage(error, "Text Zone Records Text，Text Provider Text。");
      const message = describeProviderWorkspaceError(detail);
      if (isProviderRateLimitedError(detail)) {
        const zoneKey = `${input.providerId}:${input.zoneId}`;
        setZoneFailureCooldowns((current) => ({
          ...current,
          [zoneKey]: Date.now() + PROVIDER_ZONE_FAILURE_COOLDOWN_MS,
        }));
      }
      setProviderError(message);
      setProviderWorkspaceError({
        title: `${input.zoneName} · DNS Text`,
        message,
        detail,
      });
      setLastProviderWorkspaceAttempt({
        kind: "records",
        providerId: input.providerId,
        zoneId: input.zoneId,
        zoneName: input.zoneName,
      });
    },
  });

  const createProviderMutation = useMutation({
    mutationFn: createDomainProvider,
    onSuccess: async () => {
      setProviderError(null);
      setActionNotice("Provider Text。");
      resetProviderForm();
      setCreateProviderDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["user-domain-providers"], refetchType: "all" });
    },
    onError: (error) => {
      setProviderError(getAPIErrorMessage(error, "Text Provider Text，Text。"));
    },
  });
  const updateProviderMutation = useMutation({
    mutationFn: ({ providerAccountId, input }: { providerAccountId: number; input: Parameters<typeof updateDomainProvider>[1] }) =>
      updateDomainProvider(providerAccountId, input),
    onSuccess: async () => {
      setProviderError(null);
      setActionNotice("Provider Text。");
      resetProviderForm();
      setCreateProviderDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["user-domain-providers"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
    },
    onError: (error) => {
      setProviderError(getAPIErrorMessage(error, "Text Provider Text，Text。"));
    },
  });

  const validateProviderMutation = useMutation({
    mutationFn: validateDomainProvider,
    onSuccess: async () => {
      setProviderError(null);
      setProviderWorkspaceError(null);
      setActionNotice("Provider Text。");
      await queryClient.invalidateQueries({ queryKey: ["user-domain-providers"], refetchType: "all" });
    },
    onError: (error) => {
      setProviderError(getAPIErrorMessage(error, "Text Provider Text，Text。"));
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: deleteDomainProvider,
    onSuccess: async (_, providerId) => {
      setProviderError(null);
      setProviderWorkspaceError(null);
      setActionNotice("Provider Text。");
      queryClient.setQueryData<Awaited<ReturnType<typeof fetchDomainProviders>>>(["user-domain-providers"], (current) =>
        (current ?? []).filter((item) => item.id !== providerId),
      );
      if (activeProviderWorkspace?.providerId === providerId) {
        setActiveProviderWorkspace(null);
        setActiveZoneWorkspace(null);
        setExpandedProviderId(null);
        setExpandedZoneKey(null);
        setLastProviderWorkspaceAttempt(null);
        setActivePreviewChangeSetId(null);
      }
      if (selectedProviderId === String(providerId)) {
        setSelectedProviderId("");
      }
      await queryClient.invalidateQueries({ queryKey: ["user-domain-providers"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
    },
    onError: (error) => {
      setProviderError(getAPIErrorMessage(error, "Text Provider Text，TextDomainText。"));
    },
  });

  const validatingProviderId = validateProviderMutation.isPending
    ? validateProviderMutation.variables ?? null
    : null;
  const deletingProviderId = deleteProviderMutation.isPending
    ? deleteProviderMutation.variables ?? null
    : null;
  const loadingZonesProviderId = providerZoneMutation.isPending
    ? providerZoneMutation.variables?.id ?? null
    : null;
  const loadingZoneDetailKey = providerZoneDetailMutation.isPending
    ? `${providerZoneDetailMutation.variables?.providerId ?? ""}:${providerZoneDetailMutation.variables?.zoneId ?? ""}`
    : null;
  const isRefreshingDomainData = domainsQuery.isRefetching || providersQuery.isRefetching;

  const createDomainMutation = useMutation({
    mutationFn: createDomain,
    onSuccess: async () => {
      setRootDomain("");
      setSelectedProviderId("");
      setDomainError(null);
      setActionNotice("TextDomainText。");
      setCreateRootDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"], refetchType: "all" });
    },
    onError: (error) => {
      setDomainError(getAPIErrorMessage(error, "TextDomainText，TextDomainText。"));
    },
  });

  const generateMutation = useMutation({
    mutationFn: generateSubdomains,
    onSuccess: async () => {
      setDomainError(null);
      setActionNotice("TextDomainText。");
      setGenerateDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"], refetchType: "all" });
    },
    onError: (error) => {
      setDomainError(getAPIErrorMessage(error, "TextDomainText。"));
    },
  });

  const previewChangeSetMutation = useMutation({
    mutationFn: async (input: {
      providerId: number;
      zoneId: string;
      zoneName: string;
      records: UserProviderRecordItem[];
    }) =>
      previewDomainProviderChangeSet(input.providerId, input.zoneId, {
        zoneName: input.zoneName,
        records: input.records,
      }),
    onSuccess: (changeSet) => {
      setActionNotice(`Text DNS Text：${changeSet.summary}`);
      setProviderError(null);
      setActivePreviewChangeSetId(changeSet.id);
      setActiveZoneWorkspace((current) => {
        if (!current) {
          return current;
        }
        const nextChangeSets = [changeSet, ...current.changeSets.filter((item) => item.id !== changeSet.id)];
        return {
          ...current,
          changeSets: nextChangeSets,
        };
      });
    },
    onError: (error) => {
      setProviderError(getAPIErrorMessage(error, "Text DNS Text。"));
    },
  });

  const applyChangeSetMutation = useMutation({
    mutationFn: applyDomainProviderChangeSet,
    onSuccess: (changeSet) => {
      setActionNotice(`Text Provider API Text：${changeSet.summary}`);
      setProviderError(null);
      setActivePreviewChangeSetId(changeSet.id);
      setActiveZoneWorkspace((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          changeSets: current.changeSets.map((item) => (item.id === changeSet.id ? changeSet : item)),
        };
      });
    },
    onError: (error) => {
      setProviderError(getAPIErrorMessage(error, "Text DNS Text。"));
    },
  });

  const saveRecommendedRecordsMutation = useMutation({
    mutationFn: async (input: {
      providerId: number;
      zoneId: string;
      zoneName: string;
      records: UserProviderRecordItem[];
    }) => {
      const preview = await previewDomainProviderChangeSet(input.providerId, input.zoneId, {
        zoneName: input.zoneName,
        records: input.records,
      });
      return applyDomainProviderChangeSet(preview.id);
    },
    onSuccess: async (changeSet, variables) => {
      const verifications = await fetchDomainProviderVerifications(
        variables.providerId,
        variables.zoneId,
        variables.zoneName,
      );
      setActionNotice(`Text and  DNS Text：${changeSet.summary}`);
      setProviderError(null);
      setActivePreviewChangeSetId(changeSet.id);
      setActiveZoneWorkspace((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          records: dedupeProviderRecords(variables.records),
          changeSets: [
            changeSet,
            ...current.changeSets.filter((item: UserDNSChangeSetItem) => item.id !== changeSet.id),
          ],
          verifications,
        };
      });
      scheduleWorkspaceRefresh();
    },
    onError: (error) => {
      setProviderError(getAPIErrorMessage(error, "Text DNS Text。"));
    },
  });

  function retryLastProviderWorkspaceAttempt() {
    if (!lastProviderWorkspaceAttempt) {
      return;
    }
    setActionNotice(null);
    if (lastProviderWorkspaceAttempt.kind === "zones") {
      providerZoneMutation.mutate({
        id: lastProviderWorkspaceAttempt.providerId,
        displayName: lastProviderWorkspaceAttempt.providerName,
      });
      return;
    }
    providerZoneDetailMutation.mutate({
      providerId: lastProviderWorkspaceAttempt.providerId,
      zoneId: lastProviderWorkspaceAttempt.zoneId,
      zoneName: lastProviderWorkspaceAttempt.zoneName,
    });
  }

  async function resolveLiveOwnedProvider(providerId: number) {
    const result = await providersQuery.refetch();
    const liveProviders = result.data ?? providersQuery.data ?? [];
    const provider = liveProviders.find((item) => item.id === providerId) ?? null;

    if (provider) {
      return provider;
    }

    queryClient.setQueryData<Awaited<ReturnType<typeof fetchDomainProviders>>>(
      ["user-domain-providers"],
      liveProviders,
    );

    if (activeProviderWorkspace?.providerId === providerId) {
      setActiveProviderWorkspace(null);
      setActiveZoneWorkspace(null);
      setExpandedProviderId(null);
      setExpandedZoneKey(null);
      setLastProviderWorkspaceAttempt(null);
      setActivePreviewChangeSetId(null);
    }


    setActionNotice(null);
    setProviderWorkspaceError(null);
    setProviderError("Provider Text，TextRefreshText Provider Text。");
    return null;
  }

  async function validateActiveProviderWorkspace() {
    if (!activeProviderWorkspace) {
      return;
    }
    setActionNotice(null);
    const liveProvider = await resolveLiveOwnedProvider(activeProviderWorkspace.providerId);
    if (!liveProvider) {
      return;
    }
    validateProviderMutation.mutate(liveProvider.id);
  }

  function toggleProviderExpanded(providerId: number) {
    setExpandedProviderId((current) => (current === providerId ? null : providerId));
  }

  function toggleZoneExpanded(providerId: number, zoneId: string) {
    const key = `${providerId}:${zoneId}`;
    setExpandedZoneKey((current) => (current === key ? null : key));
  }

  const recommendedRepairRecords = useMemo(
    () => (activeZoneWorkspace ? collectRepairRecords(activeZoneWorkspace.verifications) : []),
    [activeZoneWorkspace],
  );
  const paginatedZoneRecords = useMemo(
    () =>
      paginateItems(
        activeZoneWorkspace?.records ?? [],
        recordsPage,
        USER_DNS_RECORDS_PAGE_SIZE,
      ),
    [activeZoneWorkspace?.records, recordsPage],
  );
  const activePreviewChangeSet = useMemo(
    () =>
      activeZoneWorkspace?.changeSets.find((item) => item.id === activePreviewChangeSetId) ??
      activeZoneWorkspace?.changeSets.find((item) => item.status !== "applied") ??
      activeZoneWorkspace?.changeSets[0] ??
      null,
    [activePreviewChangeSetId, activeZoneWorkspace],
  );

  useEffect(() => {
    writePersistedState(domainsCacheKey, domainsQuery.data ?? []);
  }, [domainsCacheKey, domainsQuery.data]);

  useEffect(() => {
    writePersistedState(providersCacheKey, providersQuery.data ?? []);
  }, [providersCacheKey, providersQuery.data]);

  useEffect(() => {
    writePersistedState(workspaceCacheKey, {
      activeProviderWorkspace,
      activeZoneWorkspace,
      expandedRootIds,
      expandedProviderId,
      expandedZoneKey,
      recordsExpanded,
      recordsPage,
      zoneConfigMode,
      activePreviewChangeSetId,
    });
  }, [
    activePreviewChangeSetId,
    activeProviderWorkspace,
    activeZoneWorkspace,
    expandedProviderId,
    expandedRootIds,
    expandedZoneKey,
    recordsExpanded,
    recordsPage,
    workspaceCacheKey,
    zoneConfigMode,
  ]);

  useEffect(() => {
    setRecordsPage(1);
  }, [activeZoneWorkspace?.providerId, activeZoneWorkspace?.zoneId]);

  useEffect(() => {
    return () => {
      if (pendingWorkspaceRefreshRef.current !== null) {
        window.clearTimeout(pendingWorkspaceRefreshRef.current);
      }
    };
  }, []);

  const hasPendingVerifications = useMemo(
    () => (activeZoneWorkspace?.verifications ?? []).some((p) => p.status !== "verified"),
    [activeZoneWorkspace?.verifications],
  );
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  useEffect(() => {
    if (!hasPendingVerifications || !activeZoneWorkspace) {
      setIsAutoRefreshing(false);
      return;
    }
    const intervalId = window.setInterval(async () => {
      try {
        setIsAutoRefreshing(true);
        const verifications = await fetchDomainProviderVerifications(
          activeZoneWorkspace.providerId,
          activeZoneWorkspace.zoneId,
          activeZoneWorkspace.zoneName,
        );
        setActiveZoneWorkspace((current) =>
          current ? { ...current, verifications } : current,
        );
      } catch {
        // Silently ignore polling errors
      } finally {
        setIsAutoRefreshing(false);
      }
    }, 30_000);
    return () => {
      window.clearInterval(intervalId);
      setIsAutoRefreshing(false);
    };
  }, [hasPendingVerifications, activeZoneWorkspace?.providerId, activeZoneWorkspace?.zoneId, activeZoneWorkspace?.zoneName]);

  const requestedDomainUsesActiveWorkspace = useCallback((domain: {
    providerAccountId?: number | null;
    rootDomain: string;
    domain: string;
  }) => {
    return Boolean(
      activeZoneWorkspace &&
        domain.providerAccountId === activeZoneWorkspace.providerId &&
        (activeZoneWorkspace.zoneName === domain.rootDomain ||
          activeZoneWorkspace.zoneName === domain.domain),
    );
  }, [activeZoneWorkspace]);

  const syncWorkspaceForRequestedDomain = useCallback(async (domain: (typeof ownedDomains)[number]) => {
    setProviderError(null);
    setProviderWorkspaceError(null);

    if (!domain.providerAccountId) {
      setDomainError(`Domain ${domain.domain} Text DNS Text，TextDomainText。`);
      setActiveZoneWorkspace(null);
      setExpandedZoneKey(null);
      setActivePreviewChangeSetId(null);
      return;
    }

    const providerMeta = providerMap.get(domain.providerAccountId);
    const providerName = domain.providerDisplayName ?? providerMeta?.displayName ?? domain.provider ?? "Provider";

    try {
      const zones =
        activeProviderWorkspace?.providerId === domain.providerAccountId
          ? activeProviderWorkspace.zones
          : await fetchDomainProviderZones(domain.providerAccountId);

      setActiveProviderWorkspace({
        providerId: domain.providerAccountId,
        providerName,
        provider: providerMeta?.provider ?? domain.provider ?? "unknown",
        authType: providerMeta?.authType ?? "unknown",
        zones,
      });
      setExpandedProviderId(domain.providerAccountId);

      const targetZone =
        zones.find((zone) => zone.name === domain.rootDomain) ??
        zones.find((zone) => zone.name === domain.domain) ??
        null;

      if (!targetZone) {
        setDomainError(
          `Text ${providerName} Text Zone Text，Text and  ${domain.rootDomain} Text ${domain.domain}。TextDomainText Provider Text。`,
        );
        setActiveZoneWorkspace(null);
        setExpandedZoneKey(null);
        setActivePreviewChangeSetId(null);
        return;
      }

      const [records, changeSets] = await Promise.all([
        fetchDomainProviderRecords(domain.providerAccountId, targetZone.id),
        fetchDomainProviderChangeSets(domain.providerAccountId, targetZone.id),
      ]);
      const verifications = await fetchDomainProviderVerifications(
        domain.providerAccountId,
        targetZone.id,
        targetZone.name,
      );

      setDomainError(null);
      setActionNotice(`TextDomain ${domain.domain} Text and  Zone ${targetZone.name}。`);
      setActiveZoneWorkspace({
        providerId: domain.providerAccountId,
        zoneId: targetZone.id,
        zoneName: targetZone.name,
        records,
        changeSets,
        verifications,
      });
      setExpandedZoneKey(`${domain.providerAccountId}:${targetZone.id}`);
      setActivePreviewChangeSetId(
        changeSets.find((item) => item.status !== "applied")?.id ?? changeSets[0]?.id ?? null,
      );
    } catch (error) {
      setDomainError(getAPIErrorMessage(error, "TextDomainText DNS Text，Text Provider Text。"));
    }
  }, [activeProviderWorkspace, providerMap]);

  const refreshUserDomainData = useCallback(async () => {
    setActionNotice(null);
    const [, providersResult] = await Promise.all([domainsQuery.refetch(), providersQuery.refetch()]);
    const liveProviders = providersResult.data ?? providerItems;
    const liveProviderIds = new Set(liveProviders.map((item) => item.id));

    if (activeProviderWorkspace && liveProviderIds.has(activeProviderWorkspace.providerId)) {
      const zones = await fetchDomainProviderZones(activeProviderWorkspace.providerId);
      setActiveProviderWorkspace((current) =>
        current
          ? {
              ...current,
              zones,
            }
          : current,
      );
    } else if (activeProviderWorkspace) {
      setActiveProviderWorkspace(null);
      setActiveZoneWorkspace(null);
      setExpandedProviderId(null);
      setExpandedZoneKey(null);
      setLastProviderWorkspaceAttempt(null);
      setActivePreviewChangeSetId(null);
    }

    if (activeZoneWorkspace && liveProviderIds.has(activeZoneWorkspace.providerId)) {
      const [records, changeSets] = await Promise.all([
        fetchDomainProviderRecords(activeZoneWorkspace.providerId, activeZoneWorkspace.zoneId),
        fetchDomainProviderChangeSets(activeZoneWorkspace.providerId, activeZoneWorkspace.zoneId),
      ]);
      const verifications = await fetchDomainProviderVerifications(
        activeZoneWorkspace.providerId,
        activeZoneWorkspace.zoneId,
        activeZoneWorkspace.zoneName,
      );

      setActiveZoneWorkspace({
        ...activeZoneWorkspace,
        records,
        changeSets,
        verifications,
      });
      setActivePreviewChangeSetId(
        changeSets.find((item) => item.status !== "applied")?.id ?? changeSets[0]?.id ?? null,
      );
    } else if (activeZoneWorkspace) {
      setActiveZoneWorkspace(null);
      setExpandedZoneKey(null);
      setLastProviderWorkspaceAttempt(null);
      setActivePreviewChangeSetId(null);
    }
  }, [activeProviderWorkspace, activeZoneWorkspace, domainsQuery, providerItems, providersQuery]);

  useEffect(() => {
    if (!requestedDomain && !requestedProvider) {
      autoWorkspaceRequestRef.current = null;
    }

    const invalidKeys: Array<"providerId" | "domainId"> = [];

    if (searchParams.has("domainId") && requestedDomainId !== null && !requestedDomain) {
      invalidKeys.push("domainId");
    }
    if (searchParams.has("providerId") && requestedProviderId !== null && !requestedProvider) {
      invalidKeys.push("providerId");
    }

    if (invalidKeys.length > 0) {
      autoWorkspaceRequestRef.current = null;
      clearInvalidSearchParams(invalidKeys);
      return;
    }

    if (requestedDomain) {
      const targetRoot =
        requestedDomain.kind === "root"
          ? requestedDomain
          : rootDomains.find((item) => item.domain === requestedDomain.rootDomain) ?? null;
      if (targetRoot) {
        setExpandedRootIds((current) => ({ ...current, [targetRoot.id]: true }));
      }

      if (!requestedDomain.providerAccountId) {
        autoWorkspaceRequestRef.current = `domain:${requestedDomain.id}:unbound`;
        setDomainError(`Domain ${requestedDomain.domain} Text DNS Text，TextDomainText。`);
        return;
      }

      const requestKey = `domain:${requestedDomain.id}:${requestedDomain.providerAccountId}:${requestedDomain.rootDomain}:${requestedDomain.domain}`;
      if (
        !requestedDomainUsesActiveWorkspace(requestedDomain) &&
        !providerZoneMutation.isPending &&
        !providerZoneDetailMutation.isPending &&
        autoWorkspaceRequestRef.current !== requestKey
      ) {
        autoWorkspaceRequestRef.current = requestKey;
        void syncWorkspaceForRequestedDomain(requestedDomain);
        return;
      }

      autoWorkspaceRequestRef.current = requestKey;
    }

    const targetProvider =
      requestedProvider ??
      (requestedDomain?.providerAccountId
        ? providerItems.find((item) => item.id === requestedDomain.providerAccountId) ?? null
        : null);

    if (!targetProvider) {
      return;
    }

    const requestKey = `provider:${targetProvider.id}`;
    setExpandedProviderId(targetProvider.id);
    if (
      activeProviderWorkspace?.providerId === targetProvider.id ||
      providerZoneMutation.isPending ||
      autoWorkspaceRequestRef.current === requestKey
    ) {
      return;
    }

    autoWorkspaceRequestRef.current = requestKey;
    providerZoneMutation.mutate({
      id: targetProvider.id,
      displayName: targetProvider.displayName,
    });
  }, [
    activeProviderWorkspace?.providerId,
    activeZoneWorkspace,
    clearInvalidSearchParams,
    location.pathname,
    providerZoneDetailMutation.isPending,
    providerZoneMutation,
    requestedDomain,
    requestedDomainId,
    requestedDomainUsesActiveWorkspace,
    requestedProvider,
    requestedProviderId,
    rootDomains,
    searchParams,
    syncWorkspaceForRequestedDomain,
    providerItems,
  ]);

  return (
    <WorkspacePage>
      <WorkspacePanel
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/domains">DomainText</Link>
            </Button>
            <Button onClick={openCreateProviderDialog} variant="outline">
              Text Provider
            </Button>
            <Button onClick={() => void refreshUserDomainData()} variant="outline">
              <RefreshCcw className={isRefreshingDomainData ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
          </div>
        }
        description="Text Zone、Records、Text Change Set，TextDomainText。"
        title="DNS Text"
      >
        <AlertDialog
          open={providerDeleteDialog !== null}
          onOpenChange={(open) => {
            if (!open) {
              setProviderDeleteDialog(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Text DNS Text？</AlertDialogTitle>
              <AlertDialogDescription>
                {providerDeleteDialog
                  ? `Text Provider ${providerDeleteDialog.name}？Text Zone，Text DNS。`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!providerDeleteDialog) {
                    return;
                  }
                  const liveProvider = await resolveLiveOwnedProvider(providerDeleteDialog.id);
                  if (!liveProvider) {
                    setProviderDeleteDialog(null);
                    return;
                  }
                  deleteProviderMutation.mutate(liveProvider.id);
                  setProviderDeleteDialog(null);
                }}
              >
                Text
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {providerError ? (
          <NoticeBanner autoHideMs={5000} onDismiss={() => setProviderError(null)} variant="error">
            {providerError}
          </NoticeBanner>
        ) : null}
        {domainError ? (
          <NoticeBanner autoHideMs={5000} onDismiss={() => setDomainError(null)} variant="error">
            {domainError}
          </NoticeBanner>
        ) : null}
        {actionNotice ? (
          <NoticeBanner autoHideMs={5000} onDismiss={() => setActionNotice(null)} variant="success">
            {actionNotice}
          </NoticeBanner>
        ) : null}
        {(requestedProvider || requestedDomain || activeZoneWorkspace) ? (
          <Card className="border-border/60 bg-card/85 shadow-none">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Text</div>
                <p className="text-xs text-muted-foreground">
                  {requestedDomain
                    ? `TextDomain ${requestedDomain.domain} Text DNS Text。`
                    : requestedProvider
                      ? `Text Provider ${requestedProvider.displayName} Text DNS Text。`
                      : `Text ${activeZoneWorkspace?.zoneName ?? activeProviderWorkspace?.providerName ?? "DNS Text"}。`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {requestedDomain ? <WorkspaceBadge variant="outline">Domain：{requestedDomain.domain}</WorkspaceBadge> : null}
                {requestedProvider ? <WorkspaceBadge variant="outline">Provider：{requestedProvider.displayName}</WorkspaceBadge> : null}
                {activeZoneWorkspace ? <WorkspaceBadge variant="outline">Zone：{activeZoneWorkspace.zoneName}</WorkspaceBadge> : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
        <Card className="border-border/60 bg-card/85 shadow-none">
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Text</div>
                <p className="text-xs text-muted-foreground">
                  Text Provider，Text Zone Text；Text `@`，Text。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <WorkspaceBadge variant="outline">1. Text Provider</WorkspaceBadge>
                <WorkspaceBadge variant="outline">2. Text</WorkspaceBadge>
                <WorkspaceBadge variant="outline">3. Text</WorkspaceBadge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog
          onOpenChange={(open) => {
            setCreateProviderDialogOpen(open);
            if (!open) {
              resetProviderForm();
            }
          }}
          open={isCreateProviderDialogOpen}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditingProvider ? "Text Provider" : "Text Provider"}</DialogTitle>
              <DialogDescription>
                {isEditingProvider
                  ? providerCoreFieldsLocked
                    ? "Text Provider TextDomain，Text、Text、Text，Text。"
                    : "Text Provider TextDomain，Text、Text、Text。"
                  : "TextDomainText DNS Provider Text，TextDomainText。"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <WorkspaceField label="Provider">
                <OptionCombobox
                  ariaLabel="Provider"
                  emptyLabel="Text Provider"
                  options={[{ value: "cloudflare", label: "Cloudflare" }, { value: "spaceship", label: "Spaceship" }]}
                  placeholder="Text Provider"
                  searchPlaceholder="Text Provider"
                  disabled={providerCoreFieldsLocked}
                  value={providerDraft.provider}
                  onValueChange={(value) => {
                    const nextProvider = value || "cloudflare";
                    setProviderDraft((current) => ({
                      ...current,
                      provider: nextProvider,
                      authType: nextProvider === "spaceship" ? "api_key" : "api_token",
                      permissionValues: sanitizeProviderPermissions(
                        nextProvider,
                        current.permissionValues,
                      ),
                    }));
                    setProviderCredentials(EMPTY_PROVIDER_CREDENTIALS);
                  }}
                />
              </WorkspaceField>
              <WorkspaceField label="Text">
                <Input value={providerDraft.displayName} onChange={(event) => setProviderDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="Text My Cloudflare" />
              </WorkspaceField>
              <WorkspaceField label="Text">
                <OptionCombobox
                  ariaLabel="Text"
                  emptyLabel="Text"
                  options={
                    providerDraft.provider === "spaceship"
                      ? [{ value: "api_key", label: "API Key + API Secret" }]
                      : [
                          { value: "api_token", label: "API Token" },
                          { value: "api_key", label: "Global API Key + Email" },
                        ]
                  }
                  placeholder="Text"
                  searchPlaceholder="Text"
                  disabled={providerCoreFieldsLocked}
                  value={providerDraft.authType}
                  onValueChange={(value) => {
                    setProviderDraft((current) => ({
                      ...current,
                      authType: value || (current.provider === "spaceship" ? "api_key" : "api_token"),
                    }));
                    setProviderCredentials(EMPTY_PROVIDER_CREDENTIALS);
                  }}
                />
              </WorkspaceField>
              <WorkspaceField label="Text">
                <MultiOptionCombobox
                  ariaLabel="Text"
                  emptyLabel="Text"
                  options={getProviderPermissionOptions(providerDraft.provider)}
                  placeholder="Text"
                  searchPlaceholder="Text"
                  values={providerDraft.permissionValues}
                  onValuesChange={(values) =>
                    setProviderDraft((current) => ({
                      ...current,
                      permissionValues: sanitizeProviderPermissions(current.provider, values),
                    }))
                  }
                />
              </WorkspaceField>
            </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <div className="text-sm font-medium">{getProviderAuthModeMeta(providerDraft.provider, providerDraft.authType).title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {getProviderAuthModeMeta(providerDraft.provider, providerDraft.authType).description}
                  {isEditingProvider ? " Text。" : ""}
                </div>
              </div>
            <div className="grid gap-4 md:grid-cols-2">
              {getProviderCredentialFields(providerDraft.provider, providerDraft.authType).map((field) => (
                <WorkspaceField key={field.key} label={field.label}>
                  <Input
                    aria-label={field.label}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={providerCredentials[field.key]}
                    onChange={(event) => setProviderCredentials((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                </WorkspaceField>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button
                disabled={
                  !providerDraft.displayName.trim() ||
                  !canSubmitProvider(providerDraft.provider, providerDraft.authType, providerCredentials, isEditingProvider) ||
                  createProviderMutation.isPending ||
                  updateProviderMutation.isPending
                }
                onClick={() => {
                  const input = {
                    provider: providerDraft.provider,
                    displayName: providerDraft.displayName.trim(),
                    authType: providerDraft.authType,
                    credentials: {
                      apiToken: providerCredentials.apiToken.trim(),
                      apiEmail: providerCredentials.apiEmail.trim(),
                      apiKey: providerCredentials.apiKey.trim(),
                      apiSecret: providerCredentials.apiSecret.trim(),
                    },
                    status: providerDraft.status,
                    capabilities: sanitizeProviderPermissions(
                      providerDraft.provider,
                      providerDraft.permissionValues,
                    ),
                  };

                  if (editingProviderId !== null) {
                    updateProviderMutation.mutate({ providerAccountId: editingProviderId, input });
                    return;
                  }

                  createProviderMutation.mutate(input);
                }}
              >
                {createProviderMutation.isPending || updateProviderMutation.isPending
                  ? "Text..."
                  : isEditingProvider
                    ? "Text Provider"
                    : "Text Provider"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog onOpenChange={setCreateRootDialogOpen} open={isCreateRootDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>TextDomain</DialogTitle>
              <DialogDescription>TextDomain，Text and Text Provider。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <WorkspaceField label="TextDomain">
                <Input onChange={(event) => setRootDomain(event.target.value)} placeholder="example.com" value={rootDomain} />
              </WorkspaceField>
              <WorkspaceField label="Text Provider">
                <OptionCombobox
                  ariaLabel="Text Provider"
                  emptyLabel="Text Provider"
                  options={providerOptions}
                  placeholder="Text，Text Provider"
                  searchPlaceholder="Text Provider"
                  value={selectedProviderId || undefined}
                  onValueChange={(value) => setSelectedProviderId(value || "")}
                />
              </WorkspaceField>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button
                disabled={!rootDomain.trim()}
                onClick={() => createDomainMutation.mutate({
                  domain: rootDomain,
                  status: "active",
                  visibility: "private",
                  publicationStatus: "draft",
                  verificationScore: 0,
                  healthStatus: "unknown",
                  providerAccountId: selectedProviderId ? Number(selectedProviderId) : undefined,
                  weight: 100,
                })}
              >TextDomain</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog onOpenChange={setGenerateDialogOpen} open={isGenerateDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>TextDomain</DialogTitle>
              <DialogDescription>TextDomainTextDomain，Text MX、relay、edge Text。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <WorkspaceField label="TextDomain">
                <OptionCombobox
                  ariaLabel="TextDomain"
                  emptyLabel="TextDomain"
                  options={rootDomains.map((item) => ({ value: String(item.id), label: item.domain, keywords: [item.providerDisplayName || ""] }))}
                  placeholder="TextDomain"
                  searchPlaceholder="TextDomain"
                  value={selectedBaseDomainId === "" ? undefined : String(selectedBaseDomainId)}
                  onValueChange={(value) => setSelectedBaseDomainId(value ? Number(value) : "")}
                />
              </WorkspaceField>
              <WorkspaceField label="Text">
                <Textarea rows={6} onChange={(event) => setPrefixInput(event.target.value)} value={prefixInput} placeholder={"Text，Example: \nmx\nmx.edge\nrelay.cn.hk"} />
              </WorkspaceField>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button
                disabled={selectedBaseDomainId === ""}
                onClick={() => generateMutation.mutate({
                  baseDomainId: Number(selectedBaseDomainId),
                  prefixes: prefixInput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
                  status: "active",
                  visibility: "private",
                  publicationStatus: "draft",
                  verificationScore: 0,
                  healthStatus: "unknown",
                  weight: 90,
                })}
              >TextDomain</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>




        <div className="space-y-4">
          <Card className="border-border/60 bg-card/85 shadow-none">
            <CardContent className="space-y-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Provider Text</div>
                  <p className="text-xs text-muted-foreground">Text DNS Provider Text，TextDomainText and Text。</p>
                </div>
                <WorkspaceBadge>{(providersQuery.data ?? []).length} Text</WorkspaceBadge>
              </div>
              {(providersQuery.data ?? []).length ? (
                <div className="space-y-2">
                  {(providersQuery.data ?? []).map((provider) => (
                    <div key={provider.id} className="rounded-xl border border-border/60 bg-background/50">
                      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          onClick={() => toggleProviderExpanded(provider.id)}
                        >
                          <div className="mt-0.5 flex size-6 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground">
                            {expandedProviderId === provider.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{provider.displayName}</span>
                              <WorkspaceBadge variant="outline">{provider.provider}</WorkspaceBadge>
                              <WorkspaceBadge variant="outline">{provider.status}</WorkspaceBadge>
                            </div>
                            <p className="text-xs text-muted-foreground">{provider.authType} · {(provider.capabilities ?? []).join(" / ") || "Text"}</p>
                            {activeProviderWorkspace?.providerId === provider.id ? (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span>Text {activeProviderWorkspace.zones.length} Text Zone</span>
                                {activeZoneWorkspace?.providerId === provider.id ? (
                                  <>
                                    <span>·</span>
                                    <span>{activeZoneWorkspace.records.length} Text</span>
                                    <span>·</span>
                                    <span>{activeZoneWorkspace.changeSets.length} Text</span>
                                  </>
                                ) : null}
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground">Text，Text Zone Text。</div>
                            )}
                          </div>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={validatingProviderId === provider.id}
                            onClick={async () => {
                              const liveProvider = await resolveLiveOwnedProvider(provider.id);
                              if (!liveProvider) {
                                return;
                              }
                              validateProviderMutation.mutate(liveProvider.id);
                            }}
                          >
                            <RefreshCcw className="size-4" />
                            {validatingProviderId === provider.id ? "Text..." : "Text"}
                          </Button>
                          <Button
                            aria-label={`${provider.displayName} Text`}
                            size="sm"
                            variant="ghost"
                            disabled={deletingProviderId === provider.id}
                            onClick={() => openEditProviderDialog(provider)}
                          >
                            Text
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              loadingZonesProviderId === provider.id ||
                              providerZoneDetailMutation.isPending
                            }
                            onClick={async () => {
                              const liveProvider = await resolveLiveOwnedProvider(provider.id);
                              if (!liveProvider) {
                                return;
                              }
                              setExpandedProviderId(liveProvider.id);
                              providerZoneMutation.mutate({
                                id: liveProvider.id,
                                displayName: liveProvider.displayName,
                              });
                            }}
                          >
                            {loadingZonesProviderId === provider.id ? "Text..." : "Text Zones"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deletingProviderId === provider.id}
                            onClick={() => {
                              setActionNotice(null);
                              setProviderDeleteDialog({
                                id: provider.id,
                                name: provider.displayName,
                              });
                            }}
                          >
                            <Trash2 className="size-4" />
                            {deletingProviderId === provider.id ? "Text..." : "Text"}
                          </Button>
                        </div>
                      </div>
                      {expandedProviderId === provider.id ? (
                        <div className="border-t border-border/60 px-4 py-3">
                          {activeProviderWorkspace?.providerId === provider.id ? (
                            <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">{activeProviderWorkspace.providerName} · Zones</div>
                                  <p className="text-xs text-muted-foreground">Text Provider Text Zone，Text Zone Text Records / Text。</p>
                                </div>
                                <WorkspaceBadge variant="outline">{activeProviderWorkspace.zones.length} Text Zone</WorkspaceBadge>
                              </div>

                              {providerWorkspaceError ? (
                                <NoticeBanner
                                  autoHideMs={5000}
                                  onDismiss={() => setProviderWorkspaceError(null)}
                                  pauseOnHover
                                  variant="warning"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="font-medium">{providerWorkspaceError.title}</div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={providerZoneMutation.isPending || providerZoneDetailMutation.isPending}
                                      onClick={retryLastProviderWorkspaceAttempt}
                                    >
                                      Text
                                    </Button>
                                  </div>
                                  <p className="mt-1 leading-6">{providerWorkspaceError.message}</p>
                                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-background/60 p-3 text-xs text-foreground/90 dark:bg-background/20">
                                    <div className="font-medium">Text</div>
                                    <ul className="mt-2 space-y-1.5">
                                      {getProviderCredentialChecklist(activeProviderWorkspace.provider, activeProviderWorkspace.authType).map((item) => (
                                        <li key={item} className="flex gap-2">
                                          <span className="mt-[2px] text-amber-600 dark:text-amber-300">•</span>
                                          <span>{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  {providerWorkspaceError.detail && providerWorkspaceError.detail !== providerWorkspaceError.message ? (
                                    <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
                                      Text：{providerWorkspaceError.detail}
                                    </p>
                                  ) : null}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" disabled={validateProviderMutation.isPending} onClick={validateActiveProviderWorkspace}>
                                      {validateProviderMutation.isPending ? "Text..." : "Text Provider"}
                                    </Button>
                                  </div>
                                </NoticeBanner>
                              ) : null}

                              {activeProviderWorkspace.zones.length ? (
                                <div className="space-y-2">
                                  {activeProviderWorkspace.zones.map((zone) => {
                                    const zoneKey = `${activeProviderWorkspace.providerId}:${zone.id}`;
                                    const isExpanded = expandedZoneKey === zoneKey;
                                    const isLoaded =
                                      activeZoneWorkspace?.providerId === activeProviderWorkspace.providerId &&
                                      activeZoneWorkspace.zoneId === zone.id;
                                    const isLoadingThisZone = loadingZoneDetailKey === zoneKey;
                                    const cooldownUntil = zoneFailureCooldowns[zoneKey] ?? 0;
                                    const cooldownSeconds =
                                      cooldownUntil > Date.now()
                                        ? Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000))
                                        : 0;

                                    return (
                                      <div key={zoneKey} className="rounded-xl border border-border/60 bg-card/45">
                                        <div className="flex flex-col gap-3 px-3.5 py-3 md:flex-row md:items-start md:justify-between">
                                          <button
                                            type="button"
                                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                            onClick={() => toggleZoneExpanded(activeProviderWorkspace.providerId, zone.id)}
                                          >
                                            <div className="mt-0.5 flex size-5 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground">
                                              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                              <div className="truncate font-medium">{zone.name}</div>
                                              <div className="text-xs text-muted-foreground">Zone ID: {zone.id}</div>
                                              {isLoaded ? (
                                                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                                  <span>{activeZoneWorkspace.records.length} Text</span>
                                                  <span>·</span>
                                                  <span>{activeZoneWorkspace.changeSets.length} Text</span>
                                                  <span>·</span>
                                                  <span>{activeZoneWorkspace.verifications.length} Text</span>
                                                </div>
                                              ) : (
                                                <div className="text-[11px] text-muted-foreground">Text、Text。</div>
                                              )}
                                            </div>
                                          </button>
                                          <div className="flex flex-wrap items-center gap-2 text-[0.82rem] text-muted-foreground md:justify-end">
                                            <WorkspaceBadge variant="outline">{zone.status}</WorkspaceBadge>
                                            {cooldownSeconds > 0 ? (
                                              <WorkspaceBadge variant="outline">Text {cooldownSeconds}s</WorkspaceBadge>
                                            ) : null}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              disabled={isLoadingThisZone || cooldownSeconds > 0}
                                              onClick={() => {
                                                setExpandedZoneKey(zoneKey);
                                                providerZoneDetailMutation.mutate({
                                                  providerId: activeProviderWorkspace.providerId,
                                                  zoneId: zone.id,
                                                  zoneName: zone.name,
                                                });
                                              }}
                                            >
                                              {isLoadingThisZone
                                                ? "Text..."
                                                : cooldownSeconds > 0
                                                  ? `Text ${cooldownSeconds}s`
                                                  : "Text"}
                                            </Button>
                                          </div>
                                        </div>

                                        {isExpanded ? (
                                          <div className="border-t border-border/60 px-3.5 py-3">
                                            {isLoaded ? (
                                              <div className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                  <div>
                                                    <div className="text-sm font-medium">{activeZoneWorkspace.zoneName} · DNS Text</div>
                                                    <p className="text-xs text-muted-foreground">Text Records、Text Change Set Text。</p>
                                                  </div>
                                                  <div className="flex flex-wrap gap-2">
                                                    <WorkspaceBadge variant="outline">{activeZoneWorkspace.records.length} Text</WorkspaceBadge>
                                                    <WorkspaceBadge variant="outline">{activeZoneWorkspace.changeSets.length} Text</WorkspaceBadge>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => {
                                                        setProviderWorkspaceError(null);
                                                        providerZoneDetailMutation.mutate({
                                                          providerId: activeZoneWorkspace.providerId,
                                                          zoneId: activeZoneWorkspace.zoneId,
                                                          zoneName: activeZoneWorkspace.zoneName,
                                                        });
                                                      }}
                                                    >
                                                      <RefreshCcw className={loadingZoneDetailKey === `${activeZoneWorkspace.providerId}:${activeZoneWorkspace.zoneId}` ? "size-4 animate-spin" : "size-4"} />
                                                      RefreshText Zone
                                                    </Button>
                                                  </div>
                                                </div>

                                                <div className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-3">
                                                  <SectionToggle
                                                    expanded={recordsExpanded}
                                                    title="DNS Records"
                                                    description="Text Zone Text DNS Text，Text。"
                                                    meta={
                                                      <>
                                                        <WorkspaceBadge variant="outline">
                                                          {activeZoneWorkspace.records.length} Text
                                                        </WorkspaceBadge>
                                                        <WorkspaceBadge variant="outline">
                                                          Text {paginatedZoneRecords.page} / {paginatedZoneRecords.totalPages} Text
                                                        </WorkspaceBadge>
                                                      </>
                                                    }
                                                    onToggle={() => setRecordsExpanded((current) => !current)}
                                                  />

                                                  {recordsExpanded ? (
                                                    activeZoneWorkspace.records.length ? (
                                                      <>
                                                        <div className="overflow-x-auto rounded-xl border border-border/60">
                                                          <table className="min-w-[720px] border-collapse text-left text-sm">
                                                            <thead className="bg-background/80 text-muted-foreground">
                                                              <tr>
                                                                <th className="px-3 py-2 font-medium">Text</th>
                                                                <th className="px-3 py-2 font-medium">Text</th>
                                                                <th className="px-3 py-2 font-medium">Text</th>
                                                                <th className="px-3 py-2 font-medium">TTL</th>
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {paginatedZoneRecords.items.map((record, index) => (
                                                                <tr
                                                                  className="group/row border-t border-border/60 bg-card/50"
                                                                  key={`${record.id ?? record.name}-${(paginatedZoneRecords.page - 1) * USER_DNS_RECORDS_PAGE_SIZE + index}`}
                                                                >
                                                                  <td className="px-3 py-3">
                                                                    <WorkspaceBadge variant="outline">{record.type}</WorkspaceBadge>
                                                                  </td>
                                                                  <td className="px-3 py-3 font-medium">{record.name}</td>
                                                                  <td className="px-3 py-3 font-mono text-xs break-all whitespace-normal">
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                      <span>
                                                                        {formatDNSRecordValueForDisplay(
                                                                          record.type,
                                                                          record.value,
                                                                          activeProviderWorkspace?.provider,
                                                                        )}
                                                                      </span>
                                                                      <DnsCopyButton value={record.value} />
                                                                    </span>
                                                                  </td>
                                                                  <td className="px-3 py-3 text-xs text-muted-foreground">{record.ttl}</td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                        <PaginationControls
                                                          itemLabel="Record"
                                                          page={paginatedZoneRecords.page}
                                                          pageSize={USER_DNS_RECORDS_PAGE_SIZE}
                                                          total={paginatedZoneRecords.total}
                                                          totalPages={paginatedZoneRecords.totalPages}
                                                          onPageChange={setRecordsPage}
                                                        />
                                                      </>
                                                    ) : (
                                                      <WorkspaceEmpty title="Text Records" description="Text Zone Text DNS Records。" />
                                                    )
                                                  ) : null}
                                                </div>

                                                <DomainHealthScore verifications={activeZoneWorkspace.verifications} />

                                                <div className="grid gap-3 lg:grid-cols-2">
                                                  <div className="space-y-2 rounded-xl border border-border/60 bg-card/50 p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                      <div className="flex items-center gap-2">
                                                        <div className="text-sm font-medium">Text</div>
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={() => setDnsVerifyWizardOpen(true)}
                                                        >
                                                          {t("dns.verifyWizard.openGuide")}
                                                        </Button>
                                                      </div>
                                                      {(() => {
                                                        const summary = summarizeVerificationStatus(activeZoneWorkspace.verifications);
                                                        return (
                                                          <div className="flex items-center gap-2">
                                                            <WorkspaceBadge variant="outline">Text {summary.verified}</WorkspaceBadge>
                                                            <WorkspaceBadge variant="outline">Text {summary.drifted}</WorkspaceBadge>
                                                            <WorkspaceBadge variant="outline">Text {summary.pending}</WorkspaceBadge>
                                                            {isAutoRefreshing ? (
                                                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <RefreshCcw className="size-3 animate-spin" />
                                                                {t("dns.autoRefreshing")}
                                                              </span>
                                                            ) : hasPendingVerifications ? (
                                                              <span className="text-xs text-muted-foreground">{t("dns.autoRefreshing")}</span>
                                                            ) : null}
                                                          </div>
                                                        );
                                                      })()}
                                                    </div>
                                                    {activeZoneWorkspace.verifications.length ? (
                                                      activeZoneWorkspace.verifications.map((item) => (
                                                        <WorkspaceListRow
                                                          key={item.verificationType}
                                                          title={item.verificationType}
                                                          description={item.summary}
                                                          meta={
                                                            <>
                                                              <WorkspaceBadge variant={item.status === "verified" ? "secondary" : "outline"}>{item.status}</WorkspaceBadge>
                                                              <span>{formatProviderTimestamp(item.lastCheckedAt)}</span>
                                                            </>
                                                          }
                                                        />
                                                      ))
                                                    ) : (
                                                      <WorkspaceEmpty title="Text" description="Text Zone Text。" />
                                                    )}
                                                  </div>

                                                  <div className="space-y-2 rounded-xl border border-border/60 bg-card/50 p-3">
                                                    <div className="text-sm font-medium">Text Change Set</div>
                                                    {activeZoneWorkspace.changeSets.length ? (
                                                      activeZoneWorkspace.changeSets.slice(0, 5).map((item) => (
                                                        <WorkspaceListRow
                                                          key={item.id}
                                                          title={`#${item.id} · ${item.summary}`}
                                                          description={`${item.operations.length} Text · ${item.provider}`}
                                                          meta={
                                                            <>
                                                              <WorkspaceBadge variant="outline">{item.status}</WorkspaceBadge>
                                                              <span>{formatProviderTimestamp(item.appliedAt ?? item.createdAt)}</span>
                                                            </>
                                                          }
                                                        />
                                                      ))
                                                    ) : (
                                                      <WorkspaceEmpty title="Text" description="Text Zone Text DNS Text。" />
                                                    )}
                                                  </div>
                                                </div>

                                                <div className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-3">
                                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                      <div className="text-sm font-medium">DNS Text</div>
                                                      <p className="text-xs text-muted-foreground">Text，Text Provider Text API Text / Text。</p>
                                                    </div>
                                                    <div className="inline-flex rounded-lg border border-border/60 bg-background/80 p-1">
                                                      {[
                                                        { value: "manual" as const, label: "Text" },
                                                        { value: "provider_api" as const, label: "Text" },
                                                      ].map((option) => {
                                                        const zoneKey = `${activeZoneWorkspace.providerId}:${activeZoneWorkspace.zoneId}`;
                                                        const selectedMode = zoneConfigMode[zoneKey] ?? "manual";
                                                        return (
                                                          <button
                                                            key={option.value}
                                                            type="button"
                                                            className={`rounded-md px-3 py-1.5 text-xs transition ${
                                                              selectedMode === option.value
                                                                ? "bg-foreground text-background"
                                                                : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                            onClick={() =>
                                                              setZoneConfigMode((current) => ({
                                                                ...current,
                                                                [zoneKey]: option.value,
                                                              }))
                                                            }
                                                          >
                                                            {option.label}
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>

                                                  {(zoneConfigMode[`${activeZoneWorkspace.providerId}:${activeZoneWorkspace.zoneId}`] ?? "manual") === "manual" ? (
                                                    <div className="space-y-3">
                                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-sm font-medium">Text</div>
                                                        <WorkspaceBadge variant="outline">{recommendedRepairRecords.length} Text</WorkspaceBadge>
                                                      </div>
                                                      {recommendedRepairRecords.length ? (
                                                        <div className="overflow-x-auto rounded-xl border border-border/60">
                                                          <table className="min-w-[760px] border-collapse text-left text-sm">
                                                            <thead className="bg-background/80 text-muted-foreground">
                                                              <tr>
                                                                <th className="px-3 py-2 font-medium">Text</th>
                                                                <th className="px-3 py-2 font-medium">Text</th>
                                                                <th className="px-3 py-2 font-medium">Text</th>
                                                                <th className="px-3 py-2 font-medium">TTL</th>
                                                                <th className="px-3 py-2 font-medium">Text</th>
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {recommendedRepairRecords.map((record, index) => (
                                                                <tr className="group/row border-t border-border/60 bg-background/70" key={`${record.type}-${record.name}-${index}`}>
                                                                  <td className="px-3 py-3"><WorkspaceBadge variant="outline">{record.type}</WorkspaceBadge></td>
                                                                  <td className="px-3 py-3 font-medium">{record.name}</td>
                                                                  <td className="px-3 py-3 font-mono text-xs break-all whitespace-normal">
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                      <span>
                                                                        {formatDNSRecordValueForDisplay(
                                                                          record.type,
                                                                          record.value,
                                                                          activeProviderWorkspace?.provider,
                                                                        )}
                                                                      </span>
                                                                      <DnsCopyButton value={record.value} />
                                                                    </span>
                                                                  </td>
                                                                  <td className="px-3 py-3 text-xs text-muted-foreground">{record.ttl || "Text"}</td>
                                                                  <td className="px-3 py-3 text-xs text-muted-foreground">{record.priority || "-"}</td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                      ) : (
                                                        <WorkspaceEmpty title="Text" description="Text，Text Zone Text repair records。" />
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <div className="space-y-3">
                                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                          <div className="text-sm font-medium">Provider API Text</div>
                                                          <p className="text-xs text-muted-foreground">Text repair records Text，Text DNS Provider API Text。</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                          <Button
                                                            size="sm"
                                                            disabled={recommendedRepairRecords.length === 0 || saveRecommendedRecordsMutation.isPending}
                                                            onClick={() =>
                                                              saveRecommendedRecordsMutation.mutate({
                                                                providerId: activeZoneWorkspace.providerId,
                                                                zoneId: activeZoneWorkspace.zoneId,
                                                                zoneName: activeZoneWorkspace.zoneName,
                                                                records: recommendedRepairRecords,
                                                              })
                                                            }
                                                          >
                                                            {saveRecommendedRecordsMutation.isPending ? "Text..." : "Text and Text"}
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={recommendedRepairRecords.length === 0 || previewChangeSetMutation.isPending || saveRecommendedRecordsMutation.isPending}
                                                            onClick={() =>
                                                              previewChangeSetMutation.mutate({
                                                                providerId: activeZoneWorkspace.providerId,
                                                                zoneId: activeZoneWorkspace.zoneId,
                                                                zoneName: activeZoneWorkspace.zoneName,
                                                                records: recommendedRepairRecords,
                                                              })
                                                            }
                                                          >
                                                            {previewChangeSetMutation.isPending ? "Text..." : "Text"}
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            disabled={!activePreviewChangeSet || activePreviewChangeSet.status === "applied" || applyChangeSetMutation.isPending || saveRecommendedRecordsMutation.isPending}
                                                            onClick={() => {
                                                              if (!activePreviewChangeSet) {
                                                                return;
                                                              }
                                                              applyChangeSetMutation.mutate(activePreviewChangeSet.id);
                                                            }}
                                                          >
                                                            {applyChangeSetMutation.isPending ? "Text..." : "Text"}
                                                          </Button>
                                                        </div>
                                                      </div>

                                                      {recommendedRepairRecords.length === 0 ? (
                                                        <WorkspaceEmpty title="Text" description="Text verification repair records，Text Zone Text。" />
                                                      ) : null}

                                                      {activePreviewChangeSet ? (
                                                        <div className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-3">
                                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div>
                                                              <div className="text-sm font-medium">Text #{activePreviewChangeSet.id}</div>
                                                              <p className="text-xs text-muted-foreground">{activePreviewChangeSet.summary}</p>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                              <WorkspaceBadge variant="outline">{activePreviewChangeSet.status}</WorkspaceBadge>
                                                              <WorkspaceBadge variant="outline">{activePreviewChangeSet.operations.length} Text</WorkspaceBadge>
                                                            </div>
                                                          </div>
                                                          <div className="space-y-2">
                                                            {activePreviewChangeSet.operations.length ? (
                                                              activePreviewChangeSet.operations.map((operation) => (
                                                                <WorkspaceListRow
                                                                  key={operation.id}
                                                                  title={`${operation.operation.toUpperCase()} · ${operation.recordType} · ${operation.recordName}`}
                                                                  description={
                                                                    operation.after?.value ??
                                                                    operation.before?.value ??
                                                                    "Text"
                                                                  }
                                                                  descriptionClassName="font-mono text-xs break-all whitespace-normal"
                                                                  meta={
                                                                    <>
                                                                      <WorkspaceBadge variant="outline">{operation.status}</WorkspaceBadge>
                                                                      <span>{activePreviewChangeSet.provider}</span>
                                                                    </>
                                                                  }
                                                                />
                                                              ))
                                                            ) : (
                                                              <WorkspaceEmpty title="Text" description="Text Provider Text，Text。" />
                                                            )}
                                                          </div>
                                                        </div>
                                                      ) : (
                                                        <WorkspaceEmpty title="Text" description="Text“Text”Text，Text Provider API Text。" />
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ) : (
                                              <WorkspaceEmpty title="Text Zone Text" description="Text“Text”Text，Text Zone Text、Text。" />
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <WorkspaceEmpty title="Text Zone" description="Text Provider Text Zone，TextDomain。" />
                              )}
                            </div>
                          ) : (
                            <WorkspaceEmpty title="Text" description="Text“Text Zones”Text，Text Provider Text Zone、Text。" />
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <WorkspaceEmpty title="Text Provider" description="Text Cloudflare Text Spaceship Text，TextDomain。" />
              )}
            </CardContent>
          </Card>

          <NoticeBanner variant="info">
            TextDomain、Text“Text DNS”Text and  `DomainText` Text；Text DNS Text、Zone、Records Text。
          </NoticeBanner>
        </div>

        {dnsVerifyWizardOpen && activeZoneWorkspace && (
          <DnsVerifyWizard
            open={dnsVerifyWizardOpen}
            onOpenChange={setDnsVerifyWizardOpen}
            domain={domainItems.find((d) => d.domain === activeZoneWorkspace.zoneName) ?? {
              id: 0,
              domain: activeZoneWorkspace.zoneName,
              status: "active",
              visibility: "private",
              publicationStatus: "draft",
              verificationScore: 0,
              healthStatus: "unknown",
              isDefault: false,
              weight: 100,
              rootDomain: activeZoneWorkspace.zoneName,
              parentDomain: "",
              level: 0,
              kind: "root",
            }}
            requiredRecords={activeZoneWorkspace.verifications.flatMap((v) =>
              v.expectedRecords.map((r) => ({
                type: r.type,
                name: r.name,
                value: r.value,
                priority: r.priority || undefined,
              }))
            )}
          />
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}
