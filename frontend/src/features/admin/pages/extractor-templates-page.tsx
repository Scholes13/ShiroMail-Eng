import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Textarea } from "@/components/ui/textarea";
import { BasicSelect } from "@/components/ui/basic-select";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceField,
  WorkspacePage,
  WorkspacePanel,
} from "@/components/layout/workspace-ui";
import { getAPIErrorMessage } from "@/lib/http";
import { paginateItems } from "@/lib/pagination";
import {
  createAdminMailExtractorRule,
  deleteAdminMailExtractorRule,
  fetchAdminMailExtractorRules,
  fetchAdminMailboxMessages,
  fetchAdminMailboxes,
  testAdminMailExtractorRule,
  updateAdminMailExtractorRule,
  type AdminMailbox,
} from "../api";
import type { MailExtractorRule } from "../../user/api";
import { emptyRuleDraft, normalizeMailExtractorRule, toRuleDraft, validateRuleDraft, type RuleDraft } from "../../user/extractor-rule-form";

const targetFieldOptions = [
  { value: "subject", label: "Subject" },
  { value: "from_addr", label: "Sender" },
  { value: "to_addr", label: "Recipient" },
  { value: "text_body", label: "Body" },
  { value: "html_text", label: "HTML Text" },
  { value: "raw_text", label: "Raw" },
] as const;

const ADMIN_EXTRACTOR_TEMPLATES_PAGE_SIZE = 8;

export function AdminExtractorTemplatesPage() {
  const queryClient = useQueryClient();
  const [selectedRuleId, setSelectedRuleId] = useState<number | "new">("new");
  const [rulesPage, setRulesPage] = useState(1);
  const [draft, setDraft] = useState<RuleDraft>(emptyRuleDraft);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sampleMailboxId, setSampleMailboxId] = useState("");
  const [sampleMessageId, setSampleMessageId] = useState("");

  const rulesQuery = useQuery({
    queryKey: ["admin-mail-extractor-rules"],
    queryFn: fetchAdminMailExtractorRules,
  });
  const mailboxesQuery = useQuery({
    queryKey: ["admin-mailboxes"],
    queryFn: fetchAdminMailboxes,
  });

  const mailboxes = (mailboxesQuery.data ?? []).filter((mailbox) => mailbox.status === "active");
  const resolvedMailboxId = sampleMailboxId ? Number(sampleMailboxId) : mailboxes[0]?.id;
  const messagesQuery = useQuery({
    queryKey: ["admin-extractor-template-messages", resolvedMailboxId],
    queryFn: () => fetchAdminMailboxMessages(resolvedMailboxId!),
    enabled: Boolean(resolvedMailboxId),
    staleTime: 10_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...draft,
        captureGroupIndex: draft.resultMode === "capture_group" ? Number(draft.captureGroupIndex ?? 1) : undefined,
      };
      if (selectedRuleId === "new") {
        return createAdminMailExtractorRule(payload);
      }
      return updateAdminMailExtractorRule(selectedRuleId, payload);
    },
    onSuccess: async (savedRule) => {
      setFeedback("Text。");
      setSelectedRuleId(savedRule.id);
      setDraft(toRuleDraft(savedRule));
      await queryClient.invalidateQueries({ queryKey: ["admin-mail-extractor-rules"] });
    },
    onError: (error) => setFeedback(getAPIErrorMessage(error, "TextDefault templatesText。")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: number) => deleteAdminMailExtractorRule(ruleId),
    onSuccess: async () => {
      setFeedback("Default templatesText。");
      setSelectedRuleId("new");
      setDraft(emptyRuleDraft());
      await queryClient.invalidateQueries({ queryKey: ["admin-mail-extractor-rules"] });
    },
    onError: (error) => setFeedback(getAPIErrorMessage(error, "TextDefault templatesText。")),
  });

  const testMutation = useMutation({
    mutationFn: async () =>
      testAdminMailExtractorRule(
        {
          ...draft,
          captureGroupIndex: draft.resultMode === "capture_group" ? Number(draft.captureGroupIndex ?? 1) : undefined,
        },
        resolvedMailboxId && sampleMessageId
          ? { mailboxId: Number(resolvedMailboxId), messageId: Number(sampleMessageId) }
          : {},
      ),
    onError: (error) => setFeedback(getAPIErrorMessage(error, "TextDefault templatesText。")),
  });

  const rules = (rulesQuery.data ?? []).map(normalizeMailExtractorRule);
  const messages = messagesQuery.data ?? [];
  const paginatedRules = useMemo(
    () => paginateItems(rules, rulesPage, ADMIN_EXTRACTOR_TEMPLATES_PAGE_SIZE),
    [rules, rulesPage],
  );

  function selectRule(rule: MailExtractorRule) {
    setSelectedRuleId(rule.id);
    setDraft(toRuleDraft(rule));
    setFeedback(null);
  }

  function handleSave() {
    const error = validateRuleDraft(draft);
    if (error) {
      setFeedback(error);
      return;
    }
    saveMutation.mutate();
  }

  function handleTest() {
    const error = validateRuleDraft(draft);
    if (error) {
      setFeedback(error);
      return;
    }
    testMutation.mutate();
  }

  return (
    <WorkspacePage>
      <WorkspacePanel
        title="Text"
        description="TextEnableTextExtraction rulesText。"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedRuleId("new");
              setDraft(emptyRuleDraft());
              setFeedback(null);
            }}
          >
            <Plus className="size-4" />
            Text
          </Button>
        }
      >
        {feedback ? (
          <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
            {feedback}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            {rules.length ? (
              <>
                {paginatedRules.items.map((rule) => (
                <button key={rule.id} type="button" className="block w-full text-left" onClick={() => selectRule(rule)}>
                  <Card className={selectedRuleId === rule.id ? "border-primary/40 bg-muted/20 shadow-none" : "border-border/60 bg-muted/10 shadow-none"}>
                    <CardContent className="space-y-2 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{rule.name}</div>
                          <div className="text-xs text-muted-foreground">{rule.label || "No label set"}</div>
                        </div>
                        <WorkspaceBadge variant={rule.enabled ? "secondary" : "outline"}>
                          {rule.enabled ? "Enable" : "Disable"}
                        </WorkspaceBadge>
                      </div>
                      <div className="text-xs text-muted-foreground">{rule.targetFields.join(" / ") || "No field selected"}</div>
                    </CardContent>
                  </Card>
                </button>
                ))}
                <PaginationControls
                  itemLabel="Text"
                  onPageChange={setRulesPage}
                  page={paginatedRules.page}
                  pageSize={ADMIN_EXTRACTOR_TEMPLATES_PAGE_SIZE}
                  total={paginatedRules.total}
                  totalPages={paginatedRules.totalPages}
                />
              </>
            ) : (
              <WorkspaceEmpty title="TextDefault templates" description="Text，TextEnableText。" />
            )}
          </div>

          <div className="space-y-4">
            <Card className="border-border/60 bg-muted/10 shadow-none">
              <CardContent className="space-y-4 py-4">
                <div className="text-sm font-medium">{selectedRuleId === "new" ? "TextDefault templates" : "TextDefault templates"}</div>

                <div className="grid gap-3 md:grid-cols-2">
                  <WorkspaceField label="Text">
                    <Input aria-label="Text" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                  </WorkspaceField>
                  <WorkspaceField label="Result label">
                    <Input aria-label="Result label" value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} />
                  </WorkspaceField>
                </div>

                <WorkspaceField label="Description">
                  <Textarea aria-label="TextDescription" rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                </WorkspaceField>

                <WorkspaceField label="Extraction field">
                  <div className="grid gap-2 md:grid-cols-2">
                    {targetFieldOptions.map((option) => (
                      <label className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm" key={option.value}>
                        <Checkbox
                          checked={draft.targetFields.includes(option.value)}
                          onCheckedChange={(checked) =>
                            setDraft((current) => ({
                              ...current,
                              targetFields: checked === true
                                ? [...current.targetFields, option.value]
                                : current.targetFields.filter((item) => item !== option.value),
                            }))
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </WorkspaceField>

                <div className="grid gap-3 md:grid-cols-3">
                  <WorkspaceField label="Flags">
                    <Input aria-label="Regex flags" value={draft.flags} onChange={(event) => setDraft((current) => ({ ...current, flags: event.target.value }))} />
                  </WorkspaceField>
                  <WorkspaceField label="Result mode">
                    <BasicSelect value={draft.resultMode} onChange={(event) => setDraft((current) => ({ ...current, resultMode: event.target.value }))}>
                      <option value="first_match">First match</option>
                      <option value="all_matches">All matches</option>
                      <option value="capture_group">Capture group</option>
                    </BasicSelect>
                  </WorkspaceField>
                  <WorkspaceField label="Capture group">
                    <Input
                      type="number"
                      aria-label="Capture group"
                      value={String(draft.captureGroupIndex ?? 1)}
                      onChange={(event) => setDraft((current) => ({ ...current, captureGroupIndex: Number(event.target.value || 0) }))}
                      disabled={draft.resultMode !== "capture_group"}
                    />
                  </WorkspaceField>
                </div>

                <WorkspaceField label="Regular expression">
                  <Textarea aria-label="Regular expression" rows={5} value={draft.pattern} onChange={(event) => setDraft((current) => ({ ...current, pattern: event.target.value }))} placeholder="Example: \\b(\\d{6})\\b" />
                </WorkspaceField>

                <div className="grid gap-3 md:grid-cols-2">
                  <WorkspaceField label="SenderText">
                    <Input aria-label="SenderText" value={draft.senderContains} onChange={(event) => setDraft((current) => ({ ...current, senderContains: event.target.value }))} placeholder="Plain text contains only, e.g. noreply@x.ai" />
                  </WorkspaceField>
                  <WorkspaceField label="SubjectText">
                    <Input aria-label="SubjectText" value={draft.subjectContains} onChange={(event) => setDraft((current) => ({ ...current, subjectContains: event.target.value }))} placeholder="Plain text contains only, e.g. verification code" />
                  </WorkspaceField>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <WorkspaceField label="Text（Text）">
                    <BasicSelect
                      value={draft.mailboxIds[0] ? String(draft.mailboxIds[0]) : ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          mailboxIds: event.target.value ? [Number(event.target.value)] : [],
                        }))
                      }
                    >
                      <option value="">All mailboxes</option>
                      {mailboxes.map((mailbox: AdminMailbox) => (
                        <option key={mailbox.id} value={mailbox.id}>
                          {mailbox.address}
                        </option>
                      ))}
                    </BasicSelect>
                  </WorkspaceField>
                  <WorkspaceField label="Sort weight">
                    <Input aria-label="Sort weight" type="number" value={String(draft.sortOrder)} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))} />
                  </WorkspaceField>
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <Checkbox checked={draft.enabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked === true }))} />
                  <span>EnableTextDefault templates</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving…" : "Text"}
                  </Button>
                  {selectedRuleId !== "new" ? (
                    <Button variant="outline" onClick={() => deleteMutation.mutate(Number(selectedRuleId))} disabled={deleteMutation.isPending}>
                      Text
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-muted/10 shadow-none">
              <CardContent className="space-y-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Text</div>
                  <Button size="sm" variant="outline" onClick={() => void rulesQuery.refetch()}>
                    <RefreshCw className={`size-4 ${rulesQuery.isFetching ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <WorkspaceField label="Test mailbox">
                    <BasicSelect value={sampleMailboxId || (resolvedMailboxId ? String(resolvedMailboxId) : "")} onChange={(event) => {
                      setSampleMailboxId(event.target.value);
                      setSampleMessageId("");
                    }}>
                      {mailboxes.map((mailbox) => (
                        <option key={mailbox.id} value={mailbox.id}>
                          {mailbox.address}
                        </option>
                      ))}
                    </BasicSelect>
                  </WorkspaceField>
                  <WorkspaceField label="Test message">
                    <BasicSelect value={sampleMessageId} onChange={(event) => setSampleMessageId(event.target.value)}>
                      <option value="">Select a message</option>
                      {messages.map((message) => (
                        <option key={message.id} value={message.id}>
                          {(message.subject || "(No subject)").slice(0, 40)}
                        </option>
                      ))}
                    </BasicSelect>
                  </WorkspaceField>
                </div>

                <Button onClick={handleTest} disabled={testMutation.isPending || !sampleMessageId}>
                  {testMutation.isPending ? "Testing…" : "Text"}
                </Button>

                {testMutation.data?.items.length ? (
                  <div className="space-y-2">
                    {testMutation.data.items.map((item, index) => (
                      <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-3" key={`${item.ruleId}-${index}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <WorkspaceBadge variant="outline">{item.label || item.ruleName}</WorkspaceBadge>
                          <span className="text-xs text-muted-foreground">{item.sourceField}</span>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap break-all text-sm leading-6">{item.values?.join("\n") || item.value}</div>
                      </div>
                    ))}
                  </div>
                ) : testMutation.isSuccess ? (
                  <WorkspaceEmpty title="No matches" description="TextTest messageText and TextDefault templates。" />
                ) : (
                  <WorkspaceEmpty title="Select a messageText" description="Text，TextEnable。" />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
