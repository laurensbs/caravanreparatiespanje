import { getServices } from "@/actions/services";
import { ServicesClient } from "@/components/services/services-client";
import {
  DashboardPageCanvas,
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/layout/dashboard-surface";
import { cn } from "@/lib/utils";

export default async function ServicesPage() {
  const services = await getServices();
  const activeCount = services.filter((s) => s.active).length;

  return (
    <DashboardPageCanvas>
      <div className="space-y-6 sm:space-y-8">
        <DashboardPageHeader
          eyebrow="Catalog"
          title="Services"
          metadata={
            <span>
              <span className="tabular-nums text-foreground/90 dark:text-foreground/90">{activeCount}</span> active
              <span className="mx-1 text-muted-foreground/60">·</span>
              <span className="tabular-nums text-foreground/90 dark:text-foreground/90">{services.length}</span> total
            </span>
          }
          description={
            <>Fixed-price labour services — waxing, cleaning, ozon treatment, etc. Prices are excl. VAT and added as their own line on every invoice.</>
          }
        />

        <div className={cn(dashboardPanelClass, "p-4 sm:p-6")}>
          <ServicesClient services={services} />
        </div>
      </div>
    </DashboardPageCanvas>
  );
}
