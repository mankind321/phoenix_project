"use client";

import * as React from "react";

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={disabled ? undefined : setOpen}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          disabled={disabled}
          className={cn(
            "w-full flex justify-between items-center rounded-md border bg-white px-3 py-2 text-sm",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          <span className="truncate">
            {options.find((o) => o.value === value)?.label ||
              placeholder ||
              "Select..."}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        className="p-0 mt-1 rounded-md border bg-white shadow-lg"
        style={{
          width: triggerRef.current ? triggerRef.current.offsetWidth : "auto",
        }}
      >
        <Command shouldFilter>
          {/* SEARCH BAR */}
          <div className="p-2 border-b">
            <CommandInput
              placeholder={placeholder || "Search..."}
              className="h-8"
            />
          </div>

          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {options.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.label}
                className="cursor-pointer"
                onSelect={() => {
                  if (disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    opt.value === value ? "opacity-100" : "opacity-0",
                  )}
                />
                {opt.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
