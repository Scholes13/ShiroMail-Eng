import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminDomainProviders, fetchAdminDomains, verifyAdminDomain } from "../api";
import { AdminDomainsPage } from "./domains-page";

vi.mock("../api", () => ({
  fetchAdminDomains: vi.fn(),
  fetchAdminDomainProviders: vi.fn(),
  upsertAdminDomain: vi.fn(),
  deleteAdminDomain: vi.fn(),
  generateAdminSubdomains: vi.fn(),
  reviewAdminDomainPublication: vi.fn(),
  verifyAdminDomain: vi.fn(),
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
        <AdminDomainsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("AdminDomainsPage verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fetchAdminDomainProviders).mockResolvedValue([]);
    vi.mocked(fetchAdminDomains).mockResolvedValue([
      {
        id: 7,
        domain: "provider-bound.test",
        status: "active",
        ownerUserId: 3,
        visibility: "private",
        publicationStatus: "draft",
        verificationScore: 0,
        healthStatus: "degraded",
        providerAccountId: 1,
        providerDisplayName: "Primary Cloudflare",
        isDefault: false,
        weight: 100,
        rootDomain: "provider-bound.test",
        parentDomain: "",
        level: 0,
        kind: "root",
      },
    ]);
    vi.mocked(verifyAdminDomain).mockResolvedValue({
      domain: {
        id: 7,
        domain: "provider-bound.test",
        status: "active",
        ownerUserId: 3,
        visibility: "private",
        publicationStatus: "draft",
        verificationScore: 50,
        healthStatus: "degraded",
        providerAccountId: 1,
        providerDisplayName: "Primary Cloudflare",
        isDefault: false,
        weight: 100,
        rootDomain: "provider-bound.test",
        parentDomain: "",
        level: 0,
        kind: "root",
      },
      passed: false,
      summary: "DNS Text，Text。",
      zoneName: "provider-bound.test",
      verifiedCount: 1,
      totalCount: 2,
      profiles: [
        {
          verificationType: "dmarc",
          status: "drifted",
          summary: "DMARC Text",
          expectedRecords: [],
          observedRecords: [],
          repairRecords: [
            {
              type: "TXT",
              name: "_dmarc.provider-bound.test",
              value: "v=DMARC1; p=quarantine",
              ttl: 300,
              priority: 0,
              proxied: false,
            },
          ],
          lastCheckedAt: "2026-04-05T05:30:00Z",
        },
      ],
    });
  });

  it("shows verification details and dns link after verify", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(verifyAdminDomain)).toHaveBeenCalled();
    });
    expect(vi.mocked(verifyAdminDomain).mock.calls[0]?.[0]).toBe(7);

    expect(await screen.findByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("DMARC Text")).toBeInTheDocument();
    expect(screen.getAllByText(/_dmarc\.provider-bound\.test/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Text DNS Text" })).toHaveAttribute(
      "href",
      "/admin/dns?domainId=7&providerId=1",
    );
  });
});
