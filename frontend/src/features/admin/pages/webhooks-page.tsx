import { useState } from "react";
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
import { Button } from "@/components/ui/button";
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
import { getAPIErrorMessage } from "@/lib/http";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceField,
  WorkspaceListRow,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import {
  createAdminWebhook,
  fetchAdminWebhooks,
  toggleAdminWebhook,
  updateAdminWebhook,
} from "../api";
import { formatDateTime } from "../../user/pages/shared";

const DEFAULT_EVENTS = ["message.received", "mailbox.released"];

export function AdminWebhooksPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingDisableItem, setPendingDisableItem] = useState<
    Awaited<ReturnType<typeof fetchAdminWebhooks>>[number] | null
  >(null);
  const [draft, setDraft] = useState({
    userId: "",
    name: "",
    targetUrl: "",
    events: DEFAULT_EVENTS.join(", "),
  });

  const webhooksQuery = useQuery({
    queryKey: ["admin-webhooks"],
    queryFn: fetchAdminWebhooks,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: draft.name || "Default webhook",
        targetUrl: draft.targetUrl || "https://sandbox.local/webhooks/default",
        events: draft.events
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      if (editingId) {
        return updateAdminWebhook(editingId, payload);
      }
      return createAdminWebhook({
        userId: Number(draft.userId),
        ...payload,
      });
    },
    onSuccess: async () => {
      setMutationError(null);
      setActionNotice(editingId ? "Webhook Text。" : "Webhook Text。");
      setDraft({
        userId: "",
        name: "",
        targetUrl: "",
        events: DEFAULT_EVENTS.join(", "),
      });
      setEditingId(null);
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      setMutationError(
        getAPIErrorMessage(
          error,
          editingId
            ? "Text Webhook Text，Text、Text。"
            : "Text Webhook Text，Text、Text。",
        ),
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      toggleAdminWebhook(id, enabled),
    onSuccess: async () => {
      setActionNotice("Webhook Text。");
      await queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      setMutationError(getAPIErrorMessage(error, "Text Webhook Text，Text。"));
    },
  });

  const canSubmit = draft.userId.trim() !== "";

  function startCreate() {
    setMutationError(null);
    setActionNotice(null);
    setEditingId(null);
    setDraft({
      userId: "",
      name: "",
      targetUrl: "",
      events: DEFAULT_EVENTS.join(", "),
    });
    setDialogOpen(true);
  }

  function startEdit(item: {
    id: number;
    userId: number;
    name: string;
    targetUrl: string;
    events: string[];
  }) {
    setMutationError(null);
    setActionNotice(null);
    setEditingId(item.id);
    setDraft({
      userId: String(item.userId),
      name: item.name,
      targetUrl: item.targetUrl,
      events: item.events.join(", "),
    });
    setDialogOpen(true);
  }

  return (
    <WorkspacePage>
      <AlertDialog
        open={pendingDisableItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDisableItem(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Webhook？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDisableItem
                ? `TextDisable Webhook ${pendingDisableItem.name}？DisableText user #${pendingDisableItem.userId} Text and  ${pendingDisableItem.targetUrl}。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDisableItem) {
                  return;
                }
                toggleMutation.mutate({ id: pendingDisableItem.id, enabled: false });
                setPendingDisableItem(null);
              }}
            >
              TextDisable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <WorkspacePanel
        action={<Button onClick={startCreate}>Text Webhook</Button>}
        description="Text webhook Text、Text。"
        title="Webhook"
      >
        {actionNotice ? (
          <NoticeBanner autoHideMs={5000} className="mb-4" onDismiss={() => setActionNotice(null)} variant="success">
            {actionNotice}
          </NoticeBanner>
        ) : null}
        <Dialog
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (open) {
              setMutationError(null);
            }
          }}
          open={isDialogOpen}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Text Webhook" : "Text Webhook"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Text，Text and Text。"
                  : "TextCallback URL，Text and Text。"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 xl:grid-cols-2">
              <WorkspaceField label="Text ID">
                <Input
                  disabled={editingId !== null}
                  min="1"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, userId: event.target.value }))
                  }
                  placeholder="Text ID"
                  type="number"
                  value={draft.userId}
                />
              </WorkspaceField>
              <WorkspaceField label="Webhook Text">
                <Input
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Webhook Text"
                  value={draft.name}
                />
              </WorkspaceField>
              <WorkspaceField label="Callback URL">
                <Input
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, targetUrl: event.target.value }))
                  }
                  placeholder="https://sandbox.local/webhooks/order"
                  value={draft.targetUrl}
                />
              </WorkspaceField>
              <WorkspaceField label="Text">
                <Input
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, events: event.target.value }))
                  }
                  placeholder="message.received, mailbox.released"
                  value={draft.events}
                />
              </WorkspaceField>
            </div>

            <DialogFooter>
              {mutationError ? (
                <NoticeBanner autoHideMs={5000} className="mr-auto" onDismiss={() => setMutationError(null)} variant="error">
                  {mutationError}
                </NoticeBanner>
              ) : null}
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                disabled={
                  createMutation.isPending || (editingId === null && !canSubmit)
                }
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending
                  ? editingId
                    ? "Text..."
                    : "Text..."
                  : editingId
                    ? "Text"
                    : "Text Webhook"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {webhooksQuery.data?.length ? (
          <div className="space-y-3">
            {webhooksQuery.data.map((item) => (
              <WorkspaceListRow
                description={
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">{item.targetUrl}</div>
                    <div className="flex flex-wrap gap-1.5 text-[0.8rem] text-muted-foreground">
                      <span>user #{item.userId}</span>
                      {item.events.map((event) => (
                        <WorkspaceBadge key={event} variant="outline">
                          {event}
                        </WorkspaceBadge>
                      ))}
                    </div>
                  </div>
                }
                key={item.id}
                meta={
                  <>
                    <WorkspaceBadge>{item.enabled ? "enabled" : "disabled"}</WorkspaceBadge>
                    <span>{formatDateTime(item.updatedAt)}</span>
                    <Button onClick={() => startEdit(item)} size="sm" variant="secondary">
                      Text
                    </Button>
                    <Button
                      onClick={() => {
                        if (item.enabled) {
                          setPendingDisableItem(item);
                          return;
                        }
                        toggleMutation.mutate({ id: item.id, enabled: true });
                      }}
                      size="sm"
                      variant="outline"
                    >
                      {item.enabled ? "Disable" : "Enable"}
                    </Button>
                  </>
                }
                title={item.name}
              />
            ))}
          </div>
        ) : (
          <WorkspaceEmpty
            description="Text Webhook Text，Text、Text。"
            title="Text Webhook"
          />
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}
