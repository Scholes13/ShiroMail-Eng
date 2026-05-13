import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  WorkspaceEmpty,
  WorkspaceListRow,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import { fetchBalance } from "../api";
import { formatCurrency, formatDateTime } from "./shared";

export function UserBalancePage() {
  const balanceQuery = useQuery({ queryKey: ["portal-balance"], queryFn: fetchBalance });
  const balance = balanceQuery.data;

  return (
    <WorkspacePage>
      <WorkspacePanel description="Text、Text。" title="Text">
        <Card className="border-border/60 bg-card/92 shadow-none">
          <CardContent className="space-y-1 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Text</div>
            <div className="text-xl font-semibold tracking-tight">{formatCurrency(balance?.balanceCents ?? 0)}</div>
            <p className="text-xs leading-6 text-muted-foreground">Text、Text。</p>
          </CardContent>
        </Card>

        {balance?.entries.length ? (
          <div className="space-y-3">
            {balance.entries.map((entry) => (
              <WorkspaceListRow
                description={entry.entryType}
                key={entry.id}
                meta={
                  <>
                    <span className="rounded-full border border-border/60 px-2 py-1">{formatCurrency(entry.amount)}</span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </>
                }
                title={entry.description}
              />
            ))}
          </div>
        ) : (
          <WorkspaceEmpty description="Text。" title="Text" />
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}
