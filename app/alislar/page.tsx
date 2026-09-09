"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  sku: string | null;
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
  sku: string | null;
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
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function getRpcErrorMessage(message: string) {
  if (!message) {
    return "İşlem sırasında bilinmeyen bir hata oluştu.";
  }

  return message
    .replace(/^ERROR:\s*/i, "")
    .trim();
}

function PurchasesPageContent() {
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
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [savedPurchaseId, setSavedPurchaseId] =
    useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (
      preselectedSupplierId &&
      preselectedSupplierId !== supplierId
    ) {
      setSupplierId(preselectedSupplierId);
    }
  }, [preselectedSupplierId]);

  async function loadData(showRefreshing = false) {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

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
            "id, product_name, sku, barcode, category, purchase_price, stock, unit, is_active"
          )
          .eq("is_active", true)
          .order("product_name"),
      ]);

    if (supplierResult.error) {
      console.error(supplierResult.error);

      setError(
        getRpcErrorMessage(
          supplierResult.error.message
        )
      );

      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (productResult.error) {
      console.error(productResult.error);

      setError(
        getRpcErrorMessage(
          productResult.error.message
        )
      );

      setLoading(false);
      setRefreshing(false);
      return;
    }

    setSuppliers(
      (supplierResult.data || []) as Supplier[]
    );

    setProducts(
      (productResult.data || []) as Product[]
    );

    setLoading(false);
    setRefreshing(false);
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
          product.sku,
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

  const totalPurchase = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total +
        Number(item.quantity) *
          Number(item.unit_price),
      0
    );
  }, [cart]);

  const totalQuantity = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total + Number(item.quantity),
      0
    );
  }, [cart]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function addProduct(product: Product) {
    clearMessages();
    setSavedPurchaseId(null);

    const existing = cart.find(
      (item) => item.product_id === product.id
    );

    if (existing) {
      setCart((currentCart) =>
        currentCart.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity:
                  item.quantity + 1,
              }
            : item
        )
      );

      setProductSearch("");
      return;
    }

    setCart((currentCart) => [
      ...currentCart,
      {
        product_id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        barcode: product.barcode,
        quantity: 1,
        unit_price:
          Number(product.purchase_price) || 0,
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
    clearMessages();

    if (value === "") {
      setCart((currentCart) =>
        currentCart.map((item) =>
          item.product_id === productId
            ? {
                ...item,
                quantity: 0,
              }
            : item
        )
      );

      return;
    }

    const quantity = Number(value);

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity:
                Number.isFinite(quantity) &&
                quantity >= 0
                  ? quantity
                  : 0,
            }
          : item
      )
    );
  }

  function updateUnitPrice(
    productId: string,
    value: string
  ) {
    clearMessages();

    if (value === "") {
      setCart((currentCart) =>
        currentCart.map((item) =>
          item.product_id === productId
            ? {
                ...item,
                unit_price: 0,
              }
            : item
        )
      );

      return;
    }

    const unitPrice = Number(value);

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              unit_price:
                Number.isFinite(unitPrice) &&
                unitPrice >= 0
                  ? unitPrice
                  : 0,
            }
          : item
      )
    );
  }

  function removeProduct(productId: string) {
    clearMessages();

    setCart((currentCart) =>
      currentCart.filter(
        (item) => item.product_id !== productId
      )
    );
  }

  function validatePurchase() {
    if (!supplierId) {
      return "Lütfen bir tedarikçi seç.";
    }

    if (cart.length === 0) {
      return "Alışa en az bir ürün eklemelisin.";
    }

    for (const item of cart) {
      if (
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0
      ) {
        return `${item.product_name} için miktar 0'dan büyük olmalıdır.`;
      }

      if (
        !Number.isFinite(item.unit_price) ||
        item.unit_price < 0
      ) {
        return `${item.product_name} için alış fiyatı negatif olamaz.`;
      }
    }

    if (
      !Number.isFinite(totalPurchase) ||
      totalPurchase < 0
    ) {
      return "Alış toplamı geçersiz.";
    }

    return null;
  }

  async function savePurchase() {
    if (saving) {
      return;
    }

    clearMessages();
    setSavedPurchaseId(null);

    const validationError =
      validatePurchase();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    const { data, error: purchaseError } =
      await supabase.rpc(
        "create_purchase_order",
        {
          p_supplier_id: supplierId,
          p_items: cart.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          p_notes:
            notes.trim() || null,
        }
      );

    if (purchaseError) {
      console.error(purchaseError);

      setError(
        getRpcErrorMessage(
          purchaseError.message
        )
      );

      setSaving(false);
      return;
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    const purchaseId =
      result?.result_purchase_id ??
      result?.purchase_id ??
      null;

    const purchaseNumber =
      result?.result_purchase_number ??
      result?.purchase_number ??
      "-";

    const total = Number(
      result?.result_total ??
        result?.total ??
        totalPurchase
    );

    setSavedPurchaseId(purchaseId);

    setSuccess(
      `Alış #${purchaseNumber} başarıyla kaydedildi. Toplam: ${formatMoney(
        total
      )}`
    );

    setCart([]);
    setNotes("");
    setProductSearch("");
    setSaving(false);

    await loadData(true);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="text-sm font-medium text-slate-500">
            Alış ekranı yükleniyor...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() =>
                router.push("/tedarikciler")
              }
              className="mb-3 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              ← Tedarikçilere Dön
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Yeni Alış
              </h1>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                Satın Alma
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Tedarikçiden aldığın ürünleri stoğa ekle
              ve alış kaydını oluştur.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? "Yenileniyor..."
                : "↻ Yenile"}
            </button>

            <div className="min-w-[190px] rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <div className="text-xs font-semibold text-slate-400">
                Alış Toplamı
              </div>

              <div className="mt-1 text-xl font-bold text-slate-900">
                {formatMoney(totalPurchase)}
              </div>
            </div>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-bold">
                  İşlem gerçekleştirilemedi.
                </div>

                <div className="mt-1">
                  {error}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-100"
              >
                Kapat
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-bold">
                  Alış başarıyla kaydedildi.
                </div>

                <div className="mt-1">
                  {success}
                </div>
              </div>

              {savedPurchaseId && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/alislar/${savedPurchaseId}`
                    )
                  }
                  className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800"
                >
                  Alış Detayını Gör →
                </button>
              )}
            </div>
          </div>
        )}

        {/* SUPPLIER */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                1
              </div>

              <h2 className="text-lg font-bold text-slate-900">
                Tedarikçi Seç
              </h2>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Bu alışın hangi tedarikçiden yapıldığını
              seç.
            </p>
          </div>

          {suppliers.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-bold text-amber-800">
                Aktif tedarikçi bulunamadı.
              </div>

              <p className="mt-1 text-sm text-amber-700">
                Alış oluşturabilmek için önce aktif bir
                tedarikçi eklemelisin.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push("/tedarikciler")
                }
                className="mt-3 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-800"
              >
                Tedarikçilere Git →
              </button>
            </div>
          ) : (
            <>
              <select
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  clearMessages();
                  setSavedPurchaseId(null);
                }}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
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
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-sm">
                    {selectedSupplier.company_name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <div className="text-xs text-slate-400">
                      Seçilen tedarikçi
                    </div>

                    <strong className="text-slate-900">
                      {selectedSupplier.company_name}
                    </strong>

                    {selectedSupplier.contact_name && (
                      <span className="ml-2 text-slate-500">
                        •{" "}
                        {
                          selectedSupplier.contact_name
                        }
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* PRODUCT SEARCH */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                2
              </div>

              <h2 className="text-lg font-bold text-slate-900">
                Ürün Ekle
              </h2>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Ürün adı, SKU, barkod veya kategori ile
              ara.
            </p>
          </div>

          <div className="relative">
            <input
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                clearMessages();
              }}
              disabled={saving}
              placeholder="Ürün adı, SKU veya barkod ara..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-10 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            />

            {productSearch && (
              <button
                type="button"
                onClick={() =>
                  setProductSearch("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            {products.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-3xl">
                  📦
                </div>

                <div className="mt-2 font-semibold text-slate-900">
                  Aktif ürün bulunamadı
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Önce ürünler bölümünden aktif bir ürün
                  oluşturmalısın.
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Aramana uygun ürün bulunamadı.
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {filteredProducts.map((product) => {
                  const alreadyAdded = cart.some(
                    (item) =>
                      item.product_id ===
                      product.id
                  );

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        addProduct(product)
                      }
                      className="flex w-full flex-col gap-3 border-b border-slate-100 p-4 text-left transition last:border-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {product.product_name}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                          {product.sku && (
                            <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-500">
                              SKU: {product.sku}
                            </span>
                          )}

                          {product.barcode && (
                            <span>
                              Barkod:{" "}
                              {product.barcode}
                            </span>
                          )}

                          {product.category && (
                            <span>
                              {product.category}
                            </span>
                          )}

                          <span>
                            Mevcut stok:{" "}
                            {formatNumber(
                              Number(product.stock)
                            )}{" "}
                            {product.unit ||
                              "Adet"}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
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
                            ? "✓ Eklendi"
                            : "+ Ekle"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {filteredProducts.length === 20 && (
            <div className="mt-3 text-center text-xs text-slate-400">
              En fazla 20 sonuç gösteriliyor. Daha
              kesin arama yapmak için ürün adı, SKU veya
              barkod kullan.
            </div>
          )}
        </section>

        {/* CART */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    3
                  </div>

                  <h2 className="text-lg font-bold text-slate-900">
                    Alış Kalemleri
                  </h2>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  Miktar ve gerçek alış fiyatını kontrol
                  et.
                </p>
              </div>

              {cart.length > 0 && (
                <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                  {cart.length} ürün •{" "}
                  {formatNumber(totalQuantity)}{" "}
                  toplam adet
                </div>
              )}
            </div>
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
                Yukarıdaki ürün listesinden alışa ürün
                ekle.
              </div>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
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

                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                            {item.sku && (
                              <span>
                                SKU: {item.sku}
                              </span>
                            )}

                            {item.barcode && (
                              <span>
                                Barkod:{" "}
                                {item.barcode}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {formatNumber(
                            item.stock
                          )}{" "}
                          {item.unit}
                        </td>

                        <td className="px-5 py-4">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(
                                item.product_id,
                                e.target.value
                              )
                            }
                            disabled={saving}
                            className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
                          />
                        </td>

                        <td className="px-5 py-4">
                          <div className="relative w-36">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={
                                item.unit_price
                              }
                              onChange={(e) =>
                                updateUnitPrice(
                                  item.product_id,
                                  e.target.value
                                )
                              }
                              disabled={saving}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
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
                            disabled={saving}
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            Kaldır
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div className="divide-y divide-slate-100 md:hidden">
                {cart.map((item) => (
                  <div
                    key={item.product_id}
                    className="p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {item.product_name}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                          {item.sku && (
                            <span>
                              SKU: {item.sku}
                            </span>
                          )}

                          {item.barcode && (
                            <span>
                              Barkod:{" "}
                              {item.barcode}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeProduct(
                            item.product_id
                          )
                        }
                        disabled={saving}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Kaldır
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-400">
                          Mevcut Stok
                        </label>

                        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                          {formatNumber(
                            item.stock
                          )}{" "}
                          {item.unit}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-400">
                          Miktar
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(
                              item.product_id,
                              e.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-400">
                          Alış Fiyatı
                        </label>

                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={
                              item.unit_price
                            }
                            onChange={(e) =>
                              updateUnitPrice(
                                item.product_id,
                                e.target.value
                              )
                            }
                            disabled={saving}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-9 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50"
                          />

                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            ₺
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-400">
                          Kalem Toplamı
                        </label>

                        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900">
                          {formatMoney(
                            item.quantity *
                              item.unit_price
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* NOTES + TOTAL */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                4
              </div>

              <h2 className="text-lg font-bold text-slate-900">
                Alış Notu
              </h2>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              İstersen bu alışla ilgili açıklama
              ekleyebilirsin.
            </p>

            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                clearMessages();
              }}
              disabled={saving}
              maxLength={500}
              rows={6}
              placeholder="Örn: İstoç deposundan alınan ürünler..."
              className="mt-4 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
            />

            <div className="mt-2 text-right text-xs text-slate-400">
              {notes.length}/500
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
            <div className="text-sm font-semibold text-slate-500">
              Alış Özeti
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Tedarikçi
                </span>

                <span className="max-w-[180px] truncate text-right font-semibold text-slate-900">
                  {selectedSupplier
                    ? selectedSupplier.company_name
                    : "-"}
                </span>
              </div>

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
                  Toplam miktar
                </span>

                <span className="font-semibold text-slate-900">
                  {formatNumber(
                    totalQuantity
                  )}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Toplam Alış
                </div>

                <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
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
              className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Alış Kaydediliyor..."
                : "Alışı Kaydet"}
            </button>

            {!supplierId && (
              <p className="mt-3 text-center text-xs text-slate-400">
                Önce tedarikçi seçmelisin.
              </p>
            )}

            {supplierId &&
              cart.length === 0 && (
                <p className="mt-3 text-center text-xs text-slate-400">
                  Alışa en az bir ürün eklemelisin.
                </p>
              )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-4 md:p-6">
          <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="text-sm font-medium text-slate-500">
              Alış ekranı yükleniyor...
            </div>
          </div>
        </main>
      }
    >
      <PurchasesPageContent />
    </Suspense>
  );
}