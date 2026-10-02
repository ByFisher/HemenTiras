"use client";

import {
  Checkbox as HeadlessCheckbox,
  Description,
  Field,
  Fieldset,
  Input as HeadlessInput,
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Textarea as HeadlessTextarea,
} from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

const controlClassName =
  "mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition data-[hover]:border-zinc-700 data-[focus]:border-zinc-500 data-[focus]:ring-1 data-[focus]:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50";

export function FormFieldset({ className = "", ...props }: ComponentProps<typeof Fieldset>) {
  return <Fieldset className={className} {...props} />;
}

export function FormField({
  label,
  description,
  className = "",
  children,
}: {
  label: ReactNode;
  description: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Fieldset>
      <Field className={`block text-xs text-zinc-400 ${className}`}>
        <Label className="block">{label}</Label>
        <Description className="mt-1 block text-[10px] leading-relaxed text-zinc-600">{description}</Description>
        {children}
      </Field>
    </Fieldset>
  );
}

type InputProps = Omit<ComponentProps<"input">, "className"> & { className?: string };

export function FormInput({ className = "", ...props }: InputProps) {
  return <HeadlessInput as="input" className={`${controlClassName} h-10 ${className}`} {...props} />;
}

export function CustomInput({
  label,
  description,
  fieldClassName,
  ...props
}: InputProps & { label: ReactNode; description: ReactNode; fieldClassName?: string }) {
  return (
    <FormFieldset>
      <FormField label={label} description={description} className={fieldClassName}>
        <FormInput {...props} />
      </FormField>
    </FormFieldset>
  );
}

type TextareaProps = Omit<ComponentProps<"textarea">, "className"> & { className?: string };

export function FormTextarea({ className = "", ...props }: TextareaProps) {
  return <HeadlessTextarea as="textarea" className={`${controlClassName} min-h-24 p-3 ${className}`} {...props} />;
}

export function CustomTextarea({
  label,
  description,
  fieldClassName,
  ...props
}: TextareaProps & { label: ReactNode; description: ReactNode; fieldClassName?: string }) {
  return (
    <FormFieldset>
      <FormField label={label} description={description} className={fieldClassName}>
        <FormTextarea {...props} />
      </FormField>
    </FormFieldset>
  );
}

export function FormCheckbox({
  className = "",
  ...props
}: Omit<ComponentProps<typeof HeadlessCheckbox>, "className"> & { className?: string }) {
  return (
    <HeadlessCheckbox
      className={`group inline-flex size-4 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-transparent outline-none transition data-[checked]:border-zinc-200 data-[checked]:bg-zinc-100 data-[checked]:text-zinc-950 data-[hover]:border-zinc-500 data-[focus]:ring-2 data-[focus]:ring-zinc-400 ${className}`}
      {...props}
    >
      <Check size={12} aria-hidden="true" />
    </HeadlessCheckbox>
  );
}

export function FormCheckboxField({
  label,
  description,
  checked,
  onChange,
}: {
  label: ReactNode;
  description: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Fieldset>
      <Field className="flex items-start gap-2">
        <FormCheckbox checked={checked} onChange={onChange} className="mt-0.5 shrink-0" />
        <span>
          <Label className="block cursor-pointer text-xs text-zinc-500 hover:text-zinc-200">{label}</Label>
          <Description className="mt-0.5 block text-[10px] leading-relaxed text-zinc-600">{description}</Description>
        </span>
      </Field>
    </Fieldset>
  );
}

export function FormListbox<T extends string | number>({
  label,
  description,
  value,
  onChange,
  options,
  placeholder = "Seçiniz",
  clearable = true,
  className = "",
}: {
  label: string;
  description: string;
  value: T | "";
  onChange: (value: T | "") => void;
  options: readonly { value: T; label: string }[];
  placeholder?: string;
  clearable?: boolean;
  className?: string;
}) {
  return (
    <Fieldset>
      <Field className={`block text-xs text-zinc-400 ${className}`}>
        <Label className="block">{label}</Label>
        <Description className="mt-1 block text-[10px] leading-relaxed text-zinc-600">{description}</Description>
        <Listbox<"div", T | ""> as="div" value={value} onChange={onChange}>
          <div className="relative mt-1">
            <ListboxButton className="flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 text-left text-xs text-zinc-200 outline-none data-[hover]:border-zinc-700 data-[focus]:border-zinc-500 data-[focus]:ring-1 data-[focus]:ring-zinc-500">
              <span className={value !== "" ? "" : "text-zinc-500"}>{options.find((option) => option.value === value)?.label ?? placeholder}</span>
              <ChevronDown size={14} aria-hidden="true" className="text-zinc-500" />
            </ListboxButton>
            <ListboxOptions
              anchor="bottom start"
              className="z-50 max-h-60 w-[var(--button-width)] overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl [--anchor-gap:4px] focus:outline-none"
            >
              {clearable && value !== "" && (
                <ListboxOption value="" className="cursor-pointer rounded px-2 py-2 text-xs text-zinc-400 data-[focus]:bg-zinc-800 data-[focus]:text-white">
                  {placeholder}
                </ListboxOption>
              )}
              {options.map((option) => (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-2 text-xs text-zinc-300 data-[focus]:bg-zinc-800 data-[focus]:text-white data-[selected]:text-white"
                >
                  {option.label}
                  {value === option.value && <Check size={13} aria-hidden="true" />}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </div>
        </Listbox>
      </Field>
    </Fieldset>
  );
}

export const CustomSelect = FormListbox;
export const CustomListbox = FormListbox;
