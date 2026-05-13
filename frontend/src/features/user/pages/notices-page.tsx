import { useQuery } from "@tanstack/react-query";
import { WorkspaceBadge, WorkspaceEmpty, WorkspacePage, WorkspacePanel } from "@/components/layout/workspace-ui";
import { Card, CardContent } from "@/components/ui/card";
import { fetchNotices } from "../api";
import { formatDateTime } from "./shared";

export function UserNoticesPage() {
  const noticesQuery = useQuery({ queryKey: ["portal-notices"], queryFn: fetchNotices });

  return (
    <WorkspacePage>
      <WorkspacePanel description="Platform maintenance, releases, and delivery policy changes are published here." title="Notices">
        {noticesQuery.data?.length ? (
          <div className="space-y-3">
            {noticesQuery.data.map((notice) => (
              <Card className="border-border/60 bg-card/85 shadow-none" key={notice.id}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <WorkspaceBadge>{notice.category}</WorkspaceBadge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(notice.publishedAt)}</span>
                  </div>
                  <div className="text-sm font-medium">{notice.title}</div>
                  <p className="text-sm leading-6 text-muted-foreground">{notice.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <WorkspaceEmpty description="No posts yet. Future platform updates will appear here." title="TextNotices" />
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}
