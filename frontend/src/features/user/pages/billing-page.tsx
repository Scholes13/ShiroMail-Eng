import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceMetric, WorkspacePage, WorkspacePanel } from "@/components/layout/workspace-ui";
import { fetchBilling } from "../api";
import { formatDateTime } from "./shared";

export function UserBillingPage() {
  const billingQuery = useQuery({ queryKey: ["portal-billing"], queryFn: fetchBilling });
  const billing = billingQuery.data;

  return (
    <WorkspacePage>
      <WorkspacePanel description="Text、Text。" title="Text">
        <div className="grid gap-4 md:grid-cols-3">
          <WorkspaceMetric hint={billing?.planCode ?? "—"} label="Text" value={billing?.planName ?? "—"} />
          <WorkspaceMetric hint="Text" label="Text" value={billing?.mailboxQuota ?? 0} />
          <WorkspaceMetric hint="API / webhook Text" label="Text" value={billing?.dailyRequestLimit ?? 0} />
        </div>

        <Card className="border-border/60 bg-muted/10 shadow-none">
          <CardContent className="flex flex-wrap items-center gap-2 py-4 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 px-2 py-1">Status: {billing?.status ?? "—"}</span>
            <span>Text：{formatDateTime(billing?.renewalAt)}</span>
            <span>DomainText：{billing?.domainQuota ?? 0}</span>
          </CardContent>
        </Card>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
