"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

const DNS_RECORD_TYPE_ITEMS = ["A", "AAAA", "CNAME", "TXT", "MX", "NS"] as const

type DNSRecordTypeComboboxProps = {
  disabled?: boolean
  onValueChange: (value: string) => void
  value: string
}

export function DNSRecordTypeCombobox({
  disabled = false,
  onValueChange,
  value,
}: DNSRecordTypeComboboxProps) {
  return (
    <Combobox
      items={DNS_RECORD_TYPE_ITEMS}
      value={value || null}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
    >
      <ComboboxInput
        aria-label="Text"
        className="h-9 w-full"
        disabled={disabled}
        placeholder="Text"
      />
      <ComboboxContent>
        <ComboboxEmpty>Text</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
