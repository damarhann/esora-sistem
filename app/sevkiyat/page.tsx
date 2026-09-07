"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type OrderStatus = "new" | "preparing" | "shipped" | "completed" | "cancelled";

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
};

type Order = {
  id: string;
  order_number: number;
  status: OrderStatus;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
  customer_id: string;
  customer: Customer | null;
};

type OrderItem = {
  order_id: string;
  quantity: number;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Yeni",
  preparing: "Hazırlanıyor",
  shipped: "Sevk Edildi",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SevkiyatPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const [ordersResult, itemsResult] = await Promise.all([
      supabase
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          subtotal,
          total,
          notes,
          created_at,
          customer_id,
          customer:customers (
            id,
            company_name,
            contact_name,
            phone,
            city,
            district,
            address
          )
        `)
        .in("status", ["preparing", "shipped", "completed"])
        .order("created_at", { ascending: false }),

      supabase
        .from("order_items")
        .select("order_id, quantity"),
    ]);

    if (ordersResult.error) {
      setError(ordersResult.error.message);
      setLoading(false);
      return;
    }

    if (itemsResult.error) {
      setError(itemsResult.error.message);
      setLoading(false);
      return;
    }

    const normalizedOrders = (ordersResult.data || []).map((order: any) => ({
      ...order,
      customer: Array.isArray(order.customer)
        ? order.customer[0] || null
        : order.customer || null,
    })) as Order[];

    setOrders(normalizedOrders);
    setItems((itemsResult.data || []) as OrderItem[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function getItemCount(orderId: string) {
    return items
      .filter((item) => item.order_id === orderId)
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  async function updateOrderStatus(
    order: Order,
    newStatus: OrderStatus
  ) {
    if (order.status === newStatus) return;

    if (order.status === "completed") {
      return;
    }

    if (order.status === "cancelled") {
      return;
    }

    setUpdatingOrderId(order.id);
    setError("");

    const { error: updateError } = await supabase.rpc(
  "update_order_status",
  {
    p_order_id: order.id,
    p_new_status: newStatus,
  }
);

    if (updateError) {
      setError(updateError.message);
      setUpdatingOrderId(null);
      return;
    }

    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? { ...item, status: newStatus }
          : item
      )
    );

    setUpdatingOrderId(null);
  }

  const preparingOrders = useMemo(
    () => orders.filter((order) => order.status === "preparing"),
    [orders]
  );

  const shippedOrders = useMemo(
    () => orders.filter((order) => order.status === "shipped"),
    [orders]
  );

  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === "completed"),
    [orders]
  );

  const totalValue = useMemo(
    () =>
      orders
        .filter((order) => order.status !== "completed")
        .reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orders]
  );

  function OrderCard({ order }: { order: Order }) {
    const customer = order.customer;
    const itemCount = getItemCount(order.id);
    const isUpdating = updatingOrderId === order.id;

    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/siparis-gecmisi/${order.id}`}
              className="text-lg font-bold text-gray-900 hover:underline"
            >
              Sipariş #{order.order_number}
            </Link>

            <p className="mt-1 text-sm text-gray-500">
              {formatDate(order.created_at)}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              order.status === "preparing"
                ? "bg-yellow-100 text-yellow-800"
                : order.status === "shipped"
                ? "bg-blue-100 text-blue-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {STATUS_LABELS[order.status]}
          </span>
        </div>

        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="font-semibold text-gray-900">
            {customer?.company_name || "Müşteri bulunamadı"}
          </p>

          {customer?.contact_name && (
            <p className="mt-1 text-sm text-gray-600">
              {customer.contact_name}
            </p>
          )}

          {customer?.phone && (
            <p className="mt-2 text-sm text-gray-600">
              📞 {customer.phone}
            </p>
          )}

          {(customer?.address ||
            customer?.district ||
            customer?.city) && (
            <p className="mt-2 text-sm leading-5 text-gray-600">
              📍{" "}
              {[customer.address, customer.district, customer.city]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Ürün Adedi</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {itemCount}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Sipariş Tutarı</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {formatMoney(Number(order.total || 0))}
            </p>
          </div>
        </div>

        {order.notes && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-500">Not</p>
            <p className="mt-1 text-sm text-gray-700">{order.notes}</p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {order.status === "preparing" && (
            <button
              onClick={() => updateOrderStatus(order, "shipped")}
              disabled={isUpdating}
              className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating ? "Güncelleniyor..." : "🚚 Sevke Çıkar"}
            </button>
          )}

          {order.status === "shipped" && (
            <button
              onClick={() => updateOrderStatus(order, "completed")}
              disabled={isUpdating}
              className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating ? "Güncelleniyor..." : "✅ Teslim Edildi"}
            </button>
          )}

          <Link
            href={`/siparis-gecmisi/${order.id}`}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Detay
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Sevkiyat
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Hazırlanan ve sevk edilen siparişleri buradan takip et.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              🔄 Yenile
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Hata:</strong> {error}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Hazırlanıyor</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {preparingOrders.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Sevk Edildi</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {shippedOrders.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Tamamlandı</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {completedOrders.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Açık Sevkiyat Tutarı
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatMoney(totalValue)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500">
            Sevkiyatlar yükleniyor...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="text-4xl">🚚</div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">
              Bekleyen sevkiyat yok
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Hazırlanan veya sevk edilen siparişler burada görünecek.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {preparingOrders.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      ⚙️ Hazırlanıyor
                    </h2>
                    <p className="text-sm text-gray-500">
                      Sevke hazırlanması gereken siparişler.
                    </p>
                  </div>

                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
                    {preparingOrders.length} sipariş
                  </span>
                </div>

                <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {preparingOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              </section>
            )}

            {shippedOrders.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      🚚 Sevk Edildi
                    </h2>
                    <p className="text-sm text-gray-500">
                      Teslimatı bekleyen siparişler.
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                    {shippedOrders.length} sipariş
                  </span>
                </div>

                <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {shippedOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              </section>
            )}

            {completedOrders.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      ✅ Tamamlandı
                    </h2>
                    <p className="text-sm text-gray-500">
                      Teslim edilmiş son siparişler.
                    </p>
                  </div>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                    {completedOrders.length} sipariş
                  </span>
                </div>

                <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {completedOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

