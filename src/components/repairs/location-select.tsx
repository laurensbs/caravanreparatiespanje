"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

interface LocationSelectProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function LocationSelect({
  name,
  value,
  defaultValue = "none",
  onValueChange,
  className,
  locations,
}: LocationSelectProps & { locations: { id: string; name: string }[] }) {
  const main = locations.filter((loc) =>
    MAIN_LOCATIONS.includes(loc.name.toLowerCase())
  );
  const misc = locations.filter(
    (loc) => !MAIN_LOCATIONS.includes(loc.name.toLowerCase())
  );

  return (
    <Select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select location" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No location</SelectItem>
        <SelectSeparator />
        <SelectGroup>
          {main.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectGroup>
        {misc.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Misc</SelectLabel>
              {misc.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
