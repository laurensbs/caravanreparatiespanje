import { getUnits } from "@/actions/units";
import { UnitsClient } from "@/components/units/units-client";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function UnitsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { units, total, page, limit } = await getUnits({
    q: params.q,
    type: params.type,
    page: params.page ? parseInt(params.page) : 1,
  });

  return (
    <UnitsClient
      units={units}
      total={total}
      page={page}
      limit={limit}
      currentQ={params.q}
      currentType={params.type}
    />
  );
}
