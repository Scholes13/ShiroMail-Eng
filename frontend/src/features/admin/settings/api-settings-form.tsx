import type { ReactNode } from "react";
import { WorkspaceField } from "@/components/layout/workspace-ui";
import { Checkbox } from "@/components/ui/checkbox";
import { BasicSelect } from "@/components/ui/basic-select";
import { Input } from "@/components/ui/input";
import type { APILimitsSettings } from "./types";

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

function NumberField({
  label,
  ariaLabel,
  value,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <WorkspaceField label={label}>
      <Input
        aria-label={ariaLabel}
        type="number"
        min={0}
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
    </WorkspaceField>
  );
}

function SettingsBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function APISettingsForm({
  value,
  onChange,
}: {
  value: APILimitsSettings;
  onChange: (next: APILimitsSettings) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Identity Bucket
          </div>
          <div className="mt-2 text-base font-semibold text-foreground">
            {value.identityMode === "ip" ? "All requests use IP buckets" : "Bearer tokens split authenticated traffic"}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Text IP Text；Text Bearer Token Text，Text IP Text。
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Hot Reload
          </div>
          <div className="mt-2 text-base font-semibold text-foreground">
            Save to MySQL and refresh automatically
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            TextRefreshText，TextsecText，Text `app` Text。
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Strict IP Guard
          </div>
          <div className="mt-2 text-base font-semibold text-foreground">
            {value.strictIpEnabled ? "Enabled" : "Disabled"}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Text IP Text IP Text，Text、Text。
          </p>
        </div>
      </div>

      <SettingsBlock
        title="Text"
        description="Text API Text，Text、Text。"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.anonymousRPM}
            onChange={(anonymousRPM) => onChange({ ...value, anonymousRPM })}
          />
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.authenticatedRPM}
            onChange={(authenticatedRPM) =>
              onChange({ ...value, authenticatedRPM })
            }
          />
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.authRPM}
            onChange={(authRPM) => onChange({ ...value, authRPM })}
          />
          <WorkspaceField label="Text">
            <BasicSelect
              aria-label="Text"
              value={value.identityMode}
              onChange={(event) =>
                onChange({ ...value, identityMode: event.target.value })
              }
            >
              <option value="bearer_or_ip">Bearer / IP Text</option>
              <option value="ip">Text IP</option>
            </BasicSelect>
          </WorkspaceField>
        </div>
      </SettingsBlock>

      <SettingsBlock
        title="Text"
        description="Text、Text、Text、Text、OAuth Text 2FA Text，Text。"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.loginRPM}
            onChange={(loginRPM) => onChange({ ...value, loginRPM })}
          />
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.registerRPM}
            onChange={(registerRPM) => onChange({ ...value, registerRPM })}
          />
          <NumberField
            label="Refresh RPM"
            ariaLabel="Refresh RPM"
            value={value.refreshRPM}
            onChange={(refreshRPM) => onChange({ ...value, refreshRPM })}
          />
          <NumberField
            label="2FA Verify RPM"
            ariaLabel="2FA Verify RPM"
            value={value.login2faVerifyRPM}
            onChange={(login2faVerifyRPM) =>
              onChange({ ...value, login2faVerifyRPM })
            }
          />
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.forgotPasswordRPM}
            onChange={(forgotPasswordRPM) =>
              onChange({ ...value, forgotPasswordRPM })
            }
          />
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.resetPasswordRPM}
            onChange={(resetPasswordRPM) =>
              onChange({ ...value, resetPasswordRPM })
            }
          />
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.emailVerificationResendRPM}
            onChange={(emailVerificationResendRPM) =>
              onChange({ ...value, emailVerificationResendRPM })
            }
          />
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.emailVerificationConfirmRPM}
            onChange={(emailVerificationConfirmRPM) =>
              onChange({ ...value, emailVerificationConfirmRPM })
            }
          />
          <NumberField
            label="OAuth Start RPM"
            ariaLabel="OAuth Start RPM"
            value={value.oauthStartRPM}
            onChange={(oauthStartRPM) => onChange({ ...value, oauthStartRPM })}
          />
          <NumberField
            label="OAuth Callback RPM"
            ariaLabel="OAuth Callback RPM"
            value={value.oauthCallbackRPM}
            onChange={(oauthCallbackRPM) =>
              onChange({ ...value, oauthCallbackRPM })
            }
          />
        </div>
      </SettingsBlock>

      <SettingsBlock
        title="Text"
        description="Text、Text、Text；Text IP Text。"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <NumberField
            label="Text RPM"
            ariaLabel="Text RPM"
            value={value.mailboxWriteRPM}
            onChange={(mailboxWriteRPM) =>
              onChange({ ...value, mailboxWriteRPM })
            }
          />
          <NumberField
            label="Text IP RPM"
            ariaLabel="Text IP RPM"
            value={value.strictIpRPM}
            onChange={(strictIpRPM) => onChange({ ...value, strictIpRPM })}
          />
          <div className="flex items-end">
            <CheckboxField
              label="Enable API Text"
              checked={value.enabled}
              onCheckedChange={(enabled) => onChange({ ...value, enabled })}
            />
          </div>
          <div className="flex items-end">
            <CheckboxField
              label="EnableText IP Text"
              checked={value.strictIpEnabled}
              onCheckedChange={(strictIpEnabled) =>
                onChange({ ...value, strictIpEnabled })
              }
            />
          </div>
        </div>
      </SettingsBlock>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
        Text MySQL Text；TextRefreshText，TextsecText，Text `app` Text。
      </div>
    </div>
  );
}
