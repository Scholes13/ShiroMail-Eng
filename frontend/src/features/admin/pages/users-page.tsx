import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth-store";
import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WorkspaceEmpty,
  WorkspaceField,
  WorkspaceListRow,
  WorkspaceMetric,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import { getAPIErrorMessage } from "@/lib/http";
import { paginateItems } from "@/lib/pagination";
import {
  batchAdminUserAction,
  deleteAdminUser,
  fetchAdminUsers,
  getExportUsersURL,
  updateAdminUser,
  type AdminUser,
} from "../api";

const ROLE_OPTIONS = ["user", "admin"] as const;
const STATUS_OPTIONS = [
  { value: "active", label: "Text" },
  { value: "pending_verification", label: "Text" },
  { value: "disabled", label: "Disable" },
] as const;

const ADMIN_USERS_PAGE_SIZE = 10;

type UserEditForm = {
  username: string;
  email: string;
  status: string;
  emailVerified: boolean;
  roles: string[];
  newPassword: string;
};

function buildEditForm(user: AdminUser): UserEditForm {
  return {
    username: user.username,
    email: user.email,
    status: user.status || "active",
    emailVerified: user.emailVerified,
    roles: [...user.roles].sort(),
    newPassword: "",
  };
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?.userId ?? null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { confirm, ConfirmDialog } = useConfirm();
  const [formState, setFormState] = useState<UserEditForm>({
    username: "",
    email: "",
    status: "active",
    emailVerified: false,
    roles: [],
    newPassword: "",
  });

  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });
  const users = usersQuery.data ?? [];
  const adminCount = users.filter((user) => user.roles.includes("admin")).length;
  const mailboxCount = users.reduce((sum, user) => sum + user.mailboxes, 0);
  const paginatedUsers = useMemo(
    () => paginateItems(users, usersPage, ADMIN_USERS_PAGE_SIZE),
    [users, usersPage],
  );

  // Batch selection helpers
  const pageUserIds = paginatedUsers.items.map((u) => u.id);
  const selectablePageIds = pageUserIds.filter((id) => id !== currentUserId);
  const allPageSelected = selectablePageIds.length > 0 && selectablePageIds.every((id) => selectedIds.has(id));
  const somePageSelected = selectablePageIds.some((id) => selectedIds.has(id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of selectablePageIds) next.delete(id);
      } else {
        for (const id of selectablePageIds) next.add(id);
      }
      return next;
    });
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, input }: { userId: number; input: UserEditForm }) =>
      updateAdminUser(userId, {
        username: input.username.trim(),
        email: input.email.trim(),
        status: input.status,
        emailVerified: input.emailVerified,
        roles: [...input.roles].sort(),
        newPassword: input.newPassword.trim() || undefined,
      }),
    onSuccess: async () => {
      setFeedback("Text。");
      setDialogOpen(false);
      setSelectedUser(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      setFeedback(getAPIErrorMessage(error, "Text，Text。"));
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => deleteAdminUser(userId),
    onSuccess: async (_result, userId) => {
      setFeedback("Text。");
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(userId); return next; });
      queryClient.setQueryData<AdminUser[]>(["admin-users"], (current) =>
        (current ?? []).filter((user) => user.id !== userId),
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      setFeedback(getAPIErrorMessage(error, "Text，Text、DomainText。"));
    },
  });

  const batchMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: "ban" | "unban" | "delete" }) =>
      batchAdminUserAction(ids, action),
    onSuccess: async (result) => {
      const successCount = result.succeeded.length;
      const failCount = result.failed.length;
      if (failCount === 0) {
        setFeedback(`Text，${successCount} Text。`);
      } else {
        const reasons = result.failed.slice(0, 3).map((f) => f.message).join("; ");
        setFeedback(`${successCount} Text，${failCount} Text: ${reasons}`);
      }
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      setFeedback(getAPIErrorMessage(error, "Text，Text。"));
    },
  });

  async function handleBatchAction(action: "ban" | "unban" | "delete") {
    const ids = [...selectedIds];
    const labels: Record<string, string> = { ban: "Text", unban: "Text", delete: "Text" };
    const confirmed = await confirm({
      title: `Text${labels[action]} ${ids.length} Text？`,
      description: action === "delete"
        ? "Text，Text。"
        : `Text ${ids.length} Text${labels[action]}Text。`,
      confirmLabel: `Text${labels[action]}`,
      cancelLabel: "Cancel",
      variant: action === "delete" ? "danger" : "default",
    });
    if (confirmed) {
      setFeedback(null);
      batchMutation.mutate({ ids, action });
    }
  }

  function openEditDialog(user: AdminUser) {
    setSelectedUser(user);
    setFormState(buildEditForm(user));
    setDialogOpen(true);
  }

  const selectedUserIsCurrent = selectedUser?.id === currentUserId;

  return (
    <WorkspacePage>
      <WorkspacePanel
        action={
          <Button
            onClick={() => {
              const token = useAuthStore.getState().accessToken;
              const url = `${getExportUsersURL()}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
              window.open(url, "_blank");
            }}
            size="sm"
            variant="outline"
          >
            Text CSV
          </Button>
        }
        description="Text、Text，Text。"
        title="Text"
      >
        {feedback ? (
          <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-sm">{feedback}</div>
        ) : null}
        <Dialog
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedUser(null);
            }
          }}
          open={isDialogOpen}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Text</DialogTitle>
              <DialogDescription>Text、Text；Text。</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <WorkspaceField label="Text">
                  <Input
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, username: event.target.value }))
                    }
                    value={formState.username}
                  />
                </WorkspaceField>
                <WorkspaceField label="Text">
                  <Input
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, email: event.target.value }))
                    }
                    value={formState.email}
                  />
                </WorkspaceField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <WorkspaceField label="Text">
                  <div className="grid gap-2 rounded-xl border border-border/60 bg-card px-4 py-4">
                    {STATUS_OPTIONS.map((item) => {
                      const statusId = `admin-user-status-${item.value}`;
                      return (
                        <label className="flex items-center gap-2 text-sm" htmlFor={statusId} key={item.value}>
                          <input
                            checked={formState.status === item.value}
                            className="size-4"
                            id={statusId}
                            name="admin-user-status"
                            onChange={() =>
                              setFormState((current) => ({ ...current, status: item.value }))
                            }
                            type="radio"
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </WorkspaceField>

                <WorkspaceField label="Text">
                  <div className="space-y-3 rounded-xl border border-border/60 bg-card px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={formState.emailVerified}
                        id="admin-user-email-verified"
                        onCheckedChange={(checked) =>
                          setFormState((current) => ({
                            ...current,
                            emailVerified: checked === true,
                          }))
                        }
                      />
                      <Label htmlFor="admin-user-email-verified">Text</Label>
                    </div>
                    <Input
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, newPassword: event.target.value }))
                      }
                      placeholder="Text"
                      type="password"
                      value={formState.newPassword}
                    />
                  </div>
                </WorkspaceField>
              </div>

              <WorkspaceField label="Text">
                <div className="grid gap-3 rounded-xl border border-border/60 bg-card px-4 py-4">
                  {ROLE_OPTIONS.map((role) => {
                    const checkboxId = `admin-user-role-${role}`;
                    return (
                      <div className="flex items-center gap-2" key={role}>
                        <Checkbox
                          aria-label={role}
                          checked={formState.roles.includes(role)}
                          disabled={selectedUserIsCurrent && role === "admin"}
                          id={checkboxId}
                          onCheckedChange={(checked) =>
                            setFormState((current) => ({
                              ...current,
                              roles:
                                checked === true
                                  ? [...new Set([...current.roles, role])].sort()
                                  : current.roles.filter((item) => item !== role),
                            }))
                          }
                        />
                        <Label className="text-sm" htmlFor={checkboxId}>
                          {role}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </WorkspaceField>
            </div>

            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)} variant="outline">
                Cancel
              </Button>
              <Button
                disabled={!selectedUser || formState.roles.length === 0 || updateUserMutation.isPending}
                onClick={() => {
                  setFeedback(null);
                  selectedUser &&
                    updateUserMutation.mutate({
                      userId: selectedUser.id,
                      input: formState,
                    });
                }}
              >
                {updateUserMutation.isPending ? "Text..." : "Text"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {ConfirmDialog}

        <div className="grid gap-4 md:grid-cols-3">
          <WorkspaceMetric hint="Text" label="Text" value={users.length} />
          <WorkspaceMetric hint="Text admin Text" label="Text" value={adminCount} />
          <WorkspaceMetric hint="Text" label="Text" value={mailboxCount} />
        </div>

        {users.length ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <Checkbox
                aria-label="Text"
                checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">
                {selectedIds.size > 0 ? `Text ${selectedIds.size} Text` : "Text"}
              </span>
            </div>
            {paginatedUsers.items.map((user) => {
              const isCurrentUser = user.id === currentUserId;
              return (
                <div className="flex items-start gap-3" key={user.id}>
                  <div className="pt-4">
                    <Checkbox
                      aria-label={`Text ${user.username}`}
                      checked={selectedIds.has(user.id)}
                      disabled={isCurrentUser}
                      onCheckedChange={() => toggleSelect(user.id)}
                    />
                  </div>
                  <div className="flex-1">
                    <WorkspaceListRow
                      description={`${user.email} · ${user.status}${user.emailVerified ? " · Text" : " · Text"}`}
                      meta={
                        <>
                          <span className="rounded-full border border-border/60 px-2 py-1">{user.roles.join(", ")}</span>
                          <span>{user.mailboxes} Text</span>
                          <Button onClick={() => navigate(`/admin/users/${user.id}`)} size="sm" variant="ghost">
                            Text
                          </Button>
                          <Button onClick={() => openEditDialog(user)} size="sm" variant="outline">
                            Text
                          </Button>
                          <Button
                            disabled={isCurrentUser}
                            onClick={async () => {
                              const confirmed = await confirm({
                                title: "Text？",
                                description: `Text ${user.username}？Text、DomainText，Text。`,
                                confirmLabel: "Text",
                                cancelLabel: "Cancel",
                                variant: "danger",
                              });
                              if (confirmed) {
                                setFeedback(null);
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                            size="sm"
                            variant="destructive"
                          >
                            Text
                          </Button>
                        </>
                      }
                      title={user.username}
                    />
                  </div>
                </div>
              );
            })}
            <PaginationControls
              itemLabel="Text"
              onPageChange={setUsersPage}
              page={paginatedUsers.page}
              pageSize={ADMIN_USERS_PAGE_SIZE}
              total={paginatedUsers.total}
              totalPages={paginatedUsers.totalPages}
            />
          </div>
        ) : (
          <WorkspaceEmpty description="Text。" title="Text" />
        )}

        {selectedIds.size > 0 && (
          <div className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-3 rounded-xl border border-border/60 bg-card px-5 py-3 shadow-lg">
            <span className="text-sm font-medium">Text {selectedIds.size} Text</span>
            <Button
              disabled={batchMutation.isPending}
              onClick={() => handleBatchAction("ban")}
              size="sm"
              variant="outline"
            >
              Text
            </Button>
            <Button
              disabled={batchMutation.isPending}
              onClick={() => handleBatchAction("unban")}
              size="sm"
              variant="outline"
            >
              Text
            </Button>
            <Button
              disabled={batchMutation.isPending}
              onClick={() => handleBatchAction("delete")}
              size="sm"
              variant="destructive"
            >
              Text
            </Button>
            <Button
              onClick={() => setSelectedIds(new Set())}
              size="sm"
              variant="ghost"
            >
              CancelText
            </Button>
          </div>
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}
