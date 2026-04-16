import { getParts, getSuppliers, getPartRequests, getPartCategories } from "@/actions/parts";
import { getAppSettings } from "@/actions/settings";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { PartsClient } from "@/components/parts/parts-client";
import { SuppliersClient } from "@/components/parts/suppliers-client";
import { HoldedHint } from "@/components/holded-hint";

const REQUEST_STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400",
  ordered: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  shipped: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  received: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  cancelled: "bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400",
};

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
          {requests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No part requests yet.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Job</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Part</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Type</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Supplier</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Qty</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <Link
                          href={`/repairs/${req.repairJobId}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {req.jobRef}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {req.jobTitle}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{req.partName ?? "—"}</p>
                        {req.partNumber && (
                          <p className="text-xs text-muted-foreground">
                            {req.partNumber}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={req.requestType === 'equipment' ? 'border-violet-200 text-violet-600 bg-violet-50' : 'border-gray-200 text-gray-500'}>
                          {req.requestType === 'equipment' ? '🔧 Equipment' : '📦 Part'}
                        </Badge>
                      </TableCell>
                      <TableCell>{req.supplierName ?? "—"}</TableCell>
                      <TableCell>{req.quantity}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            REQUEST_STATUS_COLORS[req.status] ?? ""
                          }
                        >
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {req.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="equipment" className="mt-4">
          {requests.filter(r => r.requestType === 'equipment').length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No equipment requests yet. Garage technicians can request tools and equipment from the repair detail screen.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Job</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Equipment</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.filter(r => r.requestType === 'equipment').map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <Link href={`/repairs/${req.repairJobId}`} className="font-mono text-xs hover:underline">
                          {req.jobRef}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{req.jobTitle}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{req.partName ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={REQUEST_STATUS_COLORS[req.status] ?? ""}>
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {req.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
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
