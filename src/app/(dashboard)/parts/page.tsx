import { getParts, getSuppliers, getPartRequests, getPartCategories } from "@/actions/parts";
import { getAppSettings } from "@/actions/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartsClient } from "@/components/parts/parts-client";
import { SuppliersClient } from "@/components/parts/suppliers-client";
import { PartRequestsClient } from "@/components/parts/part-requests-client";
import { EquipmentClient } from "@/components/parts/equipment-client";
import { HoldedHint } from "@/components/holded-hint";

export default async function PartsPage() {
  const [parts, suppliers, requests, settings, categories] = await Promise.all([
    getParts(),
    getSuppliers(),
    getPartRequests(),
    getAppSettings(),
    getPartCategories(),
  ]);

  const defaultMarkup = parseFloat(settings.default_markup_percent ?? "25");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold tracking-tight">
          Parts &amp; Suppliers
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage parts catalog, suppliers, and part requests.
        </p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog ({parts.length})</TabsTrigger>
          <TabsTrigger value="requests">
            Part Requests ({requests.filter(r => r.requestType !== 'equipment').length})
          </TabsTrigger>
          <TabsTrigger value="equipment">
            Equipment ({requests.filter(r => r.requestType === 'equipment').length})
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            Suppliers ({suppliers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <HoldedHint variant="sync" className="mb-4">
            Parts catalog is synced from <strong>Holded products</strong>. Prices set here are used for cost estimates. Adding parts to a repair doesn't change anything in Holded.
          </HoldedHint>
          <PartsClient parts={parts} suppliers={suppliers} categories={categories} defaultMarkup={defaultMarkup} />
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <PartRequestsClient requests={requests} />
        </TabsContent>

        <TabsContent value="equipment" className="mt-4">
          <EquipmentClient requests={requests.filter(r => r.requestType === 'equipment')} />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <HoldedHint variant="readonly" className="mb-4">
            Suppliers are synced from <strong>Holded contacts</strong> (type: supplier). To add or edit suppliers, update them in Holded and run a sync.
          </HoldedHint>
          <SuppliersClient suppliers={suppliers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
