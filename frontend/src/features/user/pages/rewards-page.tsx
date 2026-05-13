import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Coins, Gift, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  WorkspaceEmpty,
  WorkspaceListRow,
  WorkspaceMetric,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import { fetchBalance } from "../api";
import { formatCurrency, formatDateTime } from "./shared";

export function UserRewardsPage() {
  const balanceQuery = useQuery({ queryKey: ["portal-balance"], queryFn: fetchBalance });
  const balance = balanceQuery.data;

  return (
    <WorkspacePage>
      <WorkspacePanel
        action={
          <Badge className="rounded-full" variant="outline">
            <Gift className="mr-1 size-3.5" />
            {balanceQuery.isLoading ? "Syncing reward data" : "Reward balance synced"}
          </Badge>
        }
        description="View available balance, recent activity, and redemption entry points for this account."
        title="Redemption center"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <WorkspaceMetric
            hint="All rewards, grants, and deductions share this available balance."
            label="Available balance"
            value={formatCurrency(balance?.balanceCents ?? 0)}
          />
          <WorkspaceMetric
            hint="Shows recent rewards and deductions as the balance reference before redemption."
            label="Recent activity"
            value={balance?.entries.length ?? 0}
          />
          <WorkspaceMetric hint="Balance, redemptions, and plan resources are handled in this console." label="Redemption path" value="Unified console" />
        </div>
      </WorkspacePanel>

      <WorkspacePanel description="Confirm redemption basis and available quota through balance details and plan resources." title="Reward notes">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-muted/10 shadow-none">
            <CardContent className="flex items-start justify-between gap-3 py-4">
              <div className="flex gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/35 text-muted-foreground">
                  <Coins className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">View balance details</p>
                  <p className="text-xs leading-6 text-muted-foreground">Text and Text，Text。</p>
                </div>
              </div>
              <Button asChild size="icon-sm" variant="ghost">
                <Link to="/dashboard/balance">
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-muted/10 shadow-none">
            <CardContent className="flex items-start justify-between gap-3 py-4">
              <div className="flex gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/35 text-muted-foreground">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">View plan resources</p>
                  <p className="text-xs leading-6 text-muted-foreground">Compare the current subscription and quotas to plan redemptions.</p>
                </div>
              </div>
              <Button asChild size="icon-sm" variant="ghost">
                <Link to="/dashboard/billing">
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </WorkspacePanel>

      <WorkspacePanel description="Recent rewards, deductions, and adjustments are shown here for balance checks." title="Recent reward activity">
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
          <WorkspaceEmpty description="No reward activity yet." title="No reward activity" />
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}
