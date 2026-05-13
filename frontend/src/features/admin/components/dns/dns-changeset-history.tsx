import { Button } from "@/components/ui/button";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceListRow,
} from "@/components/layout/workspace-ui";
import { cn } from "@/lib/utils";
import type { DNSChangeSetItem } from "../../api";
import { PaginationControls, SectionToggle } from "./dns-shared-ui";
import {
  ADMIN_CHANGESETS_PAGE_SIZE,
  describeChangeSetOperations,
  formatChangeSetTimestamp,
} from "./dns-page.utils";

type DnsChangesetHistoryProps = {
  expanded: boolean;
  onToggleExpanded: () => void;
  sortedHistory: DNSChangeSetItem[];
  paginatedItems: DNSChangeSetItem[];
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  selectedChangeSetID: number | null;
  isWorkspaceBusy: boolean;
  onReview: (item: DNSChangeSetItem) => void;
  onRestore: (item: DNSChangeSetItem) => void;
};

export function DnsChangesetHistory({
  expanded,
  onToggleExpanded,
  sortedHistory,
  paginatedItems,
  page,
  totalPages,
  total,
  onPageChange,
  selectedChangeSetID,
  isWorkspaceBusy,
  onReview,
  onRestore,
}: DnsChangesetHistoryProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
      <SectionToggle
        description="Text Zone Text preview / apply Text。"
        expanded={expanded}
        meta={<WorkspaceBadge variant="outline">{sortedHistory.length} Text</WorkspaceBadge>}
        title="Change Set Text"
        onToggle={onToggleExpanded}
      />
      {expanded && sortedHistory.length ? (
        <div className="space-y-2">
          {paginatedItems.map((item) => (
            <WorkspaceListRow
              className={cn(
                selectedChangeSetID === item.id
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : undefined,
              )}
              key={item.id}
              title={`#${item.id} · ${item.summary}`}
              description={`${item.provider} · ${item.zoneName} · ${describeChangeSetOperations(item)}`}
              meta={
                <>
                  <WorkspaceBadge>{item.status}</WorkspaceBadge>
                  <span>{item.appliedAt ? "Text" : "Text"}</span>
                  <span>
                    {item.appliedAt
                      ? `Text ${formatChangeSetTimestamp(item.appliedAt)}`
                      : `Text ${formatChangeSetTimestamp(item.createdAt)}`}
                  </span>
                  {item.operations.length ? (
                    <span>{item.operations.length} Text</span>
                  ) : (
                    <span>Text</span>
                  )}
                  <Button
                    disabled={isWorkspaceBusy}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => onReview(item)}
                  >
                    Text
                  </Button>
                  <Button
                    disabled={
                      isWorkspaceBusy ||
                      !item.operations.some((operation) => operation.after)
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => onRestore(item)}
                  >
                    Text and Text
                  </Button>
                </>
              }
            />
          ))}
          <PaginationControls
            itemLabel="Change Set"
            page={page}
            pageSize={ADMIN_CHANGESETS_PAGE_SIZE}
            total={total}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      ) : expanded ? (
        <WorkspaceEmpty
          title="Text Change Set Text"
          description="Text Zone Text preview / apply Text。"
        />
      ) : null}
    </div>
  );
}
