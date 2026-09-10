"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUSINESS_TYPE_SUGGESTIONS } from "@/constants/company";
import { GST_STATE_CODES } from "@/engines/gst/state-codes";
import { LogoUpload } from "@/modules/company/components/logo-upload";
import { updateCompanyProfileAction } from "@/modules/company/actions/company-actions";
import {
  companyProfileSchema,
  type CompanyProfileInput,
} from "@/modules/company/validation/company-schema";

interface CompanyProfileFormProps {
  companyId: string;
  defaultValues: Partial<CompanyProfileInput>;
}

// Base UI's Select decides controlled-vs-uncontrolled on the first render by
// checking whether `value` is `undefined` — NONE_VALUE (a distinct, defined
// "controlled, nothing selected yet" sentinel) keeps it controlled for the
// component's entire lifetime; see branch-selector.tsx/
// product-option-selector.tsx for the reference fix this mirrors.
const NONE_VALUE = "__none__";

const BASE_DEFAULT_VALUES: CompanyProfileInput = {
  companyName: "",
  country: "India",
  currencySymbol: "₹",
  decimalPlaces: 2,
};

// Company Admin's own edit of their company's profile — everything except
// the compliance-sensitive registration identifiers (Legal Name, GSTIN, PAN,
// TAN, CIN) and currency code, which stay on the Super-Admin-only form at
// /administration/companies/[id]/edit (CompanyForm/CompanyEditForm).
export function CompanyProfileForm({ companyId, defaultValues }: CompanyProfileFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CompanyProfileInput>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: { ...BASE_DEFAULT_VALUES, ...defaultValues },
  });

  const logoValue = useWatch({ control: form.control, name: "logo" });

  async function handleSubmit(data: CompanyProfileInput) {
    setIsSubmitting(true);
    let result: Awaited<ReturnType<typeof updateCompanyProfileAction>>;
    try {
      result = await updateCompanyProfileAction(companyId, data);
    } finally {
      setIsSubmitting(false);
    }

    if (result.success) {
      toast.success("Company profile saved successfully.");
      router.refresh();
      return;
    }

    toast.error(result.error ?? "Failed to save company profile.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        <FormSection title="Basic">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Name</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="businessType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Type</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} list="business-type-suggestions" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <datalist id="business-type-suggestions">
            {BUSINESS_TYPE_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </FormSection>

        <FormSection title="Contact">
          <FormField
            control={form.control}
            name="mobileNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile Number</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="alternateMobile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alternate Mobile</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} type="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder="https://" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Address">
          <FormField
            control={form.control}
            name="addressLine1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="addressLine2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="district"
            render={({ field }) => (
              <FormItem>
                <FormLabel>District</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="stateCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GST State</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(next) => field.onChange(!next || next === NONE_VALUE ? undefined : next)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select your company's GST state">
                        {(current: string | null) => {
                          if (!current || current === NONE_VALUE) {
                            return "Select your company's GST state";
                          }
                          return (
                            GST_STATE_CODES.find((entry) => entry.code === current)?.name ??
                            "Select your company's GST state"
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {GST_STATE_CODES.map((entry) => (
                        <SelectItem key={entry.code} value={entry.code}>
                          {entry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Required before you can create a Quotation, Purchase Order, or other
                  GST-taxed document —
                  determines whether tax is CGST/SGST or IGST.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pinCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PIN Code</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection
          title="Financial Display"
          description="Currency code itself is managed by Super Admin."
        >
          <FormField
            control={form.control}
            name="currencySymbol"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency Symbol *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="decimalPlaces"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Decimal Places *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={4}
                    {...field}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <div className="flex flex-col gap-2">
          <Label>Company Logo</Label>
          <LogoUpload
            value={logoValue ?? null}
            onChange={(path) => form.setValue("logo", path ?? undefined, { shouldDirty: true })}
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
