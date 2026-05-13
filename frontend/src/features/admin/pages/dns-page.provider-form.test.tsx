import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAdminDNSChangeSet,
  createAdminDomainProvider,
  deleteAdminDomainProvider,
  fetchAdminDomainProviderChangeSets,
  fetchAdminDomainProviderRecords,
  fetchAdminDomainProviderVerifications,
  fetchAdminDomainProviderZones,
  fetchAdminDomainProviders,
  fetchAdminDomains,
  generateAdminSubdomains,
  previewAdminDomainProviderChangeSet,
  upsertAdminDomain,
  updateAdminDomainProvider,
  validateAdminDomainProvider,
} from "../api";
import { AdminDnsPage } from "./dns-page";

vi.mock("../api", () => ({
  applyAdminDNSChangeSet: vi.fn(),
  createAdminDomainProvider: vi.fn(),
  deleteAdminDomainProvider: vi.fn(),
  fetchAdminDomainProviderChangeSets: vi.fn(),
  fetchAdminDomainProviderRecords: vi.fn(),
  fetchAdminDomainProviderVerifications: vi.fn(),
  fetchAdminDomainProviderZones: vi.fn(),
  fetchAdminDomainProviders: vi.fn(),
  fetchAdminDomains: vi.fn(),
  generateAdminSubdomains: vi.fn(),
  previewAdminDomainProviderChangeSet: vi.fn(),
  upsertAdminDomain: vi.fn(),
  updateAdminDomainProvider: vi.fn(),
  validateAdminDomainProvider: vi.fn(),
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
        <AdminDnsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("AdminDnsPage provider form", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();

    vi.mocked(fetchAdminDomains).mockResolvedValue([]);
    vi.mocked(fetchAdminDomainProviders).mockResolvedValue([]);
    vi.mocked(fetchAdminDomainProviderZones).mockResolvedValue([]);
    vi.mocked(fetchAdminDomainProviderRecords).mockResolvedValue([]);
    vi.mocked(fetchAdminDomainProviderChangeSets).mockResolvedValue([]);
    vi.mocked(fetchAdminDomainProviderVerifications).mockResolvedValue([]);
    vi.mocked(previewAdminDomainProviderChangeSet).mockResolvedValue({} as never);
    vi.mocked(applyAdminDNSChangeSet).mockResolvedValue({} as never);
    vi.mocked(createAdminDomainProvider).mockResolvedValue({} as never);
    vi.mocked(validateAdminDomainProvider).mockResolvedValue({} as never);
    vi.mocked(deleteAdminDomainProvider).mockResolvedValue({ ok: true });
    vi.mocked(upsertAdminDomain).mockResolvedValue({} as never);
    vi.mocked(generateAdminSubdomains).mockResolvedValue([]);
    vi.mocked(updateAdminDomainProvider).mockResolvedValue({} as never);
  });

  it("switches credential fields when auth mode changes", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Text Provider Text" }));
    const dialog = await screen.findByRole("dialog", { name: "Text Provider Text" });
    const dialogQueries = within(dialog);

    expect(dialogQueries.getByLabelText("API Token")).toBeInTheDocument();
    expect(dialogQueries.queryByLabelText("Account Email")).not.toBeInTheDocument();
    expect(dialogQueries.queryByLabelText("Global API Key")).not.toBeInTheDocument();

    fireEvent.click(dialogQueries.getByRole("combobox", { name: "Provider Auth Type" }));
    fireEvent.click(await screen.findByRole("option", { name: "Global API Key + Email" }));

    expect(dialogQueries.queryByLabelText("API Token")).not.toBeInTheDocument();
    expect(dialogQueries.getByLabelText("Account Email")).toBeInTheDocument();
    expect(dialogQueries.getByLabelText("Global API Key")).toBeInTheDocument();

    fireEvent.click(dialogQueries.getByRole("combobox", { name: "DNS Text" }));
    fireEvent.click(await screen.findByRole("option", { name: "Spaceship" }));

    expect(dialogQueries.queryByLabelText("Account Email")).not.toBeInTheDocument();
    expect(dialogQueries.queryByLabelText("Global API Key")).not.toBeInTheDocument();
    expect(dialogQueries.queryByLabelText("API Token")).not.toBeInTheDocument();
    expect(dialogQueries.getByLabelText("API Key")).toBeInTheDocument();
    expect(dialogQueries.getByLabelText("API Secret")).toBeInTheDocument();
  });

  it("submits only the active auth fields for global api key mode", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Text Provider Text" }));
    const dialog = await screen.findByRole("dialog", { name: "Text Provider Text" });
    const dialogQueries = within(dialog);

    expect(dialogQueries.queryByLabelText("Text")).not.toBeInTheDocument();
    expect(dialogQueries.getByLabelText("Text")).toBeInTheDocument();

    fireEvent.change(dialogQueries.getByPlaceholderText("Example: Cloudflare Text"), {
      target: { value: "CF Global Admin" },
    });
    fireEvent.click(dialogQueries.getByRole("combobox", { name: "Provider Auth Type" }));
    fireEvent.click(await screen.findByRole("option", { name: "Global API Key + Email" }));
    const permissionCombobox = dialogQueries.getByRole("combobox", { name: "Text" });
    fireEvent.click(permissionCombobox);
    fireEvent.click(await screen.findByRole("option", { name: "DNS Text" }));

    fireEvent.change(dialogQueries.getByLabelText("Account Email"), {
      target: { value: " admin@example.com " },
    });
    fireEvent.change(dialogQueries.getByLabelText("Global API Key"), {
      target: { value: " admin-global-key " },
    });

    const submitButton = screen
      .getAllByText("Text Provider Text")
      .map((node) => node.closest("button"))
      .find((button): button is HTMLButtonElement => !!button && !button.disabled);

    expect(submitButton).toBeDefined();
    fireEvent.click(submitButton!);

    await waitFor(() => {
      expect(vi.mocked(createAdminDomainProvider)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createAdminDomainProvider).mock.calls[0]?.[0]).toEqual({
        provider: "cloudflare",
        ownerType: "platform",
        displayName: "CF Global Admin",
        authType: "api_key",
        credentials: {
          apiToken: "",
          apiEmail: "admin@example.com",
          apiKey: "admin-global-key",
          apiSecret: "",
        },
        status: "healthy",
        capabilities: ["zones.read", "dns.write", "dns.read"],
      });
    });
  });

  it("prefills provider dialog for editing and allows saving without replacing credentials", async () => {
    vi.mocked(fetchAdminDomainProviders).mockResolvedValue([
      {
        id: 1,
        provider: "cloudflare",
        ownerType: "platform",
        displayName: "Primary Cloudflare",
        authType: "api_token",
        hasSecret: true,
        status: "healthy",
        capabilities: ["zones.read", "dns.read", "dns.write"],
        createdAt: "2026-04-05T08:00:00Z",
        updatedAt: "2026-04-05T08:00:00Z",
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Primary Cloudflare Text" }));

    const dialog = await screen.findByRole("dialog", { name: "Text Provider Text" });
    const dialogQueries = within(dialog);

    expect(dialogQueries.getByDisplayValue("Primary Cloudflare")).toBeInTheDocument();
    expect(dialogQueries.getByLabelText("API Token")).toHaveValue("");

    fireEvent.change(dialogQueries.getByPlaceholderText("Example: Cloudflare Text"), {
      target: { value: "Primary Cloudflare Updated" },
    });

    const submitButton = screen
      .getAllByText("Text Provider Text")
      .map((node) => node.closest("button"))
      .find((button): button is HTMLButtonElement => !!button && !button.disabled);

    expect(submitButton).toBeDefined();
    fireEvent.click(submitButton!);

    await waitFor(() => {
      expect(vi.mocked(updateAdminDomainProvider)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(updateAdminDomainProvider).mock.calls[0]?.[0]).toBe(1);
      expect(vi.mocked(updateAdminDomainProvider).mock.calls[0]?.[1]).toMatchObject({
        provider: "cloudflare",
        ownerType: "platform",
        displayName: "Primary Cloudflare Updated",
        authType: "api_token",
        credentials: {
          apiToken: "",
          apiEmail: "",
          apiKey: "",
          apiSecret: "",
        },
      });
    });
  });

  it("locks provider and auth type when the provider is already bound to domains", async () => {
    vi.mocked(fetchAdminDomains).mockResolvedValue([
      {
        id: 9,
        domain: "bound.example.com",
        rootDomain: "example.com",
        level: 1,
        kind: "subdomain",
        status: "active",
        verificationScore: 100,
        healthStatus: "healthy",
        providerAccountId: 1,
        isDefault: false,
        weight: 90,
        createdAt: "2026-04-05T08:00:00Z",
        updatedAt: "2026-04-05T08:00:00Z",
      },
    ] as never);
    vi.mocked(fetchAdminDomainProviders).mockResolvedValue([
      {
        id: 1,
        provider: "cloudflare",
        ownerType: "platform",
        displayName: "Bound Cloudflare",
        authType: "api_token",
        hasSecret: true,
        status: "healthy",
        capabilities: ["zones.read", "dns.read", "dns.write"],
        createdAt: "2026-04-05T08:00:00Z",
        updatedAt: "2026-04-05T08:00:00Z",
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Bound Cloudflare Text" }));

    const dialog = await screen.findByRole("dialog", { name: "Text Provider Text" });
    const dialogQueries = within(dialog);

    expect(dialogQueries.getByRole("combobox", { name: "DNS Text" })).toBeDisabled();
    expect(dialogQueries.getByRole("combobox", { name: "Provider Auth Type" })).toBeDisabled();
    expect(dialogQueries.getByText("Text Provider TextDomain，Text、Text、Text，Text。")).toBeInTheDocument();
  });

  it("uses the basic record-type combobox when building a change set", async () => {
    vi.mocked(fetchAdminDomainProviders).mockResolvedValue([
      {
        id: 1,
        provider: "cloudflare",
        ownerType: "platform",
        displayName: "Primary Cloudflare",
        authType: "api_token",
        hasSecret: true,
        status: "healthy",
        capabilities: ["zones.read", "dns.read", "dns.write"],
        createdAt: "2026-04-05T08:00:00Z",
        updatedAt: "2026-04-05T08:00:00Z",
      },
    ]);
    vi.mocked(fetchAdminDomainProviderZones).mockResolvedValue([
      {
        id: "zone-1",
        name: "example.com",
        status: "active",
      },
    ]);
    vi.mocked(fetchAdminDomainProviderRecords).mockResolvedValue([
      {
        id: "record-1",
        type: "MX",
        name: "example.com",
        value: "mx1.example.com",
        ttl: 120,
        priority: 10,
        proxied: false,
      },
    ]);
    vi.mocked(previewAdminDomainProviderChangeSet).mockResolvedValue({
      id: 22,
      providerAccountId: 1,
      providerZoneId: "zone-1",
      zoneName: "example.com",
      provider: "cloudflare",
      status: "previewed",
      summary: "1 create, 0 update, 0 delete",
      operations: [],
      createdAt: "2026-04-05T08:10:00Z",
    } as never);

    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Primary Cloudflare Text Zones" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "example.com Text Records" }));

    await screen.findByText("mx1.example.com");

    fireEvent.click(screen.getByRole("button", { name: "Text" }));

    const typeInputs = await screen.findAllByRole("combobox", { name: "Text" });
    const nameInputs = await screen.findAllByLabelText("Text");
    const valueInputs = await screen.findAllByLabelText("Text");
    const ttlInputs = await screen.findAllByLabelText("TTL");
    const priorityInputs = await screen.findAllByLabelText("Text");
    const proxiedInputs = await screen.findAllByLabelText("Text");

    const index = typeInputs.length - 1;

    const typeInputGroup = typeInputs[index].closest('[data-slot="input-group"]');
    expect(typeInputGroup).not.toBeNull();
    fireEvent.click(within(typeInputGroup as HTMLElement).getByRole("button"));
    fireEvent.click(await screen.findByRole("option", { name: "A" }));
    fireEvent.change(nameInputs[index], { target: { value: "mail.example.com" } });
    fireEvent.change(valueInputs[index], { target: { value: "1.2.3.4" } });
    fireEvent.change(ttlInputs[index], { target: { value: "120" } });
    fireEvent.change(priorityInputs[index], { target: { value: "0" } });
    fireEvent.click(proxiedInputs[index]);

    fireEvent.click(screen.getByRole("button", { name: "Text" }));

    await waitFor(() => {
      expect(vi.mocked(previewAdminDomainProviderChangeSet)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(previewAdminDomainProviderChangeSet).mock.calls[0]?.[0]).toBe(1);
      expect(vi.mocked(previewAdminDomainProviderChangeSet).mock.calls[0]?.[1]).toBe("zone-1");
      expect(vi.mocked(previewAdminDomainProviderChangeSet).mock.calls[0]?.[2]).toMatchObject({
        zoneName: "example.com",
        records: expect.arrayContaining([
          expect.objectContaining({
            type: "A",
            name: "mail.example.com",
            value: "1.2.3.4",
            ttl: 120,
            priority: 0,
            proxied: true,
          }),
        ]),
      });
    });
  });

  it("still allows saving when all records are deleted", async () => {
    vi.mocked(fetchAdminDomainProviders).mockResolvedValue([
      {
        id: 1,
        provider: "cloudflare",
        ownerType: "platform",
        displayName: "Primary Cloudflare",
        authType: "api_token",
        hasSecret: true,
        status: "healthy",
        capabilities: ["zones.read", "dns.read", "dns.write"],
        createdAt: "2026-04-05T08:00:00Z",
        updatedAt: "2026-04-05T08:00:00Z",
      },
    ]);
    vi.mocked(fetchAdminDomainProviderZones).mockResolvedValue([
      {
        id: "zone-1",
        name: "example.com",
        status: "active",
      },
    ]);
    vi.mocked(fetchAdminDomainProviderRecords).mockResolvedValue([
      {
        id: "record-1",
        type: "TXT",
        name: "example.com",
        value: "v=spf1 -all",
        ttl: 120,
        priority: 0,
        proxied: false,
      },
    ]);
    vi.mocked(previewAdminDomainProviderChangeSet).mockResolvedValue({
      id: 23,
      providerAccountId: 1,
      providerZoneId: "zone-1",
      zoneName: "example.com",
      provider: "cloudflare",
      status: "previewed",
      summary: "0 create, 0 update, 1 delete",
      operations: [],
      createdAt: "2026-04-05T08:12:00Z",
    } as never);
    vi.mocked(applyAdminDNSChangeSet).mockResolvedValue({
      id: 23,
      providerAccountId: 1,
      providerZoneId: "zone-1",
      zoneName: "example.com",
      provider: "cloudflare",
      status: "applied",
      summary: "0 create, 0 update, 1 delete",
      operations: [],
      createdAt: "2026-04-05T08:12:00Z",
    } as never);

    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Primary Cloudflare Text Zones" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "example.com Text Records" }));

    await screen.findByText("v=spf1 -all");

    fireEvent.click(await screen.findByRole("button", { name: "Text" }));

    const saveButton = screen.getByRole("button", { name: "Text and Text" });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(vi.mocked(previewAdminDomainProviderChangeSet)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(previewAdminDomainProviderChangeSet).mock.calls[0]?.[2]).toMatchObject({
        zoneName: "example.com",
        records: [],
      });
      expect(vi.mocked(applyAdminDNSChangeSet)).toHaveBeenCalledWith(23);
    });
  });
});
