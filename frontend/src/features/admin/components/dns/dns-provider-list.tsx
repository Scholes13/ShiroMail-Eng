import { Button } from "@/components/ui/button";
import {
  WorkspaceBadge,
  WorkspaceEmpty,
  WorkspaceListRow,
} from "@/components/layout/workspace-ui";
import type { DomainProviderItem } from "../../api";
import { PaginationControls } from "./dns-shared-ui";
import { ADMIN_PROVIDERS_PAGE_SIZE } from "./dns-page.utils";

type DnsProviderListProps = {
  providers: DomainProviderItem[];
  paginatedItems: DomainProviderItem[];
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  validatingProviderID: number | null;
  loadingZonesProviderID: number | null;
  deletingProviderID: number | null;
  onValidate: (provider: DomainProviderItem) => void;
  onEdit: (provider: DomainProviderItem) => void;
  onLoadZones: (provider: DomainProviderItem) => void;
  onDelete: (provider: DomainProviderItem) => void;
};

export function DnsProviderList({
  providers,
  paginatedItems,
  page,
  totalPages,
  total,
  onPageChange,
  validatingProviderID,
  loadingZonesProviderID,
  deletingProviderID,
  onValidate,
  onEdit,
  onLoadZones,
  onDelete,
}: DnsProviderListProps) {
  if (!providers.length) {
    return (
      <WorkspaceEmpty
        title="Text Provider Text"
        description="Text DNS Text，Text Zone Text Zone Text。"
      />
    );
  }

  return (
    <div className="space-y-3">
      {paginatedItems.map((provider) => (
        <WorkspaceListRow
          key={provider.id}
          title={provider.displayName}
          description={`${provider.provider} · ${provider.ownerType} · ${provider.authType}`}
          meta={
            <>
              <WorkspaceBadge>{provider.status}</WorkspaceBadge>
              <span>
                {provider.hasSecret
                  ? "secret ready"
                  : "secret missing"}
              </span>
              <span>{provider.capabilities.join(", ")}</span>
              <Button
                aria-label={`${provider.displayName} Text`}
                disabled={
                  validatingProviderID === provider.id ||
                  loadingZonesProviderID === provider.id ||
                  deletingProviderID === provider.id
                }
                size="sm"
                variant="outline"
                onClick={() => onValidate(provider)}
              >
                {validatingProviderID === provider.id ? "Text..." : "Text"}
              </Button>
              <Button
                aria-label={`${provider.displayName} Text`}
                disabled={
                  deletingProviderID === provider.id ||
                  validatingProviderID === provider.id ||
                  loadingZonesProviderID === provider.id
                }
                size="sm"
                variant="ghost"
                onClick={() => onEdit(provider)}
              >
                Text
              </Button>
              <Button
                aria-label={`${provider.displayName} Text Zones`}
                disabled={
                  validatingProviderID === provider.id ||
                  loadingZonesProviderID === provider.id ||
                  deletingProviderID === provider.id
                }
                size="sm"
                variant="ghost"
                onClick={() => onLoadZones(provider)}
              >
                {loadingZonesProviderID === provider.id ? "Text..." : "Text Zones"}
              </Button>
              <Button
                aria-label={`${provider.displayName} Text`}
                disabled={
                  deletingProviderID === provider.id ||
                  validatingProviderID === provider.id ||
                  loadingZonesProviderID === provider.id
                }
                size="sm"
                variant="ghost"
                onClick={() => onDelete(provider)}
              >
                {deletingProviderID === provider.id ? "Text..." : "Text"}
              </Button>
            </>
          }
        />
      ))}
      <PaginationControls
        itemLabel="Provider Text"
        page={page}
        pageSize={ADMIN_PROVIDERS_PAGE_SIZE}
        total={total}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
