import { PaginationControls } from "@/components/ui/pagination-controls";
import { WorkspaceEmpty, WorkspacePanel } from "@/components/layout/workspace-ui";
import { MailboxCard } from "./mailbox-card";
import type { MailboxItem } from "../api";

type PaginatedResult = {
  items: MailboxItem[];
  page: number;
  total: number;
  totalPages: number;
};

type Props = {
  isLoading: boolean;
  hasMailboxes: boolean;
  paginatedMailboxes: PaginatedResult;
  effectiveSelectedMailboxId: number | null;
  onSelectMailbox: (mailboxId: number) => void;
  onPageChange: (page: number) => void;
  pageSize: number;
  formatDate: (value: string) => string;
  formatRemainingHours: (value: string) => string;
};

export function MailboxList({
  isLoading,
  hasMailboxes,
  paginatedMailboxes,
  effectiveSelectedMailboxId,
  onSelectMailbox,
  onPageChange,
  pageSize,
  formatDate,
  formatRemainingHours,
}: Props) {
  return (
    <WorkspacePanel description="Text，Text。" title="Text">
      {isLoading ? (
        <WorkspaceEmpty description="Text，Text。" title="Text" />
      ) : !hasMailboxes ? (
        <WorkspaceEmpty
          description="Text，Text。"
          title="Text"
        />
      ) : (
        <div className="space-y-3">
          {paginatedMailboxes.items.map((mailbox) => (
            <MailboxCard
              key={mailbox.id}
              mailbox={mailbox}
              active={mailbox.id === effectiveSelectedMailboxId}
              onSelect={onSelectMailbox}
              formatDate={formatDate}
              formatRemainingHours={formatRemainingHours}
            />
          ))}
          <PaginationControls
            itemLabel="Text"
            onPageChange={onPageChange}
            page={paginatedMailboxes.page}
            pageSize={pageSize}
            total={paginatedMailboxes.total}
            totalPages={paginatedMailboxes.totalPages}
          />
        </div>
      )}
    </WorkspacePanel>
  );
}
