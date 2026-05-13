import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionCombobox } from "@/components/ui/option-combobox";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceBadge, WorkspaceEmpty, WorkspaceField, WorkspacePage, WorkspacePanel } from "@/components/layout/workspace-ui";
import { getAPIErrorMessage } from "@/lib/http";
import { validateRequiredText, validateSelection } from "@/lib/validation";
import { useState } from "react";
import { createFeedback, fetchFeedback } from "../api";
import { formatDateTime } from "./shared";

export function UserFeedbackPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ category: "product", subject: "", content: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const feedbackQuery = useQuery({ queryKey: ["portal-feedback"], queryFn: fetchFeedback });
  const categoryOptions = [
    { value: "product", label: "Product experience", keywords: ["experience", "product"] },
    { value: "bug", label: "Bug Text", keywords: ["issue", "bug"] },
    { value: "billing", label: "Textissue", keywords: ["payment", "billing"] },
  ];

  const createMutation = useMutation({
    mutationFn: createFeedback,
    onSuccess: async () => {
      setFormError(null);
      setDraft({ category: "product", subject: "", content: "" });
      await queryClient.invalidateQueries({ queryKey: ["portal-feedback"] });
      await queryClient.invalidateQueries({ queryKey: ["portal-overview"] });
    },
    onError: (error) => {
      setFormError(getAPIErrorMessage(error, "Failed to submit feedback. Please try again later."));
    },
  });

  function handleSubmit() {
    const categoryError = validateSelection("Feedback type", draft.category, categoryOptions.map((item) => item.value));
    if (categoryError) {
      setFormError(categoryError);
      return;
    }
    const subjectError = validateRequiredText("FeedbackSubject", draft.subject, { minLength: 2, maxLength: 120 });
    if (subjectError) {
      setFormError(subjectError);
      return;
    }
    const contentError = validateRequiredText("issueDescription", draft.content, { minLength: 5, maxLength: 5000 });
    if (contentError) {
      setFormError(contentError);
      return;
    }
    setFormError(null);
    createMutation.mutate({
      category: draft.category,
      subject: draft.subject.trim(),
      content: draft.content.trim(),
    });
  }

  return (
    <WorkspacePage>
      <WorkspacePanel description="Textissue、experienceText，Text。" title="Feedback">
        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-border/60 bg-muted/10 shadow-none">
            <CardContent className="flex flex-col gap-4 py-4">
              <WorkspaceField label="Feedback type">
                <OptionCombobox
                  ariaLabel="Feedback type"
                  emptyLabel="TextFeedback type"
                  value={draft.category}
                  onValueChange={(value) => setDraft((current) => ({ ...current, category: value }))}
                  options={categoryOptions}
                  placeholder="TextFeedback type"
                  searchPlaceholder="TextFeedback type"
                />
              </WorkspaceField>

              <WorkspaceField label="FeedbackSubject">
                <Input
                  onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="FeedbackSubject"
                  value={draft.subject}
                />
              </WorkspaceField>

              <WorkspaceField label="issueDescription">
                <Textarea
                  onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                  placeholder="DescriptionTextissueText"
                  rows={6}
                  value={draft.content}
                />
              </WorkspaceField>

              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

              <Button disabled={createMutation.isPending} onClick={handleSubmit}>
                {createMutation.isPending ? "Submitting..." : "TextFeedback"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            {feedbackQuery.data?.length ? (
              feedbackQuery.data.map((item) => (
                <Card className="border-border/60 bg-card/85 shadow-none" key={item.id}>
                  <CardContent className="flex flex-col gap-3 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <WorkspaceBadge>{item.category}</WorkspaceBadge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt)}</span>
                    </div>
                    <div className="text-sm font-medium">{item.subject}</div>
                    <p className="text-sm leading-6 text-muted-foreground">{item.content}</p>
                    <div className="text-xs text-muted-foreground">Status: {item.status}</div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <WorkspaceEmpty description="TextFeedbackText，Text。" title="TextFeedbackText" />
            )}
          </div>
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
