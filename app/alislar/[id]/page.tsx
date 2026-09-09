"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Supplier = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
};

type PurchaseOrder = {
  id: string;
  purchase_number: number;
  supplier_id: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
};

type PurchaseItem = {
  id: string;
  product_id: string;
  product_name: string;
  barcode: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type ProductInfo = {
  id: string;
  sku: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  ordered: "Sipariş Verildi",
  received: "Teslim Alındı",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

function formatCurrency(value: number) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getErrorMessage(message: string) {
  return message
    .replace(/^ERROR:\s*/i, "")
    .trim();
}

function getStatusClasses(status: string) {
  switch (status) {
    case "cancelled":
      return "bg-red-100 text-red-700";

    case "completed":
      return "bg-emerald-100 text-emerald-700";

    case "received":
      return "bg-blue-100 text-blue-700";

    case "ordered":
      return "bg-amber-100 text-amber-700";

    case "draft":
      return "bg-slate-100 text-slate-600";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function AlisDetayPage() {
  const params = useParams();
  const router = useRouter();

  const purchaseId = String(params.id);

  const [purchase, setPurchase] =
    useState<PurchaseOrder | null>(null);

  const [supplier, setSupplier] =
    useState<Supplier | null>(null);

  const [items, setItems] =
    useState<PurchaseItem[]>([]);

  const [productInfo, setProductInfo] =
    useState<Record<string, ProductInfo>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadPurchase(
    showRefreshing = false
  ) {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    const {
      data: purchaseData,
      error: purchaseError,
    } = await supabase
      .from("purchase_orders")
      .select(
        "id, purchase_number, supplier_id, status, subtotal, total, notes, created_at"
      )
      .eq("id", purchaseId)
      .maybeSingle();

    if (purchaseError) {
      console.error(purchaseError);

      setError(
        getErrorMessage(
          purchaseError.message
        )
      );

      setPurchase(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!purchaseData) {
      setPurchase(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [
      supplierResult,
      itemsResult,
    ] = await Promise.all([
      supabase
        .from("suppliers")
        .select(
          "id, company_name, contact_name, phone"
        )
        .eq(
          "id",
          purchaseData.supplier_id
        )
        .maybeSingle(),

      supabase
        .from("purchase_order_items")
        .select(
          "id, product_id, product_name, barcode, quantity, unit_price, total_price"
        )
        .eq(
          "purchase_order_id",
          purchaseId
        )
        .order("created_at", {
          ascending: true,
        }),
    ]);

    if (supplierResult.error) {
      console.error(
        supplierResult.error
      );
    }

    if (itemsResult.error) {
      console.error(
        itemsResult.error
      );

      setError(
        getErrorMessage(
          itemsResult.error.message
        )
      );

      setPurchase(purchaseData);
      setSupplier(
        supplierResult.data || null
      );
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const loadedItems =
      (itemsResult.data ||
        []) as PurchaseItem[];

    setPurchase(
      purchaseData as PurchaseOrder
    );

    setSupplier(
      supplierResult.data || null
    );

    setItems(loadedItems);

    if (loadedItems.length > 0) {
      const productIds = [
        ...new Set(
          loadedItems.map(
            (item) => item.product_id
          )
        ),
      ];

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select("id, sku")
        .in("id", productIds);

      if (productError) {
        console.error(productError);
      } else {
        const infoMap: Record<
          string,
          ProductInfo
        > = {};

        for (const product of (
          productData || []
        ) as ProductInfo[]) {
          infoMap[product.id] = product;
        }

        setProductInfo(infoMap);
      }
    } else {
      setProductInfo({});
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadPurchase();
  }, [purchaseId]);

  async function cancelPurchase() {
    if (!purchase || cancelling) {
      return;
    }

    const confirmed = window.confirm(
      `Alış #${purchase.purchase_number} iptal edilecek.\n\n` +
        "Bu işlem:\n" +
        "• Alışta girilen ürünlerin stoklarını geri düşürür.\n" +
        "• Tedarikçi cari kaydına iade/mahsub hareketi oluşturur.\n" +
        "• Alışın durumunu İptal yapar.\n\n" +
        "Önemli: Bu işlem daha önce yapılan tedarikçi ödemesini otomatik olarak kasaya/bankaya geri yatırmaz.\n\n" +
        "Devam etmek istiyor musun?"
    );

    if (!confirmed) {
      return;
    }

    setCancelling(true);
    setError("");
    setSuccess("");

    const {
      error: cancelError,
    } = await supabase.rpc(
      "cancel_purchase_order",
      {
        p_purchase_order_id:
          purchase.id,
      }
    );

    if (cancelError) {
      console.error(cancelError);

      setError(
        `Alış iptal edilemedi: ${getErrorMessage(
          cancelError.message
        )}`
      );

      setCancelling(false);
      return;
    }

    setSuccess(
      `Alış #${purchase.purchase_number} başarıyla iptal edildi.`
    );

    await loadPurchase(true);

    setCancelling(false);
  }

  const totalQuantity = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum + Number(item.quantity),
      0
    );
  }, [items]);

  const totalItemAmount = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum + Number(item.total_price),
      0
    );
  }, [items]);

  const isCancelled =
    purchase?.status === "cancelled";

  const statusLabel = purchase
    ? STATUS_LABELS[purchase.status] ||
      purchase.status
    : "";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />

            <p className="mt-4 text-sm font-medium text-slate-500">
              Alış bilgileri yükleniyor...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!purchase) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">
              📦
            </div>

            <h1 className="mt-4 text-xl font-bold text-slate-900">
              Alış bulunamadı
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Aradığın alış kaydı bulunamadı veya
              görüntüleme yetkin yok.
            </p>

            {error && (
              <div className="mx-auto mt-4 max-w-lg rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                router.push("/alislar")
              }
              className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Alışlara Dön
            </button>
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
                router.push("/alislar")
              }
              className="mb-3 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              ← Alışlara Dön
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Alış #{purchase.purchase_number}
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(
                  purchase.status
                )}`}
              >
                {statusLabel}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {formatDate(
                purchase.created_at
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                loadPurchase(true)
              }
              disabled={
                refreshing ||
                cancelling
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? "Yenileniyor..."
                : "↻ Yenile"}
            </button>

            {!isCancelled && (
              <button
                type="button"
                onClick={cancelPurchase}
                disabled={cancelling}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelling
                  ? "İptal Ediliyor..."
                  : "❌ Alışı İptal Et"}
              </button>
            )}
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
                onClick={() =>
                  setError("")
                }
                className="rounded-lg px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-100"
              >
                Kapat
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-bold">
                  İşlem başarılı.
                </div>

                <div className="mt-1">
                  {success}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSuccess("")
                }
                className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 transition hover:bg-emerald-100"
              >
                Kapat
              </button>
            </div>
          </div>
        )}

        {/* CANCELLED WARNING */}
        {isCancelled && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg">
                ⚠️
              </div>

              <div>
                <h2 className="font-bold text-red-800">
                  Bu alış iptal edilmiştir.
                </h2>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  Alışın stok etkisi geri alınmış ve
                  tedarikçi cari hesabına ilgili iade
                  hareketi oluşturulmuştur.
                </p>

                <p className="mt-2 text-sm font-semibold text-red-700">
                  İptal edilen alış tekrar aktif duruma
                  getirilemez.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUPPLIER + SUMMARY */}
        <div className="grid gap-6 lg:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Tedarikçi
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {supplier?.company_name ||
                    "Tedarikçi bulunamadı"}
                </h2>
              </div>

              {supplier && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/tedarikciler/${supplier.id}`
                    )
                  }
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                >
                  Tedarikçiyi Gör →
                </button>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Yetkili
                </p>

                <p className="mt-1 font-semibold text-slate-800">
                  {supplier?.contact_name ||
                    "Belirtilmemiş"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Telefon
                </p>

                <p className="mt-1 font-semibold text-slate-800">
                  {supplier?.phone ||
                    "Belirtilmemiş"}
                </p>
              </div>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
            <p className="text-sm font-semibold text-slate-300">
              Alış Özeti
            </p>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Ürün çeşidi
                </span>

                <span className="font-bold">
                  {items.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Toplam miktar
                </span>

                <span className="font-bold">
                  {formatNumber(
                    totalQuantity
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Kalem toplamı
                </span>

                <span className="font-semibold">
                  {formatCurrency(
                    totalItemAmount
                  )}
                </span>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm text-slate-300">
                  Genel toplam
                </p>

                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {formatCurrency(
                    Number(purchase.total)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PRODUCTS */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Alış Kalemleri
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Bu alışta tedarikçiden alınan ürünler.
            </p>
          </div>

          {items.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl">
                📦
              </div>

              <div className="mt-3 font-semibold text-slate-900">
                Alış kalemi bulunamadı
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Bu alış kaydında görüntülenecek ürün
                bulunmuyor.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[850px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-6 py-4">
                        Ürün
                      </th>

                      <th className="px-6 py-4">
                        SKU
                      </th>

                      <th className="px-6 py-4">
                        Barkod
                      </th>

                      <th className="px-6 py-4 text-right">
                        Miktar
                      </th>

                      <th className="px-6 py-4 text-right">
                        Birim Fiyat
                      </th>

                      <th className="px-6 py-4 text-right">
                        Toplam
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">
                            {item.product_name}
                          </p>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500">
                          {productInfo[
                            item.product_id
                          ]?.sku || "-"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500">
                          {item.barcode || "-"}
                        </td>

                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          {formatNumber(
                            Number(
                              item.quantity
                            )
                          )}
                        </td>

                        <td className="px-6 py-4 text-right text-slate-700">
                          {formatCurrency(
                            Number(
                              item.unit_price
                            )
                          )}
                        </td>

                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          {formatCurrency(
                            Number(
                              item.total_price
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="bg-slate-50">
                      <td
                        colSpan={5}
                        className="px-6 py-5 text-right font-bold text-slate-700"
                      >
                        Genel Toplam
                      </td>

                      <td className="px-6 py-5 text-right text-lg font-bold text-slate-900">
                        {formatCurrency(
                          Number(
                            purchase.total
                          )
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* MOBILE */}
              <div className="divide-y divide-slate-100 md:hidden">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900">
                          {item.product_name}
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                          {productInfo[
                            item.product_id
                          ]?.sku && (
                            <span className="rounded-md bg-slate-100 px-2 py-1">
                              SKU:{" "}
                              {
                                productInfo[
                                  item.product_id
                                ].sku
                              }
                            </span>
                          )}

                          {item.barcode && (
                            <span className="rounded-md bg-slate-100 px-2 py-1">
                              Barkod:{" "}
                              {item.barcode}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xs text-slate-400">
                          Kalem toplamı
                        </div>

                        <div className="mt-1 font-bold text-slate-900">
                          {formatCurrency(
                            Number(
                              item.total_price
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-400">
                          Miktar
                        </div>

                        <div className="mt-1 font-semibold text-slate-800">
                          {formatNumber(
                            Number(
                              item.quantity
                            )
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-400">
                          Birim fiyat
                        </div>

                        <div className="mt-1 font-semibold text-slate-800">
                          {formatCurrency(
                            Number(
                              item.unit_price
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-slate-50 p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">
                      Genel Toplam
                    </span>

                    <span className="text-xl font-bold text-slate-900">
                      {formatCurrency(
                        Number(
                          purchase.total
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* NOTE */}
        {purchase.notes && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              📝 Alış Notu
            </h2>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {purchase.notes}
            </p>
          </section>
        )}

        {/* BOTTOM ACTION */}
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() =>
              router.push("/alislar")
            }
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← Tüm Alışlara Dön
          </button>

          {supplier && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/tedarikciler/${supplier.id}`
                )
              }
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
            >
              Tedarikçi Cari Hesabını Gör →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}