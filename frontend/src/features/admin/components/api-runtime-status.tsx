import type { AdminAPILimitsSettings } from "../api";

type APIRuntimeStatusProps = {
  data: AdminAPILimitsSettings | undefined;
};

export function APIRuntimeStatus({ data }: APIRuntimeStatusProps) {
  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-4">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Runtime Status
        </div>
        <div className="mt-2 text-base font-semibold text-foreground">
          {data?.enabled ? "Rate limit enabled" : "Rate limit disabled"}
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Text and Text。TextRefreshText。
        </p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Identity Mode
        </div>
        <div className="mt-2 text-base font-semibold text-foreground">
          {data?.identityMode === "ip" ? "IP only" : "Bearer / IP mixed"}
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Text IP Text；Text Bearer Token Text。
        </p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Main RPM
        </div>
        <div className="mt-2 text-base font-semibold text-foreground">
          {data
            ? `${data.anonymousRPM} / ${data.authenticatedRPM}`
            : "-- / --"}
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Text，Text。
        </p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Strict IP
        </div>
        <div className="mt-2 text-base font-semibold text-foreground">
          {data?.strictIpEnabled
            ? `${data.strictIpRPM} RPM`
            : "Disabled"}
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Text，Text、Text。
        </p>
      </div>
    </div>
  );
}
