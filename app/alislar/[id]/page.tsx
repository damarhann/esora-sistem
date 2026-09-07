"use client";

import { useEffect, useState } from "react";
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

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  ordered: "Sipariş Verildi",
  received: "Teslim Alındı",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

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

  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  async function loadPurchase() {
    setLoading(true);

    const { data: purchaseData, error: purchaseError } =
      await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", purchaseId)
        .single();

    if (purchaseError || !purchaseData) {
      console.error(purchaseError);
      setLoading(false);
      return;
    }

    const { data: supplierData, error: supplierError } =
      await supabase
        .from("suppliers")
        .select(
          "id, company_name, contact_name, phone"
        )
        .eq("id", purchaseData.supplier_id)
        .single();

    if (supplierError) {
      console.error(supplierError);
    }

    const { data: itemsData, error: itemsError } =
      await supabase
        .from("purchase_order_items")
        .select("*")
        .eq(
          "purchase_order_id",
          purchaseId
        )
        .order("created_at", {
          ascending: true,
        });

    if (itemsError) {
      console.error(itemsError);
    }

    setPurchase(purchaseData);
    setSupplier(supplierData || null);
    setItems(itemsData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPurchase();
  }, [purchaseId]);

  async function cancelPurchase() {
    if (!purchase) return;

    const confirmed = window.confirm(
      `Alış #${purchase.purchase_number} iptal edilecek.\n\n` +
        "Bu işlem:\n" +
        "• Alıştaki ürünlerin stoklarını geri düşürecek\n" +
        "• Tedarikçi cari borcunu geri alacak\n" +
        "• Alışı iptal durumuna getirecek\n\n" +
        "Devam etmek istiyor musun?"
    );

    if (!confirmed) return;

    setCancelling(true);

    const { error } = await supabase.rpc(
      "cancel_purchase_order",
      {
        p_purchase_order_id: purchase.id,
      }
    );

    if (error) {
      alert(
        `Alış iptal edilemedi:\n${error.message}`
      );
      setCancelling(false);
      return;
    }

    alert(
      `Alış #${purchase.purchase_number} başarıyla iptal edildi.`
    );

    await loadPurchase();

    setCancelling(false);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(value);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">
              Alış bilgileri yükleniyor...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!purchase) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-4xl">📦</div>

            <h1 className="mt-4 text-xl font-bold text-slate-900">
              Alış bulunamadı
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Aradığın alış kaydı bulunamadı.
            </p>

            <button
              onClick={() =>
                router.push("/alislar")
              }
              className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Alışlara Dön
            </button>
          </div>
        </div>
      </main>
    );
  }

  const totalQuantity = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity),
    0
  );

  const isCancelled =
    purchase.status === "cancelled";

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={() =>
                router.back()
              }
              className="mb-3 text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Geri Dön
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                Alış #{purchase.purchase_number}
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isCancelled
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {STATUS_LABELS[purchase.status] ||
                  purchase.status}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {formatDate(purchase.created_at)}
            </p>
          </div>

          {!isCancelled && (
            <button
              onClick={cancelPurchase}
              disabled={cancelling}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling
                ? "İptal Ediliyor..."
                : "❌ Alışı İptal Et"}
            </button>
          )}
        </div>

        {/* CANCELLED WARNING */}
        {isCancelled && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <div className="text-xl">
                ⚠️
              </div>

              <div>
                <h2 className="font-semibold text-red-800">
                  Bu alış iptal edilmiştir.
                </h2>

                <p className="mt-1 text-sm text-red-700">
                  Alışın stok ve tedarikçi cari
                  kayıtları geri alınmıştır.
                </p>

                <p className="mt-1 text-sm font-medium text-red-700">
                  İptal edilen alış tekrar aktif
                  duruma getirilemez.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUPPLIER INFO */}
        <div className="grid gap-6 lg:grid-cols-3">

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tedarikçi
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {supplier?.company_name ||
                    "Tedarikçi bulunamadı"}
                </h2>
              </div>

              {supplier && (
                <button
                  onClick={() =>
                    router.push(
                      `/tedarikciler/${supplier.id}`
                    )
                  }
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Tedarikçiyi Gör
                </button>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">
                  Yetkili
                </p>
                <p className="mt-1 font-medium text-slate-800">
                  {supplier?.contact_name ||
                    "Belirtilmemiş"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">
                  Telefon
                </p>
                <p className="mt-1 font-medium text-slate-800">
                  {supplier?.phone ||
                    "Belirtilmemiş"}
                </p>
              </div>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
            <p className="text-sm text-slate-300">
              Alış Özeti
            </p>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Ürün Çeşidi
                </span>

                <span className="font-semibold">
                  {items.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Toplam Miktar
                </span>

                <span className="font-semibold">
                  {totalQuantity}
                </span>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm text-slate-300">
                  Genel Toplam
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {formatCurrency(
                    Number(purchase.total)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PRODUCTS */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Alış Kalemleri
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Bu alışta tedarikçiden alınan ürünler.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-4">
                    Ürün
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
                      {item.barcode || "-"}
                    </td>

                    <td className="px-6 py-4 text-right font-medium text-slate-800">
                      {Number(item.quantity)}
                    </td>

                    <td className="px-6 py-4 text-right text-slate-700">
                      {formatCurrency(
                        Number(item.unit_price)
                      )}
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatCurrency(
                        Number(item.total_price)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-slate-50">
                  <td
                    colSpan={4}
                    className="px-6 py-5 text-right font-semibold text-slate-700"
                  >
                    Genel Toplam
                  </td>

                  <td className="px-6 py-5 text-right text-lg font-bold text-slate-900">
                    {formatCurrency(
                      Number(purchase.total)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* NOTE */}
        {purchase.notes && (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">
              📝 Alış Notu
            </h2>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {purchase.notes}
            </p>
          </div>
        )}

      </div>
    </main>
  );
}

