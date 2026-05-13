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
import { OptionCombobox, type OptionComboboxOption } from "@/components/ui/option-combobox";
import { WorkspaceField } from "@/components/layout/workspace-ui";

type DomainDraft = {
  domain: string;
  status: string;
  visibility: string;
  publicationStatus: string;
  healthStatus: string;
  providerAccountId: string;
  isDefault: boolean;
  weight: number;
};

type DnsDomainFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  draft: DomainDraft;
  onDraftChange: (updater: (current: DomainDraft) => DomainDraft) => void;
  providerOptions: OptionComboboxOption[];
  mutationError: string | null;
  onDismissError: () => void;
  isPending: boolean;
  onSubmit: () => void;
  onReset: () => void;
};

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

export function DnsDomainFormDialog({
  open,
  onOpenChange,
  isEditing,
  draft,
  onDraftChange,
  providerOptions,
  mutationError,
  onDismissError,
  isPending,
  onSubmit,
  onReset,
}: DnsDomainFormDialogProps) {
  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (nextOpen) {
          onDismissError();
        } else {
          onReset();
        }
      }}
      open={open}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "TextDomain" : "TextDomain"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "TextDomainText、Text Provider Text；Text Provider。"
              : "TextDomainText，Text DNS Text。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <WorkspaceField label="Text">
            <Input
              className="h-12 rounded-xl text-base"
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  domain: event.target.value,
                }))
              }
              placeholder="example.com"
              value={draft.domain}
            />
          </WorkspaceField>
          <div className="grid gap-4 md:grid-cols-2">
            <WorkspaceField label="Text">
              <OptionCombobox
                ariaLabel="DomainText"
                emptyLabel="Text"
                onValueChange={(value) =>
                  onDraftChange((current) => ({ ...current, status: value }))
                }
                options={statusOptions}
                placeholder="Text"
                searchPlaceholder="Text"
                value={draft.status}
              />
            </WorkspaceField>

            <WorkspaceField label="Text">
              <OptionCombobox
                ariaLabel="DomainText"
                emptyLabel="Text"
                onValueChange={(value) =>
                  onDraftChange((current) => ({
                    ...current,
                    visibility: value || "private",
                  }))
                }
                options={visibilityOptions}
                placeholder="Text"
                searchPlaceholder="Text"
                value={draft.visibility}
              />
            </WorkspaceField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <WorkspaceField label="Text">
              <OptionCombobox
                ariaLabel="DomainText"
                emptyLabel="Text"
                onValueChange={(value) =>
                  onDraftChange((current) => ({
                    ...current,
                    publicationStatus: value || "draft",
                  }))
                }
                options={publicationOptions}
                placeholder="Text"
                searchPlaceholder="Text"
                value={draft.publicationStatus}
              />
            </WorkspaceField>

            <WorkspaceField label="DNS Text">
              <div className="space-y-2">
                <OptionCombobox
                  ariaLabel="DNS Text"
                  emptyLabel="Text Provider Text"
                  onValueChange={(value) =>
                    onDraftChange((current) => ({
                      ...current,
                      providerAccountId: value || "",
                    }))
                  }
                  options={providerOptions}
                  placeholder="Text"
                  searchPlaceholder="Text"
                  value={draft.providerAccountId || undefined}
                />
                {draft.providerAccountId ? (
                  <Button
                    className="h-9 px-3"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      onDraftChange((current) => ({
                        ...current,
                        providerAccountId: "",
                      }))
                    }
                  >
                    Text Provider Text
                  </Button>
                ) : null}
              </div>
            </WorkspaceField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <WorkspaceField label="Text">
              <OptionCombobox
                ariaLabel="DomainText"
                emptyLabel="Text"
                onValueChange={(value) =>
                  onDraftChange((current) => ({
                    ...current,
                    healthStatus: value || "unknown",
                  }))
                }
                options={[
                  { value: "healthy", label: "healthy" },
                  { value: "unknown", label: "unknown" },
                  { value: "degraded", label: "degraded" },
                ]}
                placeholder="Text"
                searchPlaceholder="Text"
                value={draft.healthStatus}
              />
            </WorkspaceField>

            <WorkspaceField label="Text">
              <Input
                className="h-9"
                min={0}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    weight: Number(event.target.value),
                  }))
                }
                type="number"
                value={draft.weight}
              />
            </WorkspaceField>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={draft.isDefault}
              id="admin-domain-default"
              onCheckedChange={(checked) =>
                onDraftChange((current) => ({
                  ...current,
                  isDefault: checked === true,
                }))
              }
            />
            <Label className="text-sm" htmlFor="admin-domain-default">
              Text
            </Label>
          </div>
        </div>

        <DialogFooter>
          {mutationError ? (
            <NoticeBanner autoHideMs={5000} className="mr-auto" onDismiss={onDismissError} variant="error">
              {mutationError}
            </NoticeBanner>
          ) : null}
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={isPending || draft.domain.trim() === ""}
            onClick={onSubmit}
          >
            {isPending ? "Submitting..." : isEditing ? "Text" : "Text"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
