"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Lock, Package, Pencil, Plus, ShoppingBag, Trash2, Wallet, X } from "lucide-react";
import { PageHeader, Panel, RecordList, RecordRow, StatCard, StatusPill } from "@/components/dashboard/widgets";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/store";
import {
  useCreateProduct,
  useDeleteProduct,
  useMyProducts,
  useMySales,
  useUpdateProduct,
  useWallet,
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
  const wallet = useWallet(enabled);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [editing, setEditing] = useState<Editing>(null);

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const sales = useMemo(() => salesQuery.data ?? [], [salesQuery.data]);
  const salesRevenue = sales.reduce((s, o) => s + o.totalNGN, 0);
  const stockUnits = products.reduce((s, p) => s + (p.stock ?? 0), 0);

  if (!user || !isSeller) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
        <Lock className="mx-auto h-8 w-8" strokeWidth={1.5} aria-hidden />
        <h1 className="t-display mt-3">Seller studio</h1>
        <p className="mt-2 text-[16px] text-muted">
          {user ? "Register your business to open a seller studio." : "Please sign in with a seller account."}
        </p>
        <Button asChild size="lg" className="mt-5">
          <Link href={user ? "/partnership/seller" : "/dashboard"}>{user ? "Register as a seller" : "Back to your account"}</Link>
        </Button>
      </div>
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seller studio"
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle={user.verified ? "Verified seller" : "Verification pending, our team reviews your CAC registration"}
        action={<Button onClick={() => setEditing({ mode: "new" })}><Plus aria-hidden /> Add product</Button>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key metrics">
        <StatCard icon={Package} label="Products" value={String(products.length)} />
        <StatCard icon={Boxes} label="Units in stock" value={String(stockUnits)} />
        <StatCard icon={ShoppingBag} label="Orders" value={String(sales.length)} />
        <StatCard icon={Wallet} label="Wallet balance" value={wallet.data ? formatNaira(wallet.data.balanceNGN) : "—"} />
      </section>

      <Panel id="products" title="Your shelf" icon={Package}>
        {productsQuery.isLoading ? (
          <div className="space-y-2" aria-busy="true" role="status">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : productsQuery.isError ? (
          <LoadError onRetry={() => productsQuery.refetch()} message="We could not load your products." />
        ) : products.length === 0 ? (
          <EmptyState>
            You have not listed any products yet.{" "}
            <button onClick={() => setEditing({ mode: "new" })} className="text-ink underline underline-offset-4">List your first product</button>
          </EmptyState>
        ) : (
          <RecordList>
            {products.map(p => (
              <RecordRow
                key={p.id}
                leading={<span className="h-12 w-12 shrink-0 rounded-[12px]" style={{ backgroundColor: p.bg_color || "#332f2d" }} aria-hidden />}
                title={p.name}
                subtitle={`${p.brand} · ${p.category}${p.badge ? ` · ${p.badge}` : ""}`}
                meta={`${p.stock ?? 0} in stock`}
                amount={formatNaira((p.price ?? 0) / 100)}
                status={(p.stock ?? 0) === 0 ? <StatusPill status="Sold out" /> : undefined}
                actions={
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditing({ mode: "edit", product: p })} aria-label={`Edit ${p.name}`}>
                      <Pencil aria-hidden /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}>
                      <Trash2 aria-hidden /> Remove
                    </Button>
                  </>
                }
              />
            ))}
          </RecordList>
        )}
      </Panel>

      <Panel id="sales" title="Sales" icon={ShoppingBag}>
        {salesQuery.isLoading ? (
          <div className="space-y-2" aria-busy="true" role="status">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : salesQuery.isError ? (
          <LoadError onRetry={() => salesQuery.refetch()} message="We could not load your sales." />
        ) : sales.length === 0 ? (
          <EmptyState>No sales yet. Orders that include your products show up here.</EmptyState>
        ) : (
          <RecordList>
            {sales.map(o => (
              <RecordRow
                key={o.id}
                title={o.id}
                subtitle={o.itemSummary}
                meta={`${o.date}${o.city ? ` · ${o.city}` : ""} · payment ${o.paymentStatus}`}
                amount={formatNaira(o.totalNGN)}
                status={<StatusPill status={o.shippingStatus} />}
              />
            ))}
          </RecordList>
        )}
        {sales.length > 0 && (
          <p className="t-meta mt-4 font-normal text-muted">Order totals include every item in the order. Sales revenue across these orders: {formatNaira(salesRevenue)}.</p>
        )}
      </Panel>

      {editing && (
        <ProductEditor
          initial={editing.mode === "edit" ? editing.product : undefined}
          pending={createProduct.isPending || updateProduct.isPending}
          onClose={() => setEditing(null)}
          onSubmit={submit}
        />
      )}
    </div>
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
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Math.round(parseFloat(price) * 100);
    const stockNum = parseInt(stock || "0", 10);
    if (!name.trim() || !brand.trim() || !priceNum || priceNum <= 0) {
      setError("Enter a name, brand and a price above zero.");
      return;
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setError("Stock must be zero or a whole number above zero.");
      return;
    }
    setError("");
    onSubmit({
      name: name.trim(),
      brand: brand.trim(),
      category,
      price: priceNum,
      stock: stockNum,
      badge: badge.trim() || undefined,
      blurb: blurb.trim() || undefined,
      details: details.split("\n").map(d => d.trim()).filter(Boolean),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit product" : "Add product"}
      onKeyDown={e => e.key === "Escape" && onClose()}
    >
      <form
        onSubmit={submit}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-float sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="t-display">{initial ? "Edit product" : "Add product"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 hover:bg-canvas">
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

        <FieldError>{error}</FieldError>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial ? "Save changes" : "List product"}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="t-meta mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
