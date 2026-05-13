import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { OptionCombobox } from "@/components/ui/option-combobox";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  WorkspaceEmpty,
  WorkspaceField,
  WorkspaceListRow,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import { decodeMimeHeaderValue } from "@/lib/mail-header";
import { paginateItems } from "@/lib/pagination";
import { fetchAdminMessages } from "../api";
import { formatDateTime } from "../../user/pages/shared";

const ADMIN_MESSAGES_PAGE_SIZE = 10;

export function AdminMessagesPage() {
  const messagesQuery = useQuery({ queryKey: ["admin-messages"], queryFn: fetchAdminMessages });
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"all" | "new" | "seen">("all");
  const [messagesPage, setMessagesPage] = useState(1);
  const statusOptions = [
    { value: "all", label: "Text", keywords: ["all"] },
    { value: "new", label: "new" },
    { value: "seen", label: "seen" },
  ];

  const filtered = useMemo(() => {
    return (messagesQuery.data ?? []).filter((item) => {
      const matchesStatus = status === "all" || item.status === status;
      const haystack = `${decodeMimeHeaderValue(item.subject)} ${decodeMimeHeaderValue(item.fromAddr)} ${item.mailboxAddress}`.toLowerCase();
      const matchesKeyword = keyword.trim() === "" || haystack.includes(keyword.trim().toLowerCase());
      return matchesStatus && matchesKeyword;
    });
  }, [keyword, messagesQuery.data, status]);
  const paginatedMessages = useMemo(
    () => paginateItems(filtered, messagesPage, ADMIN_MESSAGES_PAGE_SIZE),
    [filtered, messagesPage],
  );

  return (
    <WorkspacePage>
      <WorkspacePanel description="Text。" title="Text">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <WorkspaceField label="Text">
            <Input
              className="h-9"
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Text / Sender / Text"
              value={keyword}
            />
          </WorkspaceField>
          <WorkspaceField label="Text">
            <OptionCombobox
              ariaLabel="Text"
              emptyLabel="Text"
              value={status}
              onValueChange={(value) => setStatus(value as "all" | "new" | "seen")}
              options={statusOptions}
              placeholder="Text"
              searchPlaceholder="Text"
            />
          </WorkspaceField>
        </div>

        {filtered.length ? (
          <div className="flex flex-col gap-3">
            {paginatedMessages.items.map((item) => (
              <WorkspaceListRow
                description={`${decodeMimeHeaderValue(item.fromAddr)} → ${item.mailboxAddress}`}
                key={item.id}
                meta={
                  <>
                    <span className="rounded-full border border-border/60 px-2 py-1">{item.status}</span>
                    <span>{formatDateTime(item.receivedAt)}</span>
                  </>
                }
                title={decodeMimeHeaderValue(item.subject) || "(No subject)"}
              />
            ))}
            <PaginationControls
              itemLabel="Text"
              onPageChange={setMessagesPage}
              page={paginatedMessages.page}
              pageSize={ADMIN_MESSAGES_PAGE_SIZE}
              total={paginatedMessages.total}
              totalPages={paginatedMessages.totalPages}
            />
          </div>
        ) : (
          <WorkspaceEmpty description="Text。" title="Text" />
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}
