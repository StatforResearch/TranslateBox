import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { cn } from "../lib/utils";

// Searchable language selector. `options` = [{code, name, native, flag}].
export const LanguageCombobox = ({ options, value, onChange, disabled, testId, placeholder = "Select language" }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.code === value) || options[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          disabled={disabled}
          aria-expanded={open}
          className="mt-1.5 w-full h-11 flex items-center justify-between rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2 truncate">
            {selected?.flag && <span>{selected.flag}</span>}
            <span className="truncate">{selected?.name}</span>
            {selected && selected.native && selected.native !== selected.name && (
              <span className="text-slate-400 dark:text-slate-500 truncate">· {selected.native}</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-white dark:bg-[#121824] border-slate-200 dark:border-slate-700"
        align="start"
      >
        <Command
          filter={(val, search) => {
            // val is the CommandItem `value`; we encode "name|native|code".
            return val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search language…" data-testid={`${testId}-search`} />
          <CommandList className="max-h-72">
            <CommandEmpty>No language found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.code}
                  value={`${o.name}|${o.native}|${o.code}`}
                  onSelect={() => {
                    onChange(o.code);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.code ? "opacity-100" : "opacity-0")} />
                  {o.flag && <span className="mr-2">{o.flag}</span>}
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.native && o.native !== o.name && (
                    <span className="ml-2 text-slate-400 dark:text-slate-500 truncate">{o.native}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
