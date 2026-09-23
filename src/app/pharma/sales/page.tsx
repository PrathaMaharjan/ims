// "use client";

// import { useState, useMemo, useRef, useEffect } from "react";
// import {
//   Plus, X, Pencil, Trash2, Search, ChevronDown,
//   ShoppingCart, Wallet, CreditCard, Banknote, PackageCheck, Percent, Boxes, Check,
//   AlertCircle, User, UserPlus, Clock, Sparkles, AlertTriangle,
// } from "lucide-react";

// /* ------------------------------------------------------------------ */
// /* Types                                                               */
// /* ------------------------------------------------------------------ */

// type Num = number | "";
// type PaymentType = "Cash" | "Credit";
// type SaleType = "VAT/Exempt" | "VAT/Item-wise" | "VAT/TaxIncl.";
// type DiscountType = "Percentage" | "Flat";

// export interface BatchItem {
//   id: string;
//   batchNo: string;
//   stock: number;
//   expDate: string; // YYYY-MM
//   mfgDate?: string;
//   mrp: number;
//   salePrice: number;
// }

// export interface CatalogItem {
//   id: string;
//   name: string;
//   unit: string;
//   altUnit: string;
//   batches: BatchItem[];
// }

// export interface Customer {
//   id: string;
//   name: string;
//   phone?: string;
//   address?: string;
// }

// export interface LineItemForm {
//   id: string;
//   itemId: string;
//   itemName: string;
//   unit: string;
//   altUnit: string;
//   batchId: string;
//   batchNo: string;
//   batchExpDate: string;
//   batchStock: number;
//   qty: Num;
//   price: Num;
//   isFefoRecommended?: boolean;
// }

// export interface DiscountRowForm {
//   id: string;
//   amount: Num;
//   type: DiscountType;
// }

// export interface SaleForm {
//   date: string;
//   vchNo: string;
//   paymentType: PaymentType;
//   saleType: SaleType;
//   customerId: string; // empty if cash walk-in
//   customerName: string; // customer display name
//   items: LineItemForm[];
//   discounts: DiscountRowForm[];
//   notes: string;
// }

// export interface SaleVoucher {
//   id: string;
//   date: string;
//   vchNo: string;
//   paymentType: PaymentType;
//   saleType: SaleType;
//   customerId?: string;
//   customerName: string;
//   items: LineItemForm[];
//   discounts: DiscountRowForm[];
//   notes?: string;
// }

// /* ------------------------------------------------------------------ */
// /* Seed Data: Catalog & Batches                                        */
// /* ------------------------------------------------------------------ */

// const SEED_CATALOG: CatalogItem[] = [
//   {
//     id: "1",
//     name: "Cefixime 200 MG",
//     unit: "Tab",
//     altUnit: "Strip",
//     batches: [
//       { id: "b1", batchNo: "AB2511015", stock: 300, expDate: "2027-10", mfgDate: "2026-07", mrp: 12, salePrice: 10 },
//       { id: "b2", batchNo: "AB2511020", stock: 200, expDate: "2027-12", mfgDate: "2026-08", mrp: 12.5, salePrice: 10.5 },
//     ],
//   },
//   {
//     id: "2",
//     name: "Absorbant Cotton Wool",
//     unit: "Pcs",
//     altUnit: "",
//     batches: [
//       { id: "b3", batchNo: "CW-901", stock: 45, expDate: "2028-05", mfgDate: "2026-01", mrp: 8, salePrice: 7 },
//     ],
//   },
//   {
//     id: "3",
//     name: "Pregabalin 75 MG",
//     unit: "Tab",
//     altUnit: "Strip",
//     batches: [
//       // Oldest expiry: 2027-08 -> Auto-suggested first (FEFO)
//       { id: "b4", batchNo: "PG75-01", stock: 2000, expDate: "2027-08", mfgDate: "2026-03", mrp: 3, salePrice: 2.5 },
//       { id: "b5", batchNo: "PG75-02", stock: 1200, expDate: "2028-02", mfgDate: "2026-06", mrp: 3, salePrice: 2.5 },
//     ],
//   },
//   {
//     id: "4",
//     name: "Paracetamol 500 MG",
//     unit: "Tab",
//     altUnit: "Strip",
//     batches: [
//       { id: "b6", batchNo: "PCM-25A", stock: 850, expDate: "2027-04", mfgDate: "2025-10", mrp: 2, salePrice: 1.8 },
//       { id: "b7", batchNo: "PCM-25B", stock: 1500, expDate: "2027-11", mfgDate: "2026-02", mrp: 2, salePrice: 1.8 },
//     ],
//   },
//   {
//     id: "5",
//     name: "Azithromycin 500 MG",
//     unit: "Tab",
//     altUnit: "Box",
//     batches: [
//       { id: "b8", batchNo: "AZ-902", stock: 120, expDate: "2027-09", mfgDate: "2026-04", mrp: 25, salePrice: 22 },
//       { id: "b9", batchNo: "AZ-903", stock: 350, expDate: "2028-01", mfgDate: "2026-06", mrp: 25, salePrice: 22 },
//     ],
//   },
// ];

// const SEED_CUSTOMERS: Customer[] = [
//   { id: "c1", name: "Ram Bahadur Shrestha", phone: "9841234567", address: "Kathmandu" },
//   { id: "c2", name: "Sita Kumari Dahal", phone: "9812345678", address: "Lalitpur" },
//   { id: "c3", name: "Dr. Koirala Health Clinic", phone: "01-4422113", address: "Bhaktapur" },
//   { id: "c4", name: "Apex Care Center", phone: "9801122334", address: "Pokhara" },
// ];

// const SEED_SALES: SaleVoucher[] = [
//   {
//     id: "s1",
//     date: "2026-09-20",
//     vchNo: "SAL-0001",
//     paymentType: "Cash",
//     saleType: "VAT/Exempt",
//     customerName: "",
//     items: [
//       {
//         id: "l1",
//         itemId: "1",
//         itemName: "Cefixime 200 MG",
//         unit: "Tab",
//         altUnit: "Strip",
//         batchId: "b1",
//         batchNo: "AB2511015",
//         batchExpDate: "2027-10",
//         batchStock: 300,
//         qty: 30,
//         price: 10,
//         isFefoRecommended: true,
//       },
//     ],
//     discounts: [],
//     notes: "Walk-in cash counter sale",
//   },
//   {
//     id: "s2",
//     date: "2026-09-21",
//     vchNo: "SAL-0002",
//     paymentType: "Credit",
//     saleType: "VAT/Item-wise",
//     customerId: "c1",
//     customerName: "Ram Bahadur Shrestha",
//     items: [
//       {
//         id: "l2",
//         itemId: "3",
//         itemName: "Pregabalin 75 MG",
//         unit: "Tab",
//         altUnit: "Strip",
//         batchId: "b4",
//         batchNo: "PG75-01",
//         batchExpDate: "2027-08",
//         batchStock: 2000,
//         qty: 150,
//         price: 2.5,
//         isFefoRecommended: true,
//       },
//       {
//         id: "l3",
//         itemId: "2",
//         itemName: "Absorbant Cotton Wool",
//         unit: "Pcs",
//         altUnit: "",
//         batchId: "b3",
//         batchNo: "CW-901",
//         batchExpDate: "2028-05",
//         batchStock: 45,
//         qty: 5,
//         price: 7,
//         isFefoRecommended: true,
//       },
//     ],
//     discounts: [{ id: "d1", amount: 5, type: "Percentage" }],
//     notes: "Credit prescription billing",
//   },
// ];

// /* ------------------------------------------------------------------ */
// /* Helpers                                                             */
// /* ------------------------------------------------------------------ */

// const n = (v: Num) => (v === "" ? 0 : v);
// const rs = (v: number) => `Rs. ${v.toFixed(2)}`;

// function lineAmount(li: LineItemForm) {
//   return n(li.qty) * n(li.price);
// }

// function subtotalOf(items: LineItemForm[]) {
//   return items.reduce((s, li) => s + lineAmount(li), 0);
// }

// function discountValue(d: DiscountRowForm, subtotal: number) {
//   return d.type === "Percentage" ? (subtotal * n(d.amount)) / 100 : n(d.amount);
// }

// function totalDiscountOf(discounts: DiscountRowForm[], subtotal: number) {
//   return discounts.reduce((s, d) => s + discountValue(d, subtotal), 0);
// }

// function grandTotalOf(p: { items: LineItemForm[]; discounts: DiscountRowForm[] }) {
//   const sub = subtotalOf(p.items);
//   return Math.max(0, sub - totalDiscountOf(p.discounts, sub));
// }

// function nextVchNo(sales: SaleVoucher[]) {
//   const nums = sales.map(s => Number(s.vchNo.replace(/\D/g, "")) || 0);
//   const next = (nums.length ? Math.max(...nums) : 0) + 1;
//   return `SAL-${String(next).padStart(4, "0")}`;
// }

// function todayISO() {
//   return new Date().toISOString().slice(0, 10);
// }

// function emptyLine(): LineItemForm {
//   return {
//     id: crypto.randomUUID(),
//     itemId: "",
//     itemName: "",
//     unit: "",
//     altUnit: "",
//     batchId: "",
//     batchNo: "",
//     batchExpDate: "",
//     batchStock: 0,
//     qty: "",
//     price: "",
//     isFefoRecommended: false,
//   };
// }

// function emptyDiscount(): DiscountRowForm {
//   return { id: crypto.randomUUID(), amount: "", type: "Percentage" };
// }

// function emptyForm(nextNo: string): SaleForm {
//   return {
//     date: todayISO(),
//     vchNo: nextNo,
//     paymentType: "Cash",
//     saleType: "VAT/Exempt",
//     customerId: "",
//     customerName: "",
//     items: [emptyLine()],
//     discounts: [],
//     notes: "",
//   };
// }

// /**
//  * Sort batches by earliest expiry date first (FEFO).
//  * Filters out batches with 0 stock unless it is the currently selected batch.
//  */
// function getFefoBatches(item: CatalogItem, currentBatchId?: string): BatchItem[] {
//   return [...item.batches]
//     .filter(b => b.stock > 0 || b.id === currentBatchId)
//     .sort((a, b) => a.expDate.localeCompare(b.expDate));
// }

// /* ------------------------------------------------------------------ */
// /* Form UI Components                                                  */
// /* ------------------------------------------------------------------ */

// const inputCls =
//   "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]";
// const labelCls = "mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

// function Section({
//   title,
//   icon,
//   children,
//   action,
// }: {
//   title: string;
//   icon: React.ReactNode;
//   children: React.ReactNode;
//   action?: React.ReactNode;
// }) {
//   return (
//     <section>
//       <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-1.5">
//         <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#044d73]">
//           {icon} {title}
//         </h4>
//         {action}
//       </div>
//       {children}
//     </section>
//   );
// }

// function Field({
//   label,
//   hint,
//   span,
//   children,
// }: {
//   label: string;
//   hint?: string;
//   span?: boolean;
//   children: React.ReactNode;
// }) {
//   return (
//     <div className={span ? "sm:col-span-2" : ""}>
//       <label className={labelCls}>{label}</label>
//       {children}
//       {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
//     </div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /* Customer Selector with Instant "Auto Add" Feature                   */
// /* ------------------------------------------------------------------ */

// function CustomerCombobox({
//   customers,
//   selectedId,
//   selectedName,
//   paymentType,
//   onSelectCustomer,
//   onAutoAddCustomer,
// }: {
//   customers: Customer[];
//   selectedId: string;
//   selectedName: string;
//   paymentType: PaymentType;
//   onSelectCustomer: (customer: Customer | null) => void;
//   onAutoAddCustomer: (name: string) => Customer;
// }) {
//   const [open, setOpen] = useState(false);
//   const [query, setQuery] = useState("");
//   const containerRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     function handleClickOutside(event: MouseEvent) {
//       if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
//         setOpen(false);
//       }
//     }
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   const filtered = useMemo(() => {
//     if (!query.trim()) return customers;
//     const q = query.toLowerCase();
//     return customers.filter(
//       c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
//     );
//   }, [customers, query]);

//   const exactMatch = customers.some(
//     c => c.name.toLowerCase() === query.trim().toLowerCase()
//   );

//   function handleAutoAdd(nameToCreate: string) {
//     const trimmed = nameToCreate.trim();
//     if (!trimmed) return;
//     const newCustomer = onAutoAddCustomer(trimmed);
//     onSelectCustomer(newCustomer);
//     setQuery("");
//     setOpen(false);
//   }

//   return (
//     <div ref={containerRef} className="relative w-full">
//       <div className="relative">
//         <input
//           type="text"
//           value={open ? query : selectedName}
//           onChange={e => {
//             setQuery(e.target.value);
//             if (!open) setOpen(true);
//           }}
//           onFocus={() => {
//             setQuery(selectedName);
//             setOpen(true);
//           }}
//           placeholder={
//             paymentType === "Credit"
//               ? "Search or type customer name (Required for credit) *"
//               : "Leave blank for Cash Sale, or type/select customer name"
//           }
//           className={`w-full rounded-lg border py-2 pl-9 pr-8 text-sm transition-all placeholder:text-slate-400 focus:outline-none ${
//             paymentType === "Credit" && !selectedName
//               ? "border-amber-300 bg-amber-50/20 text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
//               : "border-slate-200 bg-white text-slate-700 focus:border-[#044d73] focus:ring-1 focus:ring-[#044d73]"
//           }`}
//         />
//         <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
//         {selectedName ? (
//           <button
//             type="button"
//             onClick={() => {
//               onSelectCustomer(null);
//               setQuery("");
//             }}
//             className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
//           >
//             <X className="h-3.5 w-3.5" />
//           </button>
//         ) : (
//           <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
//         )}
//       </div>

//       {open && (
//         <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-100">
//           {paymentType === "Cash" && (
//             <div
//               onClick={() => {
//                 onSelectCustomer(null);
//                 setOpen(false);
//                 setQuery("");
//               }}
//               className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer"
//             >
//               <span className="font-semibold text-slate-700">Walk-in / Cash Customer</span>
//               <span className="text-[10px] text-slate-400 italic">No account needed</span>
//             </div>
//           )}

//           {query.trim().length > 0 && !exactMatch && (
//             <div
//               onClick={() => handleAutoAdd(query)}
//               className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer transition-colors"
//             >
//               <UserPlus className="h-4 w-4 text-emerald-600" />
//               <span>
//                 Add <strong>&ldquo;{query.trim()}&rdquo;</strong> as new customer
//               </span>
//             </div>
//           )}

//           {filtered.length === 0 && !query.trim() ? (
//             <p className="p-3 text-center text-xs text-slate-400">No customers registered yet.</p>
//           ) : (
//             <div className="py-1">
//               {filtered.map(c => (
//                 <div
//                   key={c.id}
//                   onClick={() => {
//                     onSelectCustomer(c);
//                     setOpen(false);
//                     setQuery("");
//                   }}
//                   className={`flex items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer transition-colors ${
//                     selectedId === c.id ? "bg-[#044d73]/5 font-semibold text-[#044d73]" : "text-slate-700"
//                   }`}
//                 >
//                   <div>
//                     <p className="font-medium text-slate-800">{c.name}</p>
//                     <p className="text-[10px] text-slate-400">
//                       {c.phone ? `Ph: ${c.phone}` : "No phone"} {c.address ? `· ${c.address}` : ""}
//                     </p>
//                   </div>
//                   {selectedId === c.id && <Check className="h-4 w-4 text-[#044d73]" />}
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /* Item Picker Dropdown                                               */
// /* ------------------------------------------------------------------ */

// function ItemPicker({
//   catalog,
//   value,
//   onSelect,
// }: {
//   catalog: CatalogItem[];
//   value: string;
//   onSelect: (item: CatalogItem) => void;
// }) {
//   const [open, setOpen] = useState(false);
//   const [query, setQuery] = useState("");
//   const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
//   const buttonRef = useRef<HTMLButtonElement>(null);

//   const selected = catalog.find(c => c.id === value) ?? null;
//   const filtered = catalog.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

//   function toggleOpen() {
//     if (!open && buttonRef.current) {
//       const rect = buttonRef.current.getBoundingClientRect();
//       setCoords({
//         top: rect.bottom + 4,
//         left: rect.left,
//         width: Math.max(rect.width, 320),
//       });
//       setOpen(true);
//     } else {
//       setOpen(false);
//     }
//   }

//   useEffect(() => {
//     if (!open) return;
//     const handleReposition = () => {
//       if (buttonRef.current) {
//         const rect = buttonRef.current.getBoundingClientRect();
//         if (rect.bottom < 0 || rect.top > window.innerHeight) {
//           setOpen(false);
//         } else {
//           setCoords({
//             top: rect.bottom + 4,
//             left: rect.left,
//             width: Math.max(rect.width, 320),
//           });
//         }
//       }
//     };
//     window.addEventListener("scroll", handleReposition, true);
//     window.addEventListener("resize", handleReposition);
//     return () => {
//       window.removeEventListener("scroll", handleReposition, true);
//       window.removeEventListener("resize", handleReposition);
//     };
//   }, [open]);

//   return (
//     <div className="relative">
//       <button
//         ref={buttonRef}
//         type="button"
//         onClick={toggleOpen}
//         className={`flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs sm:text-sm transition-all ${
//           open
//             ? "border-[#044d73] ring-2 ring-[#044d73]/20 bg-white"
//             : "border-slate-200 bg-white hover:border-slate-300"
//         }`}
//       >
//         <span className={`truncate ${selected ? "font-semibold text-slate-800" : "text-slate-400"}`}>
//           {selected ? selected.name : "Select item to sell..."}
//         </span>
//         <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
//       </button>

//       {open && coords && (
//         <>
//           <div className="fixed inset-0 z-[100]" onClick={() => { setOpen(false); setQuery(""); }} />
//           <div
//             style={{ top: `${coords.top}px`, left: `${coords.left}px`, width: `${coords.width}px` }}
//             className="fixed z-[101] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100"
//           >
//             <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white p-2.5">
//               <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
//               <input
//                 autoFocus
//                 value={query}
//                 onChange={e => setQuery(e.target.value)}
//                 placeholder="Search medicine item…"
//                 className="w-full text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
//               />
//             </div>
//             {filtered.length === 0 ? (
//               <p className="p-4 text-center text-xs text-slate-400">No matching items found.</p>
//             ) : (
//               <div className="py-1">
//                 {filtered.map(c => {
//                   const totalStock = c.batches.reduce((acc, b) => acc + b.stock, 0);
//                   const fefoBatches = getFefoBatches(c);
//                   const oldestExp = fefoBatches[0]?.expDate;

//                   return (
//                     <button
//                       key={c.id}
//                       type="button"
//                       onClick={() => {
//                         onSelect(c);
//                         setOpen(false);
//                         setQuery("");
//                       }}
//                       className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${
//                         selected?.id === c.id ? "bg-[#044d73]/5 font-semibold text-[#044d73]" : "text-slate-700"
//                       }`}
//                     >
//                       <div className="min-w-0">
//                         <p className="truncate text-xs font-semibold">{c.name}</p>
//                         <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
//                           <span>Stock: {totalStock} {c.unit}</span>
//                           {c.batches.length > 0 && (
//                             <span className="text-[#044d73] font-medium">
//                               · {c.batches.length} batch{c.batches.length > 1 ? "es" : ""}
//                             </span>
//                           )}
//                           {oldestExp && (
//                             <span className="text-amber-600 font-medium">
//                               · Earliest Exp: {oldestExp}
//                             </span>
//                           )}
//                         </p>
//                       </div>
//                       <span className="shrink-0 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
//                         {c.batches[0] ? rs(c.batches[0].salePrice) : "—"}
//                       </span>
//                     </button>
//                   );
//                 })}
//               </div>
//             )}
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /* Batch Selector with FEFO (First Expired First Out) Highlight        */
// /* ------------------------------------------------------------------ */

// function BatchPicker({
//   item,
//   selectedBatchId,
//   onSelectBatch,
// }: {
//   item: CatalogItem;
//   selectedBatchId: string;
//   onSelectBatch: (batch: BatchItem, isOldest: boolean) => void;
// }) {
//   const fefoBatches = useMemo(() => getFefoBatches(item, selectedBatchId), [item, selectedBatchId]);
//   const oldestBatch = fefoBatches[0];
//   const selected = fefoBatches.find(b => b.id === selectedBatchId) || oldestBatch;

//   return (
//     <div className="relative">
//       <select
//         value={selectedBatchId}
//         onChange={e => {
//           const b = fefoBatches.find(x => x.id === e.target.value);
//           if (b) {
//             onSelectBatch(b, b.id === oldestBatch?.id);
//           }
//         }}
//         className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 text-xs font-medium text-slate-700 focus:border-[#044d73] focus:outline-none"
//       >
//         {fefoBatches.map((b, idx) => {
//           const isOldest = idx === 0;
//           return (
//             <option key={b.id} value={b.id}>
//               {isOldest ? `⭐ [FEFO] ${b.batchNo}` : b.batchNo} · Exp: {b.expDate} (Avail: {b.stock} {item.unit}) - {rs(b.salePrice)}
//             </option>
//           );
//         })}
//       </select>

//       {selected && (
//         <div className="mt-1 flex items-center justify-between text-[10px]">
//           {selected.id === oldestBatch?.id ? (
//             <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
//               <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Oldest Expiry (FEFO) Auto-Selected
//             </span>
//           ) : (
//             <span className="inline-flex items-center gap-1 text-slate-500">
//               <Clock className="w-2.5 h-2.5" /> Exp: {selected.expDate}
//             </span>
//           )}
//           <span className="font-semibold text-slate-600">
//             Stock: {selected.stock} {item.unit}
//           </span>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /* Page Component                                                      */
// /* ------------------------------------------------------------------ */

// export default function SalesPage() {
//   const [sales, setSales] = useState<SaleVoucher[]>(SEED_SALES);
//   const [catalog, setCatalog] = useState<CatalogItem[]>(SEED_CATALOG);
//   const [customers, setCustomers] = useState<Customer[]>(SEED_CUSTOMERS);

//   const [search, setSearch] = useState("");
//   const [paymentFilter, setPaymentFilter] = useState<"ALL" | PaymentType>("ALL");
//   const [currentPage, setCurrentPage] = useState(1);
//   const ITEMS_PER_PAGE = 8;

//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [editingSale, setEditingSale] = useState<SaleVoucher | null>(null);
//   const [viewingSale, setViewingSale] = useState<SaleVoucher | null>(null);
//   const [form, setForm] = useState<SaleForm>(() => emptyForm(nextVchNo(SEED_SALES)));

//   const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

//   /* ---- stats ---- */
//   const stats = useMemo(() => {
//     const totalAmount = sales.reduce((s, v) => s + grandTotalOf(v), 0);
//     const cashSales = sales.filter(v => v.paymentType === "Cash");
//     const creditSales = sales.filter(v => v.paymentType === "Credit");
//     const creditAmount = creditSales.reduce((s, v) => s + grandTotalOf(v), 0);

//     return {
//       total: sales.length,
//       amount: totalAmount,
//       cashCount: cashSales.length,
//       creditCount: creditSales.length,
//       creditAmount,
//     };
//   }, [sales]);

//   /* ---- filter / paginate ---- */
//   const filtered = useMemo(() => {
//     return sales
//       .filter(s => {
//         const q = search.toLowerCase();
//         const matchSearch =
//           s.vchNo.toLowerCase().includes(q) ||
//           s.customerName.toLowerCase().includes(q) ||
//           (s.notes && s.notes.toLowerCase().includes(q)) ||
//           s.items.some(
//             li =>
//               li.itemName.toLowerCase().includes(q) ||
//               li.batchNo.toLowerCase().includes(q)
//           );
//         const matchType = paymentFilter === "ALL" || s.paymentType === paymentFilter;
//         return matchSearch && matchType;
//       })
//       .sort((a, b) => b.date.localeCompare(a.date));
//   }, [sales, search, paymentFilter]);

//   const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
//   const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

//   /* ---- Customer Auto-Add Handler ---- */
//   function handleAutoAddCustomer(name: string): Customer {
//     const newCust: Customer = {
//       id: crypto.randomUUID(),
//       name: name.trim(),
//     };
//     setCustomers(prev => [...prev, newCust]);
//     return newCust;
//   }

//   /* ---- Sale Modal Operations ---- */
//   function openAdd() {
//     setEditingSale(null);
//     setForm(emptyForm(nextVchNo(sales)));
//     setIsModalOpen(true);
//   }

//   function openEdit(sale: SaleVoucher) {
//     setEditingSale(sale);
//     setForm({
//       date: sale.date,
//       vchNo: sale.vchNo,
//       paymentType: sale.paymentType,
//       saleType: sale.saleType,
//       customerId: sale.customerId || "",
//       customerName: sale.customerName || "",
//       items: sale.items.map(li => ({ ...li })),
//       discounts: sale.discounts.map(d => ({ ...d })),
//       notes: sale.notes || "",
//     });
//     setIsModalOpen(true);
//   }

//   function closeModal() {
//     setIsModalOpen(false);
//     setEditingSale(null);
//   }

//   function updateLine(id: string, patch: Partial<LineItemForm>) {
//     setForm(p => ({
//       ...p,
//       items: p.items.map(li => (li.id === id ? { ...li, ...patch } : li)),
//     }));
//   }

//   function handleSelectItem(lineId: string, item: CatalogItem) {
//     const fefoBatches = getFefoBatches(item);
//     const oldestBatch = fefoBatches[0];

//     updateLine(lineId, {
//       itemId: item.id,
//       itemName: item.name,
//       unit: item.unit,
//       altUnit: item.altUnit,
//       batchId: oldestBatch ? oldestBatch.id : "",
//       batchNo: oldestBatch ? oldestBatch.batchNo : "",
//       batchExpDate: oldestBatch ? oldestBatch.expDate : "",
//       batchStock: oldestBatch ? oldestBatch.stock : 0,
//       price: oldestBatch ? oldestBatch.salePrice : 0,
//       qty: 1,
//       isFefoRecommended: true,
//     });
//   }

//   function handleSelectBatch(lineId: string, batch: BatchItem, isOldest: boolean) {
//     updateLine(lineId, {
//       batchId: batch.id,
//       batchNo: batch.batchNo,
//       batchExpDate: batch.expDate,
//       batchStock: batch.stock,
//       price: batch.salePrice,
//       isFefoRecommended: isOldest,
//     });
//   }

//   function addLine() {
//     setForm(p => ({ ...p, items: [...p.items, emptyLine()] }));
//   }

//   function removeLine(id: string) {
//     setForm(p => ({
//       ...p,
//       items: p.items.length > 1 ? p.items.filter(li => li.id !== id) : p.items,
//     }));
//   }

//   function addDiscount() {
//     setForm(p => ({ ...p, discounts: [...p.discounts, emptyDiscount()] }));
//   }

//   function removeDiscount(id: string) {
//     setForm(p => ({ ...p, discounts: p.discounts.filter(d => d.id !== id) }));
//   }

//   function updateDiscount(id: string, patch: Partial<DiscountRowForm>) {
//     setForm(p => ({
//       ...p,
//       discounts: p.discounts.map(d => (d.id === id ? { ...d, ...patch } : d)),
//     }));
//   }

//   /* Form Calculations & Validations */
//   const validItems = form.items.filter(li => li.itemId && n(li.qty) > 0);
//   const isCredit = form.paymentType === "Credit";
//   const missingCustomerForCredit = isCredit && !form.customerName.trim();
//   const hasExceededBatchStock = form.items.some(
//     li => li.itemId && n(li.qty) > 0 && li.batchStock > 0 && n(li.qty) > li.batchStock
//   );
//   const subtotal = subtotalOf(form.items);
//   const discountTotal = totalDiscountOf(form.discounts, subtotal);
//   const grandTotal = Math.max(0, subtotal - discountTotal);

//   function handleSave(e: React.FormEvent) {
//     e.preventDefault();
//     if (!form.vchNo.trim() || validItems.length === 0 || missingCustomerForCredit) {
//       return;
//     }

//     const clean: SaleVoucher = {
//       id: editingSale ? editingSale.id : crypto.randomUUID(),
//       date: form.date,
//       vchNo: form.vchNo.trim(),
//       paymentType: form.paymentType,
//       saleType: form.saleType,
//       customerId: form.customerId || undefined,
//       customerName: form.customerName.trim(),
//       items: validItems.map(li => ({ ...li })),
//       discounts: form.discounts.filter(d => n(d.amount) > 0),
//       notes: form.notes.trim(),
//     };

//     // Deduct stock from the catalog batch
//     if (!editingSale) {
//       setCatalog(prev =>
//         prev.map(catItem => {
//           const soldLines = clean.items.filter(li => li.itemId === catItem.id);
//           if (soldLines.length === 0) return catItem;

//           return {
//             ...catItem,
//             batches: catItem.batches.map(batch => {
//               const matchedLine = soldLines.find(li => li.batchId === batch.id);
//               if (!matchedLine) return batch;
//               const deductQty = n(matchedLine.qty);
//               return {
//                 ...batch,
//                 stock: Math.max(0, batch.stock - deductQty),
//               };
//             }),
//           };
//         })
//       );
//     }

//     if (editingSale) {
//       setSales(prev => prev.map(s => (s.id === editingSale.id ? clean : s)));
//     } else {
//       setSales(prev => [...prev, clean]);
//     }
//     closeModal();
//   }

//   function handleDelete(id: string) {
//     setSales(prev => prev.filter(s => s.id !== id));
//     setDeleteConfirmId(null);
//   }

//   return (
//     <div className="flex flex-col gap-8">
//       {/* Header */}
//       <div className="rounded-xl bg-[#044d73] px-6 py-5 text-white shadow-sm flex items-center justify-between">
//         <div>
//           <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
//           <p className="text-xs text-white/70 mt-0.5">
//             Sales invoices, cash & credit billing with FEFO batch deduction
//           </p>
//         </div>
//         <button
//           onClick={openAdd}
//           className="flex items-center gap-2 bg-white text-[#044d73] hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors"
//         >
//           <Plus className="h-4 w-4" strokeWidth={2.5} />
//           Add Sale
//         </button>
//       </div>

//       {/* Stats Cards */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//         {[
//           {
//             label: "Total Sales",
//             value: stats.total,
//             border: "border-l-slate-400",
//             iconBg: "bg-slate-50 text-slate-600",
//             icon: <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />,
//           },
//           {
//             label: "Total Revenue",
//             value: rs(stats.amount),
//             border: "border-l-[#044d73]",
//             iconBg: "bg-[#044d73]/10 text-[#044d73]",
//             icon: <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />,
//           },
//           {
//             label: "Cash Sales",
//             value: stats.cashCount,
//             border: "border-l-emerald-500",
//             iconBg: "bg-emerald-50 text-emerald-600",
//             icon: <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />,
//           },
//           {
//             label: "Credit Sales",
//             value: `${stats.creditCount} (${rs(stats.creditAmount)})`,
//             border: "border-l-amber-500",
//             iconBg: "bg-amber-50 text-amber-600",
//             icon: <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />,
//           },
//         ].map(s => (
//           <div
//             key={s.label}
//             className={`rounded-xl border-l-4 ${s.border} border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between`}
//           >
//             <div>
//               <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">
//                 {s.label}
//               </p>
//               <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 break-all">
//                 {s.value}
//               </p>
//             </div>
//             <div
//               className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}
//             >
//               {s.icon}
//             </div>
//           </div>
//         ))}
//       </div>

//       {/* Filters */}
//       <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
//         <div className="relative flex-1 min-w-[200px] max-w-sm">
//           <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
//           <input
//             type="text"
//             placeholder="Search by vch no., customer, item or batch"
//             value={search}
//             onChange={e => {
//               setSearch(e.target.value);
//               setCurrentPage(1);
//             }}
//             className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
//           />
//         </div>
//         <select
//           value={paymentFilter}
//           onChange={e => {
//             setPaymentFilter(e.target.value as typeof paymentFilter);
//             setCurrentPage(1);
//           }}
//           className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none"
//         >
//           <option value="ALL">All Payment Types</option>
//           <option value="Cash">Cash Sales</option>
//           <option value="Credit">Credit Sales</option>
//         </select>
//       </div>

//       {/* Sales Vouchers Table */}
//       <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead>
//               <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
//                 <th className="py-3 px-4">Date</th>
//                 <th className="py-3 px-4">Vch No.</th>
//                 <th className="py-3 px-4">Payment</th>
//                 <th className="py-3 px-4">Customer</th>
//                 <th className="py-3 px-4">Items & Dispensed Batches</th>
//                 <th className="py-3 px-4">Total Qty</th>
//                 <th className="py-3 px-4">Amount</th>
//                 <th className="py-3 px-4 text-right">Actions</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {paginated.length === 0 ? (
//                 <tr>
//                   <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
//                     No sales vouchers match criteria.
//                   </td>
//                 </tr>
//               ) : (
//                 paginated.map(s => {
//                   const totalQty = s.items.reduce((acc, li) => acc + n(li.qty), 0);

//                   return (
//                     <tr
//                       key={s.id}
//                       onClick={() => setViewingSale(s)}
//                       className="hover:bg-slate-50/80 transition-colors text-slate-700 cursor-pointer group"
//                     >
//                       <td className="py-3 px-4 text-slate-500">{s.date}</td>
//                       <td className="py-3 px-4 font-semibold text-slate-800 group-hover:text-[#044d73] transition-colors">
//                         {s.vchNo}
//                       </td>
//                       <td className="py-3 px-4">
//                         <span
//                           className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${
//                             s.paymentType === "Cash"
//                               ? "bg-emerald-50 border-emerald-200 text-emerald-700"
//                               : "bg-amber-50 border-amber-200 text-amber-700"
//                           }`}
//                         >
//                           {s.paymentType}
//                         </span>
//                       </td>
//                       <td className="py-3 px-4">
//                         {s.customerName ? (
//                           <div className="flex items-center gap-1.5 font-medium text-slate-800">
//                             <User className="w-3.5 h-3.5 text-slate-400" />
//                             <span>{s.customerName}</span>
//                           </div>
//                         ) : (
//                           <span className="text-xs text-slate-400 italic">
//                             Walk-in (Cash)
//                           </span>
//                         )}
//                       </td>
//                       <td className="py-3 px-4 max-w-xs">
//                         <div className="flex flex-col gap-1">
//                           {s.items.slice(0, 2).map((li, i) => (
//                             <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
//                               <span className="font-medium text-slate-800">{li.itemName || "Item"}</span>
//                               {li.batchNo ? (
//                                 <span className="inline-flex items-center gap-1 rounded bg-[#044d73]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[#044d73] border border-[#044d73]/20">
//                                   <Boxes className="w-2.5 h-2.5" /> B: {li.batchNo}
//                                 </span>
//                               ) : null}
//                             </div>
//                           ))}
//                           {s.items.length > 2 && (
//                             <span className="text-[11px] text-slate-400 font-medium">
//                               +{s.items.length - 2} more item{s.items.length - 2 > 1 ? "s" : ""}
//                             </span>
//                           )}
//                         </div>
//                       </td>
//                       <td className="py-3 px-4 text-slate-500">{totalQty}</td>
//                       <td className="py-3 px-4 font-bold text-slate-800">{rs(grandTotalOf(s))}</td>
//                       <td className="py-3 px-4">
//                         <div className="flex items-center justify-end gap-1">
//                           <button
//                             type="button"
//                             onClick={e => {
//                               e.stopPropagation();
//                               openEdit(s);
//                             }}
//                             title="Edit Sale"
//                             className="p-1.5 rounded-lg text-slate-400 hover:text-[#044d73] hover:bg-[#044d73]/10 transition-colors"
//                           >
//                             <Pencil className="w-4 h-4" />
//                           </button>
//                           <button
//                             type="button"
//                             onClick={e => {
//                               e.stopPropagation();
//                               setDeleteConfirmId(s.id);
//                             }}
//                             title="Delete"
//                             className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
//                           >
//                             <Trash2 className="w-4 h-4" />
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>

//         {filtered.length > 0 && (
//           <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
//             <span className="text-xs text-slate-400">
//               Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–
//               {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} sale
//               {filtered.length !== 1 ? "s" : ""}
//             </span>
//             {totalPages > 1 && (
//               <div className="flex items-center gap-1">
//                 <button
//                   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
//                   disabled={currentPage === 1}
//                   className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
//                 >
//                   <ChevronDown className="w-4 h-4 rotate-90" />
//                 </button>
//                 {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
//                   <button
//                     key={pg}
//                     onClick={() => setCurrentPage(pg)}
//                     className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold ${
//                       currentPage === pg
//                         ? "bg-[#044d73] text-white"
//                         : "border border-slate-200 text-slate-500"
//                     }`}
//                   >
//                     {pg}
//                   </button>
//                 ))}
//                 <button
//                   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
//                   disabled={currentPage === totalPages}
//                   className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
//                 >
//                   <ChevronDown className="w-4 h-4 -rotate-90" />
//                 </button>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Delete Confirmation Modal */}
//       {deleteConfirmId && (
//         <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
//           <div className="bg-white border border-slate-200 w-full max-w-sm rounded-xl shadow-xl overflow-hidden">
//             <div className="flex flex-col items-center text-center gap-3 p-6 border-b border-slate-100">
//               <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
//                 <Trash2 className="h-6 w-6 text-red-500" />
//               </div>
//               <div>
//                 <h3 className="text-base font-semibold text-slate-900">Delete Sales Voucher?</h3>
//                 <p className="text-sm text-slate-500 mt-1">
//                   This voucher will be removed. This action cannot be undone.
//                 </p>
//               </div>
//             </div>
//             <div className="flex gap-3 p-6">
//               <button
//                 onClick={() => setDeleteConfirmId(null)}
//                 className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 font-medium text-sm py-2.5 rounded-lg"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={() => handleDelete(deleteConfirmId)}
//                 className="flex-1 bg-red-500 text-white font-semibold text-sm py-2.5 rounded-lg"
//               >
//                 Delete
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* View Sale Voucher Modal */}
//       {viewingSale && (
//         <div
//           className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
//           onClick={() => setViewingSale(null)}
//         >
//           <div
//             className="bg-white border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
//             onClick={e => e.stopPropagation()}
//           >
//             <div className="relative flex shrink-0 items-center justify-between p-6 bg-[#044d73] text-white">
//               <div className="flex items-center gap-3">
//                 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
//                   <ShoppingCart className="h-5 w-5" />
//                 </div>
//                 <div>
//                   <div className="flex items-center gap-2">
//                     <h3 className="text-lg font-semibold">{viewingSale.vchNo}</h3>
//                     <span
//                       className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${
//                         viewingSale.paymentType === "Cash"
//                           ? "bg-emerald-400/20 border-emerald-300 text-emerald-100"
//                           : "bg-amber-400/20 border-amber-300 text-amber-100"
//                       }`}
//                     >
//                       {viewingSale.paymentType}
//                     </span>
//                   </div>
//                   <p className="text-xs text-white/70 mt-0.5">
//                     Date: {viewingSale.date} · Customer:{" "}
//                     {viewingSale.customerName || "Walk-in Cash Customer"}
//                   </p>
//                 </div>
//               </div>
//               <button
//                 type="button"
//                 onClick={() => setViewingSale(null)}
//                 className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>

//             <div className="flex-1 overflow-y-auto p-6 space-y-6">
//               {/* Voucher Meta Info */}
//               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
//                 <div>
//                   <span className="text-slate-400 block font-medium uppercase text-[10px]">
//                     Voucher No
//                   </span>
//                   <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
//                     {viewingSale.vchNo}
//                   </span>
//                 </div>
//                 <div>
//                   <span className="text-slate-400 block font-medium uppercase text-[10px]">
//                     Date
//                   </span>
//                   <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
//                     {viewingSale.date}
//                   </span>
//                 </div>
//                 <div>
//                   <span className="text-slate-400 block font-medium uppercase text-[10px]">
//                     Customer
//                   </span>
//                   <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
//                     {viewingSale.customerName || "Walk-in Cash"}
//                   </span>
//                 </div>
//                 <div>
//                   <span className="text-slate-400 block font-medium uppercase text-[10px]">
//                     Sales Type
//                   </span>
//                   <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
//                     {viewingSale.saleType}
//                   </span>
//                 </div>
//               </div>

//               {/* Items Table */}
//               <div>
//                 <h4 className="text-xs font-bold uppercase tracking-wider text-[#044d73] mb-2.5 flex items-center gap-1.5">
//                   <PackageCheck className="w-4 h-4" /> Sold Items & Dispensed Batches
//                 </h4>
//                 <div className="overflow-x-auto rounded-xl border border-slate-200">
//                   <table className="w-full text-xs">
//                     <thead>
//                       <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
//                         <th className="py-2.5 px-3">#</th>
//                         <th className="py-2.5 px-3">Item Name</th>
//                         <th className="py-2.5 px-3">Deducted Batch</th>
//                         <th className="py-2.5 px-3">Expiry Date</th>
//                         <th className="py-2.5 px-3 text-center">Qty</th>
//                         <th className="py-2.5 px-3">Unit</th>
//                         <th className="py-2.5 px-3">Rate</th>
//                         <th className="py-2.5 px-3 text-right">Amount</th>
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-slate-100">
//                       {viewingSale.items.map((li, idx) => (
//                         <tr key={li.id || idx} className="hover:bg-slate-50/50">
//                           <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
//                           <td className="py-2.5 px-3 font-medium text-slate-800">{li.itemName}</td>
//                           <td className="py-2.5 px-3">
//                             {li.batchNo ? (
//                               <span className="inline-flex items-center gap-1 rounded bg-[#044d73]/10 px-2 py-0.5 text-[11px] font-semibold text-[#044d73] border border-[#044d73]/20">
//                                 <Boxes className="w-3 h-3" /> {li.batchNo}
//                               </span>
//                             ) : (
//                               <span className="text-slate-400">—</span>
//                             )}
//                           </td>
//                           <td className="py-2.5 px-3 text-slate-600">{li.batchExpDate || "—"}</td>
//                           <td className="py-2.5 px-3 font-semibold text-slate-800 text-center">
//                             {li.qty}
//                           </td>
//                           <td className="py-2.5 px-3 text-slate-500">{li.unit || "—"}</td>
//                           <td className="py-2.5 px-3 text-slate-600">{rs(n(li.price))}</td>
//                           <td className="py-2.5 px-3 font-bold text-slate-800 text-right">
//                             {rs(lineAmount(li))}
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>

//               {/* Totals */}
//               <div className="ml-auto w-full max-w-xs space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
//                 <div className="flex justify-between text-xs text-slate-500">
//                   <span>Subtotal</span>
//                   <span>{rs(subtotalOf(viewingSale.items))}</span>
//                 </div>
//                 {viewingSale.discounts.length > 0 && (
//                   <div className="flex justify-between text-xs text-slate-500">
//                     <span>Discount</span>
//                     <span>
//                       -{" "}
//                       {rs(
//                         totalDiscountOf(
//                           viewingSale.discounts,
//                           subtotalOf(viewingSale.items)
//                         )
//                       )}
//                     </span>
//                   </div>
//                 )}
//                 <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-800">
//                   <span>Grand Total</span>
//                   <span>{rs(grandTotalOf(viewingSale))}</span>
//                 </div>
//               </div>
//             </div>

//             <div className="flex items-center justify-between border-t border-slate-100 bg-white p-4 px-6">
//               <button
//                 type="button"
//                 onClick={() => {
//                   const s = viewingSale;
//                   setViewingSale(null);
//                   openEdit(s);
//                 }}
//                 className="flex items-center gap-1.5 rounded-lg border border-[#044d73]/30 bg-[#044d73]/5 hover:bg-[#044d73]/10 px-4 py-2 text-xs font-semibold text-[#044d73] transition-colors"
//               >
//                 <Pencil className="w-3.5 h-3.5" /> Edit Sale Voucher
//               </button>
//               <button
//                 type="button"
//                 onClick={() => setViewingSale(null)}
//                 className="rounded-lg bg-slate-100 hover:bg-slate-200 px-5 py-2 text-xs font-semibold text-slate-700 transition-colors"
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Add / Edit Sale Modal */}
//       {isModalOpen && (
//         <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
//           <div className="bg-white border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
//             {/* Modal Header */}
//             <div className="relative flex shrink-0 items-center justify-between px-7 py-5 bg-[#044d73] text-white">
//               <div className="flex items-center gap-3.5">
//                 <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
//                   <ShoppingCart className="h-6 w-6" />
//                 </div>
//                 <div>
//                   <h3 className="text-xl font-semibold">
//                     {editingSale ? "Edit Sales Voucher" : "Add Sale"}
//                   </h3>
//                   <p className="text-xs text-white/70">
//                     Pick customer (if credit), pick items & deduct from oldest-expiry batch (FEFO)
//                   </p>
//                 </div>
//               </div>
//               <button
//                 type="button"
//                 onClick={closeModal}
//                 className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>

//             <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
//               <div className="flex-1 space-y-6 overflow-y-auto p-7">
//                 {/* Sale Details Section */}
//                 <Section title="Voucher & Customer" icon={<ShoppingCart className="w-3.5 h-3.5" />}>
//                   <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
//                     <Field label="Date">
//                       <input
//                         type="date"
//                         value={form.date}
//                         onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
//                         className={inputCls}
//                       />
//                     </Field>

//                     <Field label="Voucher No.">
//                       <input
//                         type="text"
//                         required
//                         value={form.vchNo}
//                         onChange={e => setForm(p => ({ ...p, vchNo: e.target.value }))}
//                         className={inputCls}
//                       />
//                     </Field>

//                     <Field label="Payment Type">
//                       <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
//                         <button
//                           type="button"
//                           onClick={() => setForm(p => ({ ...p, paymentType: "Cash" }))}
//                           className={`rounded-md py-1.5 text-xs font-bold transition-all ${
//                             form.paymentType === "Cash"
//                               ? "bg-white text-emerald-700 shadow-sm"
//                               : "text-slate-500 hover:text-slate-800"
//                           }`}
//                         >
//                           Cash
//                         </button>
//                         <button
//                           type="button"
//                           onClick={() => setForm(p => ({ ...p, paymentType: "Credit" }))}
//                           className={`rounded-md py-1.5 text-xs font-bold transition-all ${
//                             form.paymentType === "Credit"
//                               ? "bg-white text-amber-700 shadow-sm"
//                               : "text-slate-500 hover:text-slate-800"
//                           }`}
//                         >
//                           Credit
//                         </button>
//                       </div>
//                     </Field>

//                     <Field label="Sale Type">
//                       <select
//                         value={form.saleType}
//                         onChange={e => setForm(p => ({ ...p, saleType: e.target.value as SaleType }))}
//                         className={inputCls}
//                       >
//                         <option value="VAT/Exempt">VAT/Exempt</option>
//                         <option value="VAT/Item-wise">VAT/Item-wise</option>
//                         <option value="VAT/TaxIncl.">VAT/TaxIncl.</option>
//                       </select>
//                     </Field>

//                     {/* Customer Picker with Auto-Add */}
//                     <div className="sm:col-span-4">
//                       <label className={labelCls}>
//                         Customer {isCredit ? <span className="text-red-500">* (Required for Credit)</span> : <span className="text-slate-400 font-normal">(Leave blank for Cash)</span>}
//                       </label>
//                       <CustomerCombobox
//                         customers={customers}
//                         selectedId={form.customerId}
//                         selectedName={form.customerName}
//                         paymentType={form.paymentType}
//                         onSelectCustomer={cust => {
//                           setForm(p => ({
//                             ...p,
//                             customerId: cust ? cust.id : "",
//                             customerName: cust ? cust.name : "",
//                           }));
//                         }}
//                         onAutoAddCustomer={handleAutoAddCustomer}
//                       />
//                       {missingCustomerForCredit && (
//                         <p className="mt-1 text-xs text-amber-600 font-medium flex items-center gap-1">
//                           <AlertTriangle className="w-3.5 h-3.5" />
//                           Please select or auto-add a customer name for credit sales.
//                         </p>
//                       )}
//                     </div>
//                   </div>
//                 </Section>

//                 {/* Line Items & Batch Deduction with FEFO */}
//                 <Section
//                   title="Items & Batch Deduction (FEFO Auto-Suggested)"
//                   icon={<PackageCheck className="w-3.5 h-3.5" />}
//                 >
//                   <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
//                     <div className="overflow-x-auto">
//                       <table className="w-full text-xs">
//                         <thead>
//                           <tr className="bg-slate-50/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
//                             <th className="py-3 px-3 w-10 text-center">#</th>
//                             <th className="py-3 px-3 min-w-[240px]">Medicine / Item</th>
//                             <th className="py-3 px-3 min-w-[280px]">
//                               <span className="flex items-center gap-1 text-[#044d73]">
//                                 <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Deduct From Batch (FEFO First)
//                               </span>
//                             </th>
//                             <th className="py-3 px-2.5 w-[90px]">Qty</th>
//                             <th className="py-3 px-2 w-[70px] text-center">Unit</th>
//                             <th className="py-3 px-2.5 w-[110px]">Sale Rate</th>
//                             <th className="py-3 px-3 w-[110px] text-right">Amount</th>
//                             <th className="py-3 px-2 w-[50px] text-center"></th>
//                           </tr>
//                         </thead>
//                         <tbody className="divide-y divide-slate-100">
//                           {form.items.map((line, idx) => {
//                             const catalogItem = catalog.find(c => c.id === line.itemId);
//                             const exceedsStock =
//                               line.itemId &&
//                               n(line.qty) > 0 &&
//                               line.batchStock > 0 &&
//                               n(line.qty) > line.batchStock;

//                             return (
//                               <tr
//                                 key={line.id}
//                                 className={`transition-colors ${
//                                   exceedsStock ? "bg-red-50/40" : "hover:bg-slate-50/50"
//                                 }`}
//                               >
//                                 {/* S.N. */}
//                                 <td className="py-3 px-3 text-center font-medium text-slate-400">
//                                   {idx + 1}
//                                 </td>

//                                 {/* Item Picker */}
//                                 <td className="py-3 px-3">
//                                   <ItemPicker
//                                     catalog={catalog}
//                                     value={line.itemId}
//                                     onSelect={c => handleSelectItem(line.id, c)}
//                                   />
//                                 </td>

//                                 {/* Batch Picker with FEFO auto-suggestion */}
//                                 <td className="py-3 px-3">
//                                   {catalogItem && catalogItem.batches.length > 0 ? (
//                                     <BatchPicker
//                                       item={catalogItem}
//                                       selectedBatchId={line.batchId}
//                                       onSelectBatch={(batch, isOldest) =>
//                                         handleSelectBatch(line.id, batch, isOldest)
//                                       }
//                                     />
//                                   ) : line.itemId ? (
//                                     <span className="text-red-500 font-medium text-[11px]">
//                                       No active batches in stock
//                                     </span>
//                                   ) : (
//                                     <span className="text-slate-400 italic text-[11px]">
//                                       Select an item first
//                                     </span>
//                                   )}
//                                 </td>

//                                 {/* Qty */}
//                                 <td className="py-3 px-2.5">
//                                   <input
//                                     type="number"
//                                     min={1}
//                                     max={line.batchStock || undefined}
//                                     step="1"
//                                     placeholder="0"
//                                     value={line.qty}
//                                     onChange={e =>
//                                       updateLine(line.id, {
//                                         qty: e.target.value === "" ? "" : Number(e.target.value),
//                                       })
//                                     }
//                                     className={`h-9 w-full rounded-lg border px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 ${
//                                       exceedsStock
//                                         ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500"
//                                         : "border-slate-200 bg-white focus:border-[#044d73] focus:ring-[#044d73]"
//                                     }`}
//                                   />
//                                   {exceedsStock && (
//                                     <span className="text-[10px] text-red-600 font-bold block mt-0.5">
//                                       Max: {line.batchStock}
//                                     </span>
//                                   )}
//                                 </td>

//                                 {/* Unit */}
//                                 <td className="py-3 px-2 text-center">
//                                   <span className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
//                                     {line.unit || "—"}
//                                   </span>
//                                 </td>

//                                 {/* Sale Rate */}
//                                 <td className="py-3 px-2.5">
//                                   <input
//                                     type="number"
//                                     min={0}
//                                     step="0.01"
//                                     placeholder="0.00"
//                                     value={line.price}
//                                     onChange={e =>
//                                       updateLine(line.id, {
//                                         price: e.target.value === "" ? "" : Number(e.target.value),
//                                       })
//                                     }
//                                     className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
//                                   />
//                                 </td>

//                                 {/* Amount */}
//                                 <td className="py-3 px-3 text-right font-bold text-slate-800">
//                                   <div className="flex h-9 items-center justify-end">
//                                     {rs(lineAmount(line))}
//                                   </div>
//                                 </td>

//                                 {/* Remove Action */}
//                                 <td className="py-3 px-2 text-center">
//                                   <button
//                                     type="button"
//                                     onClick={() => removeLine(line.id)}
//                                     disabled={form.items.length <= 1}
//                                     title="Remove item"
//                                     className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
//                                   >
//                                     <Trash2 className="w-3.5 h-3.5" />
//                                   </button>
//                                 </td>
//                               </tr>
//                             );
//                           })}
//                         </tbody>
//                       </table>
//                     </div>

//                     {/* Add Item Row Button */}
//                     <div className="border-t border-slate-100 bg-slate-50/50 p-3 px-4 flex items-center justify-between">
//                       <button
//                         type="button"
//                         onClick={addLine}
//                         className="flex items-center gap-2 rounded-lg bg-[#044d73]/10 hover:bg-[#044d73]/20 px-3.5 py-2 text-xs font-semibold text-[#044d73] transition-colors"
//                       >
//                         <Plus className="w-4 h-4" /> Add Item Line
//                       </button>
//                       <span className="text-[11px] text-slate-400 font-medium">
//                         {form.items.length} item row{form.items.length !== 1 ? "s" : ""}
//                       </span>
//                     </div>
//                   </div>

//                   {hasExceededBatchStock && (
//                     <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-2.5 px-3 text-xs text-red-700">
//                       <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
//                       <span>
//                         One or more item quantities exceed the selected batch stock. Please adjust quantity.
//                       </span>
//                     </div>
//                   )}
//                 </Section>

//                 {/* Discounts */}
//                 <Section
//                   title="Discounts"
//                   icon={<Percent className="w-3.5 h-3.5" />}
//                   action={
//                     <button
//                       type="button"
//                       onClick={addDiscount}
//                       className="flex items-center gap-1.5 text-xs font-semibold text-[#044d73] hover:underline"
//                     >
//                       <Plus className="w-3.5 h-3.5" /> Add Discount
//                     </button>
//                   }
//                 >
//                   {form.discounts.length === 0 ? (
//                     <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-400">
//                       No discount applied to this sale.
//                     </p>
//                   ) : (
//                     <div className="overflow-x-auto rounded-lg border border-slate-200">
//                       <table className="w-full text-xs">
//                         <thead>
//                           <tr className="bg-slate-50/70 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
//                             <th className="py-2.5 px-3 w-10">S.N</th>
//                             <th className="py-2.5 px-3">Amount</th>
//                             <th className="py-2.5 px-3">Discount Type</th>
//                             <th className="py-2.5 px-3 w-10"></th>
//                           </tr>
//                         </thead>
//                         <tbody className="divide-y divide-slate-100">
//                           {form.discounts.map((d, idx) => (
//                             <tr key={d.id}>
//                               <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
//                               <td className="py-2 px-3">
//                                 <input
//                                   type="number"
//                                   min={0}
//                                   step="0.01"
//                                   value={d.amount}
//                                   placeholder={d.type === "Percentage" ? "%" : "Rs."}
//                                   onChange={e =>
//                                     updateDiscount(d.id, {
//                                       amount: e.target.value === "" ? "" : Number(e.target.value),
//                                     })
//                                   }
//                                   className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
//                                 />
//                               </td>
//                               <td className="py-2 px-3">
//                                 <select
//                                   value={d.type}
//                                   onChange={e =>
//                                     updateDiscount(d.id, { type: e.target.value as DiscountType })
//                                   }
//                                   className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
//                                 >
//                                   <option value="Percentage">Percentage (%)</option>
//                                   <option value="Flat">Flat (Rs.)</option>
//                                 </select>
//                               </td>
//                               <td className="py-2 px-3">
//                                 <button
//                                   type="button"
//                                   onClick={() => removeDiscount(d.id)}
//                                   className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
//                                 >
//                                   <Trash2 className="w-3.5 h-3.5" />
//                                 </button>
//                               </td>
//                             </tr>
//                           ))}
//                         </tbody>
//                       </table>
//                     </div>
//                   )}
//                 </Section>

//                 {/* Notes & Totals */}
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
//                   <div>
//                     <label className={labelCls}>Notes / Prescription Reference</label>
//                     <textarea
//                       rows={3}
//                       value={form.notes}
//                       onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
//                       placeholder="Doctor name, prescription remarks or dispensing notes..."
//                       className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
//                     />
//                   </div>

//                   <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
//                     <div className="flex justify-between text-xs sm:text-sm text-slate-500">
//                       <span>Subtotal</span>
//                       <span>{rs(subtotal)}</span>
//                     </div>
//                     <div className="flex justify-between text-xs sm:text-sm text-slate-500">
//                       <span>Discount</span>
//                       <span>- {rs(discountTotal)}</span>
//                     </div>
//                     <div className="flex justify-between border-t border-slate-200 pt-2 text-sm sm:text-base font-bold text-slate-800">
//                       <span>Grand Total</span>
//                       <span className="text-[#044d73]">{rs(grandTotal)}</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* Modal Footer */}
//               <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-5 px-7">
//                 <button
//                   type="button"
//                   onClick={closeModal}
//                   className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={
//                     validItems.length === 0 ||
//                     !form.vchNo.trim() ||
//                     missingCustomerForCredit ||
//                     hasExceededBatchStock
//                   }
//                   className="flex-1 rounded-lg bg-[#044d73] hover:bg-[#033f60] py-2.5 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-40"
//                 >
//                   {editingSale ? "Save Changes" : "Save Sale Voucher"}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
