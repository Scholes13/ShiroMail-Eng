import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  WorkspaceBadge,
  WorkspaceListRow,
} from "@/components/layout/workspace-ui";
import type { MailDeliveryDiagnosticPayload } from "@/lib/http";
import { formatDateTime } from "../../user/pages/shared";

export type DeliveryTestDiagnosticState = {
  status: "idle" | "success" | "error";
  recipient: string;
  testedAt?: string;
  message?: string;
  diagnostic?: MailDeliveryDiagnosticPayload;
};

type DeliveryTestPanelProps = {
  recipient: string;
  onRecipientChange: (value: string) => void;
  isPending: boolean;
  onSendTest: () => void;
  diagnosticState: DeliveryTestDiagnosticState;
};

export function DeliveryTestPanel({
  recipient,
  onRecipientChange,
  isPending,
  onSendTest,
  diagnosticState,
}: DeliveryTestPanelProps) {
  return (
    <>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 md:flex-row md:items-end">
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium">Text</div>
          <Input
            aria-label="Text"
            placeholder="Text"
            value={recipient}
            onChange={(event) => onRecipientChange(event.target.value)}
          />
        </div>
        <Button disabled={isPending} onClick={onSendTest}>
          {isPending ? "Text..." : "TextTest message"}
        </Button>
      </div>
      {diagnosticState.status !== "idle" ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-card/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium">Text SMTP Text</div>
            <WorkspaceBadge
              variant={
                diagnosticState.status === "success"
                  ? "outline"
                  : "destructive"
              }
            >
              {diagnosticState.status === "success" ? "Success" : "Failed"}
            </WorkspaceBadge>
            {diagnosticState.diagnostic?.code ? (
              <WorkspaceBadge variant="secondary">
                {diagnosticState.diagnostic.code}
              </WorkspaceBadge>
            ) : null}
            {typeof diagnosticState.diagnostic?.retryable === "boolean" ? (
              <WorkspaceBadge
                variant={
                  diagnosticState.diagnostic.retryable
                    ? "outline"
                    : "secondary"
                }
              >
                {diagnosticState.diagnostic.retryable
                  ? "Retryable"
                  : "Check config"}
              </WorkspaceBadge>
            ) : null}
          </div>
          <div className="mt-3 space-y-3">
            <WorkspaceListRow
              title={diagnosticState.message ?? "Text"}
              description={
                diagnosticState.diagnostic?.hint ??
                (diagnosticState.status === "success"
                  ? "Text and Text，Text SMTP Text、Text。"
                  : "Text，Text and Text。")
              }
              meta={
                <>
                  <WorkspaceBadge variant="outline">
                    {diagnosticState.recipient || "TextRecipient"}
                  </WorkspaceBadge>
                  {diagnosticState.diagnostic?.stage ? (
                    <WorkspaceBadge variant="secondary">
                      stage: {diagnosticState.diagnostic.stage}
                    </WorkspaceBadge>
                  ) : null}
                  {diagnosticState.testedAt ? (
                    <span>{formatDateTime(diagnosticState.testedAt)}</span>
                  ) : null}
                </>
              }
              titleClassName="whitespace-normal"
              descriptionClassName="whitespace-normal"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
