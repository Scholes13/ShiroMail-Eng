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
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceField,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import { NoticeBanner } from "@/components/ui/notice-banner";
import { validateIntegerRange, validateRequiredText } from "@/lib/validation";
import {
  createAdminDoc,
  deleteAdminDoc,
  fetchAdminDocs,
  updateAdminDoc,
} from "../api";
import type { DocArticle } from "../../user/api";

const DEFAULT_DOC_DRAFT = {
  title: "",
  category: "",
  summary: "",
  readTimeMin: 5,
  tagsText: "",
};

export function AdminDocsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(DEFAULT_DOC_DRAFT);
  const [editingDoc, setEditingDoc] = useState<(DocArticle & { tagsText: string }) | null>(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<DocArticle | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const docsQuery = useQuery({ queryKey: ["admin-docs"], queryFn: fetchAdminDocs });

  const refreshDocs = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    await queryClient.invalidateQueries({ queryKey: ["portal-docs"] });
  };

  const createMutation = useMutation({
    mutationFn: createAdminDoc,
    onSuccess: async () => {
      setFormError(null);
      setDraft(DEFAULT_DOC_DRAFT);
      await refreshDocs();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ docId, input }: { docId: string; input: Omit<DocArticle, "id" | "createdAt" | "updatedAt"> }) =>
      updateAdminDoc(docId, input),
    onSuccess: async () => {
      setFormError(null);
      setEditingDoc(null);
      await refreshDocs();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminDoc,
    onSuccess: async () => {
      setPendingDeleteDoc(null);
      await refreshDocs();
    },
  });

  const docs = useMemo(() => docsQuery.data ?? [], [docsQuery.data]);
  const canCreate = draft.title.trim() !== "" && draft.category.trim() !== "" && draft.summary.trim() !== "";

  function validateDocInput(input: { title: string; category: string; summary: string; readTimeMin: number }) {
    return (
      validateRequiredText("TextSubject", input.title, { minLength: 2, maxLength: 120 }) ||
      validateRequiredText("Text", input.category, { minLength: 2, maxLength: 40 }) ||
      validateRequiredText("Text", input.summary, { minLength: 10, maxLength: 2000 }) ||
      validateIntegerRange("Text", input.readTimeMin, { min: 1, max: 240 })
    );
  }

  function handleCreateDoc() {
    const error = validateDocInput(draft);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    createMutation.mutate({
      title: draft.title.trim(),
      category: draft.category.trim(),
      summary: draft.summary.trim(),
      readTimeMin: draft.readTimeMin,
      tags: splitTags(draft.tagsText),
    });
  }

  function handleUpdateDoc() {
    if (!editingDoc) {
      return;
    }
    const error = validateDocInput(editingDoc);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    updateMutation.mutate({
      docId: editingDoc.id,
      input: {
        title: editingDoc.title.trim(),
        category: editingDoc.category.trim(),
        summary: editingDoc.summary.trim(),
        readTimeMin: editingDoc.readTimeMin,
        tags: splitTags(editingDoc.tagsText),
      },
    });
  }

  const docCards = useMemo(
    () =>
      docs.map((doc) => (
        <Card className="border-border/60 bg-card/85 shadow-none" key={doc.id}>
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <WorkspaceBadge>{doc.category}</WorkspaceBadge>
                <span>{doc.readTimeMin} min</span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    setEditingDoc({
                      ...doc,
                      tagsText: (doc.tags ?? []).join(", "),
                    })
                  }
                  size="sm"
                  variant="outline"
                >
                  Text
                </Button>
                <Button onClick={() => setPendingDeleteDoc(doc)} size="sm" variant="destructive">
                  Text
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">{doc.title}</div>
              <p className="text-sm leading-6 text-muted-foreground">{doc.summary}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(doc.tags ?? []).map((tag) => (
                <WorkspaceBadge key={tag} variant="outline">
                  {tag}
                </WorkspaceBadge>
              ))}
            </div>
          </CardContent>
        </Card>
      )),
    [docs],
  );

  return (
    <WorkspacePage>
      <WorkspacePanel
        description="Text，Text。"
        title="Text"
      >
        <Card className="border-border/60 bg-muted/10 shadow-none">
          <CardContent className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <WorkspaceField label="TextSubject">
                <Input
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Example: Webhook Text"
                  value={draft.title}
                />
              </WorkspaceField>
              <WorkspaceField label="Text">
                <Input
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                  placeholder="Example: Text"
                  value={draft.category}
                />
              </WorkspaceField>
            </div>

            <div className="grid gap-4 md:grid-cols-[0.35fr_0.65fr]">
              <WorkspaceField label="Text（Text）">
                <Input
                  min="1"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      readTimeMin: Number(event.target.value) || 1,
                    }))
                  }
                  type="number"
                  value={draft.readTimeMin}
                />
              </WorkspaceField>
              <WorkspaceField label="Text">
                <Input
                  onChange={(event) => setDraft((current) => ({ ...current, tagsText: event.target.value }))}
                  placeholder="Text，Text API, Webhook, Text"
                  value={draft.tagsText}
                />
              </WorkspaceField>
            </div>

            <WorkspaceField label="Text">
              <Textarea
                onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Text，Text。"
                rows={5}
                value={draft.summary}
              />
            </WorkspaceField>

            <div className="flex justify-end">
              <Button disabled={!canCreate || createMutation.isPending} onClick={handleCreateDoc}>
                {createMutation.isPending ? "Text..." : "Text"}
              </Button>
            </div>
            {formError ? <NoticeBanner className="text-sm" onDismiss={() => setFormError(null)} variant="error">{formError}</NoticeBanner> : null}
          </CardContent>
        </Card>

        <Dialog
          onOpenChange={(open) => {
            if (!open) {
              setEditingDoc(null);
              setFormError(null);
            }
          }}
          open={editingDoc !== null}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Text</DialogTitle>
              <DialogDescription>Text。</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <WorkspaceField label="TextSubject">
                  <Input
                    onChange={(event) =>
                      setEditingDoc((current) =>
                        current ? { ...current, title: event.target.value } : current,
                      )
                    }
                    value={editingDoc?.title ?? ""}
                  />
                </WorkspaceField>
                <WorkspaceField label="Text">
                  <Input
                    onChange={(event) =>
                      setEditingDoc((current) =>
                        current ? { ...current, category: event.target.value } : current,
                      )
                    }
                    value={editingDoc?.category ?? ""}
                  />
                </WorkspaceField>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.35fr_0.65fr]">
                <WorkspaceField label="Text（Text）">
                  <Input
                    min="1"
                    onChange={(event) =>
                      setEditingDoc((current) =>
                        current
                          ? { ...current, readTimeMin: Number(event.target.value) || 1 }
                          : current,
                      )
                    }
                    type="number"
                    value={editingDoc?.readTimeMin ?? 1}
                  />
                </WorkspaceField>
                <WorkspaceField label="Text">
                  <Input
                    onChange={(event) =>
                      setEditingDoc((current) =>
                        current ? { ...current, tagsText: event.target.value } : current,
                      )
                    }
                    value={editingDoc?.tagsText ?? ""}
                  />
                </WorkspaceField>
              </div>

              <WorkspaceField label="Text">
                <Textarea
                  onChange={(event) =>
                    setEditingDoc((current) =>
                      current ? { ...current, summary: event.target.value } : current,
                    )
                  }
                  rows={6}
                  value={editingDoc?.summary ?? ""}
                />
              </WorkspaceField>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                disabled={!editingDoc || updateMutation.isPending}
                onClick={handleUpdateDoc}
              >
                {updateMutation.isPending ? "Text..." : "Text"}
              </Button>
            </DialogFooter>
            {formError ? <NoticeBanner className="text-sm" onDismiss={() => setFormError(null)} variant="error">{formError}</NoticeBanner> : null}
          </DialogContent>
        </Dialog>

        <AlertDialog
          onOpenChange={(open) => {
            if (!open) {
              setPendingDeleteDoc(null);
            }
          }}
          open={pendingDeleteDoc !== null}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Text</AlertDialogTitle>
              <AlertDialogDescription>
                Text。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-sm">
              <div className="font-medium">{pendingDeleteDoc?.title ?? "-"}</div>
              <div className="mt-1 text-muted-foreground">{pendingDeleteDoc?.category ?? "-"}</div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMutation.isPending}
                onClick={() => pendingDeleteDoc && deleteMutation.mutate(pendingDeleteDoc.id)}
              >
                {deleteMutation.isPending ? "Text..." : "Text"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {docs.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{docCards}</div>
        ) : (
          <WorkspaceEmpty description="Text。" title="Text" />
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
