import { Button } from "@/components/ui/button";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceListRow,
} from "@/components/layout/workspace-ui";
import type { VerificationProfileItem } from "../../api";
import { SectionToggle } from "./dns-shared-ui";
import { formatChangeSetTimestamp } from "./dns-page.utils";

type DnsVerificationSectionProps = {
  verificationProfiles: VerificationProfileItem[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onLoadRepairRecords: (profile: VerificationProfileItem) => void;
};

export function DnsVerificationSection({
  verificationProfiles,
  expanded,
  onToggleExpanded,
  onLoadRepairRecords,
}: DnsVerificationSectionProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-3">
      <SectionToggle
        description="Text Zone Text、Text。"
        expanded={expanded}
        meta={<WorkspaceBadge variant="outline">{verificationProfiles.length} Text</WorkspaceBadge>}
        title="Verification Health"
        onToggle={onToggleExpanded}
      />

      {expanded ? (
        verificationProfiles.length ? (
          <div className="space-y-2">
            {verificationProfiles.map((profile) => (
              <WorkspaceListRow
                key={profile.verificationType}
                title={profile.summary}
                description={`${profile.verificationType} · observed ${profile.observedRecords.length} / expected ${profile.expectedRecords.length}`}
                meta={
                  <>
                    <WorkspaceBadge>{profile.status}</WorkspaceBadge>
                    <span>
                      {profile.lastCheckedAt
                        ? `Text ${formatChangeSetTimestamp(profile.lastCheckedAt)}`
                        : "Text"}
                    </span>
                    <Button
                      disabled={!profile.repairRecords.length}
                      size="sm"
                      variant="outline"
                      onClick={() => onLoadRepairRecords(profile)}
                    >
                      Text {profile.verificationType} Text
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <WorkspaceEmpty
            title="Text"
            description="Text Zone Text Verification Health Text。"
          />
        )
      ) : null}
    </div>
  );
}
