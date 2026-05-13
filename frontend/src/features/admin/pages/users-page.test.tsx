import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth-store";
import { deleteAdminUser, fetchAdminUsers, updateAdminUser } from "../api";
import { AdminUsersPage } from "./users-page";

vi.mock("../api", () => ({
  fetchAdminUsers: vi.fn(),
  updateAdminUser: vi.fn(),
  deleteAdminUser: vi.fn(),
}));

vi.mock("@/lib/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http")>("@/lib/http");
  return {
    ...actual,
    getAPIErrorMessage: vi.fn(actual.getAPIErrorMessage),
  };
});

describe("AdminUsersPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: "token",
      refreshToken: "refresh",
      user: { userId: 2, username: "admin", roles: ["admin"] },
    });

    vi.mocked(fetchAdminUsers).mockResolvedValue([
      {
        id: 1,
        username: "alice",
        email: "alice@shiro.local",
        status: "active",
        emailVerified: false,
        roles: ["user"],
        mailboxes: 0,
      },
      {
        id: 2,
        username: "admin",
        email: "admin@shiro.local",
        status: "active",
        emailVerified: true,
        roles: ["admin", "user"],
        mailboxes: 1,
      },
    ]);

    vi.mocked(updateAdminUser).mockResolvedValue({
      id: 1,
      username: "alice-updated",
      email: "alice-updated@shiro.local",
      status: "disabled",
      emailVerified: true,
      roles: ["admin", "user"],
      mailboxes: 0,
    });
    vi.mocked(deleteAdminUser).mockResolvedValue({ ok: true });
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
        <AdminUsersPage />
      </QueryClientProvider>,
    );
  }

  it("renders admin user inventory with status summaries", async () => {
    renderPage();

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(await screen.findByText("alice@shiro.local · active · Text")).toBeInTheDocument();
    expect(await screen.findByText("admin")).toBeInTheDocument();
    expect(await screen.findByText("Text")).toBeInTheDocument();
    expect(await screen.findByText("Text")).toBeInTheDocument();
  });

  it("updates selected user profile from the dialog", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "Text" }))[0]);

    const dialog = await screen.findByRole("dialog", { name: "Text" });
    const dialogQueries = within(dialog);

    fireEvent.change(dialogQueries.getByDisplayValue("alice"), {
      target: { value: "alice-updated" },
    });
    fireEvent.change(dialogQueries.getByDisplayValue("alice@shiro.local"), {
      target: { value: "alice-updated@shiro.local" },
    });
    fireEvent.click(dialogQueries.getByRole("checkbox", { name: "admin" }));
    fireEvent.click(dialogQueries.getByLabelText("Text"));
    fireEvent.click(dialogQueries.getByLabelText("Disable"));
    fireEvent.change(dialogQueries.getByPlaceholderText("Text"), {
      target: { value: "BetterSecret123!" },
    });
    fireEvent.click(dialogQueries.getByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(updateAdminUser).mock.calls[0]?.[0]).toBe(1);
      expect(vi.mocked(updateAdminUser).mock.calls[0]?.[1]).toEqual({
        username: "alice-updated",
        email: "alice-updated@shiro.local",
        status: "disabled",
        emailVerified: true,
        roles: ["admin", "user"],
        newPassword: "BetterSecret123!",
      });
    });
  });

  it("deletes a non-current user from destructive dialog", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "Text" }))[0]);

    const dialog = await screen.findByRole("alertdialog", { name: "Text？" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(deleteAdminUser).mock.calls[0]?.[0]).toBe(1);
    });
  });

  it("shows delete failure feedback when backend rejects deletion", async () => {
    vi.mocked(deleteAdminUser).mockRejectedValueOnce(new Error("user still has mailboxes"));
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "Text" }))[0]);

    const dialog = await screen.findByRole("alertdialog", { name: "Text？" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Text" }));

    expect(await screen.findByText("user still has mailboxes")).toBeInTheDocument();
  });
});
