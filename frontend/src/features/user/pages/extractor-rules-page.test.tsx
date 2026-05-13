import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyMailExtractorTemplate,
  createMailExtractorRule,
  disableMailExtractorTemplate,
  enableMailExtractorTemplate,
  fetchDashboard,
  fetchMailboxMessages,
  fetchMailExtractorRules,
} from "../api";
import { emptyRuleDraft, validateRuleDraft } from "../extractor-rule-form";
import { UserExtractorRulesPage } from "./extractor-rules-page";

vi.mock("../api", () => ({
  fetchMailExtractorRules: vi.fn(),
  fetchDashboard: vi.fn(),
  fetchMailboxMessages: vi.fn(),
  createMailExtractorRule: vi.fn(),
  updateMailExtractorRule: vi.fn(),
  deleteMailExtractorRule: vi.fn(),
  testMailExtractorRule: vi.fn(),
  enableMailExtractorTemplate: vi.fn(),
  disableMailExtractorTemplate: vi.fn(),
  copyMailExtractorTemplate: vi.fn(),
}));

describe("UserExtractorRulesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fetchMailExtractorRules).mockResolvedValue({
      rules: [
        {
          id: 11,
          ownerUserId: 1,
          sourceType: "user",
          name: "Textverification code",
          description: "TextSubjectverification code",
          label: "verification code",
          enabled: true,
          targetFields: ["subject"],
          pattern: "\\b(\\d{6})\\b",
          flags: "i",
          resultMode: "capture_group",
          captureGroupIndex: 1,
          mailboxIds: [],
          domainIds: [],
          senderContains: "",
          subjectContains: "verification code",
          sortOrder: 100,
        },
      ],
      templates: [
        {
          id: 21,
          sourceType: "admin_default",
          templateKey: "default-code",
          name: "Textverification codeText",
          description: "Text",
          label: "Textverification code",
          enabled: true,
          enabledForUser: false,
          targetFields: ["subject"],
          pattern: "\\b(\\d{6})\\b",
          flags: "i",
          resultMode: "capture_group",
          captureGroupIndex: 1,
          mailboxIds: [],
          domainIds: [],
          senderContains: "",
          subjectContains: "",
          sortOrder: 100,
        },
      ],
    });
    vi.mocked(fetchDashboard).mockResolvedValue({
      totalMailboxCount: 1,
      activeMailboxCount: 1,
      availableDomains: [
        {
          id: 5,
          domain: "example.test",
          status: "active",
          visibility: "private",
          publicationStatus: "draft",
          verificationScore: 100,
          healthStatus: "healthy",
          isDefault: true,
          weight: 100,
          rootDomain: "example.test",
          parentDomain: "",
          level: 0,
          kind: "root",
        },
      ],
      mailboxes: [
        {
          id: 7,
          userId: 1,
          domainId: 5,
          domain: "example.test",
          localPart: "alpha",
          address: "alpha@example.test",
          status: "active",
          permanent: false,
          expiresAt: "2026-04-07T10:00:00Z",
          retentionDays: 0,
          forwardTo: "",
          forwardKeepCopy: false,
          createdAt: "2026-04-07T09:00:00Z",
          updatedAt: "2026-04-07T09:30:00Z",
        },
      ],
      unreadCounts: {},
    });
    vi.mocked(fetchMailboxMessages).mockResolvedValue([
      {
        id: 31,
        mailboxId: 7,
        legacyMailboxKey: "",
        legacyMessageKey: "",
        sourceKind: "smtp",
        sourceMessageId: "msg-31",
        mailboxAddress: "alpha@example.test",
        fromAddr: "sender@example.com",
        toAddr: "alpha@example.test",
        subject: "verification code 123456",
        textPreview: "body",
        htmlPreview: "",
        hasAttachments: false,
        attachmentCount: 0,
        sizeBytes: 128,
        isRead: false,
        isDeleted: false,
        receivedAt: "2026-04-07T09:30:00Z",
      },
    ]);
    vi.mocked(createMailExtractorRule).mockResolvedValue({
      id: 88,
      ownerUserId: 1,
      sourceType: "user",
      name: "Textverification code",
      description: "",
      label: "Text",
      enabled: true,
      targetFields: ["subject"],
      pattern: "\\b(\\d{6})\\b",
      flags: "i",
      resultMode: "capture_group",
      captureGroupIndex: 1,
      mailboxIds: [],
      domainIds: [],
      senderContains: "",
      subjectContains: "",
      sortOrder: 100,
    });
    vi.mocked(enableMailExtractorTemplate).mockResolvedValue({ ok: true });
    vi.mocked(disableMailExtractorTemplate).mockResolvedValue({ ok: true });
    vi.mocked(copyMailExtractorTemplate).mockResolvedValue({
      id: 89,
      ownerUserId: 1,
      sourceType: "user",
      name: "Text",
      description: "",
      label: "Textverification code",
      enabled: true,
      targetFields: ["subject"],
      pattern: "\\b(\\d{6})\\b",
      flags: "i",
      resultMode: "capture_group",
      captureGroupIndex: 1,
      mailboxIds: [],
      domainIds: [],
      senderContains: "",
      subjectContains: "",
      sortOrder: 100,
    });
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <UserExtractorRulesPage />
      </QueryClientProvider>,
    );
  }

  it("renders user rules and admin templates", async () => {
    renderPage();

    expect(await screen.findByText("Textverification code")).toBeInTheDocument();
    expect(await screen.findByText("Textverification codeText")).toBeInTheDocument();
  });

  it("creates a new extractor rule", async () => {
    renderPage();

    fireEvent.change((await screen.findAllByLabelText("Rule name"))[0], { target: { value: "Textverification code" } });
    fireEvent.change(screen.getAllByLabelText("Regular expression")[0], { target: { value: "\\b(\\d{6})\\b" } });

    fireEvent.click(screen.getAllByRole("button", { name: "Save rule" })[0]);
    await waitFor(() => {
      expect(vi.mocked(createMailExtractorRule).mock.calls[0]?.[0]).toMatchObject({
        name: "Textverification code",
        targetFields: ["subject"],
      });
    });
  });

  it("enables and copies admin templates", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "Enable" }))[0]);

    await waitFor(() => {
      expect(enableMailExtractorTemplate).toHaveBeenCalledWith(21);
    });

    fireEvent.click((await screen.findAllByRole("button", { name: "Text and My rules" }))[0]);

    await waitFor(() => {
      expect(copyMailExtractorTemplate).toHaveBeenCalledWith(21);
    });
  });

  it("blocks regex syntax in contains fields before submit", () => {
    const draft = emptyRuleDraft();
    draft.name = "Textverification code";
    draft.pattern = "\\b(\\d{6})\\b";
    draft.senderContains = ".*@x.ai";

    expect(validateRuleDraft(draft)).toBe("“SenderText”Text，Text，Text and Text。");
  });
});
