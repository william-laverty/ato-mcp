"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ANZSIC_CODES } from "@ato-mcp/shared";
import { saveFacts } from "@/app/onboard/_actions";
import type { UserFacts } from "@ato-mcp/shared";

// Partial schemas per step for step-level validation
const step1Schema = z.object({
  given_name: z.string().min(1, "Name is required"),
  state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]),
  residency_status: z.enum([
    "resident",
    "non_resident",
    "temporary_resident",
    "working_holiday_maker",
  ]),
});

const step2Schema = z.object({
  has_abn: z.boolean(),
  abn: z.string().optional(),
  business_structure: z.enum([
    "sole_trader",
    "partnership",
    "company",
    "trust",
    "none",
  ]),
  business_name: z.string().optional(),
  industry_code: z.string().optional(),
  occupation: z.string().optional(),
});

const step3Schema = z.object({
  gst_registered: z.boolean(),
  gst_period: z.enum(["monthly", "quarterly", "annual", "n/a"]),
  payg_instalments: z.boolean(),
  fbt_payer: z.boolean(),
});

const step4Schema = z.object({
  has_spouse: z.boolean(),
  dependants: z.number().int().min(0).max(20),
  hecs_help_debt: z.boolean(),
  private_health_insurance: z.boolean(),
});

const step5Schema = z.object({
  has_investment_property: z.boolean(),
  has_shares_or_managed_funds: z.boolean(),
  has_crypto: z.boolean(),
  super_fund_type: z.enum(["industry", "retail", "smsf", "unsure", "none"]),
});

const step6Schema = z.object({
  current_fy: z.string().regex(/^\d{4}-\d{2}$/, "FY must be YYYY-YY e.g. 2024-25"),
  prior_fy_lodged: z.boolean(),
});

// Full form schema combining all steps
const fullSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema);

type FormData = z.infer<typeof fullSchema>;

const STEP_COUNT = 6;

interface FactsWizardProps {
  userId: string;
  initialValues?: Partial<UserFacts>;
  onComplete?: () => void;
}

export default function FactsWizard({ userId, initialValues, onComplete }: FactsWizardProps) {
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    trigger,
  } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      given_name: initialValues?.given_name ?? "",
      state: initialValues?.state ?? "NSW",
      residency_status: initialValues?.residency_status ?? "resident",
      has_abn: initialValues?.has_abn ?? false,
      abn: initialValues?.abn ?? "",
      business_structure: initialValues?.business_structure ?? "none",
      business_name: initialValues?.business_name ?? "",
      industry_code: initialValues?.industry_code ?? "",
      occupation: initialValues?.occupation ?? "",
      gst_registered: initialValues?.gst_registered ?? false,
      gst_period: initialValues?.gst_period ?? "n/a",
      payg_instalments: initialValues?.payg_instalments ?? false,
      fbt_payer: initialValues?.fbt_payer ?? false,
      has_spouse: initialValues?.has_spouse ?? false,
      dependants: initialValues?.dependants ?? 0,
      hecs_help_debt: initialValues?.hecs_help_debt ?? false,
      private_health_insurance: initialValues?.private_health_insurance ?? false,
      has_investment_property: initialValues?.has_investment_property ?? false,
      has_shares_or_managed_funds: initialValues?.has_shares_or_managed_funds ?? false,
      has_crypto: initialValues?.has_crypto ?? false,
      super_fund_type: initialValues?.super_fund_type ?? "unsure",
      current_fy: initialValues?.current_fy ?? "2024-25",
      prior_fy_lodged: initialValues?.prior_fy_lodged ?? false,
    },
  });

  const hasAbn = watch("has_abn");
  const gstRegistered = watch("gst_registered");

  const stepFields: Record<number, Array<keyof FormData>> = {
    1: ["given_name", "state", "residency_status"],
    2: ["has_abn", "abn", "business_structure", "business_name", "industry_code", "occupation"],
    3: ["gst_registered", "gst_period", "payg_instalments", "fbt_payer"],
    4: ["has_spouse", "dependants", "hecs_help_debt", "private_health_insurance"],
    5: ["has_investment_property", "has_shares_or_managed_funds", "has_crypto", "super_fund_type"],
    6: ["current_fy", "prior_fy_lodged"],
  };

  const goNext = async () => {
    const fields = stepFields[step] ?? [];
    const valid = await trigger(fields);
    if (valid) setStep((s) => Math.min(s + 1, STEP_COUNT));
  };

  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    setServerError(null);
    const now = new Date().toISOString();
    const factsPayload = {
      ...data,
      accepted_disclaimer_at: now,
      facts_updated_at: now,
      schema_version: 1 as const,
    };
    const result = await saveFacts(userId, factsPayload);
    if (result?.error) {
      const errs = "formErrors" in result.error
        ? result.error.formErrors
        : [String(result.error)];
      setServerError(errs.join(", ") || "Save failed. Please try again.");
      setSaving(false);
      return;
    }
    setSaved(true);
    setSaving(false);
    onComplete?.();
  };

  if (saved) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold text-gray-900">Tax profile saved!</h2>
        <p className="text-gray-600">Your facts have been saved securely.</p>
        <a
          href="/onboard/mode"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          Continue to setup
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i + 1 <= step ? "bg-blue-600" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Step 1 — Identity */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">About you</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First name
            </label>
            <input
              {...register("given_name")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Alex"
            />
            {errors.given_name && (
              <p className="text-red-600 text-sm mt-1">{errors.given_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State / Territory
            </label>
            <select
              {...register("state")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax residency status
            </label>
            <select
              {...register("residency_status")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="resident">Australian resident</option>
              <option value="non_resident">Non-resident</option>
              <option value="temporary_resident">Temporary resident</option>
              <option value="working_holiday_maker">Working holiday maker</option>
            </select>
          </div>
        </div>
      )}

      {/* Step 2 — Business */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Business details</h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("has_abn")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">I have an ABN</span>
          </label>

          {hasAbn && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ABN (11 digits)
              </label>
              <input
                {...register("abn")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="51 824 753 556"
              />
              {errors.abn && (
                <p className="text-red-600 text-sm mt-1">{errors.abn.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business structure
            </label>
            <select
              {...register("business_structure")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="none">Not applicable</option>
              <option value="sole_trader">Sole trader</option>
              <option value="partnership">Partnership</option>
              <option value="company">Company</option>
              <option value="trust">Trust</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business name (optional)
            </label>
            <input
              {...register("business_name")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Acme Pty Ltd"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry (ANZSIC code, optional)
            </label>
            <input
              {...register("industry_code")}
              list="anzsic-codes"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Type to search (e.g. 7000)"
            />
            <datalist id="anzsic-codes">
              {ANZSIC_CODES.map(({ code, title }) => (
                <option key={code} value={code}>{code} — {title}</option>
              ))}
            </datalist>
            {errors.industry_code && (
              <p className="text-red-600 text-sm mt-1">{errors.industry_code.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Occupation (optional)
            </label>
            <input
              {...register("occupation")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Software engineer"
            />
          </div>
        </div>
      )}

      {/* Step 3 — Tax registrations */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Tax registrations</h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("gst_registered")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">Registered for GST</span>
          </label>

          {gstRegistered && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GST reporting period
              </label>
              <select
                {...register("gst_period")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
              {errors.gst_period && (
                <p className="text-red-600 text-sm mt-1">{errors.gst_period.message}</p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("payg_instalments")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              Pay PAYG instalments
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("fbt_payer")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              Registered for FBT (Fringe Benefits Tax)
            </span>
          </label>
        </div>
      )}

      {/* Step 4 — Personal */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Personal circumstances</h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("has_spouse")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              I have a spouse or de facto partner
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of dependants
            </label>
            <input
              type="number"
              {...register("dependants", { valueAsNumber: true })}
              min={0}
              max={20}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.dependants && (
              <p className="text-red-600 text-sm mt-1">{errors.dependants.message}</p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("hecs_help_debt")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              I have a HECS/HELP debt
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("private_health_insurance")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              I have private health insurance
            </span>
          </label>
        </div>
      )}

      {/* Step 5 — Investments */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Investments</h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("has_investment_property")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              I own an investment property
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("has_shares_or_managed_funds")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              I hold shares or managed funds
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("has_crypto")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              I hold cryptocurrency
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Superannuation fund type
            </label>
            <select
              {...register("super_fund_type")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="unsure">Not sure</option>
              <option value="industry">Industry fund</option>
              <option value="retail">Retail fund</option>
              <option value="smsf">SMSF (Self-managed)</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
      )}

      {/* Step 6 — Year context */}
      {step === 6 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Financial year</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current financial year
            </label>
            <input
              {...register("current_fy")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="2024-25"
            />
            <p className="text-xs text-gray-400 mt-1">Format: YYYY-YY (e.g. 2024-25)</p>
            {errors.current_fy && (
              <p className="text-red-600 text-sm mt-1">{errors.current_fy.message}</p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("prior_fy_lodged")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              I have lodged my prior year tax return
            </span>
          </label>
        </div>
      )}

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {serverError}
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 1}
          className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>

        <span className="text-sm text-gray-400">
          Step {step} of {STEP_COUNT}
        </span>

        {step < STEP_COUNT ? (
          <button
            type="button"
            onClick={goNext}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save & continue"}
          </button>
        )}
      </div>
    </form>
  );
}
