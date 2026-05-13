import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionCombobox } from "@/components/ui/option-combobox";
import { WorkspaceField } from "@/components/layout/workspace-ui";
import { MailPlus } from "lucide-react";
import { mailboxLocalPartSchema } from "@/lib/schemas";
import type { DomainOption } from "../api";

const ttlOptions = [
  { label: "Permanent", value: "permanent", keywords: ["permanent", "forever", "Permanent", "Text"] },
  { label: "24 hours", value: "24", keywords: ["1 day", "24"] },
  { label: "72 hours", value: "72", keywords: ["3 days", "72"] },
  { label: "168 hours", value: "168", keywords: ["7 days", "168"] },
];

const retentionOptions = [
  { label: "PermanentText", value: "0", keywords: ["forever", "keep", "Permanent"] },
  { label: "7 Text", value: "7", keywords: ["7 days", "Text"] },
  { label: "14 Text", value: "14", keywords: ["14 days", "Text"] },
  { label: "30 Text", value: "30", keywords: ["30 days", "Text"] },
  { label: "60 Text", value: "60", keywords: ["60 days", "Text"] },
  { label: "90 Text", value: "90", keywords: ["90 days", "Text"] },
];

type Props = {
  domains: DomainOption[];
  effectiveDomainId: string;
  onDomainIdChange: (value: string) => void;
  ttlHours: number;
  onTtlHoursChange: (value: number) => void;
  permanent: boolean;
  onPermanentChange: (value: boolean) => void;
  localPart: string;
  onLocalPartChange: (value: string) => void;
  retentionDays: number;
  onRetentionDaysChange: (value: number) => void;
  feedback: string | null;
  isPending: boolean;
  onSubmit: () => void;
};

export function MailboxCreateForm({
  domains,
  effectiveDomainId,
  onDomainIdChange,
  ttlHours,
  onTtlHoursChange,
  permanent,
  onPermanentChange,
  localPart,
  onLocalPartChange,
  retentionDays,
  onRetentionDaysChange,
  feedback,
  isPending,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const [localPartError, setLocalPartError] = useState<string | null>(null);

  function handleLocalPartChange(value: string) {
    onLocalPartChange(value);
    if (value.trim()) {
      const result = mailboxLocalPartSchema.safeParse(value.trim().toLowerCase());
      setLocalPartError(result.success ? null : result.error.issues[0]?.message ?? null);
    } else {
      setLocalPartError(null);
    }
  }

  function handleSubmit() {
    if (localPart.trim()) {
      const result = mailboxLocalPartSchema.safeParse(localPart.trim().toLowerCase());
      if (!result.success) {
        setLocalPartError(result.error.issues[0]?.message ?? t("validation.required"));
        return;
      }
    }
    onSubmit();
  }

  return (
    <Card className="border-border/60 bg-muted/10 shadow-none">
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MailPlus className="size-4" />
          <span>Text</span>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto]">
          <WorkspaceField label="Domain">
            <OptionCombobox
              ariaLabel="TextDomain"
              emptyLabel="TextDomain"
              onValueChange={onDomainIdChange}
              options={domains.map((domain) => ({
                value: String(domain.id),
                label: domain.domain,
                keywords: [domain.rootDomain, domain.kind],
              }))}
              placeholder="TextDomain"
              searchPlaceholder="TextDomain"
              value={effectiveDomainId}
            />
          </WorkspaceField>

          <WorkspaceField label="TTL">
            <OptionCombobox
              ariaLabel="TextTTL"
              emptyLabel="TextTTL"
              onValueChange={(value) => {
                if (value === "permanent") {
                  onPermanentChange(true);
                } else {
                  onPermanentChange(false);
                  onTtlHoursChange(Number(value));
                }
              }}
              options={ttlOptions}
              placeholder="TextTTL"
              searchPlaceholder="TextTTL"
              value={permanent ? "permanent" : String(ttlHours)}
            />
          </WorkspaceField>

          <WorkspaceField label="Text">
            <OptionCombobox
              ariaLabel="Text"
              emptyLabel="Text"
              onValueChange={(value) => onRetentionDaysChange(Number(value))}
              options={retentionOptions}
              placeholder="Text"
              searchPlaceholder="Text"
              value={String(retentionDays)}
            />
          </WorkspaceField>

          <div className="flex items-end">
            <Button
              className="w-full md:w-auto"
              disabled={effectiveDomainId === "" || isPending}
              onClick={handleSubmit}
            >
              <MailPlus className="size-4" />
              {isPending ? "Text..." : "Text"}
            </Button>
          </div>
        </div>

        <WorkspaceField label="Text">
          <Input
            onChange={(event) => handleLocalPartChange(event.target.value)}
            placeholder="Text"
            value={localPart}
          />
          {localPartError ? <p className="text-xs text-destructive">{localPartError}</p> : null}
        </WorkspaceField>

        {feedback ? <div className="text-xs text-muted-foreground">{feedback}</div> : null}
      </CardContent>
    </Card>
  );
}
