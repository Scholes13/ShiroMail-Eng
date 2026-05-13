import { useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { BasicSelect } from "@/components/ui/basic-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NoticeBanner } from "@/components/ui/notice-banner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceField } from "@/components/layout/workspace-ui";
import { validateRequiredText } from "@/lib/validation";
import {
  defaultOAuthProviderSettings,
  getOAuthCallbackURL,
  oauthProviderPresets,
} from "./defaults";
import type {
  AuthPasswordSettings,
  AuthRegistrationSettings,
  AuthSessionSettings,
  OAuthDisplaySettings,
  OAuthProviderPreset,
  OAuthProviderSettings,
} from "./types";

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

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getProviderStatusMeta(value: OAuthProviderSettings) {
  const hasClientCredentials =
    value.clientId.trim().length > 0 && value.clientSecret.trim().length > 0;
  return {
    connectionLabel: value.enabled && hasClientCredentials ? "Text" : "Text",
    connectionTone:
      value.enabled && hasClientCredentials
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
        : "border-border/60 bg-muted/40 text-muted-foreground",
    credentialLabel: hasClientCredentials ? "Text" : "Text",
    scopeLabel: `${value.scopes.length} Text Scope`,
  };
}

function ProviderForm({
  value,
  onChange,
  onDelete,
  callbackOrigin,
}: {
  value: OAuthProviderSettings;
  onChange: (next: OAuthProviderSettings) => void;
  onDelete: () => void;
  callbackOrigin: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const callbackUrl = value.redirectUrl || getOAuthCallbackURL(value.slug, callbackOrigin);
  const statusMeta = getProviderStatusMeta(value);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyState("failed");
      return;
    }
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{value.displayName || value.slug}</p>
          <p className="text-xs text-muted-foreground">Slug: {value.slug}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${statusMeta.connectionTone}`}>
              {statusMeta.connectionLabel}
            </span>
            <span className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
              {statusMeta.credentialLabel}
            </span>
            <span className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
              {statusMeta.scopeLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckboxField
            label="Enable"
            checked={value.enabled}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          />
          <Button size="sm" variant="outline" onClick={onDelete}>
            <Trash2 className="size-4" />
            Text
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <WorkspaceField label="Text">
          <Input
            aria-label={`${value.slug} Text`}
            value={value.displayName}
            onChange={(event) =>
              onChange({ ...value, displayName: event.target.value })
            }
          />
        </WorkspaceField>

        <WorkspaceField label="Provider Slug">
          <Input
            aria-label={`${value.slug} Provider Slug`}
            value={value.slug}
            readOnly
          />
        </WorkspaceField>

        <WorkspaceField label="Client ID">
          <Input
            aria-label={`${value.slug} Client ID`}
            value={value.clientId}
            onChange={(event) =>
              onChange({ ...value, clientId: event.target.value })
            }
          />
        </WorkspaceField>

        <WorkspaceField label="Client Secret">
          <Input
            aria-label={`${value.slug} Client Secret`}
            value={value.clientSecret}
            onChange={(event) =>
              onChange({ ...value, clientSecret: event.target.value })
            }
          />
        </WorkspaceField>

        <div className="md:col-span-2">
          <WorkspaceField label="TextCallback URL">
            <div className="flex gap-2">
              <Input aria-label={`${value.slug} Callback URL`} value={callbackUrl} readOnly />
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="size-4" />
                {copyState === "done"
                  ? "Text"
                  : copyState === "failed"
                    ? "Text"
                    : "Text"}
              </Button>
            </div>
          </WorkspaceField>
        </div>

        <div className="md:col-span-2">
          <WorkspaceField label="Authorization URL">
            <Input
              aria-label={`${value.slug} Authorization URL`}
              value={value.authorizationUrl}
              onChange={(event) =>
                onChange({ ...value, authorizationUrl: event.target.value })
              }
            />
          </WorkspaceField>
        </div>

        <div className="md:col-span-2">
          <WorkspaceField label="Token URL">
            <Input
              aria-label={`${value.slug} Token URL`}
              value={value.tokenUrl}
              onChange={(event) =>
                onChange({ ...value, tokenUrl: event.target.value })
              }
            />
          </WorkspaceField>
        </div>

        <div className="md:col-span-2">
          <WorkspaceField label="User Info URL">
            <Input
              aria-label={`${value.slug} User Info URL`}
              value={value.userInfoUrl}
              onChange={(event) =>
                onChange({ ...value, userInfoUrl: event.target.value })
              }
            />
          </WorkspaceField>
        </div>

        <div className="md:col-span-2">
          <WorkspaceField label="Scopes">
            <Textarea
              aria-label={`${value.slug} Scopes`}
              rows={3}
              value={value.scopes.join(", ")}
              onChange={(event) =>
                onChange({
                  ...value,
                  scopes: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </WorkspaceField>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <CheckboxField
          label="Enable PKCE（OAuth 2.1）"
          checked={value.usePkce}
          onCheckedChange={(usePkce) => onChange({ ...value, usePkce })}
        />
        <CheckboxField
          label="Text"
          checked={value.allowAutoRegister}
          onCheckedChange={(allowAutoRegister) =>
            onChange({ ...value, allowAutoRegister })
          }
        />
        <CheckboxField
          label="Text"
          checked={value.allowLinkExisting}
          onCheckedChange={(allowLinkExisting) =>
            onChange({ ...value, allowLinkExisting })
          }
        />
        <CheckboxField
          label="Text/Text"
          checked={value.overwriteProfile}
          onCheckedChange={(overwriteProfile) =>
            onChange({ ...value, overwriteProfile })
          }
        />
      </div>
    </div>
  );
}

export function AuthSettingsForm({
  registration,
  password,
  session,
  oauthDisplay,
  providers,
  onRegistrationChange,
  onPasswordChange,
  onSessionChange,
  onOAuthDisplayChange,
  onProvidersChange,
  mode = "all",
}: {
  registration: AuthRegistrationSettings;
  password: AuthPasswordSettings;
  session: AuthSessionSettings;
  oauthDisplay: OAuthDisplaySettings;
  providers: OAuthProviderSettings[];
  onRegistrationChange: (next: AuthRegistrationSettings) => void;
  onPasswordChange: (next: AuthPasswordSettings) => void;
  onSessionChange: (next: AuthSessionSettings) => void;
  onOAuthDisplayChange: (next: OAuthDisplaySettings) => void;
  onProvidersChange: (next: OAuthProviderSettings[]) => void;
  mode?: "all" | "oauth" | "user";
}) {
  const showUserSettings = mode === "all" || mode === "user";
  const showOAuthSettings = mode === "all" || mode === "oauth";
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPresetSlug, setSelectedPresetSlug] = useState("");
  const [customName, setCustomName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [createCopyState, setCreateCopyState] = useState<"idle" | "done" | "failed">("idle");
  const [createError, setCreateError] = useState<string | null>(null);

  const callbackOrigin = useMemo(() => {
    if (typeof window === "undefined") {
      return "http://localhost:5173";
    }
    return window.location.origin;
  }, []);

  const sortedProviders = useMemo(() => {
    const order = new Map(oauthDisplay.providerOrder.map((value, index) => [value, index]));
    return [...providers].sort((left, right) => {
      const leftOrder = order.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = order.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.displayName.localeCompare(right.displayName);
    });
  }, [oauthDisplay.providerOrder, providers]);

  const selectedPreset = useMemo(
    () => oauthProviderPresets.find((item) => item.slug === selectedPresetSlug),
    [selectedPresetSlug],
  );
  const existingProviderSlugs = useMemo(
    () => new Set(providers.map((item) => item.slug)),
    [providers],
  );

  const candidateSlug = useMemo(
    () => normalizeSlug(customSlug) || selectedPreset?.slug || "",
    [customSlug, selectedPreset],
  );

  const duplicateSlug = useMemo(
    () => candidateSlug.length > 0 && providers.some((item) => item.slug === candidateSlug),
    [candidateSlug, providers],
  );

  const pendingCallbackUrl = useMemo(() => {
    return candidateSlug ? getOAuthCallbackURL(candidateSlug, callbackOrigin) : "";
  }, [callbackOrigin, candidateSlug]);

  async function handleCopyPendingCallback() {
    if (!pendingCallbackUrl || typeof navigator === "undefined" || !navigator.clipboard) {
      setCreateCopyState("failed");
      window.setTimeout(() => setCreateCopyState("idle"), 2000);
      return;
    }
    try {
      await navigator.clipboard.writeText(pendingCallbackUrl);
      setCreateCopyState("done");
      window.setTimeout(() => setCreateCopyState("idle"), 2000);
    } catch {
      setCreateCopyState("failed");
      window.setTimeout(() => setCreateCopyState("idle"), 2000);
    }
  }

  function upsertProvider(next: OAuthProviderSettings) {
    onProvidersChange(
      providers.map((provider) =>
        provider.slug === next.slug ? next : provider,
      ),
    );
  }

  function removeProvider(slug: string) {
    onProvidersChange(providers.filter((provider) => provider.slug !== slug));
    onOAuthDisplayChange({
      ...oauthDisplay,
      providerOrder: oauthDisplay.providerOrder.filter((value) => value !== slug),
    });
  }

  function createProviderFromPreset(preset: OAuthProviderPreset) {
    const nextSlug = normalizeSlug(customSlug) || preset.slug;
    if (!nextSlug) {
      setCreateError("Provider Slug  is required。");
      return;
    }
    if (providers.some((item) => item.slug === nextSlug)) {
      setCreateError("Text Provider Slug Text，Text。");
      return;
    }
    setCreateError(null);
    const next = {
      ...defaultOAuthProviderSettings(
        customName.trim() || preset.displayName,
        nextSlug,
      ),
      authorizationUrl: preset.authorizationUrl,
      tokenUrl: preset.tokenUrl,
      userInfoUrl: preset.userInfoUrl,
      scopes: [...preset.scopes],
      usePkce: preset.usePkce,
      redirectUrl: getOAuthCallbackURL(nextSlug, callbackOrigin),
    };
    onProvidersChange([...providers, next]);
    onOAuthDisplayChange({
      ...oauthDisplay,
      providerOrder: [...oauthDisplay.providerOrder, nextSlug],
    });
    setCreateDialogOpen(false);
    setSelectedPresetSlug("");
    setCustomName("");
    setCustomSlug("");
    setCreateCopyState("idle");
  }

  function createCustomProvider() {
    const nextSlug = normalizeSlug(customSlug);
    const nameError = validateRequiredText("Text", customName, { minLength: 2, maxLength: 80 });
    if (nameError) {
      setCreateError(nameError);
      return;
    }
    if (!nextSlug) {
      setCreateError("Provider Slug  is required。");
      return;
    }
    if (providers.some((item) => item.slug === nextSlug)) {
      setCreateError("Text Provider Slug Text，Text。");
      return;
    }
    setCreateError(null);
    const next = {
      ...defaultOAuthProviderSettings(customName.trim() || nextSlug, nextSlug),
      redirectUrl: getOAuthCallbackURL(nextSlug, callbackOrigin),
    };
    onProvidersChange([...providers, next]);
    onOAuthDisplayChange({
      ...oauthDisplay,
      providerOrder: [...oauthDisplay.providerOrder, nextSlug],
    });
    setCreateDialogOpen(false);
    setSelectedPresetSlug("");
    setCustomName("");
    setCustomSlug("");
    setCreateCopyState("idle");
  }

  const disablePresetCreate = !selectedPreset || !candidateSlug || duplicateSlug;
  const disableCustomCreate = !normalizeSlug(customSlug) || duplicateSlug;

  return (
    <div className="space-y-4">
      {showUserSettings ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <WorkspaceField label="Text">
              <BasicSelect
                aria-label="Text"
                value={registration.registrationMode}
                onChange={(event) =>
                  onRegistrationChange({
                    ...registration,
                    registrationMode: event.target.value,
                  })
                }
              >
                <option value="public">Text</option>
                <option value="invite_only">Text</option>
                <option value="closed">Text</option>
              </BasicSelect>
            </WorkspaceField>

            <WorkspaceField label="Text">
              <Input
                aria-label="Text"
                type="number"
                value={String(password.minLength)}
                onChange={(event) =>
                  onPasswordChange({
                    ...password,
                    minLength: Number(event.target.value || 0),
                  })
                }
              />
            </WorkspaceField>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <CheckboxField
              label="Text"
              checked={registration.allowRegistration}
              onCheckedChange={(allowRegistration) =>
                onRegistrationChange({ ...registration, allowRegistration })
              }
            />
            <CheckboxField
              label="Text"
              checked={registration.requireEmailVerification}
              onCheckedChange={(requireEmailVerification) =>
                onRegistrationChange({
                  ...registration,
                  requireEmailVerification,
                })
              }
            />
            <CheckboxField
              label="Text"
              checked={registration.inviteOnly}
              onCheckedChange={(inviteOnly) =>
                onRegistrationChange({ ...registration, inviteOnly })
              }
            />
            <CheckboxField
              label="Text"
              checked={password.passwordResetable}
              onCheckedChange={(passwordResetable) =>
                onPasswordChange({ ...password, passwordResetable })
              }
            />
            <CheckboxField
              label="Text"
              checked={password.requireUppercase}
              onCheckedChange={(requireUppercase) =>
                onPasswordChange({ ...password, requireUppercase })
              }
            />
            <CheckboxField
              label="Text"
              checked={password.requireNumber}
              onCheckedChange={(requireNumber) =>
                onPasswordChange({ ...password, requireNumber })
              }
            />
            <CheckboxField
              label="Text"
              checked={password.requireSpecial}
              onCheckedChange={(requireSpecial) =>
                onPasswordChange({ ...password, requireSpecial })
              }
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <WorkspaceField label="Access Token Text">
              <Input
                aria-label="Access Token Text"
                type="number"
                value={String(session.accessTokenMinutes)}
                onChange={(event) =>
                  onSessionChange({
                    ...session,
                    accessTokenMinutes: Number(event.target.value || 0),
                  })
                }
              />
            </WorkspaceField>
            <WorkspaceField label="Refresh Token Text">
              <Input
                aria-label="Refresh Token Text"
                type="number"
                value={String(session.refreshTokenDays)}
                onChange={(event) =>
                  onSessionChange({
                    ...session,
                    refreshTokenDays: Number(event.target.value || 0),
                  })
                }
              />
            </WorkspaceField>
            <WorkspaceField label="Text">
              <Input
                aria-label="Text"
                type="number"
                value={String(session.lockoutThreshold)}
                onChange={(event) =>
                  onSessionChange({
                    ...session,
                    lockoutThreshold: Number(event.target.value || 0),
                  })
                }
              />
            </WorkspaceField>
            <WorkspaceField label="Text">
              <Input
                aria-label="Text"
                type="number"
                value={String(session.lockoutDurationMinutes)}
                onChange={(event) =>
                  onSessionChange({
                    ...session,
                    lockoutDurationMinutes: Number(event.target.value || 0),
                  })
                }
              />
            </WorkspaceField>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <CheckboxField
              label="Text"
              checked={session.allowMultiSession}
              onCheckedChange={(allowMultiSession) =>
                onSessionChange({ ...session, allowMultiSession })
              }
            />
            <CheckboxField
              label="Enable MFA Text"
              checked={session.enableMFA}
              onCheckedChange={(enableMFA) =>
                onSessionChange({ ...session, enableMFA })
              }
            />
          </div>
        </>
      ) : null}

      {showOAuthSettings ? (
        <>
          <div className="grid gap-2 md:grid-cols-2">
            <CheckboxField
              label="Text OAuth"
              checked={oauthDisplay.showOnLogin}
              onCheckedChange={(showOnLogin) =>
                onOAuthDisplayChange({ ...oauthDisplay, showOnLogin })
              }
            />
            <CheckboxField
              label="Text"
              checked={oauthDisplay.autoLinkByEmail}
              onCheckedChange={(autoLinkByEmail) =>
                onOAuthDisplayChange({ ...oauthDisplay, autoLinkByEmail })
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">OAuth Text</p>
              <p className="text-xs text-muted-foreground">
                Text OAuth/OIDC Text，Text。
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="size-4" />
              Text OAuth Text
            </Button>
          </div>

          <div className="space-y-3">
            {sortedProviders.map((provider) => (
              <ProviderForm
                key={provider.slug}
                value={provider}
                onChange={upsertProvider}
                onDelete={() => removeProvider(provider.slug)}
                callbackOrigin={callbackOrigin}
              />
            ))}
          </div>

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) {
                setCreateError(null);
                setCreateCopyState("idle");
              }
            }}
          >
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Text OAuth Text</DialogTitle>
                <DialogDescription>
                  Text，Text OAuth/OIDC Text。
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <WorkspaceField label="Text">
                  <div className="space-y-2">
                    <BasicSelect
                      aria-label="Text"
                      value={selectedPresetSlug}
                      onChange={(event) => setSelectedPresetSlug(event.target.value)}
                    >
                      <option value="">Text（Text）</option>
                      {oauthProviderPresets.map((preset) => (
                        <option
                          key={preset.slug}
                          value={preset.slug}
                          disabled={existingProviderSlugs.has(preset.slug)}
                        >
                          {preset.displayName}
                        </option>
                      ))}
                    </BasicSelect>
                    <p className="text-xs text-muted-foreground">
                      Text，Text。
                    </p>
                  </div>
                </WorkspaceField>

                {selectedPreset ? (
                  <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/10 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">Text</div>
                        <div className="text-xs text-muted-foreground">
                          {selectedPreset.displayName} · {selectedPreset.slug}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground">
                        {selectedPreset.usePkce ? "PKCE / OAuth 2.1" : "OAuth 2.0"}
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Authorization URL</div>
                        <div className="break-all rounded-lg bg-background px-3 py-2 text-xs">
                          {selectedPreset.authorizationUrl}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Token URL</div>
                        <div className="break-all rounded-lg bg-background px-3 py-2 text-xs">
                          {selectedPreset.tokenUrl}
                        </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <div className="text-xs text-muted-foreground">Scopes</div>
                        <div className="rounded-lg bg-background px-3 py-2 text-xs">
                          {selectedPreset.scopes.join(", ")}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <WorkspaceField label="Text">
                    <Input
                      aria-label="OAuth Text"
                      placeholder="Example: GitHub Text"
                      value={customName}
                      onChange={(event) => setCustomName(event.target.value)}
                    />
                  </WorkspaceField>

                  <WorkspaceField label="Provider Slug">
                    <Input
                      aria-label="OAuth Provider Slug"
                      placeholder="Example: github-enterprise"
                      value={customSlug}
                      onChange={(event) => setCustomSlug(normalizeSlug(event.target.value))}
                    />
                  </WorkspaceField>
                </div>

                <WorkspaceField label="TextCallback URL">
                  <div className="flex gap-2">
                    <Input
                      aria-label="TextCallback URL"
                      value={pendingCallbackUrl}
                      placeholder="Text Provider Slug Text"
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyPendingCallback}
                      disabled={!pendingCallbackUrl}
                    >
                      <Copy className="size-4" />
                      {createCopyState === "done"
                        ? "Text"
                        : createCopyState === "failed"
                          ? "Text"
                          : "TextCallback URL"}
                    </Button>
                  </div>
                </WorkspaceField>

                {duplicateSlug ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    Text Provider Slug Text，Text。
                  </div>
                ) : null}
                {createError ? (
                  <NoticeBanner onDismiss={() => setCreateError(null)} variant="error">
                    {createError}
                  </NoticeBanner>
                ) : null}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                {selectedPresetSlug ? (
                  <Button
                    onClick={() => {
                      const preset = oauthProviderPresets.find(
                        (item) => item.slug === selectedPresetSlug,
                      );
                      if (preset) {
                        createProviderFromPreset(preset);
                      }
                    }}
                    disabled={disablePresetCreate}
                  >
                    Text
                  </Button>
                ) : (
                  <Button
                    onClick={createCustomProvider}
                    disabled={disableCustomCreate}
                  >
                    Text
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
