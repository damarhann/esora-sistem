"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Supplier = {
  id: string;
  company_name: string;
  contact_name: string | null;
  is_active: boolean;
};

type Product = {
  id: string;
  product_name: string;
  barcode: string | null;
  category: string | null;
  purchase_price: number;
  stock: number;
  unit: string | null;
  is_active: boolean;
};

type CartItem = {
  product_id: string;
  product_name: string;
  barcode: string | null;
  quantity: number;
  unit_price: number;
  stock: number;
  unit: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function PurchasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preselectedSupplierId =
    searchParams.get("tedarikci") || "";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [supplierId, setSupplierId] = useState(
    preselectedSupplierId
  );

  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    const [supplierResult, productResult] =
      await Promise.all([
        supabase
          .from("suppliers")
          .select(
            "id, company_name, contact_name, is_active"
          )
          .eq("is_active", true)
          .order("company_name"),

        supabase
          .from("products")
          .select(
            "id, product_name, barcode, category, purchase_price, stock, unit, is_active"
          )
          .eq("is_active", true)
          .order("product_name"),
      ]);

    if (supplierResult.error) {
      console.error(supplierResult.error);
      setError(supplierResult.error.message);
      setLoading(false);
      return;
    }

    if (productResult.error) {
      console.error(productResult.error);
      setError(productResult.error.message);
      setLoading(false);
      return;
    }

    setSuppliers(
      (supplierResult.data || []) as Supplier[]
    );

    setProducts(
      (productResult.data || []) as Product[]
    );

    setLoading(false);
  }

  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === supplierId
  );

  const filteredProducts = useMemo(() => {
    const search = productSearch
      .toLowerCase()
      .trim();

    if (!search) {
      return products.slice(0, 20);
    }

    return products
      .filter((product) => {
        return [
          product.product_name,
          product.barcode,
          product.category,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(search)
          );
      })
      .slice(0, 20);
  }, [products, productSearch]);

  const totalPurchase = cart.reduce(
    (total, item) =>
      total + item.quantity * item.unit_price,
    0
  );

  function addProduct(product: Product) {
    setError("");
    setSuccess("");

    const existing = cart.find(
      (item) => item.product_id === product.id
    );

    if (existing) {
      setCart(
        cart.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        )
      );

      setProductSearch("");
      return;
    }

    setCart([
      ...cart,
      {
        product_id: product.id,
        product_name: product.product_name,
        barcode: product.barcode,
        quantity: 1,
        unit_price: Number(product.purchase_price) || 0,
        stock: Number(product.stock) || 0,
        unit: product.unit || "Adet",
      },
    ]);

    setProductSearch("");
  }

  function updateQuantity(
    productId: string,
    value: string
  ) {
    const quantity = Number(value);

    setCart(
      cart.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity:
                quantity > 0 ? quantity : 1,
            }
          : item
      )
    );
  }

  function updateUnitPrice(
    productId: string,
    value: string
  ) {
    const unitPrice = Number(value);

    setCart(
      cart.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              unit_price:
                unitPrice >= 0 ? unitPrice : 0,
            }
          : item
      )
    );
  }

  function removeProduct(productId: string) {
    setCart(
      cart.filter(
        (item) => item.product_id !== productId
      )
    );
  }

  async function savePurchase() {
    setError("");
    setSuccess("");

    if (!supplierId) {
      setError("Lütfen bir tedarikçi seç.");
      return;
    }

    if (cart.length === 0) {
      setError("Alışa en az bir ürün eklemelisin.");
      return;
    }

    for (const item of cart) {
      if (item.quantity <= 0) {
        setError(
          `${item.product_name} için miktar 0'dan büyük olmalıdır.`
        );
        return;
      }

      if (item.unit_price < 0) {
        setError(
          `${item.product_name} için alış fiyatı negatif olamaz.`
        );
        return;
      }
    }

    setSaving(true);

    const { data, error: purchaseError } =
      await supabase.rpc("create_purchase_order", {
        p_supplier_id: supplierId,
        p_items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        p_notes: notes.trim() || null,
      });

    if (purchaseError) {
      console.error(purchaseError);
      setError(purchaseError.message);
      setSaving(false);
      return;
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    const purchaseNumber =
      result?.result_purchase_number ??
      result?.purchase_number;

    const total =
      Number(result?.result_total ?? result?.total ?? totalPurchase);

    setSuccess(
      `Alış #${purchaseNumber ?? "-"} başarıyla kaydedildi. Toplam: ${formatMoney(
        total
      )}`
    );

    setCart([]);
    setNotes("");
    setProductSearch("");
    setSaving(false);

    await loadData();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Alış ekranı yükleniyor...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={() =>
                router.push("/tedarikciler")
              }
              className="mb-3 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Tedarikçilere Dön
            </button>

            <h1 className="text-2xl font-bold text-slate-900">
              Yeni Alış
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Tedarikçiden aldığın ürünleri stoğa ekle
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <div className="text-xs font-semibold text-slate-400">
              Alış Toplamı
            </div>

            <div className="mt-1 text-xl font-bold text-slate-900">
              {formatMoney(totalPurchase)}
            </div>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-bold">
              İşlem gerçekleştirilemedi.
            </div>

            <div className="mt-1">
              {error}
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <div className="font-bold">
              Alış başarıyla kaydedildi.
            </div>

            <div className="mt-1">
              {success}
            </div>
          </div>
        )}

        {/* SUPPLIER */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-900">
              1. Tedarikçi Seç
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Bu alışın hangi tedarikçiden yapıldığını seç.
            </p>
          </div>

          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setError("");
              setSuccess("");
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-500"
          >
            <option value="">
              Tedarikçi seç...
            </option>

            {suppliers.map((supplier) => (
              <option
                key={supplier.id}
                value={supplier.id}
              >
                {supplier.company_name}
                {supplier.contact_name
                  ? ` - ${supplier.contact_name}`
                  : ""}
              </option>
            ))}
          </select>

          {selectedSupplier && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Seçilen tedarikçi:{" "}
              <strong className="text-slate-900">
                {selectedSupplier.company_name}
              </strong>
            </div>
          )}
        </section>

        {/* PRODUCT SEARCH */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-900">
              2. Ürün Ekle
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Ürün adı, barkod veya kategori ile ara.
            </p>
          </div>

          <input
            value={productSearch}
            onChange={(e) =>
              setProductSearch(e.target.value)
            }
            placeholder="Ürün adı veya barkod ara..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
          />

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Ürün bulunamadı.
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                {filteredProducts.map((product) => {
                  const alreadyAdded = cart.some(
                    (item) =>
                      item.product_id === product.id
                  );

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() =>
                        addProduct(product)
                      }
                      className="flex w-full items-center justify-between border-b border-slate-100 p-4 text-left transition last:border-0 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {product.product_name}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                          {product.barcode && (
                            <span>
                              Barkod: {product.barcode}
                            </span>
                          )}

                          {product.category && (
                            <span>
                              {product.category}
                            </span>
                          )}

                          <span>
                            Mevcut stok:{" "}
                            {product.stock}
                          </span>
                        </div>
                      </div>

                      <div className="ml-4 flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">
                            Son alış
                          </div>

                          <div className="font-bold text-slate-900">
                            {formatMoney(
                              Number(
                                product.purchase_price
                              )
                            )}
                          </div>
                        </div>

                        <span
                          className={
                            alreadyAdded
                              ? "rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700"
                              : "rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                          }
                        >
                          {alreadyAdded
                            ? "Eklendi"
                            : "+ Ekle"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* CART */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">
              3. Alış Kalemleri
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Miktar ve gerçek alış fiyatını kontrol et.
            </p>
          </div>

          {cart.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl">
                📦
              </div>

              <div className="mt-3 font-semibold text-slate-900">
                Henüz ürün eklenmedi
              </div>

              <div className="mt-1 text-sm text-slate-500">
                Yukarıdaki ürün listesinden alışa ürün ekle.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-400">
                    <th className="px-5 py-4">
                      Ürün
                    </th>

                    <th className="px-5 py-4">
                      Mevcut Stok
                    </th>

                    <th className="px-5 py-4">
                      Miktar
                    </th>

                    <th className="px-5 py-4">
                      Alış Fiyatı
                    </th>

                    <th className="px-5 py-4 text-right">
                      Toplam
                    </th>

                    <th className="px-5 py-4 text-center">
                      İşlem
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {cart.map((item) => (
                    <tr
                      key={item.product_id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {item.product_name}
                        </div>

                        {item.barcode && (
                          <div className="mt-1 text-xs text-slate-400">
                            Barkod: {item.barcode}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {item.stock} {item.unit}
                      </td>

                      <td className="px-5 py-4">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(
                              item.product_id,
                              e.target.value
                            )
                          }
                          className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        />
                      </td>

                      <td className="px-5 py-4">
                        <div className="relative w-36">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateUnitPrice(
                                item.product_id,
                                e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-slate-500"
                          />

                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            ₺
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-slate-900">
                        {formatMoney(
                          item.quantity *
                            item.unit_price
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            removeProduct(
                              item.product_id
                            )
                          }
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Kaldır
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* NOTES + TOTAL */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">
              4. Alış Notu
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              İstersen bu alışla ilgili açıklama ekleyebilirsin.
            </p>

            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
              rows={5}
              placeholder="Örn: İstoç deposundan alınan ürünler..."
              className="mt-4 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Alış Özeti
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Ürün çeşidi
                </span>

                <span className="font-semibold text-slate-900">
                  {cart.length}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Toplam adet
                </span>

                <span className="font-semibold text-slate-900">
                  {cart.reduce(
                    (total, item) =>
                      total + item.quantity,
                    0
                  )}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="text-xs text-slate-400">
                  Toplam Alış
                </div>

                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {formatMoney(totalPurchase)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={savePurchase}
              disabled={
                saving ||
                !supplierId ||
                cart.length === 0
              }
              className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Alış Kaydediliyor..."
                : "Alışı Kaydet"}
            </button>
          </div>

        </section>

      </div>
    </main>
  );
}

