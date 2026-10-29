"use client";

import { Select } from "radix-ui";
import { Check, ChevronDown } from "@/components/icons";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

/* Brand dropdown: a pill with an icon and the current choice, opening a
   rounded floating menu with a purple highlight and a tick on the chosen row.
   Built on Radix Select, so keyboard and screen-reader behaviour comes with it. */
export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  label,
  icon: Icon,
}: {
  value: T;
  onChange: (v: T) => void;
  options: DropdownOption<T>[];
  label: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <Select.Root value={value} onValueChange={v => onChange(v as T)}>
      <Select.Trigger
        aria-label={label}
        className="group lb-press inline-flex h-11 min-w-[210px] items-center gap-2.5 rounded-full bg-surface pl-4 pr-3 text-[14px] font-semibold tracking-[-0.014em] shadow-soft outline-none ring-1 ring-hairline transition-shadow duration-200 hover:shadow-float focus-visible:ring-2 focus-visible:ring-brand data-[state=open]:ring-2 data-[state=open]:ring-brand"
      >
        {Icon && <Icon className="h-[18px] w-[18px] text-brand" aria-hidden />}
        <span className="font-medium text-muted">{label}</span>
        <span className="flex-1 text-left">
          <Select.Value />
        </span>
        <Select.Icon asChild>
          <ChevronDown className="h-4 w-4 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          align="end"
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[24px] bg-surface p-1.5 shadow-float ring-1 ring-hairline data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <Select.Viewport>
            {options.map(o => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center rounded-2xl py-2.5 pl-3.5 pr-10 text-[14px] outline-none transition-colors data-[highlighted]:bg-brand-wash data-[state=checked]:font-semibold data-[state=checked]:text-brand-deep"
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3.5 flex items-center">
                  <Check className="h-4 w-4 text-brand" aria-hidden />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
