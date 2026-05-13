import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, CircleX, Globe, LoaderCircle, RefreshCcw, Trash2 } from "lucide-react";
import i18n from "@/lib/i18n";
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
import { NoticeBanner } from "@/components/ui/notice-banner";
import { OptionCombobox } from "@/components/ui/option-combobox";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceField,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import { getAPIErrorMessage } from "@/lib/http";
import { useAuthStore } from "@/lib/auth-store";
import { paginateItems } from "@/lib/pagination";
import { readPersistedState, writePersistedState } from "@/lib/persisted-state";
import { cn } from "@/lib/utils";
import { validateRequiredText, validateSelection } from "@/lib/validation";
import {
  createDomain,
  deleteDomain,
  fetchDomainProviders,
  fetchDomains,
  generateSubdomains,
  requestDomainPublicPool,
  type DomainVerificationResult,
  updateDomainProviderBinding,
  verifyDomain,
  withdrawDomainPublicPool,
} from "../api";

function getUserDomainsCacheKey(userId: string | undefined, suffix: string) {
  return `shiro-email.user-domains.${userId ?? "guest"}.${suffix}`;
}

const PERSISTED_QUERY_STALE_TIME = 60_000;
const USER_DOMAINS_PAGE_SIZE = 6;

type DomainStatusGroup = "unbound" | "pending" | "verified";

function getDomainStatusGroup(domain: {
  providerAccountId?: number | null;
  healthStatus: string;
  verificationScore: number;
}) {
  if (domain.providerAccountId == null) {
    return "unbound" satisfies DomainStatusGroup;
  }
  if (domain.healthStatus === "healthy" || domain.verificationScore >= 100) {
    return "verified" satisfies DomainStatusGroup;
  }
  return "pending" satisfies DomainStatusGroup;
}

function getDomainStatusMeta(group: DomainStatusGroup) {
  if (group === "verified") {
    return {
      label: "Verified",
      iconClassName: "text-emerald-500",
      cardClassName: "border-emerald-500/20 bg-emerald-500/5",
      description: "DNS and verification status are ready. You can continue creating mailboxes.",
    };
  }
  if (group === "pending") {
    return {
      label: "Pending verification",
      iconClassName: "text-rose-400",
      cardClassName: "border-rose-500/20 bg-rose-500/5",
      description: "A DNS provider is bound, but DNS configuration still needs verification.",
    };
  }
  return {
    label: "DNS not bound",
    iconClassName: "text-amber-500",
    cardClassName: "border-amber-500/20 bg-amber-500/5",
    description: "No DNS provider is bound yet. Bind one before opening the Zone workspace.",
  };
}

function isRootDomainInput(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\.+$/g, "");
  if (!normalized || normalized.includes("..")) {
    return false;
  }
  return normalized.split(".").length <= 2;
}

function normalizeRootDomainInput(value: string) {
  return value.trim().toLowerCase().replace(/\.+$/g, "");
}

function normalizeSubdomainPrefixes(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim().toLowerCase().replace(/^\.+|\.+$/g, ""))
        .filter(Boolean),
    ),
  );
}

function isValidSubdomainPrefix(value: string) {
  return value
    .split(".")
    .every((segment) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(segment));
}

function DomainStatusIcon({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  if (verified) {
    return <Check className={cn("size-4", className)} />;
  }
  return <CircleX className={cn("size-4", className)} />;
}

function getUserDomainDnsLink(domainId: number, providerId?: number | null) {
  const params = new URLSearchParams();
  params.set("domainId", String(domainId));
  if (providerId) {
    params.set("providerId", String(providerId));
  }
  return `/dashboard/dns?${params.toString()}`;
}

function formatVerificationTypeLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    mx: "MX",
    inbound_mx: "Inbound MX",
    spf: "SPF",
    dkim: "DKIM",
    dmarc: "DMARC",
    txt: "TXT",
    cname: "CNAME",
    a: "A",
    aaaa: "AAAA",
  };
  return labels[normalized] ?? value.replace(/_/g, " ").toUpperCase();
}

function formatVerificationStatusLabel(status: string) {
  if (status === "verified") {
    return "Verified";
  }
  if (status === "drifted") {
    return "Record drifted";
  }
  if (status === "missing") {
    return "Record missing";
  }
  return "Pending";
}

function formatDnsRecord(record: {
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority: number;
}) {
  const segments = [record.type, record.name, record.value];
  if (record.priority > 0) {
    segments.push(`prio ${record.priority}`);
  }
  if (record.ttl > 0) {
    segments.push(`ttl ${record.ttl}`);
  }
  return segments.join(" · ");
}

function formatVerificationTimestamp(value?: string) {
  if (!value) {
    return "Not checked yet";
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

function DomainVerificationDetails({
  result,
  dnsLink,
}: {
  result?: DomainVerificationResult;
  dnsLink: string;
}) {
  if (!result) {
    return null;
  }

  const pendingProfiles = result.profiles.filter((item) => item.status !== "verified");
  const latestCheckedAt = result.profiles
    .map((item) => item.lastCheckedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const propagationLabel = result.passed
    ? "Propagation passed"
    : pendingProfiles.length && result.verifiedCount > 0
      ? "Propagation partially passed"
      : "Propagation failed";

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4",
        result.passed ? "border-emerald-500/25 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">{result.passed ? "Latest verification passed" : "Latest verification failed"}</div>
            <WorkspaceBadge variant="outline">
              {result.verifiedCount} / {result.totalCount}
            </WorkspaceBadge>
            {result.zoneName ? <WorkspaceBadge variant="outline">Zone {result.zoneName}</WorkspaceBadge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={dnsLink}>Open DNS Settings</Link>
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Propagation status</div>
          <div className="mt-1 text-sm font-medium">{propagationLabel}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Items to fix</div>
          <div className="mt-1 text-sm font-medium">{pendingProfiles.length} items</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Last check</div>
          <div className="mt-1 text-sm font-medium">{formatVerificationTimestamp(latestCheckedAt)}</div>
        </div>
      </div>

      {!result.passed && pendingProfiles.length ? (
        <div className="mt-4 space-y-3">
          {pendingProfiles.map((profile) => (
            <div key={profile.verificationType} className="rounded-lg border border-border/60 bg-background/80 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <WorkspaceBadge variant="outline">{formatVerificationTypeLabel(profile.verificationType)}</WorkspaceBadge>
                <WorkspaceBadge variant="outline">{formatVerificationStatusLabel(profile.status)}</WorkspaceBadge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{profile.summary}</p>
              {profile.repairRecords.length ? (
                <div className="mt-3 space-y-1.5">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Suggested repair records</div>
                  {profile.repairRecords.slice(0, 3).map((record, index) => (
                    <div
                      key={`${profile.verificationType}-${record.type}-${record.name}-${index}`}
                      className="rounded-md border border-border/60 bg-card/70 px-3 py-2 text-sm break-all"
                    >
                      {formatDnsRecord(record)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function UserDomainsPage() {
  const currentUserId = useAuthStore((state) => state.user?.userId);
  const userCacheScope = currentUserId === undefined ? undefined : String(currentUserId);
  const domainsCacheKey = getUserDomainsCacheKey(userCacheScope, "domains-cache");
  const uiCacheKey = getUserDomainsCacheKey(userCacheScope, "domains-ui");
  const persistedUI = readPersistedState(uiCacheKey, {
    expandedRootIds: {} as Record<number, boolean>,
    verificationResults: {} as Record<number, DomainVerificationResult>,
  });

  const queryClient = useQueryClient();
  const [isCreateRootDialogOpen, setCreateRootDialogOpen] = useState(false);
  const [isGenerateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [isBindProviderDialogOpen, setBindProviderDialogOpen] = useState(false);
  const [rootDomain, setRootDomain] = useState("");
  const [selectedBaseDomainId, setSelectedBaseDomainId] = useState<number | "">("");
  const [bindingDomain, setBindingDomain] = useState<Awaited<ReturnType<typeof fetchDomains>>[number] | null>(null);
  const [selectedProviderAccountId, setSelectedProviderAccountId] = useState<string>("");
  const [prefixInput, setPrefixInput] = useState("mx\nmx.edge\nrelay.cn.hk");
  const [expandedRootIds, setExpandedRootIds] = useState<Record<number, boolean>>(persistedUI.expandedRootIds);
  const [verificationResults, setVerificationResults] = useState<Record<number, DomainVerificationResult>>(
    persistedUI.verificationResults,
  );
  const [verifyingDomainId, setVerifyingDomainId] = useState<number | null>(null);
  const [creatingDomainWithVerification, setCreatingDomainWithVerification] = useState(false);
  const [generatingDomainsWithVerification, setGeneratingDomainsWithVerification] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [deleteDomainDialog, setDeleteDomainDialog] = useState<{
    id: number;
    domain: string;
    label: string;
  } | null>(null);
  const [withdrawDomainDialog, setWithdrawDomainDialog] = useState<{
    id: number;
    domain: string;
    label: string;
  } | null>(null);
  const [rootDomainsPage, setRootDomainsPage] = useState(1);

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
  });

  const effectiveOwnedDomains = useMemo(
    () =>
      (domainsQuery.data ?? [])
        .map((item) => {
          const verifiedDomain = verificationResults[item.id]?.domain;
          return verifiedDomain ? { ...item, ...verifiedDomain } : item;
        })
        .filter((item) => item.ownerUserId !== undefined && item.ownerUserId === currentUserId),
    [currentUserId, domainsQuery.data, verificationResults],
  );

  const ownedDomains = useMemo(
    () => effectiveOwnedDomains,
    [effectiveOwnedDomains],
  );

  const rootDomains = useMemo(
    () => ownedDomains.filter((item) => item.kind === "root"),
    [ownedDomains],
  );

  const childDomainsByRoot = useMemo(() => {
    const map = new Map<string, typeof ownedDomains>();
    ownedDomains
      .filter((item) => item.kind !== "root")
      .forEach((item) => {
        const key = item.rootDomain;
        const current = map.get(key) ?? [];
        current.push(item);
        map.set(key, current);
      });
    return map;
  }, [ownedDomains]);

  const groupedRootDomains = useMemo(() => {
    const groups: Record<DomainStatusGroup, typeof rootDomains> = {
      unbound: [],
      pending: [],
      verified: [],
    };

    rootDomains.forEach((domain) => {
      groups[getDomainStatusGroup(domain)].push(domain);
    });

    return groups;
  }, [rootDomains]);
  const paginatedRootDomains = useMemo(
    () => paginateItems(rootDomains, rootDomainsPage, USER_DOMAINS_PAGE_SIZE),
    [rootDomains, rootDomainsPage],
  );
  const groupedPaginatedRootDomains = useMemo(() => {
    const groups: Record<DomainStatusGroup, typeof rootDomains> = {
      unbound: [],
      pending: [],
      verified: [],
    };

    paginatedRootDomains.items.forEach((domain) => {
      groups[getDomainStatusGroup(domain)].push(domain);
    });

    return groups;
  }, [paginatedRootDomains.items]);

  const domainSummary = useMemo(
    () => ({
      roots: rootDomains.length,
      children: ownedDomains.length - rootDomains.length,
      providers: providersQuery.data?.length ?? 0,
      verified: rootDomains.filter((item) => getDomainStatusGroup(item) === "verified").length,
      pending: rootDomains.filter((item) => getDomainStatusGroup(item) === "pending").length,
      unbound: rootDomains.filter((item) => getDomainStatusGroup(item) === "unbound").length,
    }),
    [ownedDomains.length, providersQuery.data?.length, rootDomains],
  );

  async function applyUserVerificationResult(result: DomainVerificationResult, announce = true) {
    setDomainError(null);
    if (announce) {
      setActionNotice(result.summary);
    }
    setVerificationResults((current) => ({ ...current, [result.domain.id]: result }));
    if (!result.passed) {
      const rootId =
        result.domain.kind === "root"
          ? result.domain.id
          : (domainsQuery.data ?? []).find((item) => item.kind === "root" && item.domain === result.domain.rootDomain)?.id;
      if (rootId) {
        setExpandedRootIds((current) => ({ ...current, [rootId]: true }));
      }
    }
    queryClient.setQueryData<Awaited<ReturnType<typeof fetchDomains>>>(["user-domains"], (current) =>
      (current ?? []).map((item) => (item.id === result.domain.id ? result.domain : item)),
    );
  }

  async function autoVerifyUserDomains(items: Awaited<ReturnType<typeof fetchDomains>>) {
    const candidates = items.filter((item) => item.providerAccountId != null);
    if (!candidates.length) {
      return [];
    }
    const results = await Promise.all(candidates.map((item) => verifyDomain(item.id)));
    for (const result of results) {
      await applyUserVerificationResult(result, false);
    }
    await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
    await queryClient.invalidateQueries({ queryKey: ["user-dashboard"], refetchType: "all" });
    return results;
  }

  function clearUserVerificationResults(domainIds: number[]) {
    if (!domainIds.length) {
      return;
    }
    setVerificationResults((current) => {
      let changed = false;
      const next = { ...current };
      for (const domainId of domainIds) {
        if (domainId in next) {
          delete next[domainId];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  const createDomainMutation = useMutation({
    mutationFn: createDomain,
    onSuccess: async (created) => {
      setCreatingDomainWithVerification(true);
      setRootDomain("");
      setDomainError(null);
      let notice = "Root domain added.";
      try {
        clearUserVerificationResults([created.id]);
        const results = await autoVerifyUserDomains([created]);
        if (results.length === 1) {
          notice = `Root domain added; ${results[0].passed ? "DNS verification passed" : "DNS verification failed"}.`;
        }
      } finally {
        setCreatingDomainWithVerification(false);
      }
      setActionNotice(notice);
      setCreateRootDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"], refetchType: "all" });
    },
    onError: (error) => {
      setDomainError(getAPIErrorMessage(error, "Failed to add root domain. Check the domain format."));
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: deleteDomain,
    onSuccess: async (_, domainId) => {
      setDomainError(null);
      setActionNotice("Domain deleted.");
      queryClient.setQueryData<Awaited<ReturnType<typeof fetchDomains>>>(["user-domains"], (current) =>
        (current ?? []).filter((item) => item.id !== domainId),
      );
      setExpandedRootIds((current) => {
        if (!(domainId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[domainId];
        return next;
      });
      setVerificationResults((current) => {
        if (!(domainId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[domainId];
        return next;
      });
      if (selectedBaseDomainId === domainId) {
        setSelectedBaseDomainId("");
      }
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"], refetchType: "all" });
    },
    onError: (error) => {
      setDomainError(getAPIErrorMessage(error, "Failed to delete domain. Clean up subdomains first."));
    },
  });

  const generateMutation = useMutation({
    mutationFn: generateSubdomains,
    onSuccess: async (createdItems) => {
      setGeneratingDomainsWithVerification(true);
      setDomainError(null);
      let notice = "Subdomains generated.";
      try {
        clearUserVerificationResults(createdItems.map((item) => item.id));
        const results = await autoVerifyUserDomains(createdItems);
        if (results.length) {
          const passedCount = results.filter((item) => item.passed).length;
          notice = `Subdomains generated. Automatically verified ${results.length}; ${passedCount} passed.`;
        }
      } finally {
        setGeneratingDomainsWithVerification(false);
      }
      setActionNotice(notice);
      setGenerateDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"], refetchType: "all" });
    },
    onError: (error) => {
      setDomainError(getAPIErrorMessage(error, "Failed to generate subdomains."));
    },
  });
  const bindProviderMutation = useMutation({
    mutationFn: ({ domainId, providerAccountId }: { domainId: number; providerAccountId?: number }) =>
      updateDomainProviderBinding(domainId, providerAccountId),
    onSuccess: async (updated) => {
      setDomainError(null);
      setActionNotice(updated.providerAccountId ? "DNS provider bound." : "DNS provider binding removed.");
      setBindProviderDialogOpen(false);
      setBindingDomain(null);
      setSelectedProviderAccountId("");
      setVerificationResults((current) => {
        if (!(updated.id in current)) {
          return current;
        }
        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      queryClient.setQueryData<Awaited<ReturnType<typeof fetchDomains>>>(["user-domains"], (current) =>
        (current ?? []).map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
    },
    onError: (error) => {
      setDomainError(getAPIErrorMessage(error, "Failed to bind DNS provider. Check domain and provider permissions, then retry."));
    },
  });

  const publishMutation = useMutation({
    mutationFn: requestDomainPublicPool,
    onSuccess: async () => {
      setDomainError(null);
      setActionNotice("Public pool request submitted.");
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"], refetchType: "all" });
    },
    onError: (error) => {
      setDomainError(getAPIErrorMessage(error, "Failed to join public pool."));
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: withdrawDomainPublicPool,
    onSuccess: async () => {
      setDomainError(null);
      setActionNotice("Public pool status updated.");
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"], refetchType: "all" });
    },
    onError: (error) => {
      setDomainError(getAPIErrorMessage(error, "Failed to update public pool status."));
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: verifyDomain,
    onMutate: async (domainId) => {
      setVerifyingDomainId(domainId);
    },
    onSuccess: async (result) => {
      await applyUserVerificationResult(result);
      await queryClient.invalidateQueries({ queryKey: ["user-domains"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"], refetchType: "all" });
    },
    onError: (error) => {
      setDomainError(getAPIErrorMessage(error, "Domain verification failed. Check DNS binding and record propagation first."));
    },
    onSettled: () => {
      setVerifyingDomainId(null);
    },
  });

  useEffect(() => {
    writePersistedState(domainsCacheKey, domainsQuery.data ?? []);
  }, [domainsCacheKey, domainsQuery.data]);

  useEffect(() => {
    const activeIds = new Set((domainsQuery.data ?? []).map((item) => item.id));
    setExpandedRootIds((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([key]) => activeIds.has(Number(key))));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
    setVerificationResults((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([key]) => activeIds.has(Number(key))),
      ) as Record<number, DomainVerificationResult>;
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [domainsQuery.data]);

  useEffect(() => {
    writePersistedState(uiCacheKey, { expandedRootIds, verificationResults });
  }, [expandedRootIds, uiCacheKey, verificationResults]);

  async function refreshUserDomainData() {
    setActionNotice(null);
    await domainsQuery.refetch();
  }

  const providerOptions = (providersQuery.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.displayName,
    keywords: [item.provider, item.authType, item.status],
  }));

  function openBindProviderDialog(domain: Awaited<ReturnType<typeof fetchDomains>>[number]) {
    setDomainError(null);
    setBindingDomain(domain);
    setSelectedProviderAccountId(domain.providerAccountId ? String(domain.providerAccountId) : "");
    setBindProviderDialogOpen(true);
  }

  function handleCreateRootDomain() {
    const normalizedDomain = normalizeRootDomainInput(rootDomain);
    const requiredError = validateRequiredText("Root domain", normalizedDomain, { minLength: 3, maxLength: 253 });
    if (requiredError) {
      setDomainError(requiredError);
      return;
    }
    if (!isRootDomainInput(normalizedDomain)) {
      setDomainError("Only root domains can be added here. Create multi-level subdomains with Generate Subdomains.");
      return;
    }
    setDomainError(null);
    createDomainMutation.mutate({
      domain: normalizedDomain,
      status: "active",
      visibility: "private",
      publicationStatus: "draft",
      verificationScore: 0,
      healthStatus: "unknown",
      weight: 100,
    });
  }

  function handleGenerateSubdomains() {
    const baseDomainError = validateSelection("Root domain", String(selectedBaseDomainId), rootDomains.map((item) => String(item.id)));
    if (baseDomainError) {
      setDomainError(baseDomainError);
      return;
    }
    const prefixes = normalizeSubdomainPrefixes(prefixInput);
    if (!prefixes.length) {
      setDomainError("Enter at least one subdomain prefix.");
      return;
    }
    const invalidPrefix = prefixes.find((item) => !isValidSubdomainPrefix(item));
    if (invalidPrefix) {
      setDomainError(`Invalid subdomain prefix format: ${invalidPrefix}`);
      return;
    }
    setDomainError(null);
    generateMutation.mutate({
      baseDomainId: Number(selectedBaseDomainId),
      prefixes,
      status: "active",
      visibility: "private",
      publicationStatus: "draft",
      verificationScore: 0,
      healthStatus: "unknown",
      weight: 90,
    });
  }

  function handleSaveProviderBinding() {
    if (!bindingDomain) {
      setDomainError("No domain is available to bind.");
      return;
    }
    const providerError = validateSelection("DNS provider", selectedProviderAccountId, providerOptions.map((item) => item.value));
    if (providerError) {
      setDomainError(providerError);
      return;
    }
    setDomainError(null);
    bindProviderMutation.mutate({
      domainId: bindingDomain.id,
      providerAccountId: Number(selectedProviderAccountId),
    });
  }

  return (
    <WorkspacePage>
      <WorkspacePanel
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refreshUserDomainData()}>
              <RefreshCcw className={domainsQuery.isRefetching ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
            <Button onClick={() => setCreateRootDialogOpen(true)}>Add Root Domain</Button>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(true)}>
              Add Subdomains
            </Button>
          </div>
        }
        description="Pending domains, binding status, and DNS configuration entry points are centralized here. The DNS settings page keeps providers, zones, records, and change workspaces."
        title="Domain Management"
      >
        <div className="space-y-4">
          <AlertDialog
            open={deleteDomainDialog !== null}
            onOpenChange={(open) => {
              if (!open) {
                setDeleteDomainDialog(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete domain?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteDomainDialog
                    ? `Delete ${deleteDomainDialog.label} ${deleteDomainDialog.domain}? This domain will be removed from the current list.`
                    : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (!deleteDomainDialog) {
                      return;
                    }
                    deleteDomainMutation.mutate(deleteDomainDialog.id);
                    setDeleteDomainDialog(null);
                  }}
                >
                  Confirm Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog
            open={withdrawDomainDialog !== null}
            onOpenChange={(open) => {
              if (!open) {
                setWithdrawDomainDialog(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{withdrawDomainDialog?.label ?? "Confirm action"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {withdrawDomainDialog
                    ? `Run "${withdrawDomainDialog.label}" for domain ${withdrawDomainDialog.domain}? This immediately changes its public pool status.`
                    : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (!withdrawDomainDialog) {
                      return;
                    }
                    withdrawMutation.mutate(withdrawDomainDialog.id);
                    setWithdrawDomainDialog(null);
                  }}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

          <Dialog open={isCreateRootDialogOpen} onOpenChange={setCreateRootDialogOpen}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Add Root Domain</DialogTitle>
                <DialogDescription>Only root domain assets are added here. Complete DNS provider binding and record configuration on the DNS Settings page.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <WorkspaceField label="Root Domain">
                  <Input
                    value={rootDomain}
                    onChange={(event) => setRootDomain(event.target.value)}
                    placeholder="example.com"
                  />
                </WorkspaceField>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  disabled={!rootDomain.trim() || createDomainMutation.isPending || creatingDomainWithVerification}
                  onClick={handleCreateRootDomain}
                >
                  {createDomainMutation.isPending || creatingDomainWithVerification ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Verifying DNS...
                    </>
                  ) : (
                    "Add Root Domain"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isGenerateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Generate Subdomains</DialogTitle>
                <DialogDescription>Generate multi-level subdomains from an existing root domain, suitable for prefixes like MX, relay, and edge.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <WorkspaceField label="Select Root Domain">
                  <OptionCombobox
                    ariaLabel="Select root domain"
                    emptyLabel="No root domains available"
                    options={rootDomains.map((item) => ({
                      value: String(item.id),
                      label: item.domain,
                      keywords: [item.rootDomain],
                    }))}
                    placeholder="Select root domain"
                    searchPlaceholder="Search root domains"
                    value={selectedBaseDomainId === "" ? undefined : String(selectedBaseDomainId)}
                    onValueChange={(value) => setSelectedBaseDomainId(value ? Number(value) : "")}
                  />
                </WorkspaceField>
                <WorkspaceField label="Multi-level Prefixes">
                  <Textarea
                    rows={6}
                    value={prefixInput}
                    onChange={(event) => setPrefixInput(event.target.value)}
                    placeholder={"One prefix per line, for example:\nmx\nmx.edge\nrelay.cn.hk"}
                  />
                </WorkspaceField>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  disabled={selectedBaseDomainId === "" || generateMutation.isPending || generatingDomainsWithVerification}
                  onClick={handleGenerateSubdomains}
                >
                  {generateMutation.isPending || generatingDomainsWithVerification ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Verifying DNS...
                    </>
                  ) : (
                    "Generate Subdomains"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isBindProviderDialogOpen}
            onOpenChange={(open) => {
              setBindProviderDialogOpen(open);
              if (!open) {
                setBindingDomain(null);
                setSelectedProviderAccountId("");
              }
            }}
          >
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{bindingDomain?.providerAccountId ? "Change DNS Provider" : "Bind DNS Provider"}</DialogTitle>
                <DialogDescription>
                  {bindingDomain
                    ? `Select an existing DNS provider account for ${bindingDomain.domain}. You can then open the matching Zone workspace directly.`
                    : "Select a DNS provider account."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <WorkspaceField label="Current Domain">
                  <Input readOnly value={bindingDomain?.domain ?? ""} />
                </WorkspaceField>
                {bindingDomain ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Status</div>
                      <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                        <DomainStatusIcon
                          className={getDomainStatusMeta(getDomainStatusGroup(bindingDomain)).iconClassName}
                          verified={getDomainStatusGroup(bindingDomain) === "verified"}
                        />
                        {getDomainStatusMeta(getDomainStatusGroup(bindingDomain)).label}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Provider</div>
                      <div className="mt-2 truncate text-sm font-medium">{bindingDomain.providerDisplayName ?? "Unbound"}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Suggested Action</div>
                      <div className="mt-2 text-sm text-muted-foreground">{getDomainStatusMeta(getDomainStatusGroup(bindingDomain)).description}</div>
                    </div>
                  </div>
                ) : null}
                <WorkspaceField label="DNS Provider">
                  <OptionCombobox
                    ariaLabel="Select DNS provider"
                    emptyLabel="No DNS providers available"
                    options={providerOptions}
                    placeholder="Select DNS provider"
                    searchPlaceholder="Search DNS providers"
                    value={selectedProviderAccountId || undefined}
                    onValueChange={(value) => setSelectedProviderAccountId(value || "")}
                  />
                </WorkspaceField>
              </div>
              <DialogFooter>
                {bindingDomain?.providerAccountId ? (
                  <Button
                    disabled={bindProviderMutation.isPending}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (!bindingDomain) return;
                      bindProviderMutation.mutate({ domainId: bindingDomain.id, providerAccountId: undefined });
                    }}
                  >
                    Unbind
                  </Button>
                ) : null}
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  disabled={!bindingDomain || !selectedProviderAccountId || bindProviderMutation.isPending}
                  onClick={handleSaveProviderBinding}
                >
                  {bindProviderMutation.isPending ? "Saving..." : "Save Binding"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="grid gap-3 lg:grid-cols-6">
            <Card className="border-border/60 bg-card/85 shadow-none lg:col-span-2">
              <CardContent className="space-y-2 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Asset Overview</div>
                <div className="text-2xl font-semibold">{domainSummary.roots}</div>
                <div className="text-sm text-muted-foreground">{domainSummary.roots} root domains · {domainSummary.children} subdomains</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-none">
              <CardContent className="space-y-2 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Verified</div>
                <div className="text-2xl font-semibold">{domainSummary.verified}</div>
                <div className="text-sm text-muted-foreground">Ready to create mailboxes</div>
              </CardContent>
            </Card>
            <Card className="border-rose-500/20 bg-rose-500/5 shadow-none">
              <CardContent className="space-y-2 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Pending</div>
                <div className="text-2xl font-semibold">{domainSummary.pending}</div>
                <div className="text-sm text-muted-foreground">Record verification needed</div>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20 bg-amber-500/5 shadow-none">
              <CardContent className="space-y-2 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">DNS Unbound</div>
                <div className="text-2xl font-semibold">{domainSummary.unbound}</div>
                <div className="text-sm text-muted-foreground">Bind a provider first</div>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/85 shadow-none">
              <CardContent className="space-y-2 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Provider</div>
                <div className="text-2xl font-semibold">{domainSummary.providers}</div>
                <div className="text-sm text-muted-foreground">Available DNS provider accounts</div>
              </CardContent>
            </Card>
          </div>

          {rootDomains.length ? (
            (["unbound", "pending", "verified"] as DomainStatusGroup[]).map((group) => {
              const sectionRoots = groupedPaginatedRootDomains[group];
              if (!sectionRoots.length) {
                return null;
              }

              const groupMeta = getDomainStatusMeta(group);

              return (
                <div key={group} className="space-y-3">
                  <Card className={cn("shadow-none", groupMeta.cardClassName)}>
                    <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <DomainStatusIcon className={groupMeta.iconClassName} verified={group === "verified"} />
                          {groupMeta.label}
                        </div>
                        <p className="text-xs text-muted-foreground">{groupMeta.description}</p>
                      </div>
                      <WorkspaceBadge variant="outline">
                        {sectionRoots.length} / {groupedRootDomains[group].length} root domains
                      </WorkspaceBadge>
                    </CardContent>
                  </Card>

                  {sectionRoots.map((root) => {
              const children = childDomainsByRoot.get(root.domain) ?? [];
              const expanded = expandedRootIds[root.id] ?? false;
              const rootStatusTone = getDomainStatusGroup(root);
              const rootVerificationResult = verificationResults[root.id];

              return (
                <Card key={root.id} className="border-border/60 bg-card/85 shadow-none">
                  <CardContent className="space-y-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-left text-sm font-medium"
                            onClick={() =>
                              setExpandedRootIds((current) => ({ ...current, [root.id]: !expanded }))
                            }
                          >
                            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            <Globe className="size-4 text-muted-foreground" />
                            {root.domain}
                          </button>
                          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <DomainStatusIcon
                              className={
                                rootStatusTone === "verified"
                                  ? "text-emerald-500"
                                  : rootStatusTone === "unbound"
                                    ? "text-amber-500"
                                    : "text-rose-400"
                              }
                              verified={rootStatusTone === "verified"}
                            />
                            {rootStatusTone === "verified"
                              ? "Verified"
                              : rootStatusTone === "unbound"
                                ? "DNS not bound"
                                : "Pending verification"}
                          </span>
                          <WorkspaceBadge>{root.status}</WorkspaceBadge>
                          <WorkspaceBadge variant="outline">{root.visibility}</WorkspaceBadge>
                          <WorkspaceBadge variant="outline">{root.publicationStatus}</WorkspaceBadge>
                          <WorkspaceBadge variant="outline">Score {root.verificationScore}</WorkspaceBadge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Health: {root.healthStatus}</span>
                          <span>Weight: {root.weight}</span>
                          <span>Subdomains: {children.length}</span>
                          <span>DNS: {root.providerDisplayName || "Bind in DNS Settings"}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openBindProviderDialog(root)}>
                          {root.providerAccountId ? "Change Provider" : "Bind Provider"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={verifyDomainMutation.isPending && verifyingDomainId === root.id}
                          onClick={() => verifyDomainMutation.mutate(root.id)}
                        >
                          {verifyDomainMutation.isPending && verifyingDomainId === root.id ? "Verifying..." : "Verify"}
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to={getUserDomainDnsLink(root.id, root.providerAccountId)}>
                            {root.providerAccountId ? "Configure DNS" : "Bind DNS"}
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="secondary">
                          <Link to={`/dashboard/mailboxes?domainId=${root.id}`}>Create Mailbox</Link>
                        </Button>
                        {(root.visibility === "private" || root.publicationStatus === "rejected") ? (
                          <Button size="sm" variant="outline" onClick={() => publishMutation.mutate(root.id)}>
                            Request Public Pool
                          </Button>
                        ) : null}
                        {root.visibility === "public_pool" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setWithdrawDomainDialog({
                                id: root.id,
                                domain: root.domain,
                                label:
                                  root.publicationStatus === "pending_review"
                                    ? "Withdraw Request"
                                    : "Remove from Public Pool",
                              })
                            }
                          >
                            {root.publicationStatus === "pending_review" ? "Withdraw Request" : "Remove from Public Pool"}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleteDomainMutation.isPending}
                          onClick={() => {
                            setActionNotice(null);
                            setDeleteDomainDialog({
                              id: root.id,
                              domain: root.domain,
                              label: "root domain",
                            });
                          }}
                        >
                          <Trash2 className="size-4" />Delete
                        </Button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
                        <DomainVerificationDetails
                          dnsLink={getUserDomainDnsLink(root.id, root.providerAccountId)}
                          result={rootVerificationResult}
                        />
                        {children.length ? (
                        <>
                          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                              <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">DNS Provider</span>
                                  <span className="truncate font-medium">{root.providerDisplayName ?? "Unbound"}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Public Pool Status</span>
                                  <span className="font-medium">{root.publicationStatus}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Visibility</span>
                                  <span className="font-medium">{root.visibility}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Create Mailbox</span>
                                  <span className="font-medium">{rootStatusTone === "verified" ? "Ready" : "Complete DNS first"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="text-sm font-semibold">Subdomain Assets</div>
                                  <p className="text-xs text-muted-foreground">Multi-level subdomains under this root domain and their DNS / verification status are shown here.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <WorkspaceBadge variant="outline">{children.length} subdomains</WorkspaceBadge>
                                  <WorkspaceBadge variant="outline">Score {root.verificationScore}</WorkspaceBadge>
                                </div>
                              </div>
                            </div>
                          </div>

                          {children.map((child) => {
                            const childStatusTone =
                              child.providerAccountId == null
                                ? "unbound"
                                : child.healthStatus === "healthy" || child.verificationScore >= 100
                                  ? "verified"
                                  : "pending";
                            const childVerificationResult = verificationResults[child.id];

                            return (
                              <div key={child.id} className="space-y-3 rounded-lg border border-border/60 bg-background px-3 py-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                      <span>{child.domain}</span>
                                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <DomainStatusIcon
                                          className={
                                            childStatusTone === "verified"
                                              ? "size-3.5 text-emerald-500"
                                              : childStatusTone === "unbound"
                                                ? "size-3.5 text-amber-500"
                                                : "size-3.5 text-rose-400"
                                          }
                                          verified={childStatusTone === "verified"}
                                        />
                                        {childStatusTone === "verified"
                                          ? "Verified"
                                          : childStatusTone === "unbound"
                                            ? "DNS not bound"
                                            : "Pending verification"}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                      <span>Level {child.level}</span>
                                      <span>Root {child.rootDomain}</span>
                                      <span>DNS {child.providerDisplayName || "Unbound"}</span>
                                      <span>Score {child.verificationScore}</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => openBindProviderDialog(child)}>
                                      {child.providerAccountId ? "Change Provider" : "Bind Provider"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={verifyDomainMutation.isPending && verifyingDomainId === child.id}
                                      onClick={() => verifyDomainMutation.mutate(child.id)}
                                    >
                                      {verifyDomainMutation.isPending && verifyingDomainId === child.id ? "Verifying..." : "Verify"}
                                    </Button>
                                    <Button asChild size="sm" variant="outline">
                                      <Link to={getUserDomainDnsLink(child.id, child.providerAccountId)}>
                                        {child.providerAccountId ? "Configure DNS" : "Bind DNS"}
                                      </Link>
                                    </Button>
                                    <Button asChild size="sm" variant="secondary">
                                      <Link to={`/dashboard/mailboxes?domainId=${child.id}`}>Create Mailbox</Link>
                                    </Button>
                                    <WorkspaceBadge variant="outline">{child.publicationStatus}</WorkspaceBadge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={deleteDomainMutation.isPending}
                                      onClick={() => {
                                        setActionNotice(null);
                                        setDeleteDomainDialog({
                                          id: child.id,
                                          domain: child.domain,
                                          label: "subdomain",
                                        });
                                      }}
                                    >
                                      <Trash2 className="size-4" />Delete
                                    </Button>
                                  </div>
                                </div>
                                <DomainVerificationDetails
                                  dnsLink={getUserDomainDnsLink(child.id, child.providerAccountId)}
                                  result={childVerificationResult}
                                />
                              </div>
                            );
                          })}
                        </>
                        ) : (
                          <WorkspaceEmpty
                            title="No subdomains yet"
                            description="Click Add Subdomains above to generate them from this root domain."
                          />
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
                </div>
              );
            })
          ) : (
            <WorkspaceEmpty
              title="No private root domains"
              description="After adding a root domain, you can generate multi-level subdomains. Manage providers and DNS configuration on the DNS Settings page."
            />
          )}
          <PaginationControls
            itemLabel="root domains"
            onPageChange={setRootDomainsPage}
            page={paginatedRootDomains.page}
            pageSize={USER_DOMAINS_PAGE_SIZE}
            total={paginatedRootDomains.total}
            totalPages={paginatedRootDomains.totalPages}
          />
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
