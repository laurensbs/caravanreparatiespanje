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
    "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-800 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/[0.04] dark:text-gray-400 dark:hover:text-gray-100 dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:text-gray-100";

  return (
    <DashboardPageCanvas>
      <div className="space-y-6 sm:space-y-8">
        <DashboardPageHeader
          eyebrow="Workshop"
          title="Parts & Suppliers"
          metadata={
            <>
              <span>
                <span className="tabular-nums text-gray-700 dark:text-gray-200">{parts.length}</span> parts
              </span>
              <span>
                <span className="tabular-nums text-gray-700 dark:text-gray-200">{partRequestCount}</span> requests
              </span>
              <span>
                <span className="tabular-nums text-gray-700 dark:text-gray-200">{suppliers.length}</span> suppliers
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
              "inline-flex h-auto w-full flex-nowrap gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50/80 p-1 sm:w-auto",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-gray-800 dark:bg-white/[0.04]"
            )}
          >
            <TabsTrigger value="catalog" className={tabTriggerClass}>
              <Package className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                Catalog
                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                  {parts.length}
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="requests" className={tabTriggerClass}>
              <ClipboardList className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                Part requests
                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                  {partRequestCount}
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="equipment" className={tabTriggerClass}>
              <Wrench className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                Equipment
                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                  {equipmentCount}
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className={tabTriggerClass}>
              <Truck className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                Suppliers
                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
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
