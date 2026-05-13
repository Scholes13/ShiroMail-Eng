import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminDoc,
  deleteAdminDoc,
  fetchAdminDocs,
  updateAdminDoc,
} from "../api";
import { AdminDocsPage } from "./docs-page";

vi.mock("../api", () => ({
  fetchAdminDocs: vi.fn(),
  createAdminDoc: vi.fn(),
  updateAdminDoc: vi.fn(),
  deleteAdminDoc: vi.fn(),
}));

describe("AdminDocsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    vi.mocked(fetchAdminDocs).mockResolvedValue([
      {
        id: "quick-start",
        title: "Text",
        category: "Text",
        summary: "5 Text、Text。",
        readTimeMin: 5,
        tags: ["Text", "Text", "Text"],
        createdAt: "2026-04-03T10:00:00Z",
        updatedAt: "2026-04-03T10:00:00Z",
      },
    ]);
    vi.mocked(createAdminDoc).mockResolvedValue({
      id: "webhook-events",
      title: "Webhook Text",
      category: "Text",
      summary: "Text、Text、Text。",
      readTimeMin: 6,
      tags: ["Webhook", "Text", "Text"],
      createdAt: "2026-04-03T11:00:00Z",
      updatedAt: "2026-04-03T11:00:00Z",
    });
    vi.mocked(updateAdminDoc).mockResolvedValue({
      id: "quick-start",
      title: "Text（Text）",
      category: "Text",
      summary: "10 Text、Text。",
      readTimeMin: 10,
      tags: ["Text", "Text"],
      createdAt: "2026-04-03T10:00:00Z",
      updatedAt: "2026-04-03T12:00:00Z",
    });
    vi.mocked(deleteAdminDoc).mockResolvedValue({ ok: true });
  });

  it("renders real doc articles for admins instead of audit rows", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminDocsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Text")).toBeInTheDocument();
    expect(await screen.findByText("Text")).toBeInTheDocument();
    expect(await screen.findByText("5 min")).toBeInTheDocument();
    expect(await screen.findByText("5 Text、Text。")).toBeInTheDocument();
  });

  it("creates, updates and deletes docs through admin crud apis", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminDocsPage />
      </QueryClientProvider>,
    );

    fireEvent.change(await screen.findByPlaceholderText("Example: Webhook Text"), {
      target: { value: "Webhook Text" },
    });
    fireEvent.change(screen.getByPlaceholderText("Example: Text"), {
      target: { value: "Text" },
    });
    fireEvent.change(screen.getByPlaceholderText("Text，Text API, Webhook, Text"), {
      target: { value: "Webhook, Text, Text" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Text，Text。"),
      {
        target: { value: "Text、Text、Text。" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(createAdminDoc).mock.calls[0]?.[0]).toEqual({
        title: "Webhook Text",
        category: "Text",
        summary: "Text、Text、Text。",
        readTimeMin: 5,
        tags: ["Webhook", "Text", "Text"],
      });
    });

    fireEvent.click(await screen.findByRole("button", { name: "Text" }));
    const editDialog = await screen.findByRole("dialog", { name: "Text" });
    const dialogQueries = within(editDialog);

    fireEvent.change(dialogQueries.getByDisplayValue("Text"), {
      target: { value: "Text（Text）" },
    });
    fireEvent.change(dialogQueries.getByDisplayValue("5"), {
      target: { value: "10" },
    });
    fireEvent.change(dialogQueries.getByDisplayValue("Text, Text, Text"), {
      target: { value: "Text, Text" },
    });
    fireEvent.change(dialogQueries.getByDisplayValue("5 Text、Text。"), {
      target: { value: "10 Text、Text。" },
    });
    fireEvent.click(dialogQueries.getByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(updateAdminDoc).mock.calls[0]).toEqual([
        "quick-start",
        {
          title: "Text（Text）",
          category: "Text",
          summary: "10 Text、Text。",
          readTimeMin: 10,
          tags: ["Text", "Text"],
        },
      ]);
    });

    fireEvent.click(await screen.findByRole("button", { name: "Text" }));
    fireEvent.click(await screen.findByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(deleteAdminDoc).mock.calls[0]?.[0]).toBe("quick-start");
    });
  });
});
