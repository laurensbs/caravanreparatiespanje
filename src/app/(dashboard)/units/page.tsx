import { getUnits } from "@/actions/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import Link from "next/link";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function UnitsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { units, total } = await getUnits({
    q: params.q,
    page: params.page ? parseInt(params.page) : 1,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Units / Vehicles</h1>
          <p className="text-muted-foreground">{total} unit{total !== 1 ? "s" : ""}</p>
        </div>
        <Button asChild>
          <Link href="/units/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Unit
          </Link>
        </Button>
      </div>

      <form className="flex gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" placeholder="Search units..." defaultValue={params.q} className="pl-9" />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Registration</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Chassis ID</TableHead>
              <TableHead>Customer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No units found
                </TableCell>
              </TableRow>
            ) : (
              units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={`/units/${u.id}`} className="font-mono text-sm font-medium hover:underline">
                      {u.registration ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{u.brand ?? "—"}</TableCell>
                  <TableCell className="text-sm">{u.model ?? "—"}</TableCell>
                  <TableCell className="text-sm">{u.year ?? "—"}</TableCell>
                  <TableCell className="text-sm font-mono">{u.chassisId ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {u.customerName ? (
                      <Link href={`/customers/${u.customerId}`} className="hover:underline">{u.customerName}</Link>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
