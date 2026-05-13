import { Checkbox } from "@/components/ui/checkbox";
import type { DomainPolicySettings } from "./types";

function CheckboxField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <span>{label}</span>
    </label>
  );
}

export function DomainPolicyForm({
  value,
  onChange,
}: {
  value: DomainPolicySettings;
  onChange: (next: DomainPolicySettings) => void;
}) {
  return (
    <div className="grid gap-3">
      <CheckboxField
        label="Text"
        checked={value.requiresReview}
        onCheckedChange={(requiresReview) => onChange({ requiresReview })}
      />
      <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
        <p className="text-sm font-medium">Text</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Text、Text，TextDomainText。
        </p>
      </div>
    </div>
  );
}
