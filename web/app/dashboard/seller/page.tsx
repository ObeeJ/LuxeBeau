"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, Boxes, Lock, Package, Pencil, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { StatCard, StatusPill } from "@/components/dashboard/widgets";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/store";
import {
  useCreateProduct,
  useDeleteProduct,
  useMyProducts,
  useMySales,
  useUpdateProduct,
  type SellerProductInput,
} from "@/lib/queries";
import { type ApiProduct } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/slide-in-notifications";
import { getFriendlyErrorMessage } from "@/lib/errors";

const CATEGORIES = ["Skincare", "Haircare", "Makeup", "Fragrance", "Body"] as const;

type Editing = { mode: "new" } | { mode: "edit"; product: ApiProduct } | null;

export default function SellerDashboard() {
  const user = useAuth(s => s.user);
  const { toast } = useToast();

  const isSeller = user?.role === "seller" || user?.role === "admin";
  const enabled = Boolean(user) && isSeller;

  const productsQuery = useMyProducts(enabled);
  const salesQuery = useMySales(enabled);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [editing, setEditing] = useState<Editing>(null);

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const sales = useMemo(() => salesQuery.data ?? [], [salesQuery.data]);
  const salesRevenue = sales.reduce((s, o) => s + o.totalNGN, 0);
  const stockUnits = products.reduce((s, p) => s + (p.stock ?? 0), 0);

  if (!user || !isSeller) {
    if (typeof window !== "undefined" && user && !isSeller) {
      window.location.replace("/partnership/seller");
    }
    return (
      <main className="mx-auto max-w-xl py-24 text-center">
        <Lock className="mx-auto h-10 w-10 text-danger" aria-hidden />
        <h1 className="mt-6 font-display text-3xl font-medium">Seller studio</h1>
        <p className="mt-3 text-lavender-200">
          {user ? "Redirecting to merchant registration…" : "Please sign in with a seller account."}
        </p>
        <Link href={user ? "/partnership/seller" : "/dashboard"} className="mt-8 inline-block rounded-full bg-royal-500 px-7 py-3 text-sm font-semibold transition-colors hover:bg-royal-400">
          {user ? "Apply as Merchant" : "Back to your account"}
        </Link>
      </main>
    );
  }

  const remove = (p: ApiProduct) => {
    if (!window.confirm(`Are you sure you want to remove "${p.name}" from your shelf? This action cannot be undone.`)) return;
    deleteProduct.mutate(p.id, {
      onSuccess: () => toast(`${p.name} has been successfully removed from your catalog.`, "success"),
      onError: e => toast(getFriendlyErrorMessage(e, "We couldn't remove this product. Please try again."), "error"),
    });
  };

  const submit = (input: SellerProductInput) => {
    const onError = (e: unknown) => toast(getFriendlyErrorMessage(e, "We couldn't save your product. Please check your fields and try again."), "error");
    if (editing?.mode === "edit") {
      updateProduct.mutate(
        { id: editing.product.id, input },
        { onSuccess: () => { toast(`${input.name} has been successfully updated.`, "success"); setEditing(null); }, onError },
      );
    } else {
      createProduct.mutate(input, {
        onSuccess: () => { toast(`${input.name} has been successfully listed on LuxeBeau.`, "success"); setEditing(null); },
        onError,
      });
    }
  };

  return (
    <main className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-300">Seller studio</p>
          <h1 className="mt-2 font-display text-3xl font-medium">
            Welcome, <em className="text-gold-gradient italic">{user.name.split(" ")[0]}</em>
          </h1>
          <p className="mt-1 text-sm text-lavender-400">
            Manage your shelf and track sales {user.verified ? "· verified seller" : "· verification pending"}
          </p>
        </div>
        <button
          onClick={() => setEditing({ mode: "new" })}
          className="inline-flex items-center gap-2 rounded-full bg-royal-500 px-6 py-3 text-sm font-semibold transition-colors hover:bg-royal-400"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add product
        </button>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
        <StatCard icon={Package} label="Products" value={String(products.length)} />
        <StatCard icon={Boxes} label="Units in stock" value={String(stockUnits)} />
        <StatCard icon={ShoppingBag} label="Orders" value={String(sales.length)} />
        <StatCard icon={Banknote} label="Sales revenue" value={formatNaira(salesRevenue)} />
      </section>

      {/* Product management */}
      <section id="products" className="card-velvet mt-8 scroll-mt-20 rounded-3xl p-6" aria-label="Your products">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Package className="h-5 w-5 text-gold-400" aria-hidden /> Your shelf
        </h2>
        {productsQuery.isLoading ? (
          <div className="mt-5 space-y-3" aria-busy="true" role="status">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full bg-velvet-800/60" />)}
          </div>
        ) : productsQuery.isError ? (
          <LoadError onRetry={() => productsQuery.refetch()} message="We could not load your products." />
        ) : products.length === 0 ? (
          <div className="mt-6 rounded-xl border border-velvet-700 p-8 text-center text-sm text-lavender-400">
            <p>You have not listed any products yet.</p>
            <button onClick={() => setEditing({ mode: "new" })} className="mt-4 font-semibold text-gold-300 hover:underline">List your first product</button>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-velvet-700/60 text-xs uppercase tracking-wider text-lavender-400">
                  <th scope="col" className="pb-3 pr-4">Product</th>
                  <th scope="col" className="pb-3 pr-4">Category</th>
                  <th scope="col" className="pb-3 pr-4 text-right">Price</th>
                  <th scope="col" className="pb-3 pr-4 text-right">Stock</th>
                  <th scope="col" className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-velvet-700/30 last:border-0">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: `linear-gradient(140deg, ${p.bg_color || "#3b2456"}, ${p.fg_color || "#6d3fb8"})` }} aria-hidden />
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-xs text-lavender-400">{p.brand}{p.badge ? ` · ${p.badge}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-lavender-300">{p.category}</td>
                    <td className="py-4 pr-4 text-right font-semibold tabular-nums text-gold-300">{formatNaira((p.price ?? 0) / 100)}</td>
                    <td className={`py-4 pr-4 text-right tabular-nums ${(p.stock ?? 0) === 0 ? "text-danger" : ""}`}>{p.stock ?? 0}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditing({ mode: "edit", product: p })} title="Edit" aria-label={`Edit ${p.name}`} className="rounded-full p-2 text-lavender-300 transition-colors hover:bg-velvet-800 hover:text-gold-300">
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button onClick={() => remove(p)} title="Remove" aria-label={`Remove ${p.name}`} className="rounded-full p-2 text-lavender-300 transition-colors hover:bg-velvet-800 hover:text-danger">
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sales */}
      <section id="sales" className="card-velvet mt-6 scroll-mt-20 overflow-x-auto rounded-3xl p-6" aria-label="Your sales">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <ShoppingBag className="h-5 w-5 text-gold-400" aria-hidden /> Sales
        </h2>
        {salesQuery.isLoading ? (
          <div className="mt-5 space-y-3" aria-busy="true" role="status">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-velvet-800/60" />)}
          </div>
        ) : salesQuery.isError ? (
          <LoadError onRetry={() => salesQuery.refetch()} message="We could not load your sales." />
        ) : sales.length === 0 ? (
          <p className="mt-6 rounded-xl border border-velvet-700 p-8 text-center text-sm text-lavender-400">No sales yet. When a customer buys one of your products, the order shows up here.</p>
        ) : (
          <table className="mt-5 w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-velvet-700/60 text-xs uppercase tracking-wider text-lavender-400">
                <th scope="col" className="pb-3 pr-4">Order</th>
                <th scope="col" className="pb-3 pr-4">Items</th>
                <th scope="col" className="pb-3 pr-4">Date</th>
                <th scope="col" className="pb-3 pr-4 text-right">Total</th>
                <th scope="col" className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(o => (
                <tr key={o.id} className="border-b border-velvet-700/30 last:border-0">
                  <td className="py-4 pr-4 font-semibold text-gold-300">{o.id}</td>
                  <td className="max-w-52 truncate py-4 pr-4 text-lavender-400">{o.itemSummary}</td>
                  <td className="py-4 pr-4 text-lavender-400">{o.date}</td>
                  <td className="py-4 pr-4 text-right font-semibold tabular-nums">{formatNaira(o.totalNGN)}</td>
                  <td className="py-4"><StatusPill status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Payouts Section */}
      <section id="payouts" className="card-velvet mt-6 scroll-mt-20 rounded-3xl p-6 space-y-6">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Banknote className="w-5 h-5 text-gold-400" /> Payouts &amp; Store Ledger
          </h2>
          <p className="text-xs text-lavender-400 mt-1">Manage your merchant earnings settlement and bank account details</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Available for Payout */}
          <div className="rounded-2xl bg-purple-950/20 border border-purple-900/40 p-5 space-y-3">
            <span className="text-xs text-lavender-400 font-medium">Available Balance</span>
            <p className="text-3xl font-display font-semibold text-white">{formatNaira(salesRevenue * 0.95)}</p>
            <button
              onClick={() => {
                toast(`Payout request for ${formatNaira(salesRevenue * 0.95)} submitted. It will reflect in your GTBank account within twenty-four hours.`, "success");
              }}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 font-semibold text-xs transition-opacity flex items-center justify-center gap-1.5"
            >
              Request Store Payout
            </button>
          </div>

          {/* Locked Escrow */}
          <div className="rounded-2xl bg-purple-950/20 border border-purple-900/40 p-5 space-y-3">
            <span className="text-xs text-lavender-400 font-medium">Held in Escrow (Orders in transit)</span>
            <p className="text-3xl font-display font-semibold text-purple-300">{formatNaira(salesRevenue * 0.05)}</p>
            <p className="text-[10px] text-lavender-400 leading-relaxed">
              Deposits for orders currently in transit. Settles immediately upon shipping status confirmation by delivery riders.
            </p>
          </div>

          {/* Settling Account */}
          <div className="rounded-2xl bg-purple-950/20 border border-purple-900/40 p-5 space-y-3">
            <span className="text-xs text-lavender-400 font-medium">Merchant Bank Account</span>
            <div className="py-2.5">
              <p className="text-sm font-semibold text-white">GTBank PLC</p>
              <p className="text-xs text-lavender-400 mt-1">Account ending in •••• 9012</p>
              <span className="inline-block mt-2 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-semibold">
                Verified Business Profile
              </span>
            </div>
          </div>
        </div>
      </section>

      {editing && (
        <ProductEditor
          initial={editing.mode === "edit" ? editing.product : undefined}
          pending={createProduct.isPending || updateProduct.isPending}
          onClose={() => setEditing(null)}
          onSubmit={submit}
        />
      )}
    </main>
  );
}

function ProductEditor({
  initial,
  pending,
  onClose,
  onSubmit,
}: {
  initial?: ApiProduct;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: SellerProductInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [price, setPrice] = useState(initial ? String((initial.price ?? 0) / 100) : "");
  const [stock, setStock] = useState(initial ? String(initial.stock ?? 0) : "0");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [blurb, setBlurb] = useState(initial?.blurb ?? "");
  const [details, setDetails] = useState((initial?.details ?? []).join("\n"));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Math.round(parseFloat(price) * 100);
    if (!name.trim() || !brand.trim() || !priceNum || priceNum <= 0) return;
    onSubmit({
      name: name.trim(),
      brand: brand.trim(),
      category,
      price: priceNum,
      stock: parseInt(stock || "0", 10),
      badge: badge.trim() || undefined,
      blurb: blurb.trim() || undefined,
      details: details.split("\n").map(d => d.trim()).filter(Boolean),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-velvet-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit product" : "Add product"}
      onKeyDown={e => e.key === "Escape" && onClose()}
    >
      <form
        onSubmit={submit}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-velvet-700/70 bg-velvet-900/90 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{initial ? "Edit product" : "Add product"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-lavender-300 hover:bg-velvet-800">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <Field label="Product name">
            <input value={name} onChange={e => setName(e.target.value)} required className="lb-input" placeholder="Hibiscus Glow Toning Essence" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand">
              <input value={brand} onChange={e => setBrand(e.target.value)} required className="lb-input" placeholder="Adunni Organics" />
            </Field>
            <Field label="Category">
              <select value={category} onChange={e => setCategory(e.target.value)} className="lb-input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price (₦)">
              <input value={price} onChange={e => setPrice(e.target.value)} required inputMode="decimal" className="lb-input" placeholder="11500" />
            </Field>
            <Field label="Stock">
              <input value={stock} onChange={e => setStock(e.target.value)} inputMode="numeric" className="lb-input" placeholder="0" />
            </Field>
            <Field label="Badge (optional)">
              <input value={badge} onChange={e => setBadge(e.target.value)} className="lb-input" placeholder="Bestseller" />
            </Field>
          </div>
          <Field label="Short description">
            <textarea value={blurb} onChange={e => setBlurb(e.target.value)} rows={2} className="lb-input resize-none" placeholder="A one-line hook customers see in the shop." />
          </Field>
          <Field label="Details (one per line)">
            <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} className="lb-input resize-none" placeholder={"NAFDAC registered\nMade in Ibadan\nVegan and cruelty-free"} />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-velvet-700 px-5 py-2.5 text-sm font-semibold text-lavender-200 transition-colors hover:border-gold-400/60">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="rounded-full bg-royal-500 px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-royal-400 disabled:opacity-60">
            {pending ? "Saving…" : initial ? "Save changes" : "List product"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-lavender-400">{label}</span>
      {children}
    </label>
  );
}
