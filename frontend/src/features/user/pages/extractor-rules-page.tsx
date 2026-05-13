import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import {
  copyMailExtractorTemplate,
  createMailExtractorRule,
  deleteMailExtractorRule,
  disableMailExtractorTemplate,
  enableMailExtractorTemplate,
  fetchDashboard,
  fetchMailboxMessages,
  fetchMailExtractorRules,
  type MailExtractorRule,
  testMailExtractorRule,
  updateMailExtractorRule,
} from "../api";
import { emptyRuleDraft, normalizeMailExtractorRule, toRuleDraft, validateRuleDraft, type RuleDraft } from "../extractor-rule-form";

const targetFieldOptions = [
  { value: "subject", label: "Subject" },
  { value: "from_addr", label: "Sender" },
  { value: "to_addr", label: "Recipient" },
  { value: "text_body", label: "Body" },
  { value: "html_text", label: "HTML Text" },
  { value: "raw_text", label: "Raw" },
] as const;

const resultModeOptions = [
  { value: "first_match", label: "First match" },
  { value: "all_matches", label: "All matches" },
  { value: "capture_group", label: "Capture group" },
] as const;

function targetSummary(rule: Pick<MailExtractorRule, "targetFields">) {
  return targetFieldOptions
    .filter((item) => (rule.targetFields ?? []).includes(item.value))
    .map((item) => item.label)
    .join(" / ");
}

export function UserExtractorRulesPage() {
  const queryClient = useQueryClient();
  const [selectedRuleId, setSelectedRuleId] = useState<number | "new">("new");
  const [draft, setDraft] = useState<RuleDraft>(emptyRuleDraft);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sampleMailboxId, setSampleMailboxId] = useState("");
  const [sampleMessageId, setSampleMessageId] = useState("");

  const rulesQuery = useQuery({
    queryKey: ["mail-extractor-rules"],
    queryFn: fetchMailExtractorRules,
  });
  const dashboardQuery = useQuery({
    queryKey: ["user-dashboard"],
    queryFn: fetchDashboard,
  });

  const mailboxes = useMemo(
    () => (dashboardQuery.data?.mailboxes ?? []).filter((mailbox) => mailbox.status === "active"),
    [dashboardQuery.data?.mailboxes],
  );
  const domains = useMemo(() => dashboardQuery.data?.availableDomains ?? [], [dashboardQuery.data?.availableDomains]);
  const selectedMailboxId = sampleMailboxId ? Number(sampleMailboxId) : mailboxes[0]?.id;
  const messagesQuery = useQuery({
    queryKey: ["extractor-rule-sample-messages", selectedMailboxId],
    queryFn: () => fetchMailboxMessages(selectedMailboxId!),
    enabled: Boolean(selectedMailboxId),
    staleTime: 10_000,
  });

  const userRules = (rulesQuery.data?.rules ?? []).map(normalizeMailExtractorRule);
  const templates = (rulesQuery.data?.templates ?? []).map(normalizeMailExtractorRule);
  const sampleMessages = messagesQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...draft,
        captureGroupIndex: draft.resultMode === "capture_group" ? Number(draft.captureGroupIndex ?? 1) : undefined,
      };
      if (selectedRuleId === "new") {
        return createMailExtractorRule(payload);
      }
      return updateMailExtractorRule(selectedRuleId, payload);
    },
    onSuccess: async (savedRule) => {
      setFeedback("Extraction rule saved.");
      setSelectedRuleId(savedRule.id);
      setDraft(toRuleDraft(savedRule));
      await queryClient.invalidateQueries({ queryKey: ["mail-extractor-rules"] });
    },
    onError: (error) => setFeedback(getAPIErrorMessage(error, "Failed to save extraction rule.")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: number) => deleteMailExtractorRule(ruleId),
    onSuccess: async () => {
      setFeedback("Extraction rule deleted.");
      setSelectedRuleId("new");
      setDraft(emptyRuleDraft());
      await queryClient.invalidateQueries({ queryKey: ["mail-extractor-rules"] });
    },
    onError: (error) => setFeedback(getAPIErrorMessage(error, "Failed to delete extraction rule.")),
  });

  const testMutation = useMutation({
    mutationFn: async () =>
      testMailExtractorRule(
        {
          ...draft,
          captureGroupIndex: draft.resultMode === "capture_group" ? Number(draft.captureGroupIndex ?? 1) : undefined,
        },
        selectedMailboxId && sampleMessageId
          ? { mailboxId: Number(selectedMailboxId), messageId: Number(sampleMessageId) }
          : {},
      ),
    onError: (error) => setFeedback(getAPIErrorMessage(error, "Failed to test extraction rule.")),
  });

  const toggleTemplateMutation = useMutation({
    mutationFn: async (template: MailExtractorRule) => {
      if (template.enabledForUser) {
        return disableMailExtractorTemplate(template.id);
      }
      return enableMailExtractorTemplate(template.id);
    },
    onSuccess: async (_, template) => {
      setFeedback(template.enabledForUser ? "Default template disabled." : "Default template enabled.");
      await queryClient.invalidateQueries({ queryKey: ["mail-extractor-rules"] });
    },
    onError: (error) => setFeedback(getAPIErrorMessage(error, "Failed to toggle default template.")),
  });

  const copyTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => copyMailExtractorTemplate(templateId),
    onSuccess: async () => {
      setFeedback("Default templatesText and My rules。");
      await queryClient.invalidateQueries({ queryKey: ["mail-extractor-rules"] });
    },
    onError: (error) => setFeedback(getAPIErrorMessage(error, "Failed to copy default template.")),
  });

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
        title="Extraction rules"
        description="Text，TextSubject、Body、HTML Text Raw Text。"
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
            New rule
          </Button>
        }
      >
        {feedback ? (
          <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
            {feedback}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wand2 className="size-4" />
                My rules
              </div>
              {userRules.length ? (
                userRules.map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    className="block w-full text-left"
                    onClick={() => selectRule(rule)}
                  >
                    <Card className={selectedRuleId === rule.id ? "border-primary/40 bg-muted/20 shadow-none" : "border-border/60 bg-muted/10 shadow-none"}>
                      <CardContent className="space-y-2 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{rule.name}</div>
                            <div className="text-xs text-muted-foreground">{targetSummary(rule) || "No field selected"}</div>
                          </div>
                          <WorkspaceBadge variant={rule.enabled ? "secondary" : "outline"}>
                            {rule.enabled ? "Enable" : "Disable"}
                          </WorkspaceBadge>
                        </div>
                        <div className="text-xs text-muted-foreground">{rule.label || "No label set"}</div>
                      </CardContent>
                    </Card>
                  </button>
                ))
              ) : (
                <WorkspaceEmpty title="No custom rules yet" description="TextExtraction rules。" />
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4" />
                Default templates
              </div>
              {templates.length ? (
                templates.map((template) => (
                  <Card className="border-border/60 bg-muted/10 shadow-none" key={template.id}>
                    <CardContent className="space-y-3 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground">{targetSummary(template)}</div>
                        </div>
                        <WorkspaceBadge variant={template.enabledForUser ? "secondary" : "outline"}>
                          {template.enabledForUser ? "TextEnable" : "TextEnable"}
                        </WorkspaceBadge>
                      </div>
                      <div className="text-xs text-muted-foreground">{template.description || template.label || "Default extraction template provided by an admin."}</div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleTemplateMutation.mutate(template)}>
                          {template.enabledForUser ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyTemplateMutation.mutate(template.id)}>
                          Text and My rules
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <WorkspaceEmpty title="TextDefault templates" description="TextExtraction rulesText。" />
              )}
            </section>
          </div>

          <div className="space-y-4">
            <Card className="border-border/60 bg-muted/10 shadow-none">
              <CardContent className="space-y-4 py-4">
                <div className="text-sm font-medium">{selectedRuleId === "new" ? "New rule" : "Edit rule"}</div>

                <div className="grid gap-3 md:grid-cols-2">
                  <WorkspaceField label="Rule name">
                    <Input aria-label="Rule name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
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
                    <Input aria-label="Regex flags" value={draft.flags} onChange={(event) => setDraft((current) => ({ ...current, flags: event.target.value }))} placeholder="e.g. i / im / ims" />
                  </WorkspaceField>
                  <WorkspaceField label="Result mode">
                    <BasicSelect value={draft.resultMode} onChange={(event) => setDraft((current) => ({ ...current, resultMode: event.target.value }))}>
                      {resultModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
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

                <div className="grid gap-3 md:grid-cols-3">
                  <WorkspaceField label="Mailbox scope">
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
                      {mailboxes.map((mailbox) => (
                        <option key={mailbox.id} value={mailbox.id}>
                          {mailbox.address}
                        </option>
                      ))}
                    </BasicSelect>
                  </WorkspaceField>
                  <WorkspaceField label="Domain scope">
                    <BasicSelect
                      value={draft.domainIds[0] ? String(draft.domainIds[0]) : ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          domainIds: event.target.value ? [Number(event.target.value)] : [],
                        }))
                      }
                    >
                      <option value="">All domains</option>
                      {domains.map((domain) => (
                        <option key={domain.id} value={domain.id}>
                          {domain.domain}
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
                  <span>EnableText</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving…" : "Save rule"}
                  </Button>
                  {selectedRuleId !== "new" ? (
                    <Button variant="outline" onClick={() => deleteMutation.mutate(Number(selectedRuleId))} disabled={deleteMutation.isPending}>
                      Delete rule
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-muted/10 shadow-none">
              <CardContent className="space-y-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Live test</div>
                  <Button size="sm" variant="outline" onClick={() => void rulesQuery.refetch()}>
                    <RefreshCw className={`size-4 ${rulesQuery.isFetching ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <WorkspaceField label="Test mailbox">
                    <BasicSelect value={sampleMailboxId || (selectedMailboxId ? String(selectedMailboxId) : "")} onChange={(event) => {
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
                      {sampleMessages.map((message) => (
                        <option key={message.id} value={message.id}>
                          {(message.subject || "(No subject)").slice(0, 40)}
                        </option>
                      ))}
                    </BasicSelect>
                  </WorkspaceField>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleTest} disabled={testMutation.isPending || !sampleMessageId}>
                    {testMutation.isPending ? "Testing…" : "Run test"}
                  </Button>
                </div>

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
                  <WorkspaceEmpty title="No matches" description="TextTest messageText and Text。" />
                ) : (
                  <WorkspaceEmpty title="Select a messageText" description="Text and Text，Text。" />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
