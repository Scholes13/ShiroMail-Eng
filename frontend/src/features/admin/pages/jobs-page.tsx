import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BasicSelect } from "@/components/ui/basic-select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceField,
  WorkspaceListRow,
  WorkspaceMetric,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import {
  fetchAdminSMTPMetrics,
  fetchAdminInboundSpool,
  fetchAdminJobs,
  retryAdminInboundSpoolItem,
} from "../api";
import {
  describeInboundSpoolFailure,
  describeSMTPRejectedReason,
} from "../smtp-diagnostics";
import { formatDateTime } from "../../user/pages/shared";

const ADMIN_INBOUND_SPOOL_PAGE_SIZE = 10;
const spoolStatusOptions = [
  { label: "Text", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];
const spoolFailureModeOptions = [
  { label: "Text", value: "all" },
  { label: "Retryable", value: "retryable" },
  { label: "Check config", value: "non_retryable" },
];

function buildSpoolStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "failed":
      return "destructive";
    case "processing":
      return "default";
    case "completed":
      return "secondary";
    default:
      return "outline";
  }
}

export function AdminJobsPage() {
  const queryClient = useQueryClient();
  const [spoolStatus, setSpoolStatus] = useState("all");
  const [spoolFailureMode, setSpoolFailureMode] = useState("all");
  const [spoolPage, setSpoolPage] = useState(1);

  const jobsQuery = useQuery({ queryKey: ["admin-jobs"], queryFn: fetchAdminJobs });
  const smtpMetricsQuery = useQuery({ queryKey: ["admin-smtp-metrics"], queryFn: fetchAdminSMTPMetrics });
  const spoolQuery = useQuery({
    queryKey: ["admin-inbound-spool", spoolStatus, spoolFailureMode, spoolPage],
    queryFn: () =>
      fetchAdminInboundSpool({
        status: spoolStatus,
        failureMode: spoolFailureMode,
        page: spoolPage,
        pageSize: ADMIN_INBOUND_SPOOL_PAGE_SIZE,
      }),
  });

  const retryMutation = useMutation({
    mutationFn: retryAdminInboundSpoolItem,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-inbound-spool"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-smtp-metrics"] }),
      ]);
    },
  });

  const jobs = jobsQuery.data ?? [];
  const smtpMetrics = smtpMetricsQuery.data;
  const spool = spoolQuery.data;
  const totalSpoolPages = Math.max(1, Math.ceil((spool?.total ?? 0) / (spool?.pageSize ?? ADMIN_INBOUND_SPOOL_PAGE_SIZE)));
  const isRefreshing = jobsQuery.isRefetching || spoolQuery.isRefetching || smtpMetricsQuery.isRefetching;
  const failedJobCount = useMemo(() => jobs.filter((item) => item.status === "failed").length, [jobs]);

  async function handleRefresh() {
    await Promise.all([jobsQuery.refetch(), spoolQuery.refetch(), smtpMetricsQuery.refetch()]);
  }

  return (
    <WorkspacePage>
      <div className="grid gap-3 md:grid-cols-4">
        <WorkspaceMetric hint="Text" label="Text" value={failedJobCount} />
        <WorkspaceMetric hint="Text worker Text SMTP Text" label="Pending Spool" value={spool?.summary.pending ?? 0} />
        <WorkspaceMetric hint="Text SMTP Text" label="Processing Spool" value={spool?.summary.processing ?? 0} />
        <WorkspaceMetric hint="Text" label="Failed Spool" value={spool?.summary.failed ?? 0} />
      </div>

      <WorkspacePanel
        description="Text worker Text、SMTP Text、Text，Text spool Text。"
        title="Text"
        action={
          <Button size="sm" type="button" variant="outline" onClick={() => void handleRefresh()}>
            <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      >
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <WorkspacePanel
              className="border-dashed"
              description="Text metrics Text SMTP Text、Text spool Text，Text。"
              title="SMTP Text"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <WorkspaceMetric hint="SMTP listener Text" label="Sessions" value={smtpMetrics?.sessionsStarted ?? 0} />
                <WorkspaceMetric hint="SMTP RCPT TO Text" label="Recipients Accepted" value={smtpMetrics?.recipientsAccepted ?? 0} />
                <WorkspaceMetric hint="DATA Text" label="Bytes Received" value={smtpMetrics?.bytesReceived ?? 0} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <WorkspacePanel className="border-dashed" description="direct / spool Text。" title="Accepted">
                  {smtpMetrics && Object.keys(smtpMetrics.accepted).length ? (
                    <div className="space-y-3">
                      {Object.entries(smtpMetrics.accepted).map(([key, value]) => (
                        <WorkspaceListRow
                          key={key}
                          title={key}
                          meta={<WorkspaceBadge variant="secondary">{value}</WorkspaceBadge>}
                        />
                      ))}
                    </div>
                  ) : (
                    <WorkspaceEmpty description="Text SMTP Text。" title="Text" />
                  )}
                </WorkspacePanel>
                <WorkspacePanel className="border-dashed" description="Text SMTP Text reject。" title="Rejected">
                  {smtpMetrics && ((smtpMetrics.rejectedDetails?.length ?? 0) > 0 || Object.keys(smtpMetrics.rejected).length) ? (
                    <div className="space-y-3">
                      {(smtpMetrics.rejectedDetails?.length
                        ? smtpMetrics.rejectedDetails.map((detail) => ({
                            key: detail.key,
                            value: detail.count,
                            reason: detail.diagnostic,
                          }))
                        : Object.entries(smtpMetrics.rejected).map(([key, value]) => ({
                            key,
                            value,
                            reason: describeSMTPRejectedReason(key),
                          }))).map(({ key, value, reason }) => {
                        return (
                        <WorkspaceListRow
                          key={key}
                          title={reason.title}
                          description={reason.description}
                          meta={<WorkspaceBadge variant="destructive">{value}</WorkspaceBadge>}
                          titleClassName="whitespace-normal"
                          descriptionClassName="whitespace-normal"
                        />
                        );
                      })}
                    </div>
                  ) : (
                    <WorkspaceEmpty description="Text SMTP reject Text。" title="Text" />
                  )}
                </WorkspacePanel>
                <WorkspacePanel className="border-dashed" description="worker Text inbound spool Text completed / failed Text。" title="Spool Worker">
                  {smtpMetrics && Object.keys(smtpMetrics.spoolProcessed).length ? (
                    <div className="space-y-3">
                      {Object.entries(smtpMetrics.spoolProcessed).map(([key, value]) => (
                        <WorkspaceListRow
                          key={key}
                          title={key}
                          meta={<WorkspaceBadge variant={key === "failed" ? "destructive" : "outline"}>{value}</WorkspaceBadge>}
                        />
                      ))}
                    </div>
                  ) : (
                    <WorkspaceEmpty description="Text worker spool Text。" title="Text spool Text" />
                  )}
                </WorkspacePanel>
              </div>
            </WorkspacePanel>

            <WorkspacePanel
              className="border-dashed"
              description="Text worker / cleanup / spool Text。"
              title="Text"
            >
              {jobs.length ? (
                <div className="space-y-3">
                  {jobs.map((item) => {
                    const failure = item.diagnostic ?? (item.errorMessage ? describeInboundSpoolFailure(item.errorMessage) : null);
                    return (
                      <WorkspaceListRow
                        key={item.id}
                        title={`#${item.id} · ${item.jobType}`}
                        description={
                          failure ? (
                            <div className="space-y-1">
                              <p>{failure.title}</p>
                              <p className="text-muted-foreground">{failure.description}</p>
                            </div>
                          ) : (item.errorMessage || "Text")
                        }
                        meta={
                          <>
                            <WorkspaceBadge variant={item.status === "failed" ? "destructive" : "outline"}>
                              {item.status}
                            </WorkspaceBadge>
                            {failure ? (
                              <WorkspaceBadge variant={failure.retryable ? "outline" : "secondary"}>
                                {failure.retryable ? "Retryable" : "Check config"}
                              </WorkspaceBadge>
                            ) : null}
                            <span>{formatDateTime(item.createdAt)}</span>
                          </>
                        }
                        titleClassName="whitespace-normal"
                        descriptionClassName="whitespace-normal"
                      />
                    );
                  })}
                </div>
              ) : (
                <WorkspaceEmpty description="Text。" title="Text" />
              )}
            </WorkspacePanel>

            <WorkspacePanel
              className="border-dashed"
              description="SMTP Text spool，Text worker Text；Text、Text。"
              title="Inbound Spool"
              action={
                <div className="flex items-center gap-2">
                  <WorkspaceField label="Text">
                    <BasicSelect
                      aria-label="Inbound Spool Text"
                      className="min-w-36"
                      value={spoolStatus}
                      onChange={(event) => {
                        setSpoolStatus(event.target.value);
                        setSpoolPage(1);
                      }}
                    >
                      {spoolStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </BasicSelect>
                  </WorkspaceField>
                  <WorkspaceField label="Text">
                    <BasicSelect
                      aria-label="Inbound Spool Text"
                      className="min-w-36"
                      value={spoolFailureMode}
                      onChange={(event) => {
                        setSpoolFailureMode(event.target.value);
                        setSpoolPage(1);
                      }}
                    >
                      {spoolFailureModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </BasicSelect>
                  </WorkspaceField>
                </div>
              }
            >
              {spool?.items.length ? (
                <div className="space-y-3">
                  {spool.items.map((item) => {
                    const isRetrying = retryMutation.isPending && retryMutation.variables === item.id;
                    const failure = item.diagnostic ?? (item.errorMessage
                      ? describeInboundSpoolFailure(item.errorMessage)
                      : null);
                    return (
                      <WorkspaceListRow
                        key={item.id}
                        title={`#${item.id} · ${item.mailFrom || "unknown sender"}`}
                        description={
                          <div className="space-y-1">
                            <p>Recipient：{item.recipients.join(", ") || "Text"}</p>
                            <p>
                              Text：{item.attemptCount} / {item.maxAttempts}
                              {failure ? ` · issue：${failure.title}` : ""}
                            </p>
                            {failure ? (
                              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                <span>{failure.description}</span>
                                <WorkspaceBadge variant={failure.retryable ? "outline" : "secondary"}>
                                  {failure.retryable ? "Retryable" : "Check config"}
                                </WorkspaceBadge>
                              </div>
                            ) : null}
                          </div>
                        }
                        meta={
                          <>
                            <WorkspaceBadge variant={buildSpoolStatusVariant(item.status)}>{item.status}</WorkspaceBadge>
                            <span>{formatDateTime(item.updatedAt)}</span>
                            {item.status === "failed" ? (
                              <Button
                                disabled={isRetrying}
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => retryMutation.mutate(item.id)}
                              >
                                {isRetrying ? (
                                  <LoaderCircle className="size-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="size-4" />
                                )}
                                Text
                              </Button>
                            ) : null}
                          </>
                        }
                      />
                    );
                  })}
                  <PaginationControls
                    itemLabel="spool Text"
                    page={spool.page}
                    pageSize={spool.pageSize}
                    total={spool.total}
                    totalPages={totalSpoolPages}
                    onPageChange={setSpoolPage}
                  />
                </div>
              ) : (
                <WorkspaceEmpty
                  description="Text inbound spool Text，Text SMTP Text。"
                  title="Inbound Spool Text"
                />
              )}
            </WorkspacePanel>
          </div>

          <WorkspacePanel
            className="border-dashed"
            description="Text spool Text，Text。"
            title="Text"
          >
            {spool?.failureReasons.length ? (
              <div className="space-y-3">
                {spool.failureReasons.map((reason) => {
                  const item = reason.diagnostic ?? describeInboundSpoolFailure(reason.message);
                  return (
                  <WorkspaceListRow
                    key={reason.message}
                    title={item.title}
                    description={item.description}
                    meta={
                      <>
                        <WorkspaceBadge variant="destructive">{reason.count} Text</WorkspaceBadge>
                        <WorkspaceBadge variant={item.retryable ? "outline" : "secondary"}>
                          {item.retryable ? "Retryable" : "Check config"}
                        </WorkspaceBadge>
                        <AlertTriangle className="size-4" />
                      </>
                    }
                    titleClassName="whitespace-normal"
                    descriptionClassName="whitespace-normal"
                  />
                  );
                })}
              </div>
            ) : (
              <WorkspaceEmpty description="Text failed spool reason。" title="Text" />
            )}
          </WorkspacePanel>
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
