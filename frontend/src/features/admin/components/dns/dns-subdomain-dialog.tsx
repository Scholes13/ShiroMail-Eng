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
import { NoticeBanner } from "@/components/ui/notice-banner";
import { OptionCombobox } from "@/components/ui/option-combobox";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceField } from "@/components/layout/workspace-ui";
import type { DomainOption } from "../../../user/api";

type DnsSubdomainDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootDomains: DomainOption[];
  selectedBaseDomainId: number | "";
  onSelectedBaseDomainIdChange: (value: number | "") => void;
  prefixInput: string;
  onPrefixInputChange: (value: string) => void;
  mutationError: string | null;
  onDismissError: () => void;
  isPending: boolean;
  onSubmit: () => void;
};

export function DnsSubdomainDialog({
  open,
  onOpenChange,
  rootDomains,
  selectedBaseDomainId,
  onSelectedBaseDomainIdChange,
  prefixInput,
  onPrefixInputChange,
  mutationError,
  onDismissError,
  isPending,
  onSubmit,
}: DnsSubdomainDialogProps) {
  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (nextOpen) {
          onDismissError();
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>TextDomain</DialogTitle>
          <DialogDescription>
            Text，Text MX、relay、edge Text。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <WorkspaceField label="TextDomain">
            <OptionCombobox
              ariaLabel="TextDomain"
              emptyLabel="TextDomain"
              onValueChange={(value) =>
                onSelectedBaseDomainIdChange(value ? Number(value) : "")
              }
              options={rootDomains.map((item) => ({
                value: String(item.id),
                label: item.domain,
                keywords: [item.rootDomain],
              }))}
              placeholder="TextDomain"
              searchPlaceholder="TextDomain"
              value={
                selectedBaseDomainId === ""
                  ? undefined
                  : String(selectedBaseDomainId)
              }
            />
          </WorkspaceField>

          <WorkspaceField label="Text">
            <Textarea
              onChange={(event) => onPrefixInputChange(event.target.value)}
              placeholder={"Text，Example: \nmx\nmx.edge\nrelay.cn.hk"}
              rows={6}
              value={prefixInput}
            />
          </WorkspaceField>
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
            disabled={selectedBaseDomainId === "" || isPending}
            onClick={onSubmit}
          >
            {isPending ? "Submitting..." : "TextDomain"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
