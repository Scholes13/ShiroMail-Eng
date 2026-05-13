import { useCallback, useEffect, useMemo, useState } from "react";
import i18n from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionCombobox } from "@/components/ui/option-combobox";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceField,
  WorkspaceMetric,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import {
  buildMailHtmlDocument,
  buildMailHtmlPreview,
  buildRawPreview,
  collectInlineCIDTargets,
  extractReceivedTimeline,
  filterHeaderEntries,
  openHtmlPreviewWindow,
  resolveHtmlBody,
  resolveMessageBody,
  summarizeMessageHeaders,
} from "@/features/mail-preview";
import { decodeMimeHeaderValue } from "@/lib/mail-header";
import { paginateItems } from "@/lib/pagination";
import {
  Clock3,
  Download,
  FileText,
  Inbox,
  MailPlus,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  createAdminMailbox,
  fetchAdminMailboxMessageAttachmentBlob,
  downloadAdminMailboxMessageAttachment,
  downloadAdminMailboxMessageRaw,
  extendAdminMailbox,
  fetchAdminMailboxDomains,
  fetchAdminMailboxMessageDetail,
  fetchAdminMailboxMessageExtractions,
  fetchAdminMailboxMessageParsedRaw,
  fetchAdminMailboxMessageRawText,
  fetchAdminMailboxMessages,
  fetchAdminMailboxes,
  fetchAdminUsers,
  releaseAdminMailbox,
} from "../api";

type MessageViewMode = "text" | "html" | "raw";
const RAW_PREVIEW_AUTOMATIC_LIMIT = 512 * 1024;

const ttlOptions = [
  { label: "24 hours", value: "24", keywords: ["1 day", "24"] },
  { label: "72 hours", value: "72", keywords: ["3 days", "72"] },
  { label: "168 hours", value: "168", keywords: ["7 days", "168"] },
];
const mailboxAutoRefreshOptions = [
  { label: "Manual refresh", value: "0", keywords: ["manual", "off", "0"] },
  { label: "5 seconds", value: "5", keywords: ["5s", "5"] },
  { label: "15 seconds", value: "15", keywords: ["15s", "15"] },
  { label: "30 seconds", value: "30", keywords: ["30s", "30"] },
];
const ADMIN_MAILBOXES_PAGE_SIZE = 8;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(i18n.language, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRemainingHours(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const hours = Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
  return `${hours} hours`;
}

function blobToDataURL(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export function AdminMailboxesPage() {
  const autoRefreshStorageKey = "shiro-email.admin-mailboxes.auto-refresh-seconds";
  const queryClient = useQueryClient();
  const [selectedMailboxId, setSelectedMailboxId] = useState<number | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [domainId, setDomainId] = useState("");
  const [ttlHours, setTtlHours] = useState<number>(24);
  const [localPart, setLocalPart] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [mailboxesPage, setMailboxesPage] = useState(1);
  const [messageViewMode, setMessageViewMode] = useState<MessageViewMode>("text");
  const [cidImageSources, setCIDImageSources] = useState<Record<string, string>>({});
  const [headersExpanded, setHeadersExpanded] = useState(false);
  const [headersSearch, setHeadersSearch] = useState("");
  const [rawPreviewRequested, setRawPreviewRequested] = useState(false);
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(() => {
    if (typeof window === "undefined") {
      return 5;
    }
    const storedValue = window.localStorage.getItem(autoRefreshStorageKey);
    return storedValue && ["0", "5", "15", "30"].includes(storedValue) ? Number(storedValue) : 5;
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
  });
  const mailboxDomainsQuery = useQuery({
    queryKey: ["admin-mailbox-domains"],
    queryFn: fetchAdminMailboxDomains,
  });
  const mailboxesQuery = useQuery({
    queryKey: ["admin-mailboxes"],
    queryFn: fetchAdminMailboxes,
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const domains = useMemo(() => mailboxDomainsQuery.data ?? [], [mailboxDomainsQuery.data]);
  const mailboxes = useMemo(
    () => [...(mailboxesQuery.data ?? [])].sort((left, right) => right.id - left.id),
    [mailboxesQuery.data],
  );

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId("");
      return;
    }
    setSelectedUserId((current) => {
      if (current && users.some((item) => String(item.id) === current)) {
        return current;
      }
      return String(users[0].id);
    });
  }, [users]);

  useEffect(() => {
    if (!domains.length) {
      setDomainId("");
      return;
    }
    setDomainId((current) => {
      if (current && domains.some((item) => String(item.id) === current)) {
        return current;
      }
      return String(domains[0].id);
    });
  }, [domains]);

  const filteredMailboxes = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    return mailboxes.filter((item) => {
      if (selectedUserId && String(item.userId) !== selectedUserId) {
        return false;
      }
      if (!keyword) {
        return item.status === "active";
      }
      return (
        item.status === "active" &&
        (item.address.toLowerCase().includes(keyword) ||
          item.ownerUsername.toLowerCase().includes(keyword) ||
          item.domain.toLowerCase().includes(keyword))
      );
    });
  }, [mailboxes, searchValue, selectedUserId]);
  const paginatedFilteredMailboxes = useMemo(
    () => paginateItems(filteredMailboxes, mailboxesPage, ADMIN_MAILBOXES_PAGE_SIZE),
    [filteredMailboxes, mailboxesPage],
  );

  useEffect(() => {
    if (!paginatedFilteredMailboxes.items.length) {
      setSelectedMailboxId(null);
      return;
    }
    setSelectedMailboxId((current) => {
      if (current && paginatedFilteredMailboxes.items.some((item) => item.id === current)) {
        return current;
      }
      return paginatedFilteredMailboxes.items[0].id;
    });
  }, [paginatedFilteredMailboxes.items]);

  const selectedMailbox = useMemo(
    () => paginatedFilteredMailboxes.items.find((item) => item.id === selectedMailboxId) ?? null,
    [paginatedFilteredMailboxes.items, selectedMailboxId],
  );

  const messagesQuery = useQuery({
    queryKey: ["admin-mailbox-messages", selectedMailboxId],
    queryFn: () => fetchAdminMailboxMessages(selectedMailboxId!),
    enabled: Boolean(selectedMailboxId),
    staleTime: 10_000,
  });
  const selectedMessageSummary = useMemo(
    () => (messagesQuery.data ?? []).find((item) => item.id === selectedMessageId) ?? null,
    [messagesQuery.data, selectedMessageId],
  );

  const selectedMessageQuery = useQuery({
    queryKey: ["admin-mailbox-message-detail", selectedMailboxId, selectedMessageSummary?.id ?? null],
    queryFn: () => fetchAdminMailboxMessageDetail(selectedMailboxId!, selectedMessageSummary!.id),
    enabled: Boolean(selectedMailboxId && selectedMessageSummary),
    staleTime: 10_000,
  });
  const canAutoLoadRawPreview = (selectedMessageSummary?.sizeBytes ?? 0) <= RAW_PREVIEW_AUTOMATIC_LIMIT;
  const selectedMessageRawQuery = useQuery({
    queryKey: ["admin-mailbox-message-raw", selectedMailboxId, selectedMessageSummary?.id ?? null],
    queryFn: () => fetchAdminMailboxMessageRawText(selectedMailboxId!, selectedMessageSummary!.id),
    enabled: Boolean(
      selectedMailboxId &&
      selectedMessageSummary &&
      messageViewMode === "raw" &&
      (canAutoLoadRawPreview || rawPreviewRequested),
    ),
    staleTime: 10_000,
  });
  const selectedMessageParsedRawQuery = useQuery({
    queryKey: ["admin-mailbox-message-parsed-raw", selectedMailboxId, selectedMessageSummary?.id ?? null],
    queryFn: () => fetchAdminMailboxMessageParsedRaw(selectedMailboxId!, selectedMessageSummary!.id),
    enabled: Boolean(selectedMailboxId && selectedMessageSummary && messageViewMode === "html"),
    staleTime: 10_000,
  });
  const selectedMessageExtractionsQuery = useQuery({
    queryKey: ["admin-mailbox-message-extractions", selectedMailboxId, selectedMessageSummary?.id ?? null],
    queryFn: () => fetchAdminMailboxMessageExtractions(selectedMailboxId!, selectedMessageSummary!.id),
    enabled: Boolean(selectedMailboxId && selectedMessageSummary),
    staleTime: 10_000,
  });

  useEffect(() => {
    setRawPreviewRequested(false);
  }, [selectedMailboxId, selectedMessageId]);

  useEffect(() => {
    const messages = messagesQuery.data ?? [];
    if (!messages.length) {
      setSelectedMessageId(null);
      return;
    }
    setSelectedMessageId((current) => {
      if (current && messages.some((item) => item.id === current)) {
        return current;
      }
      return messages[0].id;
    });
  }, [messagesQuery.data, selectedMailboxId]);

  const selectedMessage = selectedMessageQuery.data ?? null;
  const resolvedHTMLBody = useMemo(
    () => (selectedMessage ? resolveHtmlBody(selectedMessage) : ""),
    [selectedMessage],
  );
  const htmlPreview = useMemo(
    () => (resolvedHTMLBody ? buildMailHtmlPreview(resolvedHTMLBody, cidImageSources) : null),
    [cidImageSources, resolvedHTMLBody],
  );
  const rawPreview = useMemo(
    () => (selectedMessageRawQuery.data ? buildRawPreview(selectedMessageRawQuery.data) : null),
    [selectedMessageRawQuery.data],
  );
  const filteredHeaderEntries = useMemo(
    () => filterHeaderEntries(selectedMessage?.headers ?? {}, headersSearch, decodeMimeHeaderValue),
    [headersSearch, selectedMessage?.headers],
  );
  const messageSecuritySummary = useMemo(
    () => summarizeMessageHeaders(selectedMessage?.headers ?? {}, decodeMimeHeaderValue),
    [selectedMessage?.headers],
  );
  const receivedTimeline = useMemo(
    () => extractReceivedTimeline(selectedMessage?.headers ?? {}),
    [selectedMessage?.headers],
  );
  const isRefreshing =
    usersQuery.isRefetching ||
    mailboxDomainsQuery.isRefetching ||
    mailboxesQuery.isRefetching ||
    messagesQuery.isRefetching ||
    selectedMessageQuery.isRefetching ||
    selectedMessageExtractionsQuery.isRefetching ||
    selectedMessageParsedRawQuery.isRefetching ||
    selectedMessageRawQuery.isRefetching;
  const refreshMailboxWorkspace = useCallback(async () => {
    await usersQuery.refetch();
    await mailboxDomainsQuery.refetch();
    await mailboxesQuery.refetch();
    if (!selectedMailboxId) {
      return;
    }
    await messagesQuery.refetch();
    if (!selectedMessageSummary) {
      return;
    }
    await selectedMessageQuery.refetch();
    await selectedMessageExtractionsQuery.refetch();
    if (messageViewMode === "html") {
      await selectedMessageParsedRawQuery.refetch();
    }
    if (messageViewMode === "raw") {
      await selectedMessageRawQuery.refetch();
    }
  }, [
    mailboxDomainsQuery,
    mailboxesQuery,
    messageViewMode,
    messagesQuery,
    selectedMailboxId,
    selectedMessageSummary,
    selectedMessageQuery,
    selectedMessageExtractionsQuery,
    selectedMessageParsedRawQuery,
    selectedMessageRawQuery,
    usersQuery,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const handleVisibilityChange = () => {
      setPageVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(autoRefreshStorageKey, String(autoRefreshSeconds));
  }, [autoRefreshSeconds, autoRefreshStorageKey]);

  useEffect(() => {
    if (!pageVisible || autoRefreshSeconds <= 0) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      void refreshMailboxWorkspace();
    }, autoRefreshSeconds * 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshSeconds, pageVisible, refreshMailboxWorkspace]);

  useEffect(() => {
    if (messageViewMode !== "html" || !selectedMessageParsedRawQuery.data || !selectedMailboxId || !selectedMessageSummary) {
      setCIDImageSources((current) => (Object.keys(current).length ? {} : current));
      return undefined;
    }

    const inlineTargets = collectInlineCIDTargets(selectedMessageParsedRawQuery.data.attachments);
    if (!inlineTargets.length) {
      setCIDImageSources((current) => (Object.keys(current).length ? {} : current));
      return undefined;
    }

    let cancelled = false;

    void Promise.all(
      inlineTargets.map(async (target) => {
        const blob = await fetchAdminMailboxMessageAttachmentBlob(
          selectedMailboxId,
          selectedMessageSummary.id,
          target.attachmentIndex,
        );
        return [target.contentId, await blobToDataURL(blob)] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }
        setCIDImageSources(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) {
          setFeedback("Some inline images failed to load; body preview was kept.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    messageViewMode,
    selectedMailboxId,
    selectedMessageSummary,
    selectedMessageParsedRawQuery.data,
  ]);

  function invalidateMailboxData() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-mailboxes"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-mailbox-messages"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-mailbox-message-detail"] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: createAdminMailbox,
    onSuccess: async (created) => {
      setFeedback(`Created mailbox ${created.address}`);
      setLocalPart("");
      await invalidateMailboxData();
      setMailboxesPage(1);
      setSelectedMailboxId(created.id);
      setSelectedUserId(String(created.userId));
    },
    onError: () => {
      setFeedback("Failed to create mailbox. Check domain verification status or retry later.");
    },
  });

  const extendMutation = useMutation({
    mutationFn: ({ mailboxId, expiresInHours }: { mailboxId: number; expiresInHours: number }) =>
      extendAdminMailbox(mailboxId, expiresInHours),
    onSuccess: async (updated) => {
      setFeedback(`Extended ${updated.address} by 24 hours`);
      await invalidateMailboxData();
    },
    onError: () => {
      setFeedback("Renewal failed. Try again later.");
    },
  });

  const releaseMutation = useMutation({
    mutationFn: releaseAdminMailbox,
    onSuccess: async (updated) => {
      await invalidateMailboxData();
      setSelectedMailboxId((current) => (current === updated.id ? null : current));
      setSelectedMessageId(null);
      setFeedback(`Released mailbox ${updated.address}`);
    },
    onError: () => {
      setFeedback("Failed to release mailbox. Try again later.");
    },
  });

  const activeCount = mailboxes.filter((item) => item.status === "active").length;
  const selectedUserMailboxCount = selectedUserId
    ? mailboxes.filter((item) => String(item.userId) === selectedUserId && item.status === "active").length
    : activeCount;

  return (
    <WorkspacePage>
      <AlertDialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release mailbox?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMailbox
                ? `Release mailbox ${selectedMailbox.address}? It will be removed from the current list immediately.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!selectedMailbox) {
                  return;
                }
                setFeedback(null);
                releaseMutation.mutate(selectedMailbox.id);
                setReleaseDialogOpen(false);
              }}
            >
              Confirm Release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <div className="space-y-6">
          <WorkspacePanel
            action={
              <div className="flex flex-wrap items-center gap-2">
                <OptionCombobox
                  ariaLabel="Mailbox auto refresh interval"
                  className="h-9 w-[96px] min-w-[96px]"
                  contentClassName="w-[112px] min-w-[112px]"
                  emptyLabel="No matching refresh interval"
                  onValueChange={(value) => setAutoRefreshSeconds(Number(value || 0))}
                  options={mailboxAutoRefreshOptions}
                  placeholder="Auto refresh"
                  searchPlaceholder="Search refresh intervals"
                  value={String(autoRefreshSeconds)}
                />
                <Button onClick={() => void refreshMailboxWorkspace()} size="sm" variant="secondary">
                  <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            }
            description="Admins can create, renew, release, and inspect mailbox contents on behalf of users."
            title="Mailbox Management"
          >
            <div className="grid gap-4 md:grid-cols-4">
              <WorkspaceMetric label="Active Mailboxes" value={activeCount} />
              <WorkspaceMetric label="Total Users" value={users.length} />
              <WorkspaceMetric label="Available Domains" value={domains.length} />
              <WorkspaceMetric label="Filtered Mailboxes" value={selectedUserMailboxCount} />
            </div>

            <Card className="border-border/60 bg-muted/10 shadow-none">
              <CardContent className="space-y-4 py-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MailPlus className="size-4" />
                  <span>Create New Mailbox</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <WorkspaceField label="Target User">
                    <OptionCombobox
                      ariaLabel="Select user"
                      emptyLabel="No matching users"
                      onValueChange={setSelectedUserId}
                      options={users.map((user) => ({
                        value: String(user.id),
                        label: `${user.username} · ${user.email}`,
                        keywords: [user.username, user.email],
                      }))}
                      placeholder="Select user"
                      searchPlaceholder="Search users"
                      value={selectedUserId}
                    />
                  </WorkspaceField>

                  <WorkspaceField label="Domain">
                    <OptionCombobox
                      ariaLabel="Select domain"
                      emptyLabel="No matching domains"
                      onValueChange={setDomainId}
                      options={domains.map((domain) => ({
                        value: String(domain.id),
                        label: domain.domain,
                        keywords: [domain.rootDomain, domain.kind, domain.visibility],
                      }))}
                      placeholder="Select domain"
                      searchPlaceholder="Search domains"
                      value={domainId}
                    />
                  </WorkspaceField>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
                  <WorkspaceField label="Mailbox Prefix">
                    <Input
                      onChange={(event) => setLocalPart(event.target.value)}
                      placeholder="Leave blank to auto-generate"
                      value={localPart}
                    />
                  </WorkspaceField>

                  <WorkspaceField label="Validity">
                    <OptionCombobox
                      ariaLabel="Mailbox validity"
                      emptyLabel="No matching validity"
                      onValueChange={(value) => setTtlHours(Number(value))}
                      options={ttlOptions}
                      placeholder="Select validity"
                      searchPlaceholder="Search validity"
                      value={String(ttlHours)}
                    />
                  </WorkspaceField>

                  <div className="flex items-end">
                    <Button
                      className="w-full md:w-auto"
                      disabled={!selectedUserId || !domainId || createMutation.isPending}
                      onClick={() => {
                        if (!selectedUserId || !domainId) {
                          return;
                        }
                        setFeedback(null);
                        createMutation.mutate({
                          userId: Number(selectedUserId),
                          domainId: Number(domainId),
                          expiresInHours: ttlHours,
                          localPart: localPart.trim() || undefined,
                        });
                      }}
                    >
                      <MailPlus className="size-4" />
                      {createMutation.isPending ? "Creating..." : "Create Mailbox"}
                    </Button>
                  </div>
                </div>

                {feedback ? <div className="text-xs text-muted-foreground">{feedback}</div> : null}
              </CardContent>
            </Card>
          </WorkspacePanel>

          <WorkspacePanel description="Admins can filter mailboxes by user and inspect messages on the right." title="Current Mailboxes">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <WorkspaceField label="Filter User">
                <OptionCombobox
                  ariaLabel="Filter user"
                  emptyLabel="No matching users"
                  onValueChange={setSelectedUserId}
                  options={users.map((user) => ({
                    value: String(user.id),
                    label: `${user.username} · ${user.email}`,
                    keywords: [user.username, user.email],
                  }))}
                  placeholder="Select user"
                  searchPlaceholder="Search users"
                  value={selectedUserId}
                />
              </WorkspaceField>
              <WorkspaceField label="Search Mailbox">
                <Input
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search by mailbox / user / domain"
                  value={searchValue}
                />
              </WorkspaceField>
            </div>

            {mailboxesQuery.isLoading ? (
              <WorkspaceEmpty description="Synchronizing mailbox list. Please wait." title="Loading mailboxes" />
            ) : !filteredMailboxes.length ? (
              <WorkspaceEmpty description="No active mailboxes match the current filters." title="No available mailboxes" />
            ) : (
              <div className="space-y-3">
                {paginatedFilteredMailboxes.items.map((mailbox) => {
                  const active = mailbox.id === selectedMailboxId;
                  return (
                    <button
                      className="block w-full text-left"
                      key={mailbox.id}
                      onClick={() => {
                        setSelectedMailboxId(mailbox.id);
                        setSelectedMessageId(null);
                      }}
                      type="button"
                    >
                      <Card className={active ? "border-primary/40 bg-muted/20 shadow-none" : "border-border/60 bg-muted/10 shadow-none"}>
                        <CardContent className="space-y-3 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-medium">{mailbox.address}</div>
                              <p className="text-xs text-muted-foreground">
                                {mailbox.ownerUsername} · {mailbox.domain}
                              </p>
                            </div>
                            <WorkspaceBadge>{mailbox.status === "active" ? "Active" : mailbox.status}</WorkspaceBadge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{mailbox.permanent ? "Permanent mailbox" : `${formatRemainingHours(mailbox.expiresAt)} remaining`}</span>
                            <span>Updated {formatDate(mailbox.updatedAt)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
                <PaginationControls
                  itemLabel="mailboxes"
                  onPageChange={setMailboxesPage}
                  page={paginatedFilteredMailboxes.page}
                  pageSize={ADMIN_MAILBOXES_PAGE_SIZE}
                  total={paginatedFilteredMailboxes.total}
                  totalPages={paginatedFilteredMailboxes.totalPages}
                />
              </div>
            )}
          </WorkspacePanel>
        </div>

        <WorkspacePanel
          description={selectedMailbox ? (selectedMailbox.permanent ? `Owner ${selectedMailbox.ownerUsername} · permanent mailbox` : `Owner ${selectedMailbox.ownerUsername} · expires ${formatDate(selectedMailbox.expiresAt)}`) : "Select a mailbox from the left first."}
          title={selectedMailbox?.address ?? "Message Preview"}
        >
          {selectedMailbox ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={extendMutation.isPending}
                  onClick={() => {
                    setFeedback(null);
                    extendMutation.mutate({ mailboxId: selectedMailbox.id, expiresInHours: 24 });
                  }}
                  size="sm"
                  variant="secondary"
                >
                  <TimerReset className="size-4" />
                  Renew 24 Hours
                </Button>
                <Button
                  disabled={releaseMutation.isPending || selectedMailbox.status === "released"}
                  onClick={() => setReleaseDialogOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="size-4" />
                  {selectedMailbox.status === "released" ? "Released" : "Release Mailbox"}
                </Button>
                <Badge className="rounded-full" variant="outline">
                  <UserRound className="mr-1 size-3.5" />
                  {selectedMailbox.ownerUsername}
                </Badge>
                <Badge className="rounded-full" variant="outline">
                  <Clock3 className="mr-1 size-3.5" />
                  {selectedMailbox.permanent ? "Permanent" : `${formatRemainingHours(selectedMailbox.expiresAt)} remaining`}
                </Badge>
                <Badge className="rounded-full" variant={selectedMailbox.status === "active" ? "secondary" : "outline"}>
                  <ShieldCheck className="mr-1 size-3.5" />
                  {selectedMailbox.status === "active" ? "Receiving mail" : "Receiving stopped"}
                </Badge>
              </div>

              <div className="space-y-3">
                {messagesQuery.isLoading ? (
                  <WorkspaceEmpty description="Synchronizing message list. Please wait." title="Loading messages" />
                ) : !(messagesQuery.data?.length ?? 0) ? (
                  <WorkspaceEmpty description="This mailbox has no messages yet. Waiting for new mail." title="No messages yet" />
                ) : (
                  messagesQuery.data?.map((message) => {
                    const active = message.id === selectedMessageId;
                    return (
                      <button
                        className="block w-full text-left"
                        key={message.id}
                        onClick={() => setSelectedMessageId(message.id)}
                        type="button"
                      >
                        <Card className={active ? "border-primary/40 bg-muted/20 shadow-none" : "border-border/60 bg-muted/10 shadow-none"}>
                          <CardContent className="space-y-3 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="text-sm font-medium">
                                  {message.subject ? `Subject · ${decodeMimeHeaderValue(message.subject)}` : "(no subject)"}
                                </div>
                                <p className="text-xs text-muted-foreground">{decodeMimeHeaderValue(message.fromAddr)}</p>
                              </div>
                              <span className="text-xs text-muted-foreground">{formatDate(message.receivedAt)}</span>
                            </div>
                            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                              {message.textPreview || message.htmlPreview || "No preview available"}
                            </p>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <Inbox className="size-3.5" />
                                {decodeMimeHeaderValue(message.toAddr)}
                              </span>
                              <span>{message.attachmentCount} attachments</span>
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedMessageSummary ? (
                <Card className="border-border/60 bg-muted/10 shadow-none">
                  <CardContent className="space-y-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Message Details</p>
                        <h3 className="text-base font-medium">{decodeMimeHeaderValue(selectedMessageSummary.subject) || "(no subject)"}</h3>
                      </div>

                      <Button
                        onClick={() => {
                          if (!selectedMailbox) {
                            return;
                          }
                          setFeedback(null);
                          void downloadAdminMailboxMessageRaw(selectedMailbox.id, selectedMessageSummary.id).catch(() => {
                            setFeedback("Failed to download raw message. Try again later.");
                          });
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        <Download className="size-4" />
                        Download Raw
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <MetaCard label="Mailbox" value={selectedMailbox.address} />
                      <MetaCard label="From" value={decodeMimeHeaderValue(selectedMessageSummary.fromAddr)} />
                      <MetaCard label="To" value={decodeMimeHeaderValue(selectedMessageSummary.toAddr)} />
                      <MetaCard label="Received At" value={formatDate(selectedMessageSummary.receivedAt)} />
                    </div>

                    {selectedMessageQuery.isLoading && !selectedMessage ? (
                      <WorkspaceEmpty description="Loading message details. Please wait." title="Syncing details" />
                    ) : selectedMessage ? (
                      <>
                        <Card className="border-border/60 bg-background/60 shadow-none">
                          <CardContent className="space-y-3 py-4">
                            <div className="text-sm font-medium">Delivery and Authentication Summary</div>
                            <div className="grid gap-3 md:grid-cols-3">
                              <SecurityStatusCard label="SPF" value={messageSecuritySummary.spf} />
                              <SecurityStatusCard label="DKIM" value={messageSecuritySummary.dkim} />
                              <SecurityStatusCard label="DMARC" value={messageSecuritySummary.dmarc} />
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                              <MetaCard label="Reply-To" value={messageSecuritySummary.replyTo} />
                              <MetaCard label="Return-Path" value={messageSecuritySummary.returnPath} />
                              <MetaCard label="Message-ID" value={messageSecuritySummary.messageId} />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-background/60 shadow-none">
                          <CardContent className="space-y-3 py-4">
                            <div className="text-sm font-medium">Received Path</div>
                            {receivedTimeline.length ? (
                              <div className="space-y-3">
                                {receivedTimeline.map((item, index) => (
                                  <div className="rounded-xl border border-border/60 bg-muted/10 p-3" key={`${item.date}-${index}`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <WorkspaceBadge variant="outline">#{index + 1}</WorkspaceBadge>
                                      <span className="text-xs text-muted-foreground">{item.date || "Time unknown"}</span>
                                    </div>
                                    <div className="mt-2 text-sm font-medium">{item.route}</div>
                                    {item.raw ? (
                                      <pre className="mt-2 whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
                                        {item.raw}
                                      </pre>
                                    ) : null}
                                    {item.isRawTruncated ? (
                                      <p className="mt-2 text-[11px] text-muted-foreground">
                                        Raw headers for this node were truncated. Check the raw source for the full content.
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <WorkspaceEmpty description="This message has no parseable Received path." title="No delivery path" />
                            )}
                          </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-background/60 shadow-none">
                          <CardContent className="space-y-3 py-4">
                            <div className="text-sm font-medium">Extraction Results</div>
                            {selectedMessageExtractionsQuery.isLoading ? (
                              <WorkspaceEmpty description="Analyzing default extraction templates matched by this message." title="Computing extraction results" />
                            ) : selectedMessageExtractionsQuery.data?.items.length ? (
                              <div className="space-y-3">
                                {selectedMessageExtractionsQuery.data.items.map((item, index) => (
                                  <div className="rounded-xl border border-border/60 bg-muted/10 p-3" key={`${item.ruleId}-${item.sourceField}-${index}`}>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <WorkspaceBadge variant="outline">{item.label || item.ruleName}</WorkspaceBadge>
                                      <span className="text-xs text-muted-foreground">{item.sourceField}</span>
                                    </div>
                                    <div className="mt-2 whitespace-pre-wrap break-all text-sm leading-6">
                                      {item.values?.length ? item.values.join("\n") : item.value}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <WorkspaceEmpty description="This message did not match any enabled default extraction templates." title="No extraction results" />
                            )}
                          </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-background/60 shadow-none">
                          <CardContent className="space-y-2 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="inline-flex items-center gap-2 text-sm font-medium">
                                <FileText className="size-4" />
                                Message Content
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {messageViewMode === "html" && htmlPreview ? (
                                  <Button
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    onClick={() => openHtmlPreviewWindow(htmlPreview.html)}
                                  >
                                    Open in New Window
                                  </Button>
                                ) : null}
                                <div className="inline-flex rounded-lg border border-border/60 bg-muted/20 p-1">
                                  {[
                                    { value: "text" as const, label: "Text" },
                                    { value: "html" as const, label: "HTML" },
                                    { value: "raw" as const, label: "Raw" },
                                  ].map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      className={`rounded-md px-3 py-1.5 text-xs transition ${
                                        messageViewMode === option.value
                                          ? "bg-foreground text-background"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                      onClick={() => setMessageViewMode(option.value)}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {messageViewMode === "html" ? (
                              htmlPreview ? (
                                <div className="space-y-3">
                                  {htmlPreview.notices.length ? (
                                    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
                                      {htmlPreview.notices.map((notice) => (
                                        <p key={notice}>{notice}</p>
                                      ))}
                                    </div>
                                  ) : null}
                                  <iframe
                                    className="min-h-[420px] w-full rounded-xl border border-border/60 bg-white"
                                    sandbox="allow-same-origin"
                                    srcDoc={buildMailHtmlDocument(htmlPreview.html)}
                                    title="HTML Email Preview"
                                    onLoad={(event) => {
                                      const frame = event.currentTarget;
                                      const doc = frame.contentDocument;
                                      const height = doc?.documentElement?.scrollHeight ?? doc?.body?.scrollHeight ?? 420;
                                      frame.style.height = `${Math.max(height + 8, 420)}px`;
                                    }}
                                  />
                                </div>
                              ) : (
                                <WorkspaceEmpty description="This message has no displayable HTML body." title="No HTML content" />
                              )
                            ) : null}
                            {messageViewMode === "raw" ? (
                              !canAutoLoadRawPreview && !rawPreviewRequested ? (
                                <div className="space-y-3">
                                  <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
                                    This message is about {Math.max(1, Math.round((selectedMessageSummary.sizeBytes || 0) / 1024))} KB.
                                    To avoid UI lag, raw preview is not loaded automatically. You can still download the raw source or manually load a truncated preview.
                                  </div>
                                  <div className="flex justify-end">
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                      onClick={() => setRawPreviewRequested(true)}
                                    >
                                      Load Raw Preview
                                    </Button>
                                  </div>
                                </div>
                              ) : selectedMessageRawQuery.isLoading ? (
                                <WorkspaceEmpty description="Reading raw message content. Please wait." title="Loading Raw" />
                              ) : rawPreview ? (
                                <div className="space-y-3">
                                  {rawPreview.isTruncated ? (
                                    <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
                                      Raw content is large. This page only shows the first {Math.max(1, Math.round(rawPreview.preview.length / 1024))} KB preview.
                                      Use Download Raw above for the full source.
                                    </div>
                                  ) : null}
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                                      <div className="mb-2 text-xs font-medium text-foreground">Raw Headers</div>
                                      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
                                        {rawPreview.headers || "No raw headers available."}
                                      </pre>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                                      <div className="mb-2 text-xs font-medium text-foreground">Raw Body</div>
                                      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
                                        {rawPreview.body || "No raw body available."}
                                      </pre>
                                    </div>
                                  </div>
                                  <div className="flex justify-end">
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        void navigator.clipboard.writeText(rawPreview.preview).then(
                                          () => setFeedback(rawPreview.isTruncated ? "Raw preview copied. Download the full raw source for complete content." : "Raw source copied."),
                                          () => setFeedback(rawPreview.isTruncated ? "Failed to copy raw preview. Use Download Raw instead." : "Failed to copy raw source. Copy manually."),
                                        );
                                      }}
                                    >
                                      {rawPreview.isTruncated ? "Copy Preview" : "Copy Raw"}
                                    </Button>
                                  </div>
                                  <pre className="max-h-[320px] overflow-auto rounded-xl border border-border/60 bg-muted/20 p-4 text-xs leading-6 text-muted-foreground whitespace-pre-wrap break-all">
                                    {rawPreview.preview}
                                  </pre>
                                </div>
                              ) : (
                                <WorkspaceEmpty description="This message has no readable raw source." title="Raw unavailable" />
                              )
                            ) : null}
                            {messageViewMode === "text" ? (
                              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                                {resolveMessageBody(selectedMessage)}
                              </p>
                            ) : null}
                          </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-background/60 shadow-none">
                          <CardContent className="space-y-3 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="inline-flex items-center gap-2 text-sm font-medium">
                                <Paperclip className="size-4" />
                                Attachments
                              </div>
                              <Button
                                size="sm"
                                type="button"
                                variant="ghost"
                                onClick={() => setHeadersExpanded((current) => !current)}
                              >
                                {headersExpanded ? "Collapse Headers" : "View Headers"}
                              </Button>
                            </div>
                            {headersExpanded ? (
                              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
                                <Input
                                  onChange={(event) => setHeadersSearch(event.target.value)}
                                  placeholder="Search header names or values"
                                  value={headersSearch}
                                />
                                {filteredHeaderEntries.length ? (
                                  filteredHeaderEntries.map(([key, values]) => (
                                    <div className="space-y-1" key={key}>
                                      <div className="text-xs font-medium text-foreground">{key}</div>
                                      <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
                                        {values.join("\n")}
                                      </pre>
                                    </div>
                                  ))
                                ) : (
                                  <WorkspaceEmpty
                                    description={
                                      Object.keys(selectedMessage.headers ?? {}).length
                                        ? "No matching headers. Try another keyword."
                                        : "This message has no displayable raw headers."
                                    }
                                    title={Object.keys(selectedMessage.headers ?? {}).length ? "No matching headers" : "No headers"}
                                  />
                                )}
                              </div>
                            ) : null}
                            {(selectedMessage.attachments ?? []).length ? (
                              <div className="space-y-3">
                                {(selectedMessage.attachments ?? []).map((attachment, index) => (
                                  <div
                                    className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 px-4 py-3 md:flex-row md:items-center md:justify-between"
                                    key={`${attachment.storageKey}-${index}`}
                                  >
                                    <div className="space-y-1">
                                      <div className="text-sm font-medium">{attachment.fileName}</div>
                                      <p className="text-xs text-muted-foreground">
                                        {attachment.contentType || "application/octet-stream"} · {attachment.sizeBytes} bytes
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() => {
                                        if (!selectedMailbox) {
                                          return;
                                        }
                                        setFeedback(null);
                                        void downloadAdminMailboxMessageAttachment(
                                          selectedMailbox.id,
                                          selectedMessage.id,
                                          index,
                                        ).catch(() => {
                                          setFeedback(`Failed to download attachment ${attachment.fileName}. Try again later.`);
                                        });
                                      }}
                                      size="sm"
                                      variant="outline"
                                    >
                                      <Download className="size-4" />
                                      Download Attachment
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <WorkspaceEmpty description="This message has no attachments." title="No attachments" />
                            )}
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <WorkspaceEmpty description="Unable to load this message detail right now. Refresh and try again." title="Details unavailable" />
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : (
            <WorkspaceEmpty description="Select a mailbox to show recently received messages here." title="No mailbox selected" />
          )}
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/60 bg-background/60 shadow-none">
      <CardContent className="space-y-1 py-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{decodeMimeHeaderValue(value)}</p>
      </CardContent>
    </Card>
  );
}

function SecurityStatusCard({ label, value }: { label: string; value: string }) {
  const normalized = value.toLowerCase();
  const variant =
    normalized.includes("pass") || normalized.includes("Text")
      ? "secondary"
      : normalized.includes("fail") || normalized.includes("reject")
        ? "destructive"
        : "outline";

  return (
    <Card className="border-border/60 bg-background/60 shadow-none">
      <CardContent className="space-y-2 py-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <Badge className="rounded-full" variant={variant}>
            {value}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
