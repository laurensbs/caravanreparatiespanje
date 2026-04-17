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
    "min-h-12 min-w-[calc(50%-4px)] shrink-0 snap-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium touch-manipulation sm:min-h-11 sm:min-w-0 sm:flex-1 sm:px-3 sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground";

  return (
    <div className="mx-auto w-full max-w-7xl animate-fade-in px-0 sm:px-0">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm",
          "max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none"
        )}
      >
        <header className="border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Parts &amp; Suppliers</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Catalog, workshop part requests, equipment asks, and supplier directory — each in its own tab so you can
            focus on one list at a time.
          </p>
        </header>

        <Tabs defaultValue="catalog" className="w-full">
          <div className="px-3 pb-2 pt-3 sm:px-6 sm:pt-4">
            <TabsList
              className={cn(
                "flex h-auto w-full flex-nowrap snap-x snap-mandatory gap-1 overflow-x-auto p-1.5 sm:flex-wrap sm:overflow-visible sm:snap-none",
                "rounded-xl border border-border/50 bg-muted/40 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              )}
            >
              <TabsTrigger value="catalog" className={tabTriggerClass}>
                <Package className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">
                  Catalog <span className="tabular-nums text-muted-foreground">({parts.length})</span>
                </span>
              </TabsTrigger>
              <TabsTrigger value="requests" className={tabTriggerClass}>
                <ClipboardList className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">
                  Part requests <span className="tabular-nums text-muted-foreground">({partRequestCount})</span>
                </span>
              </TabsTrigger>
              <TabsTrigger value="equipment" className={tabTriggerClass}>
                <Wrench className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">
                  Equipment <span className="tabular-nums text-muted-foreground">({equipmentCount})</span>
                </span>
              </TabsTrigger>
              <TabsTrigger value="suppliers" className={tabTriggerClass}>
                <Truck className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">
                  Suppliers <span className="tabular-nums text-muted-foreground">({suppliers.length})</span>
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="catalog" className="mt-0 border-t border-border/40 px-3 pb-6 pt-3 focus-visible:outline-none sm:px-6 sm:pt-2">
            <HoldedHint variant="sync" className="mb-4">
              Parts catalog is synced from <strong>Holded products</strong>. Prices set here are used for cost estimates.
              Adding parts to a repair doesn&apos;t change anything in Holded.
            </HoldedHint>
            <PartsClient parts={parts} suppliers={suppliers} categories={categories} defaultMarkup={defaultMarkup} />
          </TabsContent>

          <TabsContent value="requests" className="mt-0 border-t border-border/40 px-3 pb-6 pt-3 focus-visible:outline-none sm:px-6 sm:pt-2">
            <PartRequestsClient requests={requests} />
          </TabsContent>

          <TabsContent value="equipment" className="mt-0 border-t border-border/40 px-3 pb-6 pt-3 focus-visible:outline-none sm:px-6 sm:pt-2">
            <EquipmentClient requests={requests.filter((r) => r.requestType === "equipment")} />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-0 border-t border-border/40 px-3 pb-6 pt-3 focus-visible:outline-none sm:px-6 sm:pt-2">
            <HoldedHint variant="readonly" className="mb-4">
              Suppliers are synced from <strong>Holded contacts</strong> (type: supplier). To add or edit suppliers,
              update them in Holded and run a sync.
            </HoldedHint>
            <SuppliersClient suppliers={suppliers} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
