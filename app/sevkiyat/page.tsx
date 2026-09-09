"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type OrderStatus =
  | "new"
  | "preparing"
  | "shipped"
  | "completed"
  | "cancelled";

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

type FilterStatus =
  | "all"
  | "preparing"
  | "shipped"
  | "completed";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Yeni",
  preparing: "Hazırlanıyor",
  shipped: "Sevk Edildi",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  preparing: "bg-amber-100 text-amber-800",
  shipped: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeCustomer(value: unknown): Customer | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;

  return {
    id: String(raw.id ?? ""),
    company_name: String(raw.company_name ?? ""),
    contact_name:
      raw.contact_name === null || raw.contact_name === undefined
        ? null
        : String(raw.contact_name),
    phone:
      raw.phone === null || raw.phone === undefined
        ? null
        : String(raw.phone),
    city:
      raw.city === null || raw.city === undefined
        ? null
        : String(raw.city),
    district:
      raw.district === null || raw.district === undefined
        ? null
        : String(raw.district),
    address:
      raw.address === null || raw.address === undefined
        ? null
        : String(raw.address),
  };
}

function normalizeOrders(value: unknown): Order[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const raw =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : {};

    const status = String(raw.status ?? "new") as OrderStatus;

    return {
      id: String(raw.id ?? ""),
      order_number: Number(raw.order_number ?? 0),
      status,
      subtotal: Number(raw.subtotal ?? 0),
      total: Number(raw.total ?? 0),
      notes:
        raw.notes === null || raw.notes === undefined
          ? null
          : String(raw.notes),
      created_at: String(raw.created_at ?? ""),
      customer_id: String(raw.customer_id ?? ""),
      customer: normalizeCustomer(raw.customer),
    };
  });
}

function normalizeItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const raw =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : {};

    return {
      order_id: String(raw.order_id ?? ""),
      quantity: Number(raw.quantity ?? 0),
    };
  });
}

function SummaryCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string;
  icon: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {value}
          </p>

          {description ? (
            <p className="mt-2 text-xs text-slate-400">
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  searchActive,
}: {
  searchActive: boolean;
}) {
  if (searchActive) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <div className="text-4xl">🔎</div>

        <h2 className="mt-4 text-xl font-bold text-slate-900">
          Sonuç bulunamadı
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Arama kriterlerini veya seçtiğin durum filtresini
          değiştirerek tekrar deneyebilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="text-4xl">🚚</div>

      <h2 className="mt-4 text-xl font-bold text-slate-900">
        Sevkiyat bulunmuyor
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Hazırlanan veya sevk edilen siparişler burada görünecek.
      </p>

      <Link
        href="/siparisler"
        className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Siparişlere Git
      </Link>
    </div>
  );
}

export default function SevkiyatPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] =
    useState<FilterStatus>("all");

  const requestIdRef = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current;

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

    if (requestId !== requestIdRef.current) {
      return;
    }

    if (ordersResult.error) {
      setError(
        ordersResult.error.message ||
          "Siparişler yüklenirken bir hata oluştu."
      );
      setLoading(false);
      return;
    }

    if (itemsResult.error) {
      setError(
        itemsResult.error.message ||
          "Sipariş ürünleri yüklenirken bir hata oluştu."
      );
      setLoading(false);
      return;
    }

    setOrders(normalizeOrders(ordersResult.data));
    setItems(normalizeItems(itemsResult.data));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of items) {
      const current = counts.get(item.order_id) ?? 0;

      counts.set(
        item.order_id,
        current + Number(item.quantity || 0)
      );
    }

    return counts;
  }, [items]);

  const filteredOrders = useMemo(() => {
    const searchTerm = search.trim().toLocaleLowerCase("tr-TR");

    return orders.filter((order) => {
      if (
        filterStatus !== "all" &&
        order.status !== filterStatus
      ) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const searchableText = [
        String(order.order_number),
        order.customer?.company_name || "",
        order.customer?.contact_name || "",
        order.customer?.phone || "",
        order.customer?.city || "",
        order.customer?.district || "",
        order.customer?.address || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return searchableText.includes(searchTerm);
    });
  }, [orders, search, filterStatus]);

  const preparingOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => order.status === "preparing"
      ),
    [filteredOrders]
  );

  const shippedOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => order.status === "shipped"
      ),
    [filteredOrders]
  );

  const completedOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => order.status === "completed"
      ),
    [filteredOrders]
  );

  const preparingCount = useMemo(
    () => orders.filter((order) => order.status === "preparing").length,
    [orders]
  );

  const shippedCount = useMemo(
    () => orders.filter((order) => order.status === "shipped").length,
    [orders]
  );

  const completedCount = useMemo(
    () => orders.filter((order) => order.status === "completed").length,
    [orders]
  );

  const openOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === "preparing" ||
          order.status === "shipped"
      ),
    [orders]
  );

  const openValue = useMemo(
    () =>
      openOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      ),
    [openOrders]
  );

  const visibleOpenValue = useMemo(
    () =>
      filteredOrders
        .filter(
          (order) =>
            order.status === "preparing" ||
            order.status === "shipped"
        )
        .reduce(
          (sum, order) => sum + Number(order.total || 0),
          0
        ),
    [filteredOrders]
  );

  async function updateOrderStatus(
    order: Order,
    newStatus: OrderStatus
  ) {
    if (order.status === newStatus) {
      return;
    }

    if (order.status === "completed") {
      return;
    }

    if (order.status === "cancelled") {
      return;
    }

    const validTransition =
      (order.status === "preparing" &&
        newStatus === "shipped") ||
      (order.status === "shipped" &&
        newStatus === "completed");

    if (!validTransition) {
      setError(
        "Bu sipariş için geçersiz bir sevkiyat durum değişikliği."
      );
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
      setError(
        updateError.message ||
          "Sipariş durumu güncellenirken bir hata oluştu."
      );
      setUpdatingOrderId(null);
      return;
    }

    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status: newStatus,
            }
          : item
      )
    );

    setUpdatingOrderId(null);
  }

  function clearFilters() {
    setSearch("");
    setFilterStatus("all");
  }

  function getItemCount(orderId: string) {
    return itemCounts.get(orderId) ?? 0;
  }

  function OrderCard({ order }: { order: Order }) {
    const customer = order.customer;
    const itemCount = getItemCount(order.id);
    const isUpdating = updatingOrderId === order.id;

    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        {/* TOP */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/siparis-gecmisi/${order.id}`}
              className="inline-flex max-w-full items-center gap-2 text-lg font-bold text-slate-950 transition hover:text-slate-600 hover:underline"
            >
              <span className="truncate">
                Sipariş #{order.order_number}
              </span>
            </Link>

            <p className="mt-1 text-xs text-slate-400">
              {formatDate(order.created_at)}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              STATUS_STYLES[order.status]
            }`}
          >
            {STATUS_LABELS[order.status]}
          </span>
        </div>

        {/* CUSTOMER */}
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
              🏢
            </div>

            <div className="min-w-0">
              <p className="truncate font-bold text-slate-900">
                {customer?.company_name || "Müşteri bulunamadı"}
              </p>

              {customer?.contact_name ? (
                <p className="mt-1 truncate text-sm text-slate-600">
                  {customer.contact_name}
                </p>
              ) : null}
            </div>
          </div>

          {customer?.phone ? (
            <a
              href={`tel:${customer.phone}`}
              className="mt-3 block text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              📞 {customer.phone}
            </a>
          ) : null}

          {customer?.address ||
          customer?.district ||
          customer?.city ? (
            <p className="mt-2 text-sm leading-5 text-slate-600">
              📍{" "}
              {[
                customer.address,
                customer.district,
                customer.city,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : null}
        </div>

        {/* ORDER INFO */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 bg-white p-3">
            <p className="text-xs font-medium text-slate-400">
              Ürün Adedi
            </p>

            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatNumber(itemCount)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-3">
            <p className="text-xs font-medium text-slate-400">
              Sipariş Tutarı
            </p>

            <p className="mt-1 truncate text-lg font-bold text-slate-900">
              {formatMoney(Number(order.total || 0))}
            </p>
          </div>
        </div>

        {/* NOTE */}
        {order.notes ? (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-700">
              Sipariş Notu
            </p>

            <p className="mt-1 text-sm leading-5 text-amber-900">
              {order.notes}
            </p>
          </div>
        ) : null}

        {/* ACTIONS */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {order.status === "preparing" ? (
            <button
              type="button"
              onClick={() =>
                void updateOrderStatus(order, "shipped")
              }
              disabled={isUpdating}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating
                ? "Güncelleniyor..."
                : "🚚 Sevke Çıkar"}
            </button>
          ) : null}

          {order.status === "shipped" ? (
            <button
              type="button"
              onClick={() =>
                void updateOrderStatus(order, "completed")
              }
              disabled={isUpdating}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating
                ? "Güncelleniyor..."
                : "✅ Teslim Edildi"}
            </button>
          ) : null}

          <Link
            href={`/siparis-gecmisi/${order.id}`}
            className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Detay
          </Link>
        </div>
      </article>
    );
  }

  function Section({
    title,
    description,
    icon,
    count,
    badgeClass,
    sectionOrders,
  }: {
    title: string;
    description: string;
    icon: string;
    count: number;
    badgeClass: string;
    sectionOrders: Order[];
  }) {
    if (sectionOrders.length === 0) {
      return null;
    }

    return (
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-950">
              <span>{icon}</span>
              <span>{title}</span>
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          </div>

          <span
            className={`self-start rounded-full px-3 py-1 text-sm font-bold sm:self-auto ${badgeClass}`}
          >
            {count} sipariş
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {sectionOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      </section>
    );
  }

  const hasActiveFilters =
    search.trim().length > 0 || filterStatus !== "all";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link
                href="/"
                className="transition hover:text-slate-900"
              >
                Ana Sayfa
              </Link>

              <span>›</span>

              <span className="font-medium text-slate-700">
                Sevkiyat
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Sevkiyat
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Hazırlanan, sevk edilen ve teslim edilen siparişleri
              takip et.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Yenileniyor..." : "↻ Yenile"}
          </button>
        </div>

        {/* ERROR */}
        {error ? (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-red-800">
                Bir sorun oluştu
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800"
            >
              Tekrar Dene
            </button>
          </div>
        ) : null}

        {/* SUMMARY */}
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Hazırlanıyor"
            value={formatNumber(preparingCount)}
            icon="⚙️"
            description="Sevke hazır olması gerekenler"
          />

          <SummaryCard
            title="Sevk Edildi"
            value={formatNumber(shippedCount)}
            icon="🚚"
            description="Teslimatı bekleyenler"
          />

          <SummaryCard
            title="Tamamlandı"
            value={formatNumber(completedCount)}
            icon="✅"
            description="Teslim edilen siparişler"
          />

          <SummaryCard
            title="Açık Sevkiyat"
            value={formatMoney(openValue)}
            icon="💰"
            description={`${openOrders.length} açık sipariş`}
          />
        </div>

        {/* FILTER */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                🔎
              </span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Sipariş no, müşteri, telefon, şehir ara..."
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Tümü"],
                ["preparing", "Hazırlanıyor"],
                ["shipped", "Sevk Edildi"],
                ["completed", "Tamamlandı"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFilterStatus(value as FilterStatus)
                  }
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    filterStatus === value
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
                >
                  Filtreleri Temizle
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-1 border-t border-slate-100 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-slate-500">
                Gösterilen sipariş
              </span>

              <span className="font-bold text-slate-900">
                {filteredOrders.length} / {orders.length}
              </span>
            </div>
          </div>
        </section>

        {/* LOADING */}
        {loading && orders.length === 0 ? (
          <div className="space-y-4">
            <div className="h-2 animate-pulse rounded-full bg-slate-200" />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-80 animate-pulse rounded-2xl bg-slate-200"
                />
              ))}
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState searchActive={hasActiveFilters} />
        ) : (
          <div className="space-y-10">
            <Section
              title="Hazırlanıyor"
              description="Sevke hazırlanması gereken siparişler."
              icon="⚙️"
              count={preparingOrders.length}
              badgeClass="bg-amber-100 text-amber-800"
              sectionOrders={preparingOrders}
            />

            <Section
              title="Sevk Edildi"
              description="Teslimatı bekleyen siparişler."
              icon="🚚"
              count={shippedOrders.length}
              badgeClass="bg-blue-100 text-blue-800"
              sectionOrders={shippedOrders}
            />

            <Section
              title="Tamamlandı"
              description="Teslim edilmiş siparişler."
              icon="✅"
              count={completedOrders.length}
              badgeClass="bg-emerald-100 text-emerald-800"
              sectionOrders={completedOrders}
            />
          </div>
        )}

        {/* FILTERED OPEN VALUE */}
        {hasActiveFilters && filteredOrders.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-slate-900">
                  Filtrelenen Açık Sevkiyat
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Hazırlanıyor ve sevk edilmiş siparişlerin toplamı
                </p>
              </div>

              <p className="text-xl font-bold text-slate-950">
                {formatMoney(visibleOpenValue)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="h-8" />
      </div>
    </main>
  );
}