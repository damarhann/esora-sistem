"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type OrderStatus =
  | "new"
  | "preparing"
  | "shipped"
  | "completed"
  | "cancelled";

type Order = {
  id: string;
  order_number: number;
  customer_id: string;
  status: OrderStatus;
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
  value: OrderStatus;
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

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "preparing",
  preparing: "shipped",
  shipped: "completed",
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    void loadOrder();
  }, [orderId]);

  async function loadOrder() {
    setLoading(true);

    try {
      const {
        data: orderData,
        error: orderError,
      } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_id, status, subtotal, total, notes, created_at"
        )
        .eq("id", orderId)
        .single();

      if (orderError) {
        console.error("Sipariş yükleme hatası:", orderError);
        alert(`Sipariş bulunamadı.\n\n${orderError.message}`);
        return;
      }

      if (!orderData) {
        alert("Sipariş bulunamadı.");
        return;
      }

      const typedOrder = orderData as Order;

      setOrder(typedOrder);

      const {
        data: customerData,
        error: customerError,
      } = await supabase
        .from("customers")
        .select(
          "company_name, contact_name, phone, city, district, address"
        )
        .eq("id", typedOrder.customer_id)
        .single();

      if (customerError) {
        console.error(
          "Müşteri bilgisi yükleme hatası:",
          customerError
        );
      }

      setCustomer(customerData as Customer | null);

      const {
        data: itemsData,
        error: itemsError,
      } = await supabase
        .from("order_items")
        .select(
          "id, product_id, product_name, barcode, quantity, unit_price, total_price"
        )
        .eq("order_id", orderId)
        .order("created_at", {
          ascending: true,
        });

      if (itemsError) {
        console.error(
          "Sipariş ürünleri yükleme hatası:",
          itemsError
        );

        alert(
          `Sipariş ürünleri yüklenemedi.\n\n${itemsError.message}`
        );

        setItems([]);
      } else {
        setItems((itemsData || []) as OrderItem[]);
      }
    } catch (error) {
      console.error("Sipariş detayında beklenmeyen hata:", error);

      alert("Sipariş detayları yüklenirken beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
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

    try {
      const { error } = await supabase.rpc("cancel_order", {
        p_order_id: order.id,
      });

      if (error) {
        console.error("Sipariş iptal hatası:", error);

        alert(
          `Sipariş iptal edilemedi.\n\n${error.message}`
        );

        return;
      }

      setOrder((currentOrder) => {
        if (!currentOrder) {
          return currentOrder;
        }

        return {
          ...currentOrder,
          status: "cancelled",
        };
      });

      alert(
        `Sipariş #${order.order_number} başarıyla iptal edildi.\n\n` +
          "Stok geri eklendi ve cari kayıt geri alındı."
      );
    } catch (error) {
      console.error(
        "Sipariş iptalinde beklenmeyen hata:",
        error
      );

      alert(
        "Sipariş iptal edilirken beklenmeyen bir hata oluştu."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function updateStatus(newStatus: OrderStatus) {
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

    const expectedNextStatus = NEXT_STATUS[order.status];

    if (newStatus !== expectedNextStatus) {
      if (expectedNextStatus) {
        alert(
          `Bu sipariş için sıradaki durum "${getStatusText(
            expectedNextStatus
          )}" olmalıdır.`
        );
      } else {
        alert(
          "Bu sipariş için başka bir aktif durum bulunmuyor."
        );
      }

      return;
    }

    setUpdatingStatus(true);

    try {
      const { error } = await supabase.rpc(
        "update_order_status",
        {
          p_order_id: order.id,
          p_new_status: newStatus,
        }
      );

      if (error) {
        console.error(
          "Sipariş durumu güncelleme hatası:",
          error
        );

        alert(
          `Sipariş durumu güncellenemedi.\n\n${error.message}`
        );

        return;
      }

      setOrder((currentOrder) => {
        if (!currentOrder) {
          return currentOrder;
        }

        return {
          ...currentOrder,
          status: newStatus,
        };
      });
    } catch (error) {
      console.error(
        "Sipariş durumu güncellemesinde beklenmeyen hata:",
        error
      );

      alert(
        "Sipariş durumu güncellenirken beklenmeyen bir hata oluştu."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  function formatPrice(value: number | null | undefined) {
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

  function getStatusText(status: OrderStatus) {
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

  function getStatusClass(status: OrderStatus) {
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

  function isStatusButtonDisabled(
    status: StatusOption
  ) {
    if (!order) {
      return true;
    }

    if (updatingStatus) {
      return true;
    }

    if (order.status === "cancelled") {
      return true;
    }

    if (status.value === order.status) {
      return true;
    }

    if (status.value === "cancelled") {
      return false;
    }

    return NEXT_STATUS[order.status] !== status.value;
  }

  function getStatusButtonClass(
    status: StatusOption
  ) {
    if (!order) {
      return "";
    }

    const isCurrent = order.status === status.value;
    const isCancelled = order.status === "cancelled";
    const isNext =
      NEXT_STATUS[order.status] === status.value;

    if (isCurrent) {
      return "border-slate-900 bg-slate-900 text-white";
    }

    if (isCancelled) {
      return "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400";
    }

    if (status.value === "cancelled") {
      return "border-red-200 bg-white text-red-600 hover:bg-red-50";
    }

    if (isNext) {
      return "border-slate-300 bg-white text-slate-700 hover:border-slate-900 hover:bg-slate-50";
    }

    return "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400";
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
              const disabled =
                isStatusButtonDisabled(status);

              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() =>
                    void updateStatus(status.value)
                  }
                  disabled={disabled}
                  className={`rounded-xl border p-4 text-center transition ${getStatusButtonClass(
                    status
                  )} disabled:opacity-70`}
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

          {/* DURUM BİLGİSİ */}
          {!isCancelled && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {NEXT_STATUS[order.status] ? (
                <>
                  Sıradaki durum:{" "}
                  <strong className="text-slate-900">
                    {getStatusText(
                      NEXT_STATUS[order.status]!
                    )}
                  </strong>
                </>
              ) : (
                "Bu sipariş tamamlanmıştır."
              )}
            </div>
          )}

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
