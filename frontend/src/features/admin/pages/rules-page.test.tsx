import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminRules, upsertAdminRule } from "../api";
import { AdminRulesPage } from "./rules-page";

vi.mock("../api", () => ({
  fetchAdminRules: vi.fn(),
  upsertAdminRule: vi.fn(),
}));

describe("AdminRulesPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    vi.mocked(fetchAdminRules).mockResolvedValue([
      {
        id: "default",
        name: "Text",
        retentionHours: 24,
        autoExtend: false,
        updatedAt: "2026-04-03T10:00:00Z",
      },
      {
        id: "vip",
        name: "Text",
        retentionHours: 72,
        autoExtend: true,
        updatedAt: "2026-04-03T11:00:00Z",
      },
    ]);
    vi.mocked(upsertAdminRule).mockImplementation(async (id, input) => ({
      id,
      ...input,
      updatedAt: "2026-04-03T11:05:00Z",
    }));
  });

  it("renders admin rule list from the real rules api", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminRulesPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Text")).toBeInTheDocument();
    expect(await screen.findByText("Text")).toBeInTheDocument();
    expect(await screen.findByText("72h")).toBeInTheDocument();
  });

  it("saves edited rule payloads through admin rule api", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminRulesPage />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Text/ }));
    fireEvent.change(screen.getByPlaceholderText("Rule name"), {
      target: { value: "VIP Text" },
    });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "96" },
    });
    fireEvent.click(screen.getByLabelText("EnableText"));
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));

    await waitFor(() => {
      expect(vi.mocked(upsertAdminRule).mock.calls[0]?.[0]).toBe("vip");
      expect(vi.mocked(upsertAdminRule).mock.calls[0]?.[1]).toEqual({
        name: "VIP Text",
        retentionHours: 96,
        autoExtend: false,
      });
    });
  });
});
