import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BasicSelect } from "@/components/ui/basic-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { WorkspaceField } from "@/components/layout/workspace-ui";
import { SiteBrandMark } from "@/components/brand/site-brand-mark";
import {
  ambientSeasons,
  ambientTimeSegments,
  getAmbientThemeSnapshot,
  type AmbientSeason,
  type AmbientTimeSegment,
} from "@/lib/ambient-theme";
import type { SiteIdentitySettings } from "./types";

function getIconSourceLabel(siteIconUrl: string) {
  const trimmed = siteIconUrl.trim();
  if (!trimmed) {
    return "Text";
  }
  if (trimmed.startsWith("data:image/")) {
    return "Text";
  }
  if (trimmed.startsWith("/")) {
    return "Text";
  }
  return "Text URL";
}

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
      <Checkbox checked={checked} onCheckedChange={(next) => onCheckedChange(next === true)} />
      <span>{label}</span>
    </label>
  );
}

const seasonLabels: Record<AmbientSeason, string> = {
  spring: "Spring · Text",
  summer: "Summer · Text",
  autumn: "Autumn · Text",
  winter: "Winter · Text",
};

const timeSegmentLabels: Record<AmbientTimeSegment, string> = {
  midnight: "Midnight · Text",
  predawn: "Predawn · Text",
  dawn: "Dawn · Text",
  morning: "Morning · Text",
  noon: "Noon · Text",
  afternoon: "Afternoon · Text",
  dusk: "Dusk · Text",
};

export function SiteSettingsForm({
  identity,
  onIdentityChange,
}: {
  identity: SiteIdentitySettings;
  onIdentityChange: (next: SiteIdentitySettings) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [iconUploadError, setIconUploadError] = useState<string | null>(null);
  const [iconUploadHint, setIconUploadHint] = useState<string | null>(null);
  const [isDraggingIcon, setIsDraggingIcon] = useState(false);
  const currentAmbientSnapshot = useMemo(() => getAmbientThemeSnapshot(), []);
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewSeason, setPreviewSeason] = useState<AmbientSeason>(currentAmbientSnapshot.season);
  const [previewTimeSegment, setPreviewTimeSegment] = useState<AmbientTimeSegment>(currentAmbientSnapshot.timeSegment);
  const iconSourceLabel = getIconSourceLabel(identity.siteIconUrl);

  useEffect(() => {
    const root = document.documentElement;
    if (!previewEnabled) {
      delete root.dataset.ambientPreview;
      return;
    }

    root.dataset.ambientPreview = "true";
    root.dataset.season = previewSeason;
    root.dataset.timeSegment = previewTimeSegment;
    root.dataset.ambientTheme = `${previewSeason}-${previewTimeSegment}`;

    return () => {
      delete root.dataset.ambientPreview;
    };
  }, [previewEnabled, previewSeason, previewTimeSegment]);

  useEffect(() => {
    return () => {
      const root = document.documentElement;
      delete root.dataset.ambientPreview;
    };
  }, []);

  async function applyIconFile(file: File | null | undefined) {
    if (!file) {
      return;
    }

    const allowedTypes = new Set([
      "image/svg+xml",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ]);

    if (!allowedTypes.has(file.type)) {
      setIconUploadError("Text SVG、PNG、JPG、WEBP Text ICO Text。");
      setIconUploadHint(null);
      return;
    }

    if (file.size > 512 * 1024) {
      setIconUploadError("Text must be at most 512 KB。");
      setIconUploadHint(null);
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
            return;
          }
          reject(new Error("invalid result"));
        };
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(file);
      });

      setIconUploadError(null);
      setIconUploadHint(
        file.type === "image/svg+xml"
          ? "Text SVG Text，Text，Text。"
          : `Text ${file.name}，Text。`,
      );
      onIdentityChange({
        ...identity,
        siteIconUrl: dataUrl,
      });
    } catch {
      setIconUploadError("Text，Text。");
      setIconUploadHint(null);
    }
  }

  async function handleIconFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    await applyIconFile(file);
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <WorkspaceField label="Text">
        <Input
          aria-label="Text"
          value={identity.siteName}
          onChange={(event) =>
            onIdentityChange({ ...identity, siteName: event.target.value })
          }
        />
      </WorkspaceField>

      <WorkspaceField label="Text">
        <Input
          aria-label="Text"
          value={identity.supportEmail}
          onChange={(event) =>
            onIdentityChange({
              ...identity,
              supportEmail: event.target.value,
            })
          }
        />
      </WorkspaceField>

      <WorkspaceField label="Text">
        <Input
          aria-label="Text"
          value={identity.appBaseUrl}
          onChange={(event) =>
            onIdentityChange({
              ...identity,
              appBaseUrl: event.target.value,
            })
          }
        />
      </WorkspaceField>

      <WorkspaceField label="Text URL">
        <div className="space-y-3">
          <div
            className={[
              "rounded-2xl border border-dashed px-3 py-3 transition-colors",
              isDraggingIcon
                ? "border-foreground/30 bg-muted/35"
                : "border-border/70 bg-muted/15",
            ].join(" ")}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDraggingIcon(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                return;
              }
              setIsDraggingIcon(false);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isDraggingIcon) {
                setIsDraggingIcon(true);
              }
            }}
            onDrop={async (event) => {
              event.preventDefault();
              setIsDraggingIcon(false);
              await applyIconFile(event.dataTransfer.files?.[0]);
            }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-sm">
                <SiteBrandMark
                  iconUrl={identity.siteIconUrl}
                  imageClassName="size-6"
                  siteName={identity.siteName || "Shiro Email"}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Text and Text，Text</p>
                  <span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {iconSourceLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  SVG Text；PNG / JPG / WEBP / ICO Text，Text。
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
              <SiteBrandMark
                iconUrl={identity.siteIconUrl}
                imageClassName="size-5"
                siteName={identity.siteName || "Shiro Email"}
              />
            </div>
            <Input
              aria-label="Text URL"
              placeholder="https://example.com/icon.svg"
              value={identity.siteIconUrl}
              onChange={(event) =>
                onIdentityChange({
                  ...identity,
                  siteIconUrl: event.target.value,
                })
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              accept=".svg,.png,.jpg,.jpeg,.webp,.ico,image/svg+xml,image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon"
              className="hidden"
              onChange={handleIconFileChange}
              type="file"
            />
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Text
            </Button>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setIconUploadError(null);
                setIconUploadHint("Text。");
                onIdentityChange({
                  ...identity,
                  siteIconUrl: "",
                });
              }}
            >
              Text
            </Button>
            <p className="text-xs text-muted-foreground">Text URL Text，Text SVG，Text 512 KB。</p>
          </div>
          {iconUploadError ? (
            <p className="text-xs text-destructive">{iconUploadError}</p>
          ) : null}
          {!iconUploadError && iconUploadHint ? (
            <p className="text-xs text-muted-foreground">{iconUploadHint}</p>
          ) : null}
          {!iconUploadError && !iconUploadHint ? (
            <p className="text-xs text-muted-foreground">
              Text：{iconSourceLabel}。Text SVG，Text。
            </p>
          ) : null}
        </div>
      </WorkspaceField>

      <WorkspaceField label="Text">
        <Input
          aria-label="Text"
          value={identity.defaultLanguage}
          onChange={(event) =>
            onIdentityChange({
              ...identity,
              defaultLanguage: event.target.value,
            })
          }
        />
      </WorkspaceField>

      <WorkspaceField label="Text">
        <Input
          aria-label="Text"
          value={identity.defaultTimeZone}
          onChange={(event) =>
            onIdentityChange({
              ...identity,
              defaultTimeZone: event.target.value,
            })
          }
        />
      </WorkspaceField>

      <div className="md:col-span-2">
        <WorkspaceField label="Text">
          <Input
            aria-label="Text"
            value={identity.slogan}
            onChange={(event) =>
              onIdentityChange({ ...identity, slogan: event.target.value })
            }
          />
        </WorkspaceField>
      </div>

      <div className="md:col-span-2">
        <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 md:grid-cols-[1.1fr_0.9fr]">
          <WorkspaceField label="Text">
            <div className="space-y-3">
              <CheckboxField
                checked={identity.ambientThemeEnabled}
                label="EnableText"
                onCheckedChange={(ambientThemeEnabled) =>
                  onIdentityChange({
                    ...identity,
                    ambientThemeEnabled,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Text / Text / Text，Text。
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
                  Text：{seasonLabels[currentAmbientSnapshot.season]}
                </span>
                <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
                  Text：{timeSegmentLabels[currentAmbientSnapshot.timeSegment]}
                </span>
              </div>
            </div>
          </WorkspaceField>

          <WorkspaceField label="Text">
            <div className="space-y-2">
              <BasicSelect
                aria-label="Text"
                value={identity.ambientThemeIntensity}
                onChange={(event) =>
                  onIdentityChange({
                    ...identity,
                    ambientThemeIntensity: event.target.value,
                  })
                }
              >
                <option value="subtle">Subtle · Text</option>
                <option value="balanced">Balanced · Text</option>
                <option value="vivid">Vivid · Text</option>
              </BasicSelect>
              <p className="text-xs text-muted-foreground">
                `Subtle` Text；`Vivid` Text、Text、Text。
              </p>
            </div>
          </WorkspaceField>
        </div>
      </div>

      <div className="md:col-span-2">
        <div className="grid gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 md:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <WorkspaceField label="Text">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground">
                    {previewEnabled ? "Forced preview active" : "Auto local time mode"}
                  </span>
                  <span className="rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground">
                    {previewEnabled
                      ? `${seasonLabels[previewSeason]} / ${timeSegmentLabels[previewTimeSegment]}`
                      : `${seasonLabels[currentAmbientSnapshot.season]} / ${timeSegmentLabels[currentAmbientSnapshot.timeSegment]}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Text，Text。
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant={previewEnabled ? "outline" : "default"}
                    onClick={() => {
                      setPreviewEnabled(false);
                      setPreviewSeason(currentAmbientSnapshot.season);
                      setPreviewTimeSegment(currentAmbientSnapshot.timeSegment);
                    }}
                  >
                    Text
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant={previewEnabled ? "default" : "outline"}
                    onClick={() => setPreviewEnabled(true)}
                  >
                    Text
                  </Button>
                </div>
              </div>
            </WorkspaceField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <WorkspaceField label="Text">
              <BasicSelect
                aria-label="Text"
                disabled={!previewEnabled}
                value={previewSeason}
                onChange={(event) => setPreviewSeason(event.target.value as AmbientSeason)}
              >
                {ambientSeasons.map((season) => (
                  <option key={season} value={season}>
                    {seasonLabels[season]}
                  </option>
                ))}
              </BasicSelect>
            </WorkspaceField>

            <WorkspaceField label="Text">
              <BasicSelect
                aria-label="Text"
                disabled={!previewEnabled}
                value={previewTimeSegment}
                onChange={(event) => setPreviewTimeSegment(event.target.value as AmbientTimeSegment)}
              >
                {ambientTimeSegments.map((timeSegment) => (
                  <option key={timeSegment} value={timeSegment}>
                    {timeSegmentLabels[timeSegment]}
                  </option>
                ))}
              </BasicSelect>
            </WorkspaceField>
          </div>
        </div>
      </div>
    </div>
  );
}
