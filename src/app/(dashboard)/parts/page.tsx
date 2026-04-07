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
        <h1 className="text-3xl font-bold tracking-tight">
          Parts &amp; Suppliers
        </h1>
        <p className="text-muted-foreground">
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Part</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
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
          )}
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          {suppliers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No suppliers yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suppliers.map((s) => (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    {s.email && <p>{s.email}</p>}
                    {s.phone && <p>{s.phone}</p>}
                    {s.website && (
                      <a
                        href={s.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {s.website}
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
