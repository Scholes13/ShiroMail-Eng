import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronUp, CircleX, Globe, LoaderCircle, Plus, RefreshCcw } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NoticeBanner } from "@/components/ui/notice-banner";
import { Label } from "@/components/ui/label";
import { OptionCombobox } from "@/components/ui/option-combobox";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceField,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import { getAPIErrorMessage } from "@/lib/http";
import { readPersistedState, writePersistedState } from "@/lib/persisted-state";
import { cn } from "@/lib/utils";
import {
  deleteAdminDomain,
  fetchAdminDomainProviders,
  fetchAdminDomains,
  generateAdminSubdomains,
  reviewAdminDomainPublication,
  upsertAdminDomain,
  verifyAdminDomain,
} from "../api";
import type { DomainOption, DomainVerificationResult } from "../../user/api";

type DomainGuideRecord = {
  key: string;
  type: string;
  name: string;
  value: string;
  status: string;
  verified: boolean;
};

const ADMIN_DOMAINS_PAGE_SIZE = 8;
const ADMIN_DOMAINS_CACHE_KEY = "shiro-email.admin-domains.cache";
const ADMIN_DOMAINS_UI_CACHE_KEY = "shiro-email.admin-domains.ui";
const PERSISTED_QUERY_STALE_TIME = 60_000;

function getAdminDomainDnsLink(domainId: number, providerId?: number | null) {
  const params = new URLSearchParams();
  params.set("domainId", String(domainId));
  if (providerId) {
    params.set("providerId", String(providerId));
  }
  return `/admin/dns?${params.toString()}`;
}

function getAdminDomainStatus(domain: {
  providerAccountId?: number | null;
  publicationStatus: string;
  healthStatus: string;
  verificationScore: number;
}) {
  if (domain.publicationStatus === "pending_review") {
    return "review";
  }
  if (domain.providerAccountId == null) {
    return "unbound";
  }
  if (domain.healthStatus === "healthy" || domain.verificationScore >= 100) {
    return "verified";
  }
  return "pending";
}

function getAdminDomainStatusMeta(status: ReturnType<typeof getAdminDomainStatus>) {
  if (status === "review") {
    return {
      label: "Text",
      iconClassName: "text-sky-500",
      cardClassName: "border-sky-500/20 bg-sky-500/5",
      description: "TextDomainTextDomainText。",
    };
  }
  if (status === "unbound") {
    return {
      label: "Text DNS",
      iconClassName: "text-amber-500",
      cardClassName: "border-amber-500/20 bg-amber-500/5",
      description: "TextDomainText Provider Text，Text DNS Text。",
    };
  }
  if (status === "verified") {
    return {
      label: "Text",
      iconClassName: "text-emerald-500",
      cardClassName: "border-emerald-500/20 bg-emerald-500/5",
      description: "TextDomainText。",
    };
  }
  return {
    label: "Text",
    iconClassName: "text-rose-400",
    cardClassName: "border-rose-500/20 bg-rose-500/5",
    description: "TextDomainText Provider，Text。",
  };
}

function isRootDomainInput(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\.+$/g, "");
  if (!normalized || normalized.includes("..")) {
    return false;
  }
  return normalized.split(".").length <= 2;
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

function paginateItems<T>(items: T[], page: number, pageSize: number) {
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
        <Button disabled={page <= 1} size="sm" type="button" variant="outline" onClick={() => onPageChange(page - 1)}>
          Text
        </Button>
        <Button disabled={page >= totalPages} size="sm" type="button" variant="outline" onClick={() => onPageChange(page + 1)}>
          Text
        </Button>
      </div>
    </div>
  );
}

function buildRecommendedDomainRecords(domain: DomainOption): DomainGuideRecord[] {
  const rootName = domain.rootDomain || domain.domain;
  return [
    {
      key: `${domain.id}-mx`,
      type: "MX",
      name: domain.domain,
      value: "mx.shiro.email (priority 10)",
      status: "Text",
      verified: false,
    },
    {
      key: `${domain.id}-spf`,
      type: "TXT",
      name: domain.domain,
      value: "v=spf1 include:spf.shiro.email ~all",
      status: "Text",
      verified: false,
    },
    {
      key: `${domain.id}-dmarc`,
      type: "TXT",
      name: `_dmarc.${rootName}`,
      value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@shiro.email",
      status: "Text",
      verified: false,
    },
  ];
}

function formatVerificationTypeLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    mx: "MX",
    inbound_mx: "Text MX",
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
    return "Text";
  }
  if (status === "drifted") {
    return "Text";
  }
  if (status === "missing") {
    return "Text";
  }
  return "Text";
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
    ? "Text"
    : pendingProfiles.length && result.verifiedCount > 0
      ? "Text"
      : "Text";

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
            <div className="text-sm font-semibold">{result.passed ? "Text" : "Text"}</div>
            <WorkspaceBadge variant="outline">
              {result.verifiedCount} / {result.totalCount}
            </WorkspaceBadge>
            {result.zoneName ? <WorkspaceBadge variant="outline">Zone {result.zoneName}</WorkspaceBadge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={dnsLink}>Text DNS Text</Link>
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Text</div>
          <div className="mt-1 text-sm font-medium">{propagationLabel}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Text</div>
          <div className="mt-1 text-sm font-medium">{pendingProfiles.length} Text</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Text</div>
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
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text</div>
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

export function AdminDomainsPage() {
  const queryClient = useQueryClient();
  const persistedUI = readPersistedState(ADMIN_DOMAINS_UI_CACHE_KEY, {
    domainCardExpandedState: {} as Record<number, boolean>,
    verificationResults: {} as Record<number, DomainVerificationResult>,
  });
  const emptyDomainDraft = {
    domain: "",
    status: "active",
    visibility: "private",
    publicationStatus: "draft",
    healthStatus: "unknown",
    providerAccountId: "",
    isDefault: false,
    weight: 100,
  };

  const [domainMutationError, setDomainMutationError] = useState<string | null>(null);
  const [subdomainMutationError, setSubdomainMutationError] = useState<string | null>(null);
  const [domainDeleteError, setDomainDeleteError] = useState<string | null>(null);
  const [domainActionNotice, setDomainActionNotice] = useState<string | null>(null);
  const [deleteDomainDialog, setDeleteDomainDialog] = useState<{
    id: number;
    domain: string;
  } | null>(null);
  const [reviewRejectDialog, setReviewRejectDialog] = useState<{
    id: number;
    domain: string;
  } | null>(null);
  const [isCreateDomainDialogOpen, setCreateDomainDialogOpen] = useState(false);
  const [editingDomainId, setEditingDomainId] = useState<number | null>(null);
  const [isGenerateSubdomainDialogOpen, setGenerateSubdomainDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDomainDraft);
  const [selectedBaseDomainId, setSelectedBaseDomainId] = useState<number | "">("");
  const [prefixInput, setPrefixInput] = useState("mx\nmx.edge\nrelay.cn.hk");
  const [domainCardExpandedState, setDomainCardExpandedState] = useState<Record<number, boolean>>(
    persistedUI.domainCardExpandedState,
  );
  const [verificationResults, setVerificationResults] = useState<Record<number, DomainVerificationResult>>(
    persistedUI.verificationResults,
  );
  const [verifyingDomainId, setVerifyingDomainId] = useState<number | null>(null);
  const [creatingDomainWithVerification, setCreatingDomainWithVerification] = useState(false);
  const [generatingDomainsWithVerification, setGeneratingDomainsWithVerification] = useState(false);
  const [domainsPage, setDomainsPage] = useState(1);
  const isEditingDomain = editingDomainId !== null;

  const domainsQuery = useQuery({
    queryKey: ["admin-domains"],
    queryFn: fetchAdminDomains,
    staleTime: PERSISTED_QUERY_STALE_TIME,
    placeholderData: () => readPersistedState<DomainOption[]>(ADMIN_DOMAINS_CACHE_KEY, []),
  });
  const providersQuery = useQuery({
    queryKey: ["admin-domain-providers"],
    queryFn: fetchAdminDomainProviders,
    staleTime: PERSISTED_QUERY_STALE_TIME,
  });

  const effectiveDomains = useMemo(
    () =>
      (domainsQuery.data ?? []).map((item) => {
        const verifiedDomain = verificationResults[item.id]?.domain;
        return verifiedDomain ? { ...item, ...verifiedDomain } : item;
      }),
    [domainsQuery.data, verificationResults],
  );

  const rootDomains = useMemo(
    () => effectiveDomains.filter((item) => item.kind === "root"),
    [effectiveDomains],
  );

  const domainSummary = useMemo(
    () => ({
      total: effectiveDomains.length,
      root: rootDomains.length,
      review: effectiveDomains.filter((item) => getAdminDomainStatus(item) === "review").length,
      unbound: effectiveDomains.filter((item) => getAdminDomainStatus(item) === "unbound").length,
      pending: effectiveDomains.filter((item) => getAdminDomainStatus(item) === "pending").length,
      verified: effectiveDomains.filter((item) => getAdminDomainStatus(item) === "verified").length,
    }),
    [effectiveDomains, rootDomains.length],
  );

  const paginatedDomains = useMemo(
    () => paginateItems(effectiveDomains, domainsPage, ADMIN_DOMAINS_PAGE_SIZE),
    [domainsPage, effectiveDomains],
  );

  async function applyAdminVerificationResult(result: DomainVerificationResult, announce = true) {
    setDomainDeleteError(null);
    if (announce) {
      setDomainActionNotice(result.summary);
    }
    setVerificationResults((current) => ({ ...current, [result.domain.id]: result }));
    if (!result.passed) {
      setDomainCardExpandedState((current) => ({ ...current, [result.domain.id]: true }));
    }
    queryClient.setQueryData<Awaited<ReturnType<typeof fetchAdminDomains>>>(["admin-domains"], (current) =>
      (current ?? []).map((item) => (item.id === result.domain.id ? result.domain : item)),
    );
  }

  async function autoVerifyAdminDomains(items: DomainOption[]) {
    const candidates = items.filter((item) => item.providerAccountId != null);
    if (!candidates.length) {
      return [];
    }
    const results = await Promise.all(candidates.map((item) => verifyAdminDomain(item.id)));
    for (const result of results) {
      await applyAdminVerificationResult(result, false);
    }
    await queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
    await queryClient.invalidateQueries({ queryKey: ["user-domains"] });
    await queryClient.invalidateQueries({ queryKey: ["user-dashboard"] });
    return results;
  }

  function clearAdminVerificationResults(domainIds: number[]) {
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

  const groupedPaginatedDomains = useMemo(() => {
    const groups: Record<ReturnType<typeof getAdminDomainStatus>, DomainOption[]> = {
      review: [],
      unbound: [],
      pending: [],
      verified: [],
    };

    paginatedDomains.items.forEach((domain) => {
      groups[getAdminDomainStatus(domain)].push(domain);
    });

    return groups;
  }, [paginatedDomains.items]);

  useEffect(() => {
    writePersistedState(ADMIN_DOMAINS_CACHE_KEY, domainsQuery.data ?? []);
  }, [domainsQuery.data]);

  useEffect(() => {
    const activeIds = new Set((domainsQuery.data ?? []).map((item) => item.id));
    setDomainCardExpandedState((current) => {
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
    writePersistedState(ADMIN_DOMAINS_UI_CACHE_KEY, {
      domainCardExpandedState,
      verificationResults,
    });
  }, [domainCardExpandedState, verificationResults]);

  async function refreshAdminDomainData() {
    setDomainActionNotice(null);
    await domainsQuery.refetch();
  }

  const statusOptions = [
    { value: "active", label: "active" },
    { value: "paused", label: "paused" },
  ];
  const visibilityOptions = [
    { value: "private", label: "private" },
    { value: "public_pool", label: "public_pool" },
    { value: "platform_public", label: "platform_public" },
  ];
  const publicationOptions = [
    { value: "draft", label: "draft" },
    { value: "pending_review", label: "pending_review" },
    { value: "approved", label: "approved" },
    { value: "rejected", label: "rejected" },
  ];
  const providerOptions = (providersQuery.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.displayName,
    keywords: [item.provider, item.authType, item.status],
  }));

  const upsertMutation = useMutation({
    mutationFn: upsertAdminDomain,
    onSuccess: async (created) => {
      setCreatingDomainWithVerification(true);
      setDomainMutationError(null);
      setDomainDeleteError(null);
      let notice = isEditingDomain ? "DomainText。" : "DomainText。";
      try {
        clearAdminVerificationResults([created.id]);
        const results = await autoVerifyAdminDomains([created]);
        if (results.length === 1) {
          notice = `${isEditingDomain ? "DomainText" : "DomainText"}，${results[0].passed ? "DNS Text" : "DNS Text"}。`;
        }
      } finally {
        setCreatingDomainWithVerification(false);
      }
      setDomainActionNotice(notice);
      setDraft(emptyDomainDraft);
      setEditingDomainId(null);
      setCreateDomainDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      setDomainMutationError(getAPIErrorMessage(error, "TextDomainText，Text。"));
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: deleteAdminDomain,
    onSuccess: async (_, domainId) => {
      setDomainDeleteError(null);
      setDomainActionNotice("DomainText。");
      queryClient.setQueryData<Awaited<ReturnType<typeof fetchAdminDomains>>>(["admin-domains"], (current) =>
        (current ?? []).filter((item) => item.id !== domainId),
      );
      setDomainCardExpandedState((current) => {
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
      await queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      setDomainDeleteError(getAPIErrorMessage(error, "TextDomainText，TextDomainText。"));
    },
  });

  const generateMutation = useMutation({
    mutationFn: generateAdminSubdomains,
    onSuccess: async (createdItems) => {
      setGeneratingDomainsWithVerification(true);
      setSubdomainMutationError(null);
      setDomainDeleteError(null);
      let notice = "TextDomainText。";
      try {
        clearAdminVerificationResults(createdItems.map((item) => item.id));
        const results = await autoVerifyAdminDomains(createdItems);
        if (results.length) {
          const passedCount = results.filter((item) => item.passed).length;
          notice = `TextDomainText，Text ${results.length} Text，${passedCount} Text。`;
        }
      } finally {
        setGeneratingDomainsWithVerification(false);
      }
      setDomainActionNotice(notice);
      setGenerateSubdomainDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      setSubdomainMutationError(getAPIErrorMessage(error, "TextDomainText，Text。"));
    },
  });

  const reviewPublicationMutation = useMutation({
    mutationFn: ({ domainId, decision }: { domainId: number; decision: "approve" | "reject" }) =>
      reviewAdminDomainPublication(domainId, decision),
    onSuccess: async (_, variables) => {
      setDomainDeleteError(null);
      setDomainActionNotice(
        variables.decision === "approve" ? "DomainTextDomainText。" : "DomainText。",
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["user-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"] });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: verifyAdminDomain,
    onMutate: async (domainId) => {
      setVerifyingDomainId(domainId);
    },
    onSuccess: async (result) => {
      await applyAdminVerificationResult(result);
      await queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["user-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["user-dashboard"] });
    },
    onError: (error) => {
      setDomainDeleteError(getAPIErrorMessage(error, "TextDomainText，Text DNS Text。"));
    },
    onSettled: () => {
      setVerifyingDomainId(null);
    },
  });

  function openCreateDomainDialog() {
    setEditingDomainId(null);
    setDomainMutationError(null);
    setDomainActionNotice(null);
    setDraft(emptyDomainDraft);
    setCreateDomainDialogOpen(true);
  }

  function openEditDomainDialog(domain: DomainOption) {
    setEditingDomainId(domain.id);
    setDomainMutationError(null);
    setDomainActionNotice(null);
    setDraft({
      domain: domain.domain,
      status: domain.status,
      visibility: domain.visibility,
      publicationStatus: domain.publicationStatus,
      healthStatus: domain.healthStatus,
      providerAccountId: domain.providerAccountId ? String(domain.providerAccountId) : "",
      isDefault: domain.isDefault,
      weight: domain.weight,
    });
    setCreateDomainDialogOpen(true);
  }

  function isDomainCardExpanded(domain: DomainOption) {
    if (domainCardExpandedState[domain.id] !== undefined) {
      return domainCardExpandedState[domain.id];
    }
    return false;
  }

  return (
    <WorkspacePage>
      <WorkspacePanel
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refreshAdminDomainData()}>
              <RefreshCcw className={domainsQuery.isRefetching ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
            <Button onClick={openCreateDomainDialog}>
              <Plus className="size-4" />
              TextDomain
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDomainActionNotice(null);
                setGenerateSubdomainDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              TextDomain
            </Button>
          </div>
        }
        description="TextDomain、TextDomainText DNS Text；DNS Text、Zone、Records、Verification Text。"
        title="DomainText"
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
                <AlertDialogTitle>TextDomain？</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteDomainDialog
                    ? `TextDomain ${deleteDomainDialog.domain}？TextDomainText。`
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
                  Text
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog
            open={reviewRejectDialog !== null}
            onOpenChange={(open) => {
              if (!open) {
                setReviewRejectDialog(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>TextDomainText？</AlertDialogTitle>
                <AlertDialogDescription>
                  {reviewRejectDialog
                    ? `TextDomain ${reviewRejectDialog.domain} TextDomainText？TextDomainText。`
                    : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (!reviewRejectDialog) {
                      return;
                    }
                    reviewPublicationMutation.mutate({
                      domainId: reviewRejectDialog.id,
                      decision: "reject",
                    });
                    setReviewRejectDialog(null);
                  }}
                >
                  Text
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Dialog
            open={isCreateDomainDialogOpen}
            onOpenChange={(open) => {
              setCreateDomainDialogOpen(open);
              if (open) {
                setDomainMutationError(null);
              } else {
                setEditingDomainId(null);
                setDraft(emptyDomainDraft);
              }
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{isEditingDomain ? "TextDomain" : "TextDomain"}</DialogTitle>
                <DialogDescription>
                  {isEditingDomain
                    ? "TextDomainText；Provider Text、Zone Text Record Text DNS Text。"
                    : "TextDomainText，Text DNS Text Provider Text。"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <WorkspaceField label="Text">
                  <Input
                    className="h-12 rounded-xl text-base"
                    value={draft.domain}
                    onChange={(event) => setDraft((current) => ({ ...current, domain: event.target.value }))}
                    placeholder="example.com"
                  />
                </WorkspaceField>

                <div className="grid gap-4 md:grid-cols-2">
                  <WorkspaceField label="Text">
                    <OptionCombobox
                      ariaLabel="DomainText"
                      emptyLabel="Text"
                      options={statusOptions}
                      placeholder="Text"
                      searchPlaceholder="Text"
                      value={draft.status}
                      onValueChange={(value) => setDraft((current) => ({ ...current, status: value || "active" }))}
                    />
                  </WorkspaceField>

                  <WorkspaceField label="Text">
                    <OptionCombobox
                      ariaLabel="DomainText"
                      emptyLabel="Text"
                      options={visibilityOptions}
                      placeholder="Text"
                      searchPlaceholder="Text"
                      value={draft.visibility}
                      onValueChange={(value) => setDraft((current) => ({ ...current, visibility: value || "private" }))}
                    />
                  </WorkspaceField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <WorkspaceField label="Text">
                    <OptionCombobox
                      ariaLabel="DomainText"
                      emptyLabel="Text"
                      options={publicationOptions}
                      placeholder="Text"
                      searchPlaceholder="Text"
                      value={draft.publicationStatus}
                      onValueChange={(value) =>
                        setDraft((current) => ({ ...current, publicationStatus: value || "draft" }))
                      }
                    />
                  </WorkspaceField>

                  <WorkspaceField label="Text">
                    <OptionCombobox
                      ariaLabel="DomainText"
                      emptyLabel="Text"
                      options={[
                        { value: "healthy", label: "healthy" },
                        { value: "unknown", label: "unknown" },
                        { value: "degraded", label: "degraded" },
                      ]}
                      placeholder="Text"
                      searchPlaceholder="Text"
                      value={draft.healthStatus}
                      onValueChange={(value) => setDraft((current) => ({ ...current, healthStatus: value || "unknown" }))}
                    />
                  </WorkspaceField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <WorkspaceField label="DNS Text">
                    <OptionCombobox
                      ariaLabel="DNS Text"
                      emptyLabel="Text"
                      options={providerOptions}
                      placeholder="Text DNS Text"
                      searchPlaceholder="Text DNS Text"
                      value={draft.providerAccountId || undefined}
                      onValueChange={(value) =>
                        setDraft((current) => ({ ...current, providerAccountId: value || "" }))
                      }
                    />
                  </WorkspaceField>
                  <WorkspaceField label="Text">
                    <Input
                      className="h-9"
                      min={0}
                      type="number"
                      value={draft.weight}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, weight: Number(event.target.value) }))
                      }
                    />
                  </WorkspaceField>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="admin-domain-default"
                    checked={draft.isDefault}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, isDefault: checked === true }))
                    }
                  />
                  <Label className="text-sm" htmlFor="admin-domain-default">
                    Text
                  </Label>
                </div>
              </div>

              <DialogFooter>
                {domainMutationError ? (
                  <NoticeBanner autoHideMs={5000} className="mr-auto" onDismiss={() => setDomainMutationError(null)} variant="error">
                    {domainMutationError}
                  </NoticeBanner>
                ) : null}
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  disabled={upsertMutation.isPending || creatingDomainWithVerification || draft.domain.trim() === ""}
                  onClick={() => {
                    if (!isEditingDomain && !isRootDomainInput(draft.domain)) {
                      setDomainMutationError("TextDomain，Text“TextDomain”Text。");
                      return;
                    }
                    upsertMutation.mutate({
                      ...draft,
                      providerAccountId: draft.providerAccountId ? Number(draft.providerAccountId) : undefined,
                      verificationScore: draft.healthStatus === "healthy" ? 100 : 0,
                    });
                  }}
                >
                  {upsertMutation.isPending || creatingDomainWithVerification ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Text DNS Text...
                    </>
                  ) : isEditingDomain ? (
                    "Text"
                  ) : (
                    "Text"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isGenerateSubdomainDialogOpen}
            onOpenChange={(open) => {
              setGenerateSubdomainDialogOpen(open);
              if (open) {
                setSubdomainMutationError(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>TextDomain</DialogTitle>
                <DialogDescription>Text，Text MX、relay、edge Text。</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <WorkspaceField label="TextDomain">
                  <OptionCombobox
                    ariaLabel="TextDomain"
                    emptyLabel="TextDomain"
                    options={rootDomains.map((item) => ({
                      value: String(item.id),
                      label: item.domain,
                      keywords: [item.rootDomain],
                    }))}
                    placeholder="TextDomain"
                    searchPlaceholder="TextDomain"
                    value={selectedBaseDomainId === "" ? undefined : String(selectedBaseDomainId)}
                    onValueChange={(value) => setSelectedBaseDomainId(value ? Number(value) : "")}
                  />
                </WorkspaceField>

                <WorkspaceField label="Text">
                  <Textarea
                    rows={6}
                    value={prefixInput}
                    onChange={(event) => setPrefixInput(event.target.value)}
                    placeholder={"Text，Example: \nmx\nmx.edge\nrelay.cn.hk"}
                  />
                </WorkspaceField>
              </div>

              <DialogFooter>
                {subdomainMutationError ? (
                  <NoticeBanner autoHideMs={5000} className="mr-auto" onDismiss={() => setSubdomainMutationError(null)} variant="error">
                    {subdomainMutationError}
                  </NoticeBanner>
                ) : null}
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  disabled={selectedBaseDomainId === "" || generateMutation.isPending || generatingDomainsWithVerification}
                  onClick={() =>
                    generateMutation.mutate({
                      baseDomainId: Number(selectedBaseDomainId),
                      prefixes: prefixInput
                        .split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                      status: "active",
                      visibility: "private",
                      publicationStatus: "draft",
                      healthStatus: "unknown",
                      weight: 90,
                    })
                  }
                >
                  {generateMutation.isPending || generatingDomainsWithVerification ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Text DNS Text...
                    </>
                  ) : (
                    "TextDomain"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {domainsQuery.data?.length ? (
            <div className="space-y-3">
              {domainDeleteError ? (
                <NoticeBanner autoHideMs={5000} onDismiss={() => setDomainDeleteError(null)} variant="error">
                  {domainDeleteError}
                </NoticeBanner>
              ) : null}
              {domainActionNotice ? (
                <NoticeBanner autoHideMs={5000} onDismiss={() => setDomainActionNotice(null)} variant="success">
                  {domainActionNotice}
                </NoticeBanner>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-6">
                <Card className="border-border/60 bg-card shadow-none lg:col-span-2">
                  <CardContent className="space-y-2 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">DomainText</div>
                    <div className="text-2xl font-semibold">{domainSummary.total}</div>
                    <div className="text-sm text-muted-foreground">Text {domainSummary.root} Text · Provider Text {domainSummary.unbound} Text</div>
                  </CardContent>
                </Card>
                <Card className="border-sky-500/20 bg-sky-500/5 shadow-none">
                  <CardContent className="space-y-2 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text</div>
                    <div className="text-2xl font-semibold">{domainSummary.review}</div>
                    <div className="text-sm text-muted-foreground">Text</div>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/20 bg-amber-500/5 shadow-none">
                  <CardContent className="space-y-2 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text DNS</div>
                    <div className="text-2xl font-semibold">{domainSummary.unbound}</div>
                    <div className="text-sm text-muted-foreground">Text Provider</div>
                  </CardContent>
                </Card>
                <Card className="border-rose-500/20 bg-rose-500/5 shadow-none">
                  <CardContent className="space-y-2 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text</div>
                    <div className="text-2xl font-semibold">{domainSummary.pending}</div>
                    <div className="text-sm text-muted-foreground">Text</div>
                  </CardContent>
                </Card>
                <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-none">
                  <CardContent className="space-y-2 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text</div>
                    <div className="text-2xl font-semibold">{domainSummary.verified}</div>
                    <div className="text-sm text-muted-foreground">TextDomain</div>
                  </CardContent>
                </Card>
              </div>

              {(["review", "unbound", "pending", "verified"] as Array<ReturnType<typeof getAdminDomainStatus>>).map((group) => {
                const domains = groupedPaginatedDomains[group];
                if (!domains.length) {
                  return null;
                }

                const groupMeta = getAdminDomainStatusMeta(group);

                return (
                  <div key={group} className="space-y-3">
                    <Card className={cn("shadow-none", groupMeta.cardClassName)}>
                      <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <DomainStatusIcon verified={group === "verified"} className={groupMeta.iconClassName} />
                            {groupMeta.label}
                          </div>
                          <p className="text-xs text-muted-foreground">{groupMeta.description}</p>
                        </div>
                        <WorkspaceBadge variant="outline">{domains.length} TextDomain</WorkspaceBadge>
                      </CardContent>
                    </Card>

                    {domains.map((domain) => {
                const isExpanded = isDomainCardExpanded(domain);
                const guideRecords = buildRecommendedDomainRecords(domain);
                const verifiedCount = guideRecords.filter((item) => item.verified).length;
                const pendingCount = Math.max(guideRecords.length - verifiedCount, 0);
                const statusTone = getAdminDomainStatus(domain);
                const verificationResult = verificationResults[domain.id];

                return (
                  <Card
                    key={domain.id}
                    className={cn(
                      "border-border/60 bg-card shadow-none transition-colors",
                      selectedBaseDomainId === domain.id && "border-primary/40",
                    )}
                  >
                    <CardContent className={cn("py-4", isExpanded ? "space-y-4" : "space-y-3")}>
                      <div className={cn("flex flex-col lg:flex-row lg:items-center lg:justify-between", isExpanded ? "gap-4" : "gap-3")}>
                        <div className={cn(isExpanded ? "space-y-2" : "space-y-1.5")}>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 text-[1.05rem] font-semibold">
                              <Globe className="size-5 text-muted-foreground" />
                              <span>{domain.domain}</span>
                            </div>
                            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <DomainStatusIcon
                                verified={statusTone === "verified"}
                                className={cn(
                                  statusTone === "verified"
                                    ? "text-emerald-500"
                                    : statusTone === "review"
                                      ? "text-sky-500"
                                      : statusTone === "unbound"
                                        ? "text-amber-500"
                                        : "text-rose-400",
                                )}
                              />
                              {statusTone === "verified"
                                ? "Text"
                                : statusTone === "review"
                                  ? "Text"
                                  : statusTone === "unbound"
                                    ? "Text DNS"
                                    : "Text"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <WorkspaceBadge variant="outline">{domain.status}</WorkspaceBadge>
                            <WorkspaceBadge variant="outline">{domain.visibility}</WorkspaceBadge>
                            <WorkspaceBadge variant="outline">{domain.publicationStatus}</WorkspaceBadge>
                            {domain.providerDisplayName ? (
                              <WorkspaceBadge variant="outline">{domain.providerDisplayName}</WorkspaceBadge>
                            ) : null}
                            <WorkspaceBadge variant="outline">Text {domain.verificationScore}</WorkspaceBadge>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDomainCardExpandedState((current) => ({ ...current, [domain.id]: !isExpanded }))
                            }
                          >
                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            {isExpanded ? "Text" : "Text"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={verifyDomainMutation.isPending && verifyingDomainId === domain.id}
                            onClick={() => verifyDomainMutation.mutate(domain.id)}
                          >
                            {verifyDomainMutation.isPending && verifyingDomainId === domain.id ? "Text..." : "Text"}
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link to={getAdminDomainDnsLink(domain.id, domain.providerAccountId)}>
                              {domain.providerAccountId ? "Text DNS" : "Text DNS"}
                            </Link>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditDomainDialog(domain)}>
                            Text
                          </Button>
                          {domain.publicationStatus === "pending_review" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDomainActionNotice(null);
                                  reviewPublicationMutation.mutate({ domainId: domain.id, decision: "approve" });
                                }}
                              >
                                Text
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDomainActionNotice(null);
                                  setReviewRejectDialog({
                                    id: domain.id,
                                    domain: domain.domain,
                                  });
                                }}
                              >
                                Text
                              </Button>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDomainActionNotice(null);
                              setDeleteDomainDialog({
                                id: domain.id,
                                domain: domain.domain,
                              });
                            }}
                          >
                            Text
                          </Button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="space-y-3">
                          <DomainVerificationDetails
                            dnsLink={getAdminDomainDnsLink(domain.id, domain.providerAccountId)}
                            result={verificationResult}
                          />
                        <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
                          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                            <p className="text-sm font-semibold">DomainText</p>
                            <div className="mt-4 space-y-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Text</span>
                                <WorkspaceBadge variant="outline">{domain.healthStatus}</WorkspaceBadge>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Text</span>
                                <span className="truncate font-medium">{domain.rootDomain}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Text</span>
                                <span className="font-medium">{verifiedCount}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Text</span>
                                <span className="font-medium">{pendingCount}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Text</span>
                                <span className="font-medium">{domain.publicationStatus}</span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/60 bg-background/35 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">DomainText</p>
                                <p className="text-sm text-muted-foreground">
                                  DomainTextDomainText；Provider Text、Text DNS Text、Text and Text DNS Text。
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <WorkspaceBadge variant="outline">{domain.providerDisplayName ?? "Text Provider"}</WorkspaceBadge>
                                <WorkspaceBadge variant="outline">{guideRecords.length} Text</WorkspaceBadge>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              {guideRecords.slice(0, 4).map((record) => (
                                <div key={record.key} className="rounded-xl border border-border/60 bg-card/50 px-3 py-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <WorkspaceBadge variant="outline">{record.type}</WorkspaceBadge>
                                    <span className="text-xs text-muted-foreground">{record.status}</span>
                                  </div>
                                  <div className="mt-2 truncate text-sm font-medium">{record.name}</div>
                                  <div className="mt-1 truncate text-xs text-muted-foreground">{record.value}</div>
                                </div>
                              ))}
                              </div>

                              <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                                <div className="space-y-3 text-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">DNS Text</span>
                                    <span className="truncate font-medium">{domain.providerDisplayName ?? "Text"}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Text</span>
                                    <span className="font-medium">{domain.publicationStatus}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Text</span>
                                    <span className="font-medium">
                                      {statusTone === "verified"
                                        ? "Text"
                                        : statusTone === "review"
                                          ? "Text"
                                          : statusTone === "unbound"
                                            ? "Text DNS"
                                            : "Text"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Text</span>
                                    <span className="font-medium">
                                      {statusTone === "review"
                                        ? "Text"
                                        : statusTone === "unbound"
                                          ? "Text Provider"
                                          : statusTone === "pending"
                                            ? "Text DNS Text"
                                            : "Text"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 text-xs text-muted-foreground">
                              Text Provider、Text，Text DNS Text。
                            </div>
                          </div>
                        </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/60 bg-background/30 px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text</span>
                            <span className="font-medium">
                              {statusTone === "verified"
                                ? "Text"
                                : statusTone === "review"
                                  ? "Text"
                                  : statusTone === "unbound"
                                    ? "Text DNS"
                                    : "Text"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text</span>
                            <span className="font-medium">{domain.healthStatus}</span>
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text</span>
                            <span className="truncate font-medium">{domain.rootDomain}</span>
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Provider</span>
                            <span className="truncate font-medium">{domain.providerDisplayName ?? "Text Provider"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text</span>
                            <span className="font-medium">{guideRecords.length} Text</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Text</span>
                            <span className="font-medium">{pendingCount}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
                  </div>
                );
              })}
              <PaginationControls
                itemLabel="Domain"
                page={paginatedDomains.page}
                pageSize={ADMIN_DOMAINS_PAGE_SIZE}
                total={paginatedDomains.total}
                totalPages={paginatedDomains.totalPages}
                onPageChange={setDomainsPage}
              />
            </div>
          ) : (
            <WorkspaceEmpty title="TextDomain" description="TextDomainText。" />
          )}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
