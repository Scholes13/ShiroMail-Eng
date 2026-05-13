import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceListRow,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import {
  fetchAdminAudit,
  fetchAdminConfigs,
  fetchAdminDomainProviders,
  fetchAdminJobs,
} from "../api";
import {
  describeInboundSpoolFailure,
} from "../smtp-diagnostics";
import { formatDateTime } from "../../user/pages/shared";

function formatAuditEntry(item: Awaited<ReturnType<typeof fetchAdminAudit>>[number]) {
  const detail = item.detail ?? {};
  if (item.action === "admin.mail_delivery.test") {
    const recipient =
      typeof detail.recipient === "string" && detail.recipient.trim()
        ? detail.recipient.trim()
        : item.resourceId;
    return {
      title: "SMTP test sent",
      description: `Delivery test was accepted for ${recipient}.`,
      badges: [
        { text: "smtp", variant: "outline" as const },
        { text: "ok", variant: "outline" as const },
      ],
    };
  }
  if (item.action === "admin.mail_delivery.test_failed") {
    const recipient =
      typeof detail.recipient === "string" && detail.recipient.trim()
        ? detail.recipient.trim()
        : item.resourceId;
    const code =
      typeof detail.code === "string" && detail.code.trim()
        ? detail.code.trim()
        : "delivery_failed";
    const stage =
      typeof detail.stage === "string" && detail.stage.trim()
        ? detail.stage.trim()
        : "unknown";
    const hint =
      typeof detail.hint === "string" && detail.hint.trim()
        ? detail.hint.trim()
        : "Check SMTP settings and upstream server logs.";
    const retryable =
      typeof detail.retryable === "boolean" ? detail.retryable : false;
    return {
      title: `SMTP test failed · ${code}`,
      description: `${recipient} · stage ${stage}. ${hint}`,
      badges: [
        { text: "smtp", variant: "outline" as const },
        { text: "failed", variant: "destructive" as const },
        { text: retryable ? "retryable" : "check config", variant: retryable ? "outline" as const : "secondary" as const },
      ],
    };
  }

  return {
    title: item.action,
    description: `${item.resourceType} / ${item.resourceId}`,
    badges: [] as Array<{ text: string; variant: "default" | "secondary" | "outline" | "destructive" }>,
  };
}

export function AdminResourcesPage() {
  const providersQuery = useQuery({
    queryKey: ["admin-domain-providers"],
    queryFn: fetchAdminDomainProviders,
  });
  const configsQuery = useQuery({
    queryKey: ["admin-configs"],
    queryFn: fetchAdminConfigs,
  });
  const jobsQuery = useQuery({ queryKey: ["admin-jobs"], queryFn: fetchAdminJobs });
  const auditQuery = useQuery({ queryKey: ["admin-audit"], queryFn: fetchAdminAudit });

  const providerItems = providersQuery.data ?? [];
  const configItems = configsQuery.data ?? [];
  const jobItems = jobsQuery.data ?? [];
  const auditItems = (auditQuery.data ?? []).slice(0, 6);

  return (
    <WorkspacePage>
      <WorkspacePanel description="Text、Text。" title="Text">
        <div className="grid gap-4 xl:grid-cols-3">
          <ResourceSummaryCard
            description="DNS Provider Text"
            title="Provider Text"
            value={providerItems.length}
          />
          <ResourceSummaryCard
            description="Text"
            title="Text"
            value={configItems.length}
          />
          <ResourceSummaryCard
            description="Text"
            title="Text"
            value={jobItems.length}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-border/60 bg-card/92 shadow-none">
            <CardContent className="space-y-3 py-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Provider Text</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  TextDomainText。
                </p>
              </div>
              {providerItems.length ? (
                <div className="space-y-3">
                  {providerItems.slice(0, 5).map((item) => (
                    <WorkspaceListRow
                      description={`${item.provider} · ${item.capabilities.length} capabilities`}
                      key={item.id}
                      meta={
                        <>
                          <WorkspaceBadge>{item.status}</WorkspaceBadge>
                          <span>{formatDateTime(item.updatedAt)}</span>
                        </>
                      }
                      title={item.displayName}
                    />
                  ))}
                </div>
              ) : (
                <WorkspaceEmpty description="Text Provider Text。" title="Text Provider Text" />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/92 shadow-none">
            <CardContent className="space-y-3 py-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Text</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Text，Text。
                </p>
              </div>
              {configItems.length ? (
                <div className="space-y-3">
                  {configItems.slice(0, 5).map((item) => (
                    <WorkspaceListRow
                      description={`updated by #${item.updatedBy}`}
                      key={item.key}
                      meta={<span>{formatDateTime(item.updatedAt)}</span>}
                      title={item.key}
                    />
                  ))}
                </div>
              ) : (
                <WorkspaceEmpty description="Text。" title="Text" />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/92 shadow-none">
            <CardContent className="space-y-3 py-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Text</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Text，Text worker Textissue。
                </p>
              </div>
              {jobItems.length ? (
                <div className="space-y-3">
                  {jobItems.slice(0, 5).map((item) => {
                    const failure = item.diagnostic ?? (item.errorMessage ? describeInboundSpoolFailure(item.errorMessage) : null);
                    return (
                      <WorkspaceListRow
                        description={
                          failure ? (
                            <div className="space-y-1">
                              <p>{failure.title}</p>
                              <p className="text-muted-foreground">{failure.description}</p>
                            </div>
                          ) : (item.errorMessage || "Text")
                        }
                        key={item.id}
                        meta={
                          <>
                            <WorkspaceBadge>{item.status}</WorkspaceBadge>
                            {failure ? (
                              <WorkspaceBadge variant={failure.retryable ? "outline" : "secondary"}>
                                {failure.retryable ? "retryable" : "check config"}
                              </WorkspaceBadge>
                            ) : null}
                            <span>{formatDateTime(item.createdAt)}</span>
                          </>
                        }
                        title={item.jobType}
                        titleClassName="whitespace-normal"
                        descriptionClassName="whitespace-normal"
                      />
                    );
                  })}
                </div>
              ) : (
                <WorkspaceEmpty description="Text。" title="Text" />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/92 shadow-none">
            <CardContent className="space-y-3 py-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Text</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Text，Text。
                </p>
              </div>
              {auditItems.length ? (
                <div className="space-y-3">
                  {auditItems.map((item) => (
                    <WorkspaceListRow
                      description={formatAuditEntry(item).description}
                      key={item.id}
                      meta={
                        <>
                          {formatAuditEntry(item).badges.map((badge) => (
                            <WorkspaceBadge key={`${item.id}-${badge.text}`} variant={badge.variant}>
                              {badge.text}
                            </WorkspaceBadge>
                          ))}
                          <span>{formatDateTime(item.createdAt)}</span>
                          <WorkspaceBadge variant="outline">actor #{item.actorUserId}</WorkspaceBadge>
                        </>
                      }
                      title={formatAuditEntry(item).title}
                      titleClassName="whitespace-normal"
                      descriptionClassName="whitespace-normal"
                    />
                  ))}
                </div>
              ) : (
                <WorkspaceEmpty description="Text。" title="Text" />
              )}
            </CardContent>
          </Card>
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}

function ResourceSummaryCard({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: number;
}) {
  return (
    <Card className="border-border/60 bg-card/92 shadow-none">
      <CardContent className="space-y-2 py-4">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
