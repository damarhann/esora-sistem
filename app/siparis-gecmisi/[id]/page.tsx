
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Order = {
  id: string;
  order_number: number;
  customer_id: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
};

type Customer = {
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
};

type OrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  barcode: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type StatusOption = {
  value: string;
  label: string;
  icon: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "new",
    label: "Yeni",
    icon: "🆕",
  },
  {
    value: "preparing",
    label: "Hazırlanıyor",
    icon: "⚙️",
  },
  {
    value: "shipped",
    label: "Sevk Edildi",
    icon: "🚚",
  },
  {
    value: "completed",
    label: "Tamamlandı",
    icon: "✅",
  },
  {
    value: "cancelled",
    label: "İptal",
    icon: "❌",
  },
];

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  async function loadOrder() {
    setLoading(true);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError) {
      console.error(orderError);
      alert("Sipariş bulunamadı.");
      setLoading(false);
      return;
    }

    setOrder(orderData);

    const { data: customerData, error: customerError } =
      await supabase
        .from("customers")
        .select(
          "company_name, contact_name, phone, city, district, address"
        )
        .eq("id", orderData.customer_id)
        .single();

    if (customerError) {
      console.error(customerError);
    }

    setCustomer(customerData);

    const { data: itemsData, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", {
        ascending: true,
      });

    if (itemsError) {
      console.error(itemsError);
      alert("Sipariş ürünleri yüklenemedi.");
    }

    setItems(itemsData || []);

    setLoading(false);
  }

  async function cancelOrder() {
    if (!order) {
      return;
    }

    if (order.status === "cancelled") {
      alert("Bu sipariş zaten iptal edilmiş.");
      return;
    }

    const confirmed = window.confirm(
      `Sipariş #${order.order_number} iptal edilecek.\n\n` +
        "• Siparişteki ürünler stoğa geri eklenecek.\n" +
        "• Cari borç kaydı geri alınacak.\n" +
        "• Bu işlem geri alınamaz.\n\n" +
        "Siparişi iptal etmek istediğine emin misin?"
    );

    if (!confirmed) {
      return;
    }

    setUpdatingStatus(true);

    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: order.id,
    });

    if (error) {
      console.error(error);

      setUpdatingStatus(false);

      alert(
        `Sipariş iptal edilemedi.\n\n${error.message}`
      );

      return;
    }

    setOrder({
      ...order,
      status: "cancelled",
    });

    setUpdatingStatus(false);

    alert(
      `Sipariş #${order.order_number} başarıyla iptal edildi.\n\n` +
        "Stok geri eklendi ve cari kayıt geri alındı."
    );
  }

  async function updateStatus(newStatus: string) {
    if (!order) {
      return;
    }

    if (newStatus === order.status) {
      return;
    }

    if (order.status === "cancelled") {
      alert(
        "İptal edilmiş sipariş tekrar aktif duruma getirilemez."
      );

      return;
    }

    if (newStatus === "cancelled") {
      await cancelOrder();
      return;
    }

    setUpdatingStatus(true);

    const { error } = await supabase.rpc(
  "update_order_status",
  {
    p_order_id: order.id,
    p_new_status: newStatus,
  }
);

    setUpdatingStatus(false);

    if (error) {
      console.error(error);

      alert(
        `Sipariş durumu güncellenemedi.\n\n${error.message}`
      );

      return;
    }

    setOrder({
      ...order,
      status: newStatus,
    });
  }

  function formatPrice(value: number) {
    return Number(value || 0).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusText(status: string) {
    switch (status) {
      case "new":
        return "Yeni";

      case "preparing":
        return "Hazırlanıyor";

      case "shipped":
        return "Sevk Edildi";

      case "completed":
        return "Tamamlandı";

      case "cancelled":
        return "İptal";

      default:
        return status;
    }
  }

  function getStatusClass(status: string) {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-700";

      case "preparing":
        return "bg-yellow-100 text-yellow-700";

      case "shipped":
        return "bg-purple-100 text-purple-700";

      case "completed":
        return "bg-green-100 text-green-700";

      case "cancelled":
        return "bg-red-100 text-red-700";

      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-10">
        <p className="text-slate-500">
          Sipariş detayları yükleniyor...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 p-10">
        <p className="text-red-500">
          Sipariş bulunamadı.
        </p>

        <Link
          href="/siparis-gecmisi"
          className="mt-4 inline-block text-sm font-semibold text-slate-700 underline"
        >
          Siparişlere dön
        </Link>
      </div>
    );
  }

  const isCancelled = order.status === "cancelled";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* ÜST BAŞLIK */}
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

          <div>
            <Link
              href="/siparis-gecmisi"
              className="mb-3 inline-block text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Siparişlere Dön
            </Link>

            <h1 className="text-3xl font-bold text-slate-900">
              Sipariş #{order.order_number}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {formatDate(order.created_at)}
            </p>
          </div>

          {/* MEVCUT DURUM */}
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusClass(
                order.status
              )}`}
            >
              {getStatusText(order.status)}
            </div>

            {updatingStatus && (
              <span className="text-xs text-slate-500">
                Güncelleniyor...
              </span>
            )}
          </div>

        </div>

        {/* SİPARİŞ DURUMU */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <h2 className="mb-5 text-lg font-bold text-slate-900">
            Sipariş Durumu
          </h2>

          <div className="grid gap-3 md:grid-cols-5">

            {STATUS_OPTIONS.map((status) => {
              const isCurrent =
                order.status === status.value;

              const disabled =
                updatingStatus ||
                isCancelled ||
                isCurrent;

              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() =>
                    updateStatus(status.value)
                  }
                  disabled={disabled}
                  className={`rounded-xl border p-4 text-center transition ${
                    isCurrent
                      ? "border-slate-900 bg-slate-900 text-white"
                      : isCancelled
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  } disabled:opacity-70`}
                >
                  <div className="text-xl">
                    {status.icon}
                  </div>

                  <div className="mt-2 text-sm font-semibold">
                    {status.label}
                  </div>
                </button>
              );
            })}

          </div>

          {/* İPTAL UYARISI */}
          {isCancelled && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong>
                Bu sipariş iptal edilmiştir.
              </strong>

              <br />

              Siparişin stok ve cari kayıtları geri
              alınmıştır.

              <br />

              İptal edilen sipariş tekrar aktif duruma
              getirilemez.
            </div>
          )}

        </div>

        {/* MÜŞTERİ BİLGİLERİ */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <h2 className="mb-5 text-lg font-bold text-slate-900">
            Müşteri Bilgileri
          </h2>

          {customer ? (
            <div className="grid gap-5 md:grid-cols-2">

              {/* FİRMA */}
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Firma
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {customer.company_name}
                </p>
              </div>

              {/* YETKİLİ */}
              {customer.contact_name && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Yetkili
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {customer.contact_name}
                  </p>
                </div>
              )}

              {/* TELEFON */}
              {customer.phone && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Telefon
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {customer.phone}
                  </p>
                </div>
              )}

              {/* BÖLGE */}
              {(customer.city || customer.district) && (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Bölge
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {customer.city || ""}

                    {customer.city &&
                    customer.district
                      ? " / "
                      : ""}

                    {customer.district || ""}
                  </p>
                </div>
              )}

              {/* ADRES */}
              {customer.address && (
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Adres
                  </p>

                  <p className="mt-1 text-slate-700">
                    {customer.address}
                  </p>
                </div>
              )}

            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Müşteri bilgisi bulunamadı.
            </p>
          )}

        </div>

        {/* ÜRÜNLER */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-900">
              Sipariş Ürünleri
            </h2>
          </div>

          {items.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              Siparişte ürün bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                      Ürün
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Birim Fiyat
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Miktar
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Toplam
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {items.map((item) => (
                    <tr key={item.id}>

                      <td className="px-6 py-5">

                        <div className="font-semibold text-slate-900">
                          {item.product_name}
                        </div>

                        {item.barcode && (
                          <div className="mt-1 text-xs text-slate-400">
                            Barkod: {item.barcode}
                          </div>
                        )}

                      </td>

                      <td className="px-6 py-5 text-right">
                        {formatPrice(
                          Number(item.unit_price)
                        )}{" "}
                        ₺
                      </td>

                      <td className="px-6 py-5 text-right font-semibold">
                        {item.quantity}
                      </td>

                      <td className="px-6 py-5 text-right font-bold">
                        {formatPrice(
                          Number(item.total_price)
                        )}{" "}
                        ₺
                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>
          )}

          {/* TOPLAM */}
          <div className="border-t border-slate-200 p-6">

            <div className="ml-auto max-w-sm space-y-3">

              {/* ARA TOPLAM */}
              <div className="flex justify-between text-sm">

                <span className="text-slate-500">
                  Ara Toplam
                </span>

                <span className="font-semibold text-slate-900">
                  {formatPrice(
                    Number(order.subtotal)
                  )}{" "}
                  ₺
                </span>

              </div>

              {/* GENEL TOPLAM */}
              <div className="flex justify-between border-t border-slate-200 pt-3">

                <span className="text-lg font-bold text-slate-900">
                  Genel Toplam
                </span>

                <span className="text-2xl font-bold text-slate-900">
                  {formatPrice(
                    Number(order.total)
                  )}{" "}
                  ₺
                </span>

              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

