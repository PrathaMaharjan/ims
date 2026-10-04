"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Package, X, Plus, Check, ListFilter, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";

export interface CreatedProductItem {
  id: string;
  name: string;
  aliasName?: string | null;
  manufacturer?: string | null;
  hsnCode?: string | null;
  unit: string;
  alternativeUnit?: string | null;
  stockQuantity: number;
}

interface Category {
  id: string;
  name: string;
}

type Num = number | "";

interface ItemForm {
  name: string;
  brand: string;
  category: string;
  alias: string;
  hsnCode: string;
  unit: string;
  altUnit: string;
  minStockLevel: Num;
  description: string;
}

const DEFAULT_UNITS = [
  "Strips",
  "Tablets",
  "Capsules",
  "Bottles",
  "Boxes",
  "Vials",
  "Ampoules",
  "Tubes",
  "Pieces",
  "Sachets",
  "Injections",
];

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]";
const labelCls =
  "mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

function Field({
  label,
  hint,
  span,
  children,
}: {
  label: string;
  hint?: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      type="text"
      required={required}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

function NumInput({
  value,
  onChange,
  step = "1",
  placeholder,
}: {
  value: Num;
  onChange: (v: Num) => void;
  step?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      min={0}
      value={value}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(e.target.value === "" ? "" : Number(e.target.value))
      }
      className={inputCls}
    />
  );
}

function CreatableSelect({
  value,
  options,
  onChange,
  onCreate,
  onDelete,
  noun,
  noneLabel,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onCreate: (raw: string) => string | null | Promise<string | null>;
  onDelete?: (option: string) => void | Promise<void>;
  noun: string;
  noneLabel?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState("");
  const [manageSearch, setManageSearch] = useState("");
  const manageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        manageRef.current &&
        !manageRef.current.contains(event.target as Node)
      ) {
        setManaging(false);
      }
    }
    if (managing) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [managing]);

  function cancel() {
    setDraft("");
    setAdding(false);
  }

  async function commit() {
    const created = await onCreate(draft);
    if (created) onChange(created);
    cancel();
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          value={draft}
          placeholder={`New ${noun}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className={inputCls}
        />
        <button
          type="button"
          onClick={commit}
          title={`Add ${noun}`}
          className="shrink-0 rounded-lg bg-[#044d73] px-3.5 text-white hover:bg-[#033f60] transition-colors"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          title="Cancel"
          className="shrink-0 rounded-lg border border-slate-200 px-3.5 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const filteredManageOptions = options.filter((o) =>
    o.toLowerCase().includes(manageSearch.toLowerCase())
  );

  return (
    <div className="relative flex gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        {noneLabel !== undefined && <option value="">{noneLabel}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => {
          setAdding(true);
          setManaging(false);
        }}
        title={`Add new ${noun}`}
        className="shrink-0 rounded-lg border border-slate-200 px-3 text-[#044d73] hover:bg-[#044d73]/10 transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>

      {onDelete && options.length > 0 && (
        <button
          type="button"
          onClick={() => setManaging((p) => !p)}
          title={`Manage / Delete ${noun}s`}
          className={`shrink-0 rounded-lg border px-2.5 transition-colors ${
            managing
              ? "border-[#044d73] bg-[#044d73] text-white"
              : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <ListFilter className="h-4 w-4" />
        </button>
      )}

      {managing && onDelete && (
        <div
          ref={manageRef}
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#044d73]">
              Manage {noun}s ({options.length})
            </span>
            <button
              type="button"
              onClick={() => setManaging(false)}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {options.length > 5 && (
            <div className="mb-2">
              <input
                type="text"
                value={manageSearch}
                onChange={(e) => setManageSearch(e.target.value)}
                placeholder={`Filter ${noun}s...`}
                className="h-7 w-full rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#044d73]"
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredManageOptions.length === 0 ? (
              <p className="p-2 text-center text-xs text-slate-400">
                No {noun}s found
              </p>
            ) : (
              filteredManageOptions.map((opt) => (
                <div
                  key={opt}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-slate-50 transition-colors"
                >
                  <span
                    className={`truncate font-medium ${
                      value === opt ? "text-[#044d73] font-semibold" : "text-slate-700"
                    }`}
                  >
                    {opt}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(opt)}
                    title={`Delete "${opt}"`}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  onSuccess: (product: CreatedProductItem) => void;
  existingBrands?: string[];
}

export function AddItemModal({
  isOpen,
  onClose,
  initialName = "",
  onSuccess,
  existingBrands = [],
}: AddItemModalProps) {
  const [form, setForm] = useState<ItemForm>({
    name: initialName,
    brand: "",
    category: "",
    alias: "",
    hsnCode: "",
    unit: "Strips",
    altUnit: "",
    minStockLevel: 10,
    description: "",
  });

  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS);
  const [brands, setBrands] = useState<string[]>(existingBrands);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync initialName and reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({
        name: initialName,
        brand: "",
        category: "",
        alias: "",
        hsnCode: "",
        unit: "Strips",
        altUnit: "",
        minStockLevel: 10,
        description: "",
      });
      setSaveError(null);
    }
  }, [isOpen, initialName]);

  // Sync brands if updated from outside
  useEffect(() => {
    if (existingBrands.length > 0) {
      setBrands((prev) => Array.from(new Set([...prev, ...existingBrands])).sort());
    }
  }, [existingBrands]);

  // Load categories from backend
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    api
      .get("/api/product/categories")
      .then((res) => {
        if (isMounted) {
          const cats = res.data?.categories || [];
          setCategories(cats);
        }
      })
      .catch(() => {
        // Non-blocking
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function setField<K extends keyof ItemForm>(key: K, value: ItemForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function addUnit(raw: string): string | null {
    const name = raw.trim();
    if (!name) return null;
    const existing = units.find((u) => u.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    setUnits((prev) => [...prev, name]);
    return name;
  }

  function deleteUnit(unitToDelete: string) {
    setUnits((prev) => prev.filter((u) => u !== unitToDelete));
    if (form.unit === unitToDelete) setForm((p) => ({ ...p, unit: "" }));
    if (form.altUnit === unitToDelete) setForm((p) => ({ ...p, altUnit: "" }));
  }

  function addBrand(raw: string): string | null {
    const name = raw.trim();
    if (!name) return null;
    const existing = brands.find((b) => b.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    setBrands((prev) => [...prev, name]);
    return name;
  }

  function deleteBrand(brandToDelete: string) {
    setBrands((prev) => prev.filter((b) => b !== brandToDelete));
    if (form.brand === brandToDelete) setForm((p) => ({ ...p, brand: "" }));
  }

  async function addCategory(raw: string): Promise<string | null> {
    const name = raw.trim();
    if (!name) return null;
    const existing = categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing.name;
    try {
      const res = await api.post("/api/product/categories", { name });
      const created: Category = res.data.category;
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      return created.name;
    } catch {
      return null;
    }
  }

  async function deleteCategory(categoryToDelete: string) {
    const category = categories.find((c) => c.name === categoryToDelete);
    if (!category) return;
    try {
      await api.delete(`/api/product/categories/${category.id}`);
    } catch {
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    if (form.category === categoryToDelete)
      setForm((p) => ({ ...p, category: "" }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const altUnit = form.altUnit === form.unit ? "" : form.altUnit;
    let matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === form.category.trim().toLowerCase()
    );

    setSaving(true);
    setSaveError(null);

    try {
      // If user typed a category name that isn't saved yet, create it
      if (!matchedCategory && form.category.trim()) {
        try {
          const catRes = await api.post("/api/product/categories", {
            name: form.category.trim(),
          });
          matchedCategory = catRes.data?.category;
          if (matchedCategory) {
            setCategories((prev) => [...prev, matchedCategory!]);
          }
        } catch {
          // ignore
        }
      }

      const payload = {
        name: form.name.trim(),
        aliasName: form.alias.trim() || undefined,
        manufacturer: form.brand.trim() || undefined,
        categoryId: matchedCategory?.id,
        hsnCode: form.hsnCode.trim() || undefined,
        unit: form.unit || undefined,
        alternativeUnit: altUnit || undefined,
        lowStockThreshold:
          typeof form.minStockLevel === "number" ? form.minStockLevel : undefined,
        description: form.description.trim() || undefined,
      };

      const res = await api.post("/api/product", payload);
      const created = res.data?.product;

      if (!created || !created.id) {
        throw new Error("No product returned from server.");
      }

      const formattedProduct: CreatedProductItem = {
        id: created.id,
        name: created.name,
        aliasName: created.aliasName ?? null,
        manufacturer: created.manufacturer ?? null,
        hsnCode: created.hsnCode ?? null,
        unit: created.unit ?? form.unit ?? "Pcs",
        alternativeUnit: created.alternativeUnit ?? null,
        stockQuantity: created.stockQuantity ?? 0,
      };

      onSuccess(formattedProduct);
      onClose();
    } catch (err: any) {
      setSaveError(
        err?.response?.data?.details?.fieldErrors?.name?.[0] ||
          err?.response?.data?.error ||
          "Failed to save item. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Modal Header — identical to inventory */}
        <div className="relative flex shrink-0 flex-col items-center gap-1 p-8 bg-[#044d73] text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 mb-2">
            <Package className="h-7 w-7" />
          </div>
          <h3 className="text-2xl font-semibold">Add New Item</h3>
          <p className="text-sm text-white/70">
            Fill in the details to add an item to inventory.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-6 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form — identical layout and fields to inventory */}
        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto p-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Item Name" span>
                <TextInput
                  required
                  value={form.name}
                  onChange={(v) => setField("name", v)}
                  placeholder="e.g. Cefixime 200 MG"
                />
              </Field>

              <Field label="Brand / Manufacturer">
                <CreatableSelect
                  value={form.brand}
                  options={brands}
                  noun="brand"
                  noneLabel="Select / None"
                  onChange={(v) => setField("brand", v)}
                  onCreate={addBrand}
                  onDelete={deleteBrand}
                />
              </Field>

              <Field label="Category">
                <CreatableSelect
                  value={form.category}
                  options={categories.map((c) => c.name)}
                  noun="category"
                  noneLabel="Select / None"
                  onChange={(v) => setField("category", v)}
                  onCreate={addCategory}
                  onDelete={deleteCategory}
                />
              </Field>

              <Field label="Alias Name">
                <TextInput
                  value={form.alias}
                  onChange={(v) => setField("alias", v)}
                  placeholder="Short name"
                />
              </Field>

              <Field label="HSN Code">
                <TextInput
                  value={form.hsnCode}
                  onChange={(v) => setField("hsnCode", v)}
                  placeholder="e.g. 3004"
                />
              </Field>

              <Field label="Unit">
                <CreatableSelect
                  value={form.unit}
                  options={units}
                  noun="unit"
                  onChange={(v) => setField("unit", v)}
                  onCreate={addUnit}
                  onDelete={deleteUnit}
                />
              </Field>

              <Field label="Alternative Unit">
                <CreatableSelect
                  value={form.altUnit}
                  options={units.filter((u) => u !== form.unit)}
                  noun="unit"
                  noneLabel="None"
                  onChange={(v) => setField("altUnit", v)}
                  onCreate={addUnit}
                  onDelete={deleteUnit}
                />
              </Field>

              <Field
                label="Low Stock Threshold"
                hint="Item is flagged “Low Stock” at or below this quantity"
                span
              >
                <NumInput
                  value={form.minStockLevel}
                  onChange={(v) => setField("minStockLevel", v)}
                />
              </Field>

              <Field label="Item Description" span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  className={inputCls}
                  placeholder="Brief clinical description or dosage information"
                />
              </Field>
            </div>
          </div>

          {saveError && (
            <div className="mx-8 mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-600 font-medium">
              {saveError}
            </div>
          )}

          {/* Modal Footer — identical to inventory */}
          <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-5 px-8">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[#044d73] hover:bg-[#033f60] py-3 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
