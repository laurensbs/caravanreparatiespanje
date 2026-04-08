import { getParts, getSuppliers, getPartRequests } from "@/actions/parts";
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
  requested: "bg-yellow-100 text-yellow-800",
  ordered: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export default async function PartsPage() {
  const [parts, suppliers, requests] = await Promise.all([
    getParts(),
    getSuppliers(),
    getPartRequests(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Parts &amp; Suppliers
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage parts catalog, suppliers, and part requests for repair jobs.
        </p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog ({parts.length})</TabsTrigger>
          <TabsTrigger value="requests">
            Part Requests ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            Suppliers ({suppliers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <HoldedHint variant="sync" className="mb-4">
            Parts catalog is synced from <strong>Holded products</strong>. Prices set here are used for cost estimates. Adding parts to a repair doesn't change anything in Holded.
          </HoldedHint>
          <PartsClient parts={parts} suppliers={suppliers} />
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
