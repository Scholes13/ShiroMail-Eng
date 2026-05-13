import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { NoticeBanner } from "@/components/ui/notice-banner";
import { OptionCombobox } from "@/components/ui/option-combobox";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { getAPIErrorMessage } from "@/lib/http";
import { paginateItems } from "@/lib/pagination";
import { validateRequiredText, validateSelection } from "@/lib/validation";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceField,
  WorkspaceListRow,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import {
  createAdminApiKey,
  fetchAdminApiKeys,
  fetchAdminDomains,
  revokeAdminApiKey,
  rotateAdminApiKey,
} from "../api";
import {
  type ApiKeyDomainBindingInput,
  type ApiKeyItem,
} from "../../user/api";
import { formatDateTime } from "../../user/pages/shared";

const DEFAULT_SCOPES = [
  "mailboxes.read",
  "messages.read",
  "domains.read",
  "domains.verify",
];

const API_KEY_SCOPE_OPTIONS = [
  "mailboxes.read",
  "mailboxes.write",
  "messages.read",
  "messages.attachments.read",
  "domains.read",
  "domains.write",
  "domains.verify",
  "domains.publish",
  "domains.unpublish",
  "dns.records.read",
  "dns.records.write",
  "provider.accounts.read",
  "provider.accounts.write",
  "public_pool.use",
  "public_pool.manage",
] as const;

const DOMAIN_ACCESS_MODE_OPTIONS = [
  { value: "mixed", label: "mixed" },
  { value: "private_only", label: "private_only" },
  { value: "public_only", label: "public_only" },
];

const DOMAIN_BINDING_ACCESS_OPTIONS = [
  { value: "read", label: "read" },
  { value: "write", label: "write" },
  { value: "verify", label: "verify" },
  { value: "publish", label: "publish" },
  { value: "manage", label: "manage" },
];

const DEFAULT_RESOURCE_POLICY = {
  domainAccessMode: "mixed",
  allowPlatformPublicDomains: true,
  allowUserPublishedDomains: true,
  allowOwnedPrivateDomains: true,
  allowProviderMutation: false,
  allowProtectedRecordWrite: false,
};

const ADMIN_API_KEYS_PAGE_SIZE = 8;

type BindingDraft = {
  domainId: string;
  accessLevel: string;
};

type RevealedKeyState = {
  mode: "created" | "rotated";
  name: string;
  secret: string;
};

export function AdminApiKeysPage() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<RevealedKeyState | null>(null);
  const [pendingRevokeItem, setPendingRevokeItem] = useState<ApiKeyItem | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const [createError, setCreateError] = useState<string | null>(null);
  const [apiKeysPage, setApiKeysPage] = useState(1);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(DEFAULT_SCOPES);
  const [resourcePolicy, setResourcePolicy] = useState(DEFAULT_RESOURCE_POLICY);
  const [bindingDraft, setBindingDraft] = useState<BindingDraft>({
    domainId: "",
    accessLevel: "read",
  });
  const [domainBindings, setDomainBindings] = useState<ApiKeyDomainBindingInput[]>([]);

  const apiKeysQuery = useQuery({
    queryKey: ["admin-api-keys"],
    queryFn: fetchAdminApiKeys,
  });
  const domainsQuery = useQuery({
    queryKey: ["admin-domains"],
    queryFn: fetchAdminDomains,
  });

  const domainOptions = useMemo(
    () =>
      (domainsQuery.data ?? []).map((item) => ({
        value: String(item.id),
        label: item.domain,
        keywords: [item.visibility, item.publicationStatus, item.kind],
      })),
    [domainsQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: createAdminApiKey,
    onSuccess: async (created) => {
      setCreateError(null);
      setName("");
      setSelectedScopes(DEFAULT_SCOPES);
      setResourcePolicy(DEFAULT_RESOURCE_POLICY);
      setBindingDraft({ domainId: "", accessLevel: "read" });
      setDomainBindings([]);
      setCreateDialogOpen(false);
      setCopyState("idle");
      setRevealedKey({
        mode: "created",
        name: created.name,
        secret: created.plainSecret || created.keyPreview,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"], refetchType: "all" });
    },
    onError: (error) => {
      setCreateError(
        getAPIErrorMessage(error, "Text API Key Text，Text、Text。"),
      );
    },
  });

  const rotateMutation = useMutation({
    mutationFn: rotateAdminApiKey,
    onSuccess: async (rotated) => {
      setCopyState("idle");
      setRevealedKey({
        mode: "rotated",
        name: rotated.name,
        secret: rotated.plainSecret || rotated.keyPreview,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeAdminApiKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"], refetchType: "all" });
    },
  });

  const canAddBinding = bindingDraft.domainId !== "";
  const canSubmit = name.trim() !== "";
  const activeApiKeys = apiKeysQuery.data ?? [];
  const paginatedApiKeys = useMemo(
    () => paginateItems(activeApiKeys, apiKeysPage, ADMIN_API_KEYS_PAGE_SIZE),
    [activeApiKeys, apiKeysPage],
  );

  const handleCopySecret = async () => {
    if (!revealedKey || typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyState("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(revealedKey.secret);
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  };

  function handleAddBinding() {
    const domainError = validateSelection("Domain", bindingDraft.domainId, domainOptions.map((item) => item.value));
    if (domainError) {
      setCreateError(domainError);
      return;
    }
    const accessError = validateSelection("Text", bindingDraft.accessLevel, DOMAIN_BINDING_ACCESS_OPTIONS.map((item) => item.value));
    if (accessError) {
      setCreateError(accessError);
      return;
    }
    setCreateError(null);
    setDomainBindings((current) =>
      upsertDomainBinding(current, Number(bindingDraft.domainId), bindingDraft.accessLevel),
    );
  }

  function handleCreateKey() {
    const nameError = validateRequiredText("Text", name, { minLength: 2, maxLength: 80 });
    if (nameError) {
      setCreateError(nameError);
      return;
    }
    if (!selectedScopes.length) {
      setCreateError(" must be at leastText scope。");
      return;
    }
    const modeError = validateSelection("Text", resourcePolicy.domainAccessMode, DOMAIN_ACCESS_MODE_OPTIONS.map((item) => item.value));
    if (modeError) {
      setCreateError(modeError);
      return;
    }
    setCreateError(null);
    createMutation.mutate({
      name: name.trim(),
      scopes: [...selectedScopes].sort(),
      resourcePolicy,
      domainBindings,
    });
  }

  return (
    <WorkspacePage>
      <WorkspacePanel
          action={<Button onClick={() => setCreateDialogOpen(true)}>Text API Key</Button>}
        description="Text API Key，Text；TextDomain。"
        title="API Text"
      >
        <Dialog
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (open) {
              setCreateError(null);
            }
          }}
          open={isCreateDialogOpen}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Text API Key</DialogTitle>
              <DialogDescription>
                Text API Key，Text scopes、resource policy TextDomainText。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <WorkspaceField label="Text">
                  <Input
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Text，Text Admin Worker / Audit Bot"
                    value={name}
                  />
                </WorkspaceField>

                <div className="space-y-3 rounded-xl border border-border/60 bg-card px-4 py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Scopes</p>
                    <p className="text-sm text-muted-foreground">
                      Text，Text scope。
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {API_KEY_SCOPE_OPTIONS.map((scope) => {
                      const checkboxID = `admin-api-key-scope-${scope.replace(/[.]/g, "-")}`;
                      return (
                        <div className="flex items-center gap-2" key={scope}>
                          <Checkbox
                            aria-label={scope}
                            checked={selectedScopes.includes(scope)}
                            id={checkboxID}
                            onCheckedChange={(checked) =>
                              setSelectedScopes((current) =>
                                toggleScope(current, scope, checked === true),
                              )
                            }
                          />
                          <Label className="text-sm" htmlFor={checkboxID}>
                            {scope}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-4 rounded-xl border border-border/60 bg-card px-4 py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Resource Policy</p>
                    <p className="text-sm text-muted-foreground">
                      Text key Text，Text DNS / Provider Text。
                    </p>
                  </div>

                  <WorkspaceField label="Text">
                    <OptionCombobox
                      ariaLabel="Text"
                      emptyLabel="Text"
                      onValueChange={(value) =>
                        setResourcePolicy((current) => ({
                          ...current,
                          domainAccessMode: value || "mixed",
                        }))
                      }
                      options={DOMAIN_ACCESS_MODE_OPTIONS}
                      placeholder="Text"
                      searchPlaceholder="Text"
                      value={resourcePolicy.domainAccessMode}
                    />
                  </WorkspaceField>

                  <div className="grid gap-3">
                    <PolicyCheckbox
                      checked={resourcePolicy.allowOwnedPrivateDomains}
                      label="owned_private"
                      onCheckedChange={(checked) =>
                        setResourcePolicy((current) => ({
                          ...current,
                          allowOwnedPrivateDomains: checked,
                        }))
                      }
                    />
                    <PolicyCheckbox
                      checked={resourcePolicy.allowPlatformPublicDomains}
                      label="platform_public"
                      onCheckedChange={(checked) =>
                        setResourcePolicy((current) => ({
                          ...current,
                          allowPlatformPublicDomains: checked,
                        }))
                      }
                    />
                    <PolicyCheckbox
                      checked={resourcePolicy.allowUserPublishedDomains}
                      label="public_pool"
                      onCheckedChange={(checked) =>
                        setResourcePolicy((current) => ({
                          ...current,
                          allowUserPublishedDomains: checked,
                        }))
                      }
                    />
                    <PolicyCheckbox
                      checked={resourcePolicy.allowProviderMutation}
                      label="provider_mutation"
                      onCheckedChange={(checked) =>
                        setResourcePolicy((current) => ({
                          ...current,
                          allowProviderMutation: checked,
                        }))
                      }
                    />
                    <PolicyCheckbox
                      checked={resourcePolicy.allowProtectedRecordWrite}
                      label="protected_record_write"
                      onCheckedChange={(checked) =>
                        setResourcePolicy((current) => ({
                          ...current,
                          allowProtectedRecordWrite: checked,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-border/60 bg-card px-4 py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Domain Bindings</p>
                    <p className="text-sm text-muted-foreground">
                      Text key Text and TextDomain，Text、Text；TextDomain。
                    </p>
                  </div>

                  <WorkspaceField label="TextDomain">
                    <OptionCombobox
                      ariaLabel="TextDomain"
                      disabled={!domainOptions.length}
                      emptyLabel="TextDomain"
                      onValueChange={(value) =>
                        setBindingDraft((current) => ({ ...current, domainId: value }))
                      }
                      options={domainOptions}
                      placeholder="TextDomain"
                      searchPlaceholder="TextDomain"
                      value={bindingDraft.domainId || undefined}
                    />
                  </WorkspaceField>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <WorkspaceField label="Text">
                      <OptionCombobox
                        ariaLabel="Text"
                        emptyLabel="Text"
                        onValueChange={(value) =>
                          setBindingDraft((current) => ({
                            ...current,
                            accessLevel: value || "read",
                          }))
                        }
                        options={DOMAIN_BINDING_ACCESS_OPTIONS}
                        placeholder="Text"
                        searchPlaceholder="Text"
                        value={bindingDraft.accessLevel}
                      />
                    </WorkspaceField>

                    <div className="flex items-end">
                      <Button
                        disabled={!canAddBinding}
                        onClick={handleAddBinding}
                        variant="outline"
                      >
                        Text
                      </Button>
                    </div>
                  </div>

                  {domainBindings.length ? (
                    <div className="space-y-2">
                      {domainBindings.map((binding) => {
                        const bindingDomain = (domainsQuery.data ?? []).find(
                          (item) => item.id === binding.nodeId,
                        );
                        return (
                          <WorkspaceListRow
                            description={`${bindingDomain?.visibility ?? "unknown"} · ${bindingDomain?.publicationStatus ?? "unknown"}`}
                            key={`${binding.nodeId}-${binding.accessLevel}`}
                            meta={
                              <>
                                <WorkspaceBadge>{binding.accessLevel}</WorkspaceBadge>
                                <Button
                                  onClick={() =>
                                    setDomainBindings((current) =>
                                      current.filter(
                                        (item) =>
                                          item.nodeId !== binding.nodeId ||
                                          item.accessLevel !== binding.accessLevel,
                                      ),
                                    )
                                  }
                                  size="sm"
                                  variant="ghost"
                                >
                                  Text
                                </Button>
                              </>
                            }
                            title={bindingDomain?.domain ?? `node #${binding.nodeId}`}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <WorkspaceEmpty
                      description="Text，Text key Text resource policy Text。"
                      title="Text and TextDomain"
                    />
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              {createError ? (
                <NoticeBanner autoHideMs={5000} className="mr-auto" onDismiss={() => setCreateError(null)} variant="error">
                  {createError}
                </NoticeBanner>
              ) : null}
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                disabled={!canSubmit || createMutation.isPending}
                onClick={handleCreateKey}
              >
                {createMutation.isPending ? "Text..." : "Text"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          onOpenChange={(open) => {
            if (!open) {
              setRevealedKey(null);
              setCopyState("idle");
            }
          }}
          open={revealedKey !== null}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {revealedKey?.mode === "rotated" ? "Text API Text" : "Text API Text"}
              </DialogTitle>
              <DialogDescription>
                Text，Text。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <WorkspaceField label="Text">
                <Input readOnly value={revealedKey?.name ?? ""} />
              </WorkspaceField>

              <WorkspaceField label="Text">
                <div className="space-y-2">
                  <Input className="font-mono text-[0.82rem]" readOnly value={revealedKey?.secret ?? ""} />
                  <p className="text-xs text-muted-foreground">
                    Text，Text and Text。
                  </p>
                </div>
              </WorkspaceField>
            </div>

            <DialogFooter>
              {copyState === "done" ? (
                <NoticeBanner autoHideMs={5000} className="mr-auto text-xs" onDismiss={() => setCopyState("idle")} variant="success">
                  Text and Text
                </NoticeBanner>
              ) : copyState === "failed" ? (
                <NoticeBanner autoHideMs={5000} className="mr-auto text-xs" onDismiss={() => setCopyState("idle")} variant="error">
                  Text，Text
                </NoticeBanner>
              ) : (
                <div className="mr-auto text-xs text-muted-foreground">
                  Text and Text
                </div>
              )}
              <Button onClick={handleCopySecret} variant="secondary">
                Text
              </Button>
              <DialogClose asChild>
                <Button variant="outline">Text</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          onOpenChange={(open) => {
            if (!open) {
              setPendingRevokeItem(null);
            }
          }}
          open={pendingRevokeItem !== null}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Text API Text</DialogTitle>
              <DialogDescription>
                Text key Text，Text。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <WorkspaceField label="Text">
                <Input readOnly value={pendingRevokeItem?.name ?? ""} />
              </WorkspaceField>
              <WorkspaceField label="Text">
                <Input className="font-mono text-[0.82rem]" readOnly value={pendingRevokeItem?.keyPreview ?? ""} />
              </WorkspaceField>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                disabled={revokeMutation.isPending}
                onClick={() => {
                  if (!pendingRevokeItem) {
                    return;
                  }
                  revokeMutation.mutate(pendingRevokeItem.id, {
                    onSuccess: () => {
                      setPendingRevokeItem(null);
                    },
                  });
                }}
                variant="destructive"
              >
                {revokeMutation.isPending ? "Text..." : "Text"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {activeApiKeys.length > 0 ? (
          <div className="space-y-3">
            {paginatedApiKeys.items.map((item) => {
              const scopes = item.scopes ?? [];
              const domainBindings = item.domainBindings ?? [];

              return (
                <WorkspaceListRow
                  description={
                    <div className="space-y-2">
                      <div className="font-mono text-[0.82rem]">{item.keyPreview}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {scopes.map((scope) => (
                          <WorkspaceBadge key={scope} variant="outline">
                            {scope}
                          </WorkspaceBadge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[0.8rem]">
                        <span>{item.resourcePolicy.domainAccessMode}</span>
                        <span>Text {domainBindings.length}</span>
                        <span>Text {formatDateTime(item.lastUsedAt)}</span>
                        <span>{formatDomainPolicySummary(item)}</span>
                      </div>
                    </div>
                  }
                  key={item.id}
                  meta={
                    <>
                      <WorkspaceBadge>{item.status}</WorkspaceBadge>
                      <span>{formatDateTime(item.rotatedAt ?? item.createdAt)}</span>
                      <Button
                        onClick={() => rotateMutation.mutate(item.id)}
                        size="sm"
                        variant="secondary"
                      >
                        Text
                      </Button>
                      <Button
                        onClick={() => setPendingRevokeItem(item)}
                        size="sm"
                        variant="outline"
                      >
                        Text
                      </Button>
                    </>
                  }
                  title={item.name}
                />
              );
            })}
            <PaginationControls
              itemLabel="API Key"
              onPageChange={setApiKeysPage}
              page={paginatedApiKeys.page}
              pageSize={ADMIN_API_KEYS_PAGE_SIZE}
              total={paginatedApiKeys.total}
              totalPages={paginatedApiKeys.totalPages}
            />
          </div>
        ) : (
          <WorkspaceEmpty
            description="Text API Key。"
            title="Text API Key"
          />
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}

function PolicyCheckbox({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const checkboxID = `admin-policy-${label}`;

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        aria-label={label}
        checked={checked}
        id={checkboxID}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <Label className="text-sm" htmlFor={checkboxID}>
        {label}
      </Label>
    </div>
  );
}

function toggleScope(current: string[], scope: string, enabled: boolean) {
  if (enabled) {
    return [...new Set([...current, scope])].sort();
  }
  return current.filter((item) => item !== scope);
}

function upsertDomainBinding(
  current: ApiKeyDomainBindingInput[],
  nodeID: number,
  accessLevel: string,
) {
  const nextBinding = {
    nodeId: nodeID,
    accessLevel,
  };
  const existingIndex = current.findIndex(
    (item) => item.nodeId === nodeID && item.accessLevel === accessLevel,
  );
  if (existingIndex >= 0) {
    return current;
  }
  return [...current, nextBinding];
}

function formatDomainPolicySummary(item: ApiKeyItem) {
  const targets: string[] = [];
  if (item.resourcePolicy.allowOwnedPrivateDomains) {
    targets.push("Text");
  }
  if (item.resourcePolicy.allowPlatformPublicDomains) {
    targets.push("Text");
  }
  if (item.resourcePolicy.allowUserPublishedDomains) {
    targets.push("Text");
  }
  if (targets.length === 0) {
    return "Text";
  }
  return targets.join(" / ");
}
