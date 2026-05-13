import { useMemo, useState } from "react";
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
import { OptionCombobox } from "@/components/ui/option-combobox";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceField,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import {
  createAdminNotice,
  deleteAdminNotice,
  fetchAdminNotices,
  updateAdminNotice,
} from "../api";
import type { NoticeItem } from "../../user/api";
import { formatDateTime } from "../../user/pages/shared";

const DEFAULT_NOTICE_DRAFT = {
  title: "",
  body: "",
  category: "platform",
  level: "info",
};

export function AdminNoticesPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(DEFAULT_NOTICE_DRAFT);
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
  const [pendingDeleteNotice, setPendingDeleteNotice] = useState<NoticeItem | null>(null);

  const noticesQuery = useQuery({ queryKey: ["admin-notices"], queryFn: fetchAdminNotices });
  const categoryOptions = useMemo(
    () => [
      { value: "platform", label: "platform", keywords: ["system", "platform"] },
      { value: "release", label: "release", keywords: ["publish", "release"] },
      { value: "maintenance", label: "maintenance", keywords: ["ops", "maintenance"] },
    ],
    [],
  );
  const levelOptions = useMemo(
    () => [
      { value: "info", label: "info" },
      { value: "warning", label: "warning" },
    ],
    [],
  );

  const refreshNotices = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-notices"] });
  };

  const createMutation = useMutation({
    mutationFn: createAdminNotice,
    onSuccess: async () => {
      setDraft(DEFAULT_NOTICE_DRAFT);
      await refreshNotices();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ noticeId, input }: { noticeId: number; input: typeof DEFAULT_NOTICE_DRAFT }) =>
      updateAdminNotice(noticeId, input),
    onSuccess: async () => {
      setEditingNotice(null);
      await refreshNotices();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminNotice,
    onSuccess: async () => {
      setPendingDeleteNotice(null);
      await refreshNotices();
    },
  });

  return (
    <WorkspacePage>
      <WorkspacePanel description="Text、TextNoticesText。" title="NoticesText">
        <Card className="border-border/60 bg-muted/10 shadow-none">
          <CardContent className="space-y-4 py-4">
            <WorkspaceField label="NoticesSubject">
              <Input
                className="h-9"
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="NoticesSubject"
                value={draft.title}
              />
            </WorkspaceField>

            <div className="grid gap-4 md:grid-cols-2">
              <WorkspaceField label="Text">
                <OptionCombobox
                  ariaLabel="NoticesText"
                  emptyLabel="Text"
                  value={draft.category}
                  onValueChange={(value) => setDraft((current) => ({ ...current, category: value }))}
                  options={categoryOptions}
                  placeholder="Text"
                  searchPlaceholder="Text"
                />
              </WorkspaceField>

              <WorkspaceField label="Text">
                <OptionCombobox
                  ariaLabel="NoticesText"
                  emptyLabel="Text"
                  value={draft.level}
                  onValueChange={(value) => setDraft((current) => ({ ...current, level: value }))}
                  options={levelOptions}
                  placeholder="Text"
                  searchPlaceholder="Text"
                />
              </WorkspaceField>
            </div>

            <WorkspaceField label="NoticesBody">
              <Textarea
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                placeholder="NoticesBody"
                rows={5}
                value={draft.body}
              />
            </WorkspaceField>

            <div className="flex justify-end">
              <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate(draft)}>
                {createMutation.isPending ? "Text..." : "TextNotices"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog onOpenChange={(open) => !open && setEditingNotice(null)} open={editingNotice !== null}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>TextNotices</DialogTitle>
              <DialogDescription>TextSubject、Text、TextBody，Text。</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <WorkspaceField label="NoticesSubject">
                <Input
                  onChange={(event) =>
                    setEditingNotice((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                  placeholder="NoticesSubject"
                  value={editingNotice?.title ?? ""}
                />
              </WorkspaceField>

              <div className="grid gap-4 md:grid-cols-2">
                <WorkspaceField label="Text">
                  <OptionCombobox
                    ariaLabel="TextNoticesText"
                    emptyLabel="Text"
                    onValueChange={(value) =>
                      setEditingNotice((current) =>
                        current ? { ...current, category: value } : current,
                      )
                    }
                    options={categoryOptions}
                    placeholder="Text"
                    searchPlaceholder="Text"
                    value={editingNotice?.category ?? "platform"}
                  />
                </WorkspaceField>

                <WorkspaceField label="Text">
                  <OptionCombobox
                    ariaLabel="TextNoticesText"
                    emptyLabel="Text"
                    onValueChange={(value) =>
                      setEditingNotice((current) =>
                        current ? { ...current, level: value } : current,
                      )
                    }
                    options={levelOptions}
                    placeholder="Text"
                    searchPlaceholder="Text"
                    value={editingNotice?.level ?? "info"}
                  />
                </WorkspaceField>
              </div>

              <WorkspaceField label="NoticesBody">
                <Textarea
                  onChange={(event) =>
                    setEditingNotice((current) =>
                      current ? { ...current, body: event.target.value } : current,
                    )
                  }
                  placeholder="NoticesBody"
                  rows={6}
                  value={editingNotice?.body ?? ""}
                />
              </WorkspaceField>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                disabled={!editingNotice || updateMutation.isPending}
                onClick={() => {
                  if (!editingNotice) {
                    return;
                  }
                  updateMutation.mutate({
                    noticeId: editingNotice.id,
                    input: {
                      title: editingNotice.title,
                      body: editingNotice.body,
                      category: editingNotice.category,
                      level: editingNotice.level,
                    },
                  });
                }}
              >
                {updateMutation.isPending ? "Text..." : "Text"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          onOpenChange={(open) => {
            if (!open) {
              setPendingDeleteNotice(null);
            }
          }}
          open={pendingDeleteNotice !== null}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>TextNotices</AlertDialogTitle>
              <AlertDialogDescription>
                TextNotices，Text。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-sm">
              <div className="font-medium">{pendingDeleteNotice?.title ?? "-"}</div>
              <div className="mt-1 text-muted-foreground">{pendingDeleteNotice?.category ?? "-"}</div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMutation.isPending}
                onClick={() => pendingDeleteNotice && deleteMutation.mutate(pendingDeleteNotice.id)}
              >
                {deleteMutation.isPending ? "Text..." : "Text"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="space-y-3">
          {(noticesQuery.data ?? []).map((item) => (
            <Card className="border-border/60 bg-card/92 shadow-none" key={item.id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/60 px-2 py-1">{item.category}</span>
                    <span className="rounded-full border border-border/60 px-2 py-1">{item.level}</span>
                    <span>{formatDateTime(item.publishedAt)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setEditingNotice(item)} size="sm" variant="outline">
                      Text
                    </Button>
                    <Button onClick={() => setPendingDeleteNotice(item)} size="sm" variant="destructive">
                      Text
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">{item.title}</div>
                  <p className="text-xs leading-6 text-muted-foreground">{item.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
