import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminMailExtractorRule,
  deleteAdminMailExtractorRule,
  fetchAdminMailExtractorRules,
  fetchAdminMailboxMessages,
  fetchAdminMailboxes,
} from "../api";
import { AdminExtractorTemplatesPage } from "./extractor-templates-page";

vi.mock("../api", () => ({
  fetchAdminMailExtractorRules: vi.fn(),
  fetchAdminMailboxes: vi.fn(),
  fetchAdminMailboxMessages: vi.fn(),
  createAdminMailExtractorRule: vi.fn(),
  updateAdminMailExtractorRule: vi.fn(),
  deleteAdminMailExtractorRule: vi.fn(),
  testAdminMailExtractorRule: vi.fn(),
}));

describe("AdminExtractorTemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fetchAdminMailExtractorRules).mockResolvedValue([
      {
        id: 41,
        sourceType: "admin_default",
        templateKey: "mail-code",
        name: "Textverification codeText",
        description: "TextDefault templates",
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
        subjectContains: "",
        sortOrder: 100,
      },
    ]);
    vi.mocked(fetchAdminMailboxes).mockResolvedValue([
      {
        id: 5,
        userId: 1,
        domainId: 1,
        domain: "example.test",
        localPart: "ops",
        address: "ops@example.test",
        ownerUsername: "admin",
        status: "active",
        permanent: false,
        expiresAt: "2026-04-07T10:00:00Z",
        createdAt: "2026-04-07T09:00:00Z",
        updatedAt: "2026-04-07T09:30:00Z",
      },
    ]);
    vi.mocked(fetchAdminMailboxMessages).mockResolvedValue([
      {
        id: 51,
        mailboxId: 5,
        legacyMailboxKey: "",
        legacyMessageKey: "",
        sourceKind: "smtp",
        sourceMessageId: "msg-51",
        mailboxAddress: "ops@example.test",
        fromAddr: "sender@example.com",
        toAddr: "ops@example.test",
        subject: "verification code 654321",
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
    vi.mocked(createAdminMailExtractorRule).mockResolvedValue({
      id: 52,
      sourceType: "admin_default",
      templateKey: "created-template",
      name: "Textverification codeText",
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
    vi.mocked(deleteAdminMailExtractorRule).mockResolvedValue({ ok: true });
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
        <AdminExtractorTemplatesPage />
      </QueryClientProvider>,
    );
  }

  it("renders existing admin extractor templates", async () => {
    renderPage();

    expect(await screen.findByText("Textverification codeText")).toBeInTheDocument();
    expect(await screen.findByText("verification code")).toBeInTheDocument();
  });

  it("creates a template", async () => {
    renderPage();

    fireEvent.change((await screen.findAllByLabelText("Text"))[0], { target: { value: "Textverification codeText" } });
    fireEvent.change(screen.getAllByLabelText("Regular expression")[0], {
      target: { value: "\\b(\\d{6})\\b" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Text" })[0]);
    await waitFor(() => {
      expect(vi.mocked(createAdminMailExtractorRule).mock.calls[0]?.[0]).toMatchObject({
        name: "Textverification codeText",
      });
    });
  });

  it("deletes an existing template", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByText("Textverification codeText"))[0]);
    fireEvent.click((await screen.findAllByRole("button", { name: "Text" }))[0]);

    await waitFor(() => {
      expect(deleteAdminMailExtractorRule).toHaveBeenCalledWith(41);
    });
  });

  it("normalizes malformed template payloads instead of crashing", async () => {
    vi.mocked(fetchAdminMailExtractorRules).mockResolvedValueOnce([
      {
        id: 61,
        sourceType: "admin_default",
        templateKey: "broken-template",
        name: "Text",
        description: "",
        label: "",
        enabled: true,
        targetFields: null as never,
        pattern: "\\b(\\d{6})\\b",
        flags: null as never,
        resultMode: null as never,
        captureGroupIndex: null as never,
        mailboxIds: null as never,
        domainIds: null as never,
        senderContains: null as never,
        subjectContains: null as never,
        sortOrder: null as never,
      },
    ]);

    renderPage();

    expect(await screen.findByText("Text")).toBeInTheDocument();
  });
});
