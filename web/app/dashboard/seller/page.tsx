"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X } from "@/components/icons";
import { Figures, PageHeader, Panel, RecordList, StatusPill, Table, Tabs } from "@/components/dashboard/widgets";
import { IdentityPanel } from "@/components/dashboard/identity";
import { PendingApproval } from "@/components/dashboard/pending-approval";
import { SaleRow } from "@/components/dashboard/sale-row";
import { ImageField } from "@/components/dashboard/image-field";
import { Photo } from "@/components/site/catalog";
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
import { getFriendlyErrorMessage } from "@/lib/errors";

const CATEGORIES = ["Skincare", "Haircare", "Makeup", "Fragrance", "Body"] as const;

type Editing = { mode: "new" } | { mode: "edit"; product: ApiProduct } | null;
type Tab = "products" | "orders" | "verification";

export default function SellerDashboard() {
  const user = useAuth(s => s.user);
  const status = useAuth(s => s.status);
  const isSeller = user?.role === "seller" || user?.role === "admin";
  const enabled = Boolean(user) && isSeller;

  const productsQuery = useMyProducts(enabled);
  const salesQuery = useMySales(enabled);
  const wallet = useWallet(enabled);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [tab, setTab] = useState<Tab>("products");
  const [editing, setEditing] = useState<Editing>(null);
  const [rowError, setRowError] = useState("");

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const sales = useMemo(() => salesQuery.data ?? [], [salesQuery.data]);

  if (status === "loading") return <Skeleton className="h-64 w-full rounded-[28px] bg-surface" />;

  if (!user || !isSeller) {
    return (
      <div className="mx-auto max-w-sm rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
        <h1 className="t-display">Seller studio</h1>
        <p className="mt-2 text-[16px] text-muted">
          {user ? "Register your business to start selling." : "Sign in with your seller account."}
        </p>
        <Button asChild size="lg" className="mt-5">
          <Link href={user ? "/partnership/seller" : "/dashboard"}>{user ? "Register as a seller" : "Go to sign in"}</Link>
        </Button>
      </div>
    );
  }

  const remove = (p: ApiProduct) => {
    if (!window.confirm(`Remove "${p.name}" from your shop?`)) return;
    setRowError("");
    deleteProduct.mutate(p.id, {
      onError: e => setRowError(getFriendlyErrorMessage(e, "We couldn't remove this product.")),
    });
  };

  const submit = (input: SellerProductInput, setError: (m: string) => void) => {
    const onError = (e: unknown) => setError(getFriendlyErrorMessage(e, "We couldn't save this product. Check the fields and try again."));
    if (editing?.mode === "edit") {
      updateProduct.mutate({ id: editing.product.id, input }, { onSuccess: () => setEditing(null), onError });
    } else {
      createProduct.mutate(input, { onSuccess: () => setEditing(null), onError });
    }
  };

  const unitsInStock = products.reduce((s, p) => s + (p.stock ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Seller studio"
        subtitle={user.verified ? `${user.name} · Approved seller` : `${user.name} · Awaiting approval`}
        action={<Button onClick={() => setEditing({ mode: "new" })}><Plus aria-hidden /> Add product</Button>}
      />

      {!user.verified && user.role === "seller" && <PendingApproval kind="seller" />}

      <Figures
        items={[
          { label: "Products", value: String(products.length) },
          { label: "Units in stock", value: unitsInStock.toLocaleString("en-NG") },
          { label: "Orders", value: String(sales.length) },
          { label: "Wallet", value: wallet.data ? formatNaira(wallet.data.balanceNGN) : "—" },
        ]}
      />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "products", label: "Products", count: products.length },
          { id: "orders", label: "Orders", count: sales.length },
          { id: "verification", label: "Verification" },
        ]}
      />

      {tab === "products" && (
        <Panel aria-label="Products">
          {productsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : productsQuery.isError ? (
            <LoadError onRetry={() => productsQuery.refetch()} message="We couldn't load your products." />
          ) : products.length === 0 ? (
            <EmptyState>
              No products yet.{" "}
              <button onClick={() => setEditing({ mode: "new" })} className="text-ink underline underline-offset-4">Add your first product</button>
            </EmptyState>
          ) : (
            <>
              <Table head={["Product", "Category", "Price", "Stock", ""]} minWidth={620}>
                {products.map(p => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0">
                          <Photo src={p.image_url ?? undefined} alt={p.name} fallback="" sizes="sm" className="rounded-[12px]" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate">{p.name}</p>
                          <p className="text-[12px] text-muted">{p.brand}{p.image_url ? "" : " · No photo"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-muted">{p.category}</td>
                    <td className="py-3 pr-4 tabular-nums">{formatNaira((p.price ?? 0) / 100)}</td>
                    <td className="py-3 pr-4 tabular-nums">{(p.stock ?? 0) === 0 ? <StatusPill status="Sold out" /> : p.stock}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setEditing({ mode: "edit", product: p })}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}>Remove</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
              <FieldError>{rowError}</FieldError>
            </>
          )}
        </Panel>
      )}

      {tab === "orders" && (
        <Panel aria-label="Orders">
          {salesQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : salesQuery.isError ? (
            <LoadError onRetry={() => salesQuery.refetch()} message="We couldn't load your orders." />
          ) : sales.length === 0 ? (
            <EmptyState>No orders yet. Orders that include your products appear here.</EmptyState>
          ) : (
            <RecordList>
              {sales.map(o => <SaleRow key={o.id} order={o} />)}
            </RecordList>
          )}
        </Panel>
      )}

      {tab === "verification" && <IdentityPanel />}

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
  onSubmit: (input: SellerProductInput, setError: (m: string) => void) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [price, setPrice] = useState(initial ? String((initial.price ?? 0) / 100) : "");
  const [stock, setStock] = useState(initial ? String(initial.stock ?? 0) : "0");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [blurb, setBlurb] = useState(initial?.blurb ?? "");
  const [details, setDetails] = useState((initial?.details ?? []).join("\n"));
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceKobo = Math.round(parseFloat(price) * 100);
    const stockNum = Number(stock || "0");
    if (!name.trim() || !brand.trim()) return setError("Enter a product name and brand.");
    if (!priceKobo || priceKobo <= 0) return setError("Enter a price above zero.");
    if (!Number.isInteger(stockNum) || stockNum < 0) return setError("Stock must be a whole number, zero or more.");
    setError("");
    onSubmit(
      {
        name: name.trim(),
        brand: brand.trim(),
        category,
        price: priceKobo,
        stock: stockNum,
        badge: badge.trim() || undefined,
        blurb: blurb.trim() || undefined,
        details: details.split("\n").map(d => d.trim()).filter(Boolean),
        image_url: imageUrl || undefined,
      },
      setError,
    );
  };

  const field = (label: string, control: React.ReactNode) => (
    <label className="block">
      <span className="t-meta mb-1.5 block font-normal">{label}</span>
      {control}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit product" : "Add product"}
      onKeyDown={e => e.key === "Escape" && onClose()}
    >
      <form onSubmit={submit} noValidate className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-float sm:rounded-[28px] sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="t-display">{initial ? "Edit product" : "Add product"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-canvas">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <ImageField label="Photo" value={imageUrl} onChange={setImageUrl} />
          {field("Product name", <input value={name} onChange={e => setName(e.target.value)} className="lb-input h-11" placeholder="Hibiscus Glow Toning Essence" />)}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("Brand", <input value={brand} onChange={e => setBrand(e.target.value)} className="lb-input h-11" placeholder="Adunni Organics" />)}
            {field("Category", (
              <select value={category} onChange={e => setCategory(e.target.value)} className="lb-input h-11">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {field("Price (₦)", <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" className="lb-input h-11" placeholder="11500" />)}
            {field("Stock", <input value={stock} onChange={e => setStock(e.target.value)} inputMode="numeric" className="lb-input h-11" />)}
            <div className="col-span-2 sm:col-span-1">
              {field("Label (optional)", <input value={badge} onChange={e => setBadge(e.target.value)} className="lb-input h-11" placeholder="Bestseller" />)}
            </div>
          </div>
          {field("Short description", <textarea value={blurb} onChange={e => setBlurb(e.target.value)} rows={2} className="lb-input" />)}
          {field("Details, one per line", <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} className="lb-input" placeholder={"NAFDAC registered\nMade in Ibadan"} />)}
        </div>

        <FieldError>{error}</FieldError>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial ? "Save changes" : "Add product"}</Button>
        </div>
      </form>
    </div>
  );
}
