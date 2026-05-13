import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Database, Globe, Users } from "lucide-react";
import { PublicBottomCta, PublicPageHero, PublicShell } from "../components/public-shell";
import { PublicFeatureCard, PublicInfoCard, PublicSection } from "../components/public-ui";
import { Button } from "@/components/ui/button";
import { fetchPublicSiteStats } from "../api";

export function StatsPage() {
  const statsQuery = useQuery({
    queryKey: ["public-site-stats"],
    queryFn: fetchPublicSiteStats,
    staleTime: 15_000,
  });
  const stats = statsQuery.data;
  const formattedUpdatedAt =
    typeof stats?.updatedAt === "string" && !Number.isNaN(Date.parse(stats.updatedAt))
      ? new Date(stats.updatedAt).toLocaleString()
      : null;
  const metricCards = [
    { title: "TextDomain", value: stats?.activeDomainCount ?? 0, icon: Globe },
    { title: "Active mailboxes", value: stats?.activeMailboxCount ?? 0, icon: Database },
    { title: "Text", value: stats?.todayMessageCount ?? 0, icon: Activity },
    { title: "Text", value: stats?.totalUserCount ?? 0, icon: Users },
    { title: "Text", value: stats?.failedJobCount ?? 0, icon: AlertTriangle },
  ];

  return (
    <PublicShell>
      <PublicPageHero
        eyebrow="Stats"
        title="Text"
        description="Text。"
      />

      <PublicSection description="Text。" title="Text">
        <div className="mb-3 flex items-center justify-end">
          <Button onClick={() => statsQuery.refetch()} size="sm" variant="outline">
            Refresh data
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {metricCards.map((item) => (
            <PublicFeatureCard
              description={statsQuery.isLoading ? "Text..." : `${item.value.toLocaleString()} Text`}
              icon={item.icon}
              key={item.title}
              title={item.title}
            />
          ))}
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm leading-6 text-muted-foreground">
          {statsQuery.isLoading
            ? "Text..."
            : statsQuery.isError
              ? "Text，Text“Refresh data”Text。"
            : formattedUpdatedAt
              ? `Text：${formattedUpdatedAt}`
              : "Text，TextRefreshText。"}
        </div>
      </PublicSection>

      <PublicInfoCard title="Text">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm leading-6 text-muted-foreground">
            Text。
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm leading-6 text-muted-foreground">
            Text。
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm leading-6 text-muted-foreground">
            Text。
          </div>
        </div>
      </PublicInfoCard>

      <PublicBottomCta />
    </PublicShell>
  );
}
