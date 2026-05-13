import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  itemLabel,
  onPageChange,
}: PaginationControlsProps) {
  if (total <= pageSize) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        Text {page} / {totalPages} Text · Text {total} Text{itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button disabled={page <= 1} size="sm" type="button" variant="outline" onClick={() => onPageChange(page - 1)}>
          Text
        </Button>
        <Button disabled={page >= totalPages} size="sm" type="button" variant="outline" onClick={() => onPageChange(page + 1)}>
          Text
        </Button>
      </div>
    </div>
  );
}
