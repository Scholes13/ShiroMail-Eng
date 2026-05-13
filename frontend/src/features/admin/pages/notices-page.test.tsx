import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminNotice,
  deleteAdminNotice,
  fetchAdminNotices,
  updateAdminNotice,
} from "../api";
import { AdminNoticesPage } from "./notices-page";

vi.mock("../api", () => ({
  fetchAdminNotices: vi.fn(),
  createAdminNotice: vi.fn(),
  updateAdminNotice: vi.fn(),
  deleteAdminNotice: vi.fn(),
}));

describe("AdminNoticesPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    vi.mocked(fetchAdminNotices).mockResolvedValue([
      {
        id: 1,
        title: "Text",
        body: "Text 23:00 Text。",
        category: "maintenance",
        level: "warning",
        publishedAt: "2026-04-03T10:00:00Z",
      },
    ]);
    vi.mocked(createAdminNotice).mockResolvedValue({
      id: 2,
      title: "Text",
      body: "Webhook Text API Key Text。",
      category: "release",
      level: "info",
      publishedAt: "2026-04-03T11:00:00Z",
    });
    vi.mocked(updateAdminNotice).mockResolvedValue({
      id: 1,
      title: "Text",
      body: "Text and  23:30。",
      category: "maintenance",
      level: "warning",
      publishedAt: "2026-04-03T10:00:00Z",
    });
    vi.mocked(deleteAdminNotice).mockResolvedValue({ ok: true });
  });

  it("renders real admin notices", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminNoticesPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Text")).toBeInTheDocument();
    expect(await screen.findByText("Text 23:00 Text。")).toBeInTheDocument();
    expect(await screen.findByText("maintenance")).toBeInTheDocument();
  });

  it("publishes notices through the real create api", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminNoticesPage />
      </QueryClientProvider>,
    );

    fireEvent.change(await screen.findByPlaceholderText("NoticesSubject"), {
      target: { value: "Text" },
    });
    fireEvent.change(screen.getByPlaceholderText("NoticesBody"), {
      target: { value: "Webhook Text API Key Text。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "TextNotices" }));

    await waitFor(() => {
      expect(vi.mocked(createAdminNotice).mock.calls[0]?.[0]).toEqual({
        title: "Text",
        body: "Webhook Text API Key Text。",
        category: "platform",
        level: "info",
      });
    });
  });

  it("updates and deletes notices from the admin list", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminNoticesPage />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Text" }));
    fireEvent.change(await screen.findByDisplayValue("Text"), {
      target: { value: "Text" },
    });
    fireEvent.change(screen.getByDisplayValue("Text 23:00 Text。"), {
      target: { value: "Text and  23:30。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(updateAdminNotice).mock.calls[0]).toEqual([
        1,
        {
          title: "Text",
          body: "Text and  23:30。",
          category: "maintenance",
          level: "warning",
        },
      ]);
    });

    fireEvent.click(await screen.findByRole("button", { name: "Text" }));
    fireEvent.click(await screen.findByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(deleteAdminNotice).mock.calls[0]?.[0]).toBe(1);
    });
  });
});
