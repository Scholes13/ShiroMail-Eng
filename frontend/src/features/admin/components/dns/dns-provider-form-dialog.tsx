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
import { MultiOptionCombobox } from "@/components/ui/multi-option-combobox";
import { NoticeBanner } from "@/components/ui/notice-banner";
import { OptionCombobox } from "@/components/ui/option-combobox";
import { WorkspaceField } from "@/components/layout/workspace-ui";
import {
  type ProviderCredentials,
  canSubmitProviderCredentials,
  getProviderAuthModeMeta,
  getProviderCredentialFields,
  getProviderPermissionOptions,
  sanitizeProviderPermissions,
} from "./dns-page.utils";

type ProviderDraft = {
  provider: string;
  ownerType: string;
  displayName: string;
  authType: string;
  status: string;
  permissionValues: string[];
};

type DnsProviderFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  coreFieldsLocked: boolean;
  draft: ProviderDraft;
  onDraftChange: (updater: (current: ProviderDraft) => ProviderDraft) => void;
  credentials: ProviderCredentials;
  onCredentialsChange: (updater: (current: ProviderCredentials) => ProviderCredentials) => void;
  mutationError: string | null;
  onDismissError: () => void;
  isPending: boolean;
  onSubmit: () => void;
  onReset: () => void;
};

export function DnsProviderFormDialog({
  open,
  onOpenChange,
  isEditing,
  coreFieldsLocked,
  draft,
  onDraftChange,
  credentials,
  onCredentialsChange,
  mutationError,
  onDismissError,
  isPending,
  onSubmit,
  onReset,
}: DnsProviderFormDialogProps) {
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Text Provider Text" : "Text Provider Text"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? coreFieldsLocked
                ? "Text Provider TextDomain，Text、Text、Text，Text。"
                : "Text Provider TextDomain，Text、Text、Text。"
              : "Text DNS Text，Text。"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <WorkspaceField label="DNS Text">
                <OptionCombobox
                  ariaLabel="DNS Text"
                  emptyLabel="Text"
                  onValueChange={(value) => {
                    const nextProvider = value || "cloudflare";
                    onDraftChange((current) => ({
                      ...current,
                      provider: nextProvider,
                      authType: nextProvider === "spaceship" ? "api_key" : "api_token",
                      permissionValues: sanitizeProviderPermissions(
                        nextProvider,
                        current.permissionValues,
                      ),
                    }));
                    onCredentialsChange(() => ({
                      apiToken: "",
                      apiEmail: "",
                      apiKey: "",
                      apiSecret: "",
                    }));
                  }}
                  options={[
                    { value: "cloudflare", label: "Cloudflare" },
                    { value: "spaceship", label: "Spaceship" },
                  ]}
                  placeholder="Text"
                  searchPlaceholder="Text"
                  disabled={coreFieldsLocked}
                  value={draft.provider}
                />
              </WorkspaceField>
              <WorkspaceField label="Owner">
                <OptionCombobox
                  ariaLabel="Owner Type"
                  emptyLabel="Text Owner"
                  onValueChange={() => {}}
                  options={[
                    { value: "platform", label: "platform" },
                  ]}
                  placeholder="Text"
                  searchPlaceholder="Text"
                  disabled
                  value={draft.ownerType}
                />
              </WorkspaceField>

              <WorkspaceField label="Text">
                <Input
                  className="h-10"
                  onChange={(event) =>
                    onDraftChange((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  placeholder="Example: Cloudflare Text"
                  value={draft.displayName}
                />
              </WorkspaceField>

              <WorkspaceField label="Text">
                <OptionCombobox
                  ariaLabel="Provider Status"
                  emptyLabel="Text"
                  onValueChange={(value) =>
                    onDraftChange((current) => ({
                      ...current,
                      status: value || "healthy",
                    }))
                  }
                  options={[
                    { value: "healthy", label: "healthy" },
                    { value: "degraded", label: "degraded" },
                    { value: "pending", label: "pending" },
                  ]}
                  placeholder="Text"
                  searchPlaceholder="Text"
                  value={draft.status}
                />
              </WorkspaceField>

              <WorkspaceField label="Text">
                <OptionCombobox
                  ariaLabel="Provider Auth Type"
                  emptyLabel="Text"
                  onValueChange={(value) => {
                    onDraftChange((current) => ({
                      ...current,
                      authType:
                        value ||
                        (current.provider === "spaceship" ? "api_key" : "api_token"),
                    }));
                    onCredentialsChange(() => ({
                      apiToken: "",
                      apiEmail: "",
                      apiKey: "",
                      apiSecret: "",
                    }));
                  }}
                  options={
                    draft.provider === "spaceship"
                      ? [{ value: "api_key", label: "API Key + API Secret" }]
                      : [
                            { value: "api_token", label: "API Token" },
                            { value: "api_key", label: "Global API Key + Email" },
                          ]
                  }
                  placeholder="Text"
                  searchPlaceholder="Text"
                  disabled={coreFieldsLocked}
                  value={draft.authType}
                />
              </WorkspaceField>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="mb-3 space-y-1">
                <p className="text-sm font-medium">Text</p>
                <p className="text-sm text-muted-foreground">
                  Text，Text JSON Text Secret Ref。
                </p>
              </div>

              <div className="mb-4 rounded-xl border border-border/60 bg-background/70 px-4 py-3">
                <p className="text-sm font-medium">
                  {getProviderAuthModeMeta(draft.provider, draft.authType).title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getProviderAuthModeMeta(draft.provider, draft.authType).description}
                  {isEditing ? " Text。" : ""}
                </p>
              </div>

              <div className="grid gap-4">
                {getProviderCredentialFields(draft.provider, draft.authType).map((field) => (
                  <WorkspaceField key={field.key} label={field.label}>
                    <Input
                      aria-label={field.label}
                      className="h-10"
                      onChange={(event) =>
                        onCredentialsChange((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      type={field.type}
                      value={credentials[field.key]}
                    />
                  </WorkspaceField>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="mb-3 space-y-1">
                <p className="text-sm font-medium">Text</p>
                <p className="text-sm text-muted-foreground">
                  Text Provider Text，Text。
                </p>
              </div>

              <MultiOptionCombobox
                ariaLabel="Text"
                emptyLabel="Text"
                options={getProviderPermissionOptions(draft.provider)}
                placeholder="Text"
                searchPlaceholder="Text"
                values={draft.permissionValues}
                onValuesChange={(values) =>
                  onDraftChange((current) => ({
                    ...current,
                    permissionValues: sanitizeProviderPermissions(current.provider, values),
                  }))
                }
              />
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Text</p>
              <p className="mt-2 leading-7">
                Text，Text、Text Zone、Text
                Records Text。
              </p>
            </div>
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
            disabled={
              isPending ||
              draft.displayName.trim() === "" ||
              !canSubmitProviderCredentials(
                draft.provider,
                draft.authType,
                credentials,
                isEditing,
              )
            }
            onClick={onSubmit}
          >
            {isPending
              ? "Submitting..."
              : isEditing
                ? "Text Provider Text"
                : "Text Provider Text"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
