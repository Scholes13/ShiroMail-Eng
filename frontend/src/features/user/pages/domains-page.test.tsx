import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth-store";
import {
  createDomain,
  deleteDomain,
  fetchDomainProviders,
  fetchDomains,
  generateSubdomains,
  requestDomainPublicPool,
  updateDomainProviderBinding,
  verifyDomain,
  withdrawDomainPublicPool,
} from "../api";
import { UserDomainsPage } from "./domains-page";

vi.mock("../api", () => ({
  fetchDomains: vi.fn(),
  fetchDomainProviders: vi.fn(),
  createDomain: vi.fn(),
  deleteDomain: vi.fn(),
  generateSubdomains: vi.fn(),
  requestDomainPublicPool: vi.fn(),
  updateDomainProviderBinding: vi.fn(),
  verifyDomain: vi.fn(),
  withdrawDomainPublicPool: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <UserDomainsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("UserDomainsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        userId: 7,
        username: "tester",
        roles: ["user"],
      },
    });

    vi.mocked(fetchDomains).mockResolvedValue([
      {
        id: 1,
        domain: "owned-private.test",
        status: "active",
        ownerUserId: 7,
        visibility: "private",
        publicationStatus: "draft",
        verificationScore: 0,
        healthStatus: "unknown",
        providerAccountId: 11,
        providerDisplayName: "Cloudflare Prod",
        isDefault: false,
        weight: 100,
        rootDomain: "owned-private.test",
        parentDomain: "",
        level: 0,
        kind: "root",
      },
      {
        id: 3,
        domain: "owned-public.test",
        status: "active",
        ownerUserId: 7,
        visibility: "public_pool",
        publicationStatus: "approved",
        verificationScore: 100,
        healthStatus: "healthy",
        isDefault: false,
        weight: 100,
        rootDomain: "owned-public.test",
        parentDomain: "",
        level: 0,
        kind: "root",
      },
      {
        id: 2,
        domain: "shared-public-pool.test",
        status: "active",
        ownerUserId: 9,
        visibility: "public_pool",
        publicationStatus: "approved",
        verificationScore: 100,
        healthStatus: "healthy",
        isDefault: false,
        weight: 100,
        rootDomain: "shared-public-pool.test",
        parentDomain: "",
        level: 0,
        kind: "root",
      },
      {
        id: 4,
        domain: "mx.owned-private.test",
        status: "active",
        ownerUserId: 7,
        visibility: "private",
        publicationStatus: "draft",
        verificationScore: 0,
        healthStatus: "unknown",
        providerAccountId: 11,
        providerDisplayName: "Cloudflare Prod",
        isDefault: false,
        weight: 90,
        rootDomain: "owned-private.test",
        parentDomain: "owned-private.test",
        level: 1,
        kind: "subdomain",
      },
    ]);
    vi.mocked(fetchDomainProviders).mockResolvedValue([
      {
        id: 11,
        provider: "cloudflare",
        ownerType: "user",
        ownerUserId: 7,
        displayName: "Cloudflare Prod",
        authType: "api_token",
        hasSecret: true,
        status: "healthy",
        capabilities: ["zones.read", "dns.write"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(createDomain).mockResolvedValue({
      id: 9,
      domain: "new-root.test",
      status: "active",
      ownerUserId: 7,
      visibility: "private",
      publicationStatus: "draft",
      verificationScore: 0,
      healthStatus: "unknown",
      isDefault: false,
      weight: 100,
      rootDomain: "new-root.test",
      parentDomain: "",
      level: 0,
      kind: "root",
    });
    vi.mocked(deleteDomain).mockResolvedValue({ ok: true });
    vi.mocked(generateSubdomains).mockResolvedValue([]);
    vi.mocked(requestDomainPublicPool).mockResolvedValue({
      id: 1,
      domain: "owned-private.test",
      status: "active",
      ownerUserId: 7,
      visibility: "public_pool",
      publicationStatus: "pending_review",
      verificationScore: 0,
      healthStatus: "unknown",
      isDefault: false,
      weight: 100,
      rootDomain: "owned-private.test",
      parentDomain: "",
      level: 0,
      kind: "root",
    });
    vi.mocked(withdrawDomainPublicPool).mockResolvedValue({
      id: 3,
      domain: "owned-public.test",
      status: "active",
      ownerUserId: 7,
      visibility: "private",
      publicationStatus: "draft",
      verificationScore: 100,
      healthStatus: "healthy",
      isDefault: false,
      weight: 100,
      rootDomain: "owned-public.test",
      parentDomain: "",
      level: 0,
      kind: "root",
    });
    vi.mocked(updateDomainProviderBinding).mockResolvedValue({
      id: 1,
      domain: "owned-private.test",
      status: "active",
      ownerUserId: 7,
      visibility: "private",
      publicationStatus: "draft",
      verificationScore: 0,
      healthStatus: "unknown",
      providerAccountId: undefined,
      isDefault: false,
      weight: 100,
      rootDomain: "owned-private.test",
      parentDomain: "",
      level: 0,
      kind: "root",
    });
    vi.mocked(verifyDomain).mockResolvedValue({
      domain: {
        id: 1,
        domain: "owned-private.test",
        status: "active",
        ownerUserId: 7,
        visibility: "private",
        publicationStatus: "draft",
        verificationScore: 100,
        healthStatus: "healthy",
        providerAccountId: 11,
        providerDisplayName: "Cloudflare Prod",
        isDefault: false,
        weight: 100,
        rootDomain: "owned-private.test",
        parentDomain: "",
        level: 0,
        kind: "root",
      },
      passed: false,
      summary: "DNS Text，Text。",
      zoneName: "owned-private.test",
      verifiedCount: 1,
      totalCount: 2,
      profiles: [
        {
          verificationType: "mx",
          status: "drifted",
          summary: "MX Text",
          expectedRecords: [],
          observedRecords: [],
          repairRecords: [
            {
              type: "MX",
              name: "owned-private.test",
              value: "mx.shiro.email",
              ttl: 120,
              priority: 10,
              proxied: false,
            },
          ],
          lastCheckedAt: new Date().toISOString(),
        },
      ],
    });
  });

  it("shows only owned domains and pool actions", async () => {
    renderPage();

    expect(await screen.findByText("owned-private.test")).toBeInTheDocument();
    expect(await screen.findByText("owned-public.test")).toBeInTheDocument();
    expect(screen.queryByText("shared-public-pool.test")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Text" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Text" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Text" }));
    await waitFor(() => {
      expect(vi.mocked(requestDomainPublicPool).mock.calls[0]?.[0]).toBe(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Text" }));
    fireEvent.click(await screen.findByRole("button", { name: "Text" }));
    await waitFor(() => {
      expect(vi.mocked(withdrawDomainPublicPool).mock.calls[0]?.[0]).toBe(3);
    });
  });

  it("creates root domains and subdomains inside dialogs", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "TextDomain" }));

    const rootDialog = await screen.findByRole("dialog", { name: "TextDomain" });
    fireEvent.change(within(rootDialog).getByPlaceholderText("example.com"), {
      target: { value: "new-root.test" },
    });
    fireEvent.click(within(rootDialog).getByRole("button", { name: "TextDomain" }));

    await waitFor(() => {
      expect(vi.mocked(createDomain).mock.calls[0]?.[0]).toEqual({
        domain: "new-root.test",
        status: "active",
        visibility: "private",
        publicationStatus: "draft",
        verificationScore: 0,
        healthStatus: "unknown",
        providerAccountId: undefined,
        weight: 100,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "TextDomain" }));

    const generateDialog = await screen.findByRole("dialog", { name: "TextDomain" });
    const generateDialogQueries = within(generateDialog);

    fireEvent.click(generateDialogQueries.getByRole("combobox", { name: "TextDomain" }));
    fireEvent.click(await screen.findByRole("option", { name: "owned-private.test" }));
    fireEvent.change(generateDialogQueries.getByRole("textbox", { name: "Text" }), {
      target: { value: "mx\nrelay" },
    });
    fireEvent.click(generateDialogQueries.getByRole("button", { name: "TextDomain" }));

    await waitFor(() => {
      expect(vi.mocked(generateSubdomains).mock.calls[0]?.[0]).toEqual({
        baseDomainId: 1,
        prefixes: ["mx", "relay"],
        status: "active",
        visibility: "private",
        publicationStatus: "draft",
        verificationScore: 0,
        healthStatus: "unknown",
        weight: 90,
      });
    });
  });

  it("allows binding dialog actions for a root domain", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "Text" }))[0]);

    const bindDialog = await screen.findByRole("dialog", { name: "Text DNS Text" });
    const bindDialogQueries = within(bindDialog);

    expect(bindDialogQueries.getByText("Cloudflare Prod")).toBeInTheDocument();
    fireEvent.click(bindDialogQueries.getByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(updateDomainProviderBinding).mock.calls[0]?.[0]).toBe(1);
      expect(vi.mocked(updateDomainProviderBinding).mock.calls[0]?.[1]).toBeUndefined();
    });
  });

  it("shows child domains inside expanded root cards", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /owned-private\.test/i }));

    expect(await screen.findByText("mx.owned-private.test")).toBeInTheDocument();
    expect(await screen.findAllByRole("link", { name: "Text" })).not.toHaveLength(0);
  });
});
