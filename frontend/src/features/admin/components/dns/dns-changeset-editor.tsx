import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DNSRecordTypeCombobox } from "@/components/ui/dns-record-type-combobox";
import { Input } from "@/components/ui/input";
import { NoticeBanner } from "@/components/ui/notice-banner";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceListRow,
} from "@/components/layout/workspace-ui";
import type { DNSChangeSetItem } from "../../api";
import { PaginationControls, SectionToggle } from "./dns-shared-ui";
import {
  ADMIN_CHANGESET_EDITOR_PAGE_SIZE,
  type EditableProviderRecord,
  createEditableProviderRecord,
  describeChangeSetOperations,
  formatChangeSetTimestamp,
} from "./dns-page.utils";

type DnsChangesetEditorProps = {
  expanded: boolean;
  onToggleExpanded: () => void;
  desiredRecordsDraft: EditableProviderRecord[];
  onDesiredRecordsDraftChange: (updater: (current: EditableProviderRecord[]) => EditableProviderRecord[]) => void;
  paginatedItems: EditableProviderRecord[];
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  zoneName: string;
  currentRecords: Array<{
    id?: string;
    type: string;
    name: string;
    value: string;
    ttl: number;
    priority: number;
    proxied: boolean;
  }>;
  isWorkspaceBusy: boolean;
  changeSetError: string | null;
  onDismissError: () => void;
  changeSetNotice: string | null;
  onDismissNotice: () => void;
  changeSetPreview: DNSChangeSetItem | null;
  onSave: () => void;
  onPreview: () => void;
  onApply: () => void;
  isSaving: boolean;
  isPreviewing: boolean;
  isApplying: boolean;
};

export function DnsChangesetEditor({
  expanded,
  onToggleExpanded,
  desiredRecordsDraft,
  onDesiredRecordsDraftChange,
  paginatedItems,
  page,
  totalPages,
  total,
  onPageChange,
  zoneName,
  currentRecords,
  isWorkspaceBusy,
  changeSetError,
  onDismissError,
  changeSetNotice,
  onDismissNotice,
  changeSetPreview,
  onSave,
  onPreview,
  onApply,
  isSaving,
  isPreviewing,
  isApplying,
}: DnsChangesetEditorProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <SectionToggle
        description="Text，Text preview，Text change-set Text。"
        expanded={expanded}
        meta={<WorkspaceBadge variant="outline">{desiredRecordsDraft.length} Text</WorkspaceBadge>}
        title="DNS Change Set"
        onToggle={onToggleExpanded}
      />

      {expanded ? (
        <>
          <div className="space-y-3">
            <div className="grid gap-2">
              {paginatedItems.map((record, index) => (
                <div
                  key={record.localId}
                  className="rounded-xl border border-border/60 bg-background/80 p-3"
                >
                  <div className="grid gap-3 xl:grid-cols-[110px_1.2fr_1.8fr_90px_90px_auto_auto]">
                    <DNSRecordTypeCombobox
                      disabled={isWorkspaceBusy}
                      value={record.type}
                      onValueChange={(nextValue) =>
                        onDesiredRecordsDraftChange((current) =>
                          current.map((item) =>
                            item.localId === record.localId
                              ? { ...item, type: nextValue }
                              : item,
                          ),
                        )
                      }
                    />
                    <Input
                      aria-label="Text"
                      className="h-9"
                      disabled={isWorkspaceBusy}
                      onChange={(event) =>
                        onDesiredRecordsDraftChange((current) =>
                          current.map((item) =>
                            item.localId === record.localId
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="@ / _dmarc"
                      value={record.name}
                    />
                    <Input
                      aria-label="Text"
                      className="h-9"
                      disabled={isWorkspaceBusy}
                      onChange={(event) =>
                        onDesiredRecordsDraftChange((current) =>
                          current.map((item) =>
                            item.localId === record.localId
                              ? { ...item, value: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Text"
                      value={record.value}
                    />
                    <Input
                      aria-label="TTL"
                      className="h-9"
                      disabled={isWorkspaceBusy}
                      min={60}
                      onChange={(event) =>
                        onDesiredRecordsDraftChange((current) =>
                          current.map((item) =>
                            item.localId === record.localId
                              ? { ...item, ttl: Number(event.target.value || 0) }
                              : item,
                          ),
                        )
                      }
                      type="number"
                      value={record.ttl}
                    />
                    <Input
                      aria-label="Text"
                      className="h-9"
                      disabled={isWorkspaceBusy}
                      min={0}
                      onChange={(event) =>
                        onDesiredRecordsDraftChange((current) =>
                          current.map((item) =>
                            item.localId === record.localId
                              ? { ...item, priority: Number(event.target.value || 0) }
                              : item,
                          ),
                        )
                      }
                      type="number"
                      value={record.priority}
                    />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        aria-label="Text"
                        checked={record.proxied}
                        disabled={isWorkspaceBusy}
                        onCheckedChange={(checked) =>
                          onDesiredRecordsDraftChange((current) =>
                            current.map((item) =>
                              item.localId === record.localId
                                ? { ...item, proxied: checked === true }
                                : item,
                            ),
                          )
                        }
                      />
                      Text
                    </label>
                    <Button
                      aria-label="Text"
                      className="h-9"
                      disabled={isWorkspaceBusy}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onDesiredRecordsDraftChange((current) =>
                          current.filter((item) => item.localId !== record.localId),
                        )
                      }
                    >
                      Text
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Text #{(page - 1) * ADMIN_CHANGESET_EDITOR_PAGE_SIZE + index + 1}
                  </p>
                </div>
              ))}
            </div>
            <PaginationControls
              itemLabel="Text"
              page={page}
              pageSize={ADMIN_CHANGESET_EDITOR_PAGE_SIZE}
              total={total}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                aria-label="Text"
                disabled={isWorkspaceBusy}
                size="sm"
                variant="outline"
                onClick={() =>
                  onDesiredRecordsDraftChange((current) => {
                    const next = [
                      ...current,
                      createEditableProviderRecord({
                        name: zoneName,
                      }),
                    ];
                    onPageChange(
                      Math.max(1, Math.ceil(next.length / ADMIN_CHANGESET_EDITOR_PAGE_SIZE)),
                    );
                    return next;
                  })
                }
              >
                <Plus className="size-4" />
                Text
              </Button>
              <Button
                disabled={isWorkspaceBusy}
                size="sm"
                variant="ghost"
                onClick={() => {
                  onDesiredRecordsDraftChange(() =>
                    currentRecords.map((r) => createEditableProviderRecord(r)),
                  );
                  onPageChange(1);
                }}
              >
                Text
              </Button>
            </div>
          </div>

          {changeSetError ? (
            <NoticeBanner autoHideMs={5000} className="text-xs" onDismiss={onDismissError} variant="error">
              {changeSetError}
            </NoticeBanner>
          ) : null}
          {changeSetNotice ? (
            <NoticeBanner autoHideMs={5000} className="text-xs" onDismiss={onDismissNotice} variant="success">
              {changeSetNotice}
            </NoticeBanner>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isWorkspaceBusy}
              onClick={onSave}
            >
              {isSaving ? "Text..." : "Text and Text"}
            </Button>

            <Button
              disabled={isWorkspaceBusy}
              variant="outline"
              onClick={onPreview}
            >
              {isPreviewing ? "Text..." : "Text"}
            </Button>

            <Button
              disabled={!changeSetPreview || isWorkspaceBusy}
              variant="secondary"
              onClick={onApply}
            >
              {isApplying ? "Text..." : "Text"}
            </Button>
          </div>

          {changeSetPreview ? (
            <ChangeSetPreviewPanel changeSet={changeSetPreview} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ChangeSetPreviewPanel({ changeSet }: { changeSet: DNSChangeSetItem }) {
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <WorkspaceBadge variant="outline">Text</WorkspaceBadge>
        <WorkspaceBadge>
          {changeSet.status}
        </WorkspaceBadge>
        <span>{describeChangeSetOperations(changeSet)}</span>
        <span>Text {formatChangeSetTimestamp(changeSet.createdAt)}</span>
        {changeSet.appliedAt ? (
          <span>Text {formatChangeSetTimestamp(changeSet.appliedAt)}</span>
        ) : (
          <span>Text</span>
        )}
      </div>

      {changeSet.operations.length ? (
        <div className="space-y-2">
          {changeSet.operations.map((operation) => (
            <WorkspaceListRow
              key={operation.id}
              title={`${operation.operation} · ${operation.recordType} · ${operation.recordName}`}
              description={
                operation.after?.value ??
                operation.before?.value ??
                `${operation.recordType} ${operation.recordName}`
              }
              descriptionClassName="font-mono text-xs break-all whitespace-normal"
              meta={
                <>
                  <WorkspaceBadge>
                    {operation.status}
                  </WorkspaceBadge>
                  {operation.after?.ttl ? (
                    <span>TTL {operation.after.ttl}</span>
                  ) : null}
                  {operation.before?.ttl &&
                  !operation.after?.ttl ? (
                    <span>TTL {operation.before.ttl}</span>
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      ) : (
        <WorkspaceEmpty
          title="Text"
          description="Text Records Text。"
        />
      )}
    </div>
  );
}
