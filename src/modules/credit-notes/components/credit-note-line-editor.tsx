"use client";

import * as React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import type { CreateCreditNoteInput } from "@/modules/credit-notes/validation/credit-note-schema";
import type { CreditNoteGstRateOption } from "@/types/credit-note";

const NONE_VALUE = "__none__";

const BLANK_LINE = { description: "", taxableAmount: 0, ratePercent: 0, cessPercent: 0 };

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

function gstRateLabel(rate: CreditNoteGstRateOption): string {
  return rate.cessPercent > 0 ? `${rate.name} (${rate.ratePercent}% + ${rate.cessPercent}% cess)` : `${rate.name} (${rate.ratePercent}%)`;
}

interface CreditNoteLineEditorProps {
  gstRates: CreditNoteGstRateOption[];
}

/** Freeform adjustment lines (40-credit-note.md's Data Model: "description +
 * taxableAmount + ratePercent/cessPercent entered or picked directly from a
 * GstRate") — deliberately not derived from a product or invoice line, so
 * this is a plain add/remove row editor rather than a capped, invoice-driven
 * one like sales-return-form.tsx's. */
export function CreditNoteLineEditor({ gstRates }: CreditNoteLineEditorProps) {
  const { control, setValue } = useFormContext<CreateCreditNoteInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  function applyGstRate(index: number, gstRateId: string | null | undefined) {
    if (!gstRateId || gstRateId === NONE_VALUE) {
      return;
    }
    const rate = gstRates.find((option) => option.id === gstRateId);
    if (!rate) {
      return;
    }
    setValue(`lines.${index}.ratePercent`, rate.ratePercent, { shouldValidate: true });
    setValue(`lines.${index}.cessPercent`, rate.cessPercent, { shouldValidate: true });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Taxable Amount</TableHead>
              <TableHead>GST Rate</TableHead>
              <TableHead className="text-right">Rate %</TableHead>
              <TableHead className="text-right">Cess %</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell className="min-w-56">
                  <FormField
                    control={control}
                    name={`lines.${index}.description`}
                    render={({ field: descriptionField }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...descriptionField} placeholder="e.g. Price correction" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>

                <TableCell>
                  <FormField
                    control={control}
                    name={`lines.${index}.taxableAmount`}
                    render={({ field: amountField }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            min={0.01}
                            step="0.01"
                            style={{ width: numericFieldWidth(amountField.value) }}
                            {...amountField}
                            onChange={(event) => amountField.onChange(toNumberOrZero(event.target.valueAsNumber))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>

                <TableCell className="min-w-40">
                  <Select value={NONE_VALUE} onValueChange={(value) => applyGstRate(index, value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick a rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {gstRates.map((rate) => (
                        <SelectItem key={rate.id} value={rate.id}>
                          {gstRateLabel(rate)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                <TableCell>
                  <FormField
                    control={control}
                    name={`lines.${index}.ratePercent`}
                    render={({ field: rateField }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            style={{ width: numericFieldWidth(rateField.value) }}
                            {...rateField}
                            onChange={(event) => rateField.onChange(toNumberOrZero(event.target.valueAsNumber))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>

                <TableCell>
                  <FormField
                    control={control}
                    name={`lines.${index}.cessPercent`}
                    render={({ field: cessField }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            style={{ width: numericFieldWidth(cessField.value ?? 0) }}
                            value={cessField.value ?? 0}
                            onChange={(event) => cessField.onChange(toNumberOrZero(event.target.valueAsNumber))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>

                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                    aria-label="Remove line"
                  >
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={() => append(BLANK_LINE)}>
        <Plus size={16} />
        Add Line
      </Button>
    </div>
  );
}
