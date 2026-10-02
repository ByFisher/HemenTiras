"use client";

import { useState } from "react";
import {
  Combobox as HeadlessCombobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Description,
  Field,
  Fieldset,
  Label,
} from "@headlessui/react";
import { Check, ChevronsUpDown } from "lucide-react";

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  label,
  description,
  placeholder = "Seçiniz...",
  searchPlaceholder = "Ara...",
  emptyText = "Sonuç bulunamadı.",
  className = "",
  disabled = false,
}: ComboboxProps) {
  const [query, setQuery] = useState("");
  const filteredOptions = options.filter((option) =>
    option.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")),
  );

  return (
    <Fieldset>
      <Field className={`relative block w-full ${className}`}>
        {label && <Label className="block text-xs text-zinc-400">{label}</Label>}
        {description && <Description className="mt-1 block text-[10px] leading-relaxed text-zinc-600">{description}</Description>}
        <HeadlessCombobox
          value={value}
          onChange={(option: string | null) => {
            if (option === null) return;
            onChange(option === value ? "" : option);
            setQuery("");
          }}
          onClose={() => setQuery("")}
          disabled={disabled}
          immediate
        >
          <div className="relative mt-1">
            <ComboboxInput
              aria-label={label ?? searchPlaceholder}
              displayValue={(option: string) => option}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={value || placeholder}
              className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-3 pr-9 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-500 data-[hover]:border-zinc-700 data-[focus]:border-zinc-500 data-[focus]:ring-1 data-[focus]:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <ComboboxButton aria-label="Seçenekleri göster" className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 data-[hover]:text-zinc-200">
              <ChevronsUpDown size={14} aria-hidden="true" />
            </ComboboxButton>
            <ComboboxOptions
              anchor="bottom start"
              className="z-50 max-h-60 w-[var(--input-width)] overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl [--anchor-gap:4px] focus:outline-none empty:invisible"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-zinc-500">
                  {query ? emptyText : searchPlaceholder}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <ComboboxOption
                    key={option}
                    value={option}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-2 text-xs text-zinc-300 data-[focus]:bg-zinc-800 data-[focus]:text-white"
                  >
                    <span>{option}</span>
                    {value === option && <Check size={13} aria-hidden="true" />}
                  </ComboboxOption>
                ))
              )}
            </ComboboxOptions>
          </div>
        </HeadlessCombobox>
      </Field>
    </Fieldset>
  );
}
