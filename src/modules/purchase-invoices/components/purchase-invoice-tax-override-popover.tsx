"use client";

import { Percent } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { CreatePurchaseInvoiceInput } from "@/modules/purchase-invoices/validation/purchase-invoice-schema";

interface PurchaseInvoiceTaxOverridePopoverProps {
  index: number;
  /** Only the intra-/inter-state relevant override fields are shown — the
   * parent form knows the supply type from placeOfSupplyStateCode vs the
   * company's own state code. */
  isIntraState: boolean;
  isOverridden: boolean;
}

/** Per-line "Override Tax" control (44-purchase-invoice.md's spec-33
 * forward-note, identical shape to Sales Invoice's) — a Popover instead of a
 * separate dialog component to keep this to one file; reveals the
 * overridden amount fields plus a required reason. */
export function PurchaseInvoiceTaxOverridePopover({ index, isIntraState, isOverridden }: PurchaseInvoiceTaxOverridePopoverProps) {
  const { control } = useFormContext<CreatePurchaseInvoiceInput>();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant={isOverridden ? "default" : "outline"} size="icon-sm" aria-label="Override tax">
            <Percent size={14} />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <FormField
            control={control}
            name={`lines.${index}.isTaxOverridden`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-2">
                <FormLabel>Override this line&apos;s tax</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {isOverridden ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {isIntraState ? (
                  <>
                    <FormField
                      control={control}
                      name={`lines.${index}.overriddenCgst`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">CGST</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={field.value ?? ""}
                              onChange={(event) =>
                                field.onChange(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name={`lines.${index}.overriddenSgst`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">SGST</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={field.value ?? ""}
                              onChange={(event) =>
                                field.onChange(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <FormField
                    control={control}
                    name={`lines.${index}.overriddenIgst`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">IGST</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={field.value ?? ""}
                            onChange={(event) =>
                              field.onChange(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={control}
                  name={`lines.${index}.overriddenCess`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Cess</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={control}
                name={`lines.${index}.overrideReason`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Reason (required)</FormLabel>
                    <FormControl>
                      <Input value={field.value ?? ""} onChange={field.onChange} placeholder="e.g. Exempt under notification X" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
