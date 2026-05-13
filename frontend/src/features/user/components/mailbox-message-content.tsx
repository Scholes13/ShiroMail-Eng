import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  WorkspaceEmpty,
} from "@/components/layout/workspace-ui";
import {
  buildMailHtmlDocument,
  openHtmlPreviewWindow,
  resolveMessageBody,
} from "@/features/mail-preview";
import { FileText } from "lucide-react";
import type { MailboxMessage, MailboxMessageSummary } from "../api";

export type MessageViewMode = "text" | "html" | "raw";

export type RawPreview = {
  preview: string;
  headers: string;
  body: string;
  isTruncated: boolean;
};

export type HtmlPreview = {
  html: string;
  notices: string[];
};

type Props = {
  selectedMessage: MailboxMessage;
  htmlPreview: HtmlPreview | null;
  rawPreview: RawPreview | null;
  canAutoLoadRawPreview: boolean;
  rawPreviewRequested: boolean;
  onRequestRawPreview: () => void;
  isRawLoading: boolean;
  messageViewMode: MessageViewMode;
  onMessageViewModeChange: (mode: MessageViewMode) => void;
  selectedMessageSummary: MailboxMessageSummary;
  onFeedback: (msg: string | null) => void;
};

export function MessageContentCard({
  selectedMessage,
  htmlPreview,
  rawPreview,
  canAutoLoadRawPreview,
  rawPreviewRequested,
  onRequestRawPreview,
  isRawLoading,
  messageViewMode,
  onMessageViewModeChange,
  selectedMessageSummary,
  onFeedback,
}: Props) {
  return (
    <Card className="border-border/60 bg-background/60 shadow-none">
      <CardContent className="space-y-2 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4" />
            Text
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {messageViewMode === "html" && htmlPreview ? (
              <Button size="sm" type="button" variant="outline" onClick={() => openHtmlPreviewWindow(htmlPreview.html)}>
                Text
              </Button>
            ) : null}
            <div className="inline-flex rounded-lg border border-border/60 bg-muted/20 p-1">
              {([
                { value: "text" as const, label: "Text" },
                { value: "html" as const, label: "HTML" },
                { value: "raw" as const, label: "Raw" },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs transition ${
                    messageViewMode === option.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => onMessageViewModeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {messageViewMode === "html" ? <HtmlContent htmlPreview={htmlPreview} /> : null}
        {messageViewMode === "raw" ? (
          <RawContent
            rawPreview={rawPreview}
            canAutoLoadRawPreview={canAutoLoadRawPreview}
            rawPreviewRequested={rawPreviewRequested}
            onRequestRawPreview={onRequestRawPreview}
            isRawLoading={isRawLoading}
            selectedMessageSummary={selectedMessageSummary}
            onFeedback={onFeedback}
          />
        ) : null}
        {messageViewMode === "text" ? (
          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
            {resolveMessageBody(selectedMessage)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function HtmlContent({ htmlPreview }: { htmlPreview: HtmlPreview | null }) {
  if (!htmlPreview) {
    return <WorkspaceEmpty description="Text HTML Body。" title="Text HTML Text" />;
  }
  return (
    <div className="space-y-3">
      {htmlPreview.notices.length ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
          {htmlPreview.notices.map((notice) => <p key={notice}>{notice}</p>)}
        </div>
      ) : null}
      <iframe
        className="min-h-[420px] w-full rounded-xl border border-border/60 bg-white"
        sandbox="allow-same-origin"
        srcDoc={buildMailHtmlDocument(htmlPreview.html)}
        title="HTML Text"
        onLoad={(event) => {
          const frame = event.currentTarget;
          const doc = frame.contentDocument;
          const height = doc?.documentElement?.scrollHeight ?? doc?.body?.scrollHeight ?? 420;
          frame.style.height = `${Math.max(height + 8, 420)}px`;
        }}
      />
    </div>
  );
}

function RawContent({
  rawPreview,
  canAutoLoadRawPreview,
  rawPreviewRequested,
  onRequestRawPreview,
  isRawLoading,
  selectedMessageSummary,
  onFeedback,
}: {
  rawPreview: RawPreview | null;
  canAutoLoadRawPreview: boolean;
  rawPreviewRequested: boolean;
  onRequestRawPreview: () => void;
  isRawLoading: boolean;
  selectedMessageSummary: MailboxMessageSummary;
  onFeedback: (msg: string | null) => void;
}) {
  if (!canAutoLoadRawPreview && !rawPreviewRequested) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
          Text {Math.max(1, Math.round((selectedMessageSummary.sizeBytes || 0) / 1024))} KB。
          Text，Raw Text；Text，Text。
        </div>
        <div className="flex justify-end">
          <Button size="sm" type="button" variant="outline" onClick={onRequestRawPreview}>
            Text Raw Text
          </Button>
        </div>
      </div>
    );
  }
  if (isRawLoading) {
    return <WorkspaceEmpty description="Text，Text。" title="Text Raw" />;
  }
  if (!rawPreview) {
    return <WorkspaceEmpty description="Text Raw Text。" title="Raw Text" />;
  }
  return (
    <div className="space-y-3">
      {rawPreview.isTruncated ? (
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-xs leading-6 text-muted-foreground">
          Raw Text，Text {Math.max(1, Math.round(rawPreview.preview.length / 1024))} KB Text。
          Text"Text"。
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
          <div className="mb-2 text-xs font-medium text-foreground">Raw Headers</div>
          <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
            {rawPreview.headers || "Text Header Text。"}
          </pre>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
          <div className="mb-2 text-xs font-medium text-foreground">Raw Body</div>
          <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
            {rawPreview.body || "Text Body Text。"}
          </pre>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(rawPreview.preview).then(
              () => onFeedback(rawPreview.isTruncated ? "Raw Text，Text。" : "Raw Text。"),
              () => onFeedback(rawPreview.isTruncated ? "Text Raw Text，Text。" : "Text Raw Text，Text。"),
            );
          }}
        >
          {rawPreview.isTruncated ? "Text" : "Text Raw"}
        </Button>
      </div>
      <pre className="max-h-[320px] overflow-auto rounded-xl border border-border/60 bg-muted/20 p-4 text-xs leading-6 text-muted-foreground whitespace-pre-wrap break-all">
        {rawPreview.preview}
      </pre>
    </div>
  );
}
