import { getParts, getSuppliers, getPartRequests, getPartCategories } from "@/actions/parts";
import { getAppSettings } from "@/actions/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartsClient } from "@/components/parts/parts-client";
import { SuppliersClient } from "@/components/parts/suppliers-client";
import { PartRequestsClient } from "@/components/parts/part-requests-client";
import { EquipmentClient } from "@/components/parts/equipment-client";
import { HoldedHint } from "@/components/holded-hint";
import { Package, ClipboardList, Wrench, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DashboardPageCanvas,
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/layout/dashboard-surface";

export default async function PartsPage() {
  const [parts, suppliers, requests, settings, categories] = await Promise.all([
    getParts(),
    getSuppliers(),
    getPartRequests(),
    getAppSettings(),
    getPartCategories(),
  ]);

  const defaultMarkup = parseFloat(settings.default_markup_percent ?? "25");
  const partRequestCount = requests.filter((r) => r.requestType !== "equipment").length;
  const equipmentCount = requests.filter((r) => r.requestType === "equipment").length;

  const tabTriggerClass =
    "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/[0.04] dark:text-muted-foreground/70 dark:hover:text-foreground dark:data-[state=active]:bg-foreground dark:data-[state=active]:text-foreground";

  return (
    <DashboardPageCanvas>
      <div className="space-y-6 sm:space-y-8">
        <DashboardPageHeader
          eyebrow="Workshop"
          title="Parts & Suppliers"
          metadata={
            <>
              <span>
                <span className="tabular-nums text-foreground/90 dark:text-foreground/90">{parts.length}</span> parts
              </span>
              <span>
                <span className="tabular-nums text-foreground/90 dark:text-foreground/90">{partRequestCount}</span> requests
              </span>
              <span>
                <span className="tabular-nums text-foreground/90 dark:text-foreground/90">{suppliers.length}</span> suppliers
              </span>
            </>
          }
          description={
            <>Catalog, workshop part requests, equipment asks, and supplier directory — each in its own tab so you can focus on one list at a time.</>
          }
        />

        <Tabs defaultValue="catalog" className="w-full">
          <TabsList
            className={cn(
              "inline-flex h-auto w-full flex-nowrap gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/50 p-1 sm:w-auto",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-border dark:bg-card/[0.04]"
            )}
          >
            <TabsTrigger value="catalog" className={tabTriggerClass}>
              <Package className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                Catalog
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground dark:bg-card/[0.06] dark:text-muted-foreground/70">
                  {parts.length}
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="requests" className={tabTriggerClass}>
              <ClipboardList className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                Part requests
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground dark:bg-card/[0.06] dark:text-muted-foreground/70">
                  {partRequestCount}
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="equipment" className={tabTriggerClass}>
              <Wrench className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                Equipment
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground dark:bg-card/[0.06] dark:text-muted-foreground/70">
                  {equipmentCount}
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className={tabTriggerClass}>
              <Truck className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                Suppliers
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground dark:bg-card/[0.06] dark:text-muted-foreground/70">
                  {suppliers.length}
                </span>
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className={cn("mt-5 focus-visible:outline-none", dashboardPanelClass, "p-4 sm:p-6")}>
            <HoldedHint variant="sync" className="mb-4">
              Parts catalog is synced from <strong>Holded products</strong>. Prices set here are used for cost estimates.
              Adding parts to a repair doesn&apos;t change anything in Holded.
            </HoldedHint>
            <PartsClient parts={parts} suppliers={suppliers} categories={categories} defaultMarkup={defaultMarkup} />
          </TabsContent>

          <TabsContent value="requests" className={cn("mt-5 focus-visible:outline-none", dashboardPanelClass, "p-4 sm:p-6")}>
            <PartRequestsClient requests={requests} />
          </TabsContent>

          <TabsContent value="equipment" className={cn("mt-5 focus-visible:outline-none", dashboardPanelClass, "p-4 sm:p-6")}>
            <EquipmentClient requests={requests.filter((r) => r.requestType === "equipment")} />
          </TabsContent>

          <TabsContent value="suppliers" className={cn("mt-5 focus-visible:outline-none", dashboardPanelClass, "p-4 sm:p-6")}>
            <HoldedHint variant="readonly" className="mb-4">
              Suppliers are synced from <strong>Holded contacts</strong> (type: supplier). To add or edit suppliers,
              update them in Holded and run a sync.
            </HoldedHint>
            <SuppliersClient suppliers={suppliers} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardPageCanvas>
  );
}
