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

type CustomerRelation =
  | {
      company_name: string;
      contact_name: string | null;
    }
  | {
      company_name: string;
      contact_name: string | null;
    }[]
  | null;

type Order = {
  id: string;
  order_number: number;
  customer_id: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
  customers: CustomerRelation;
};

type FilterStatus = "all" | OrderStatus;

const STATUS_OPTIONS: {
  value: FilterStatus;
  label: string;
}[] = [
  { value: "all", label: "Tümü" },
  { value: "new", label: "Yeni" },
  { value: "preparing", label: "Hazırlanıyor" },
  { value: "shipped", label: "Sevk Edildi" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal" },
];

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getCustomer(order: Order) {
  if (!order.customers) {
    return null;
  }

  if (Array.isArray(order.customers)) {
    return order.customers[0] ?? null;
  }

  return order.customers;
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
      return "Bilinmiyor";
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-700";

    case "preparing":
      return "bg-amber-100 text-amber-800";

    case "shipped":
      return "bg-purple-100 text-purple-700";

    case "completed":
      return "bg-emerald-100 text-emerald-700";

    case "cancelled":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "new":
      return "🆕";

    case "preparing":
      return "⚙️";

    case "shipped":
      return "🚚";

    case "completed":
      return "✅";

    case "cancelled":
      return "❌";

    default:
      return "•";
  }
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<FilterStatus>("all");

  const [error, setError] = useState("");

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const loadOrders = useCallback(
    async (showRefresh = false) => {
      const requestId = ++requestIdRef.current;

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const { data, error: supabaseError } =
          await supabase
            .from("orders")
            .select(`
              id,
              order_number,
              customer_id,
              status,
              subtotal,
              total,
              notes,
              created_at,
              customers (
                company_name,
                contact_name
              )
            `)
            .order("created_at", {
              ascending: false,
            });

        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }

        if (supabaseError) {
          console.error(
            "Sipariş geçmişi yükleme hatası:",
            supabaseError
          );

          setError(
            "Siparişler yüklenirken bir hata oluştu. Lütfen tekrar dene."
          );

          return;
        }

        setOrders(
          (data as unknown as Order[]) || []
        );
      } catch (loadError) {
        console.error(
          "Sipariş geçmişi beklenmeyen hata:",
          loadError
        );

        if (
          mountedRef.current &&
          requestId === requestIdRef.current
        ) {
          setError(
            "Siparişler yüklenirken beklenmeyen bir hata oluştu."
          );
        }
      } finally {
        if (
          mountedRef.current &&
          requestId === requestIdRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;

    void loadOrders();

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const cleanSearch = search
      .trim()
      .toLocaleLowerCase("tr-TR");

    return orders.filter((order) => {
      if (
        statusFilter !== "all" &&
        order.status !== statusFilter
      ) {
        return false;
      }

      if (!cleanSearch) {
        return true;
      }

      const customer = getCustomer(order);

      const searchableText = [
        order.order_number,
        customer?.company_name,
        customer?.contact_name,
        order.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return searchableText.includes(cleanSearch);
    });
  }, [orders, search, statusFilter]);

  const summary = useMemo(() => {
    let totalSales = 0;
    let completed = 0;
    let newOrders = 0;
    let preparing = 0;
    let shipped = 0;
    let cancelled = 0;

    for (const order of orders) {
      if (order.status !== "cancelled") {
        totalSales += Number(order.total) || 0;
      }

      switch (order.status) {
        case "completed":
          completed += 1;
          break;

        case "new":
          newOrders += 1;
          break;

        case "preparing":
          preparing += 1;
          break;

        case "shipped":
          shipped += 1;
          break;

        case "cancelled":
          cancelled += 1;
          break;
      }
    }

    return {
      totalOrders: orders.length,
      completed,
      newOrders,
      preparing,
      shipped,
      cancelled,
      totalSales,
    };
  }, [orders]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
  }

  const hasFilters =
    search.trim().length > 0 ||
    statusFilter !== "all";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-9 w-56 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-slate-200" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>

          <div className="mt-6 h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link
              href="/"
              className="transition hover:text-slate-900"
            >
              Ana Sayfa
            </Link>

            <span>›</span>

            <span className="font-medium text-slate-700">
              Sipariş Geçmişi
            </span>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Sipariş Geçmişi
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Oluşturulan tüm siparişleri buradan takip
                edebilirsin.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void loadOrders(true)}
                disabled={refreshing}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing
                  ? "Yenileniyor..."
                  : "↻ Yenile"}
              </button>

              <Link
                href="/siparisler"
                className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                + Yeni Sipariş
              </Link>
            </div>
          </div>
        </div>

        {/* ERROR */}
        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-red-700">
                  Siparişler yüklenemedi
                </p>

                <p className="mt-1 text-sm text-red-600">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadOrders(true)}
                disabled={refreshing}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        ) : null}

        {/* SUMMARY */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Toplam Sipariş
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-950">
              {summary.totalOrders}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Tüm kayıtlar
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Tamamlanan
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-800">
              {summary.completed}
            </p>

            <p className="mt-1 text-xs text-emerald-600">
              Teslim süreci tamamlananlar
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Net Sipariş Tutarı
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
              {formatMoney(summary.totalSales)}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              İptal edilenler hariç
            </p>
          </div>
        </div>

        {/* STATUS SUMMARY */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatusFilter("new")}
            className={`rounded-2xl border p-4 text-left transition ${
              statusFilter === "new"
                ? "border-blue-300 ring-2 ring-blue-100"
                : "border-blue-100"
            } bg-blue-50 hover:border-blue-200`}
          >
            <p className="text-sm font-medium text-blue-600">
              Yeni
            </p>

            <p className="mt-1 text-2xl font-bold text-blue-800">
              {summary.newOrders}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("preparing")}
            className={`rounded-2xl border p-4 text-left transition ${
              statusFilter === "preparing"
                ? "border-amber-300 ring-2 ring-amber-100"
                : "border-amber-100"
            } bg-amber-50 hover:border-amber-200`}
          >
            <p className="text-sm font-medium text-amber-700">
              Hazırlanıyor
            </p>

            <p className="mt-1 text-2xl font-bold text-amber-800">
              {summary.preparing}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("shipped")}
            className={`rounded-2xl border p-4 text-left transition ${
              statusFilter === "shipped"
                ? "border-purple-300 ring-2 ring-purple-100"
                : "border-purple-100"
            } bg-purple-50 hover:border-purple-200`}
          >
            <p className="text-sm font-medium text-purple-600">
              Sevk Edildi
            </p>

            <p className="mt-1 text-2xl font-bold text-purple-800">
              {summary.shipped}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("cancelled")}
            className={`rounded-2xl border p-4 text-left transition ${
              statusFilter === "cancelled"
                ? "border-red-300 ring-2 ring-red-100"
                : "border-red-100"
            } bg-red-50 hover:border-red-200`}
          >
            <p className="text-sm font-medium text-red-600">
              İptal
            </p>

            <p className="mt-1 text-2xl font-bold text-red-800">
              {summary.cancelled}
            </p>
          </button>
        </div>

        {/* FILTERS */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="order-search"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Sipariş Ara
              </label>

              <div className="relative">
                <input
                  id="order-search"
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Sipariş no, müşteri veya yetkili ara..."
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>

            <div className="lg:w-auto">
              <p className="mb-2 text-sm font-bold text-slate-700">
                Durum
              </p>

              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setStatusFilter(option.value)
                    }
                    className={`rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                      statusFilter === option.value
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 lg:self-end"
              >
                Filtreleri Temizle
              </button>
            ) : null}
          </div>
        </section>

        {/* RESULT INFO */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            <span className="font-bold text-slate-900">
              {filteredOrders.length}
            </span>{" "}
            sipariş gösteriliyor
          </p>

          {hasFilters ? (
            <p className="text-xs text-slate-400">
              Filtre uygulanıyor
            </p>
          ) : null}
        </div>

        {/* ORDERS */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {filteredOrders.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="text-4xl">
                {hasFilters ? "🔎" : "📦"}
              </div>

              <h2 className="mt-4 text-lg font-bold text-slate-900">
                {hasFilters
                  ? "Aramaya uygun sipariş bulunamadı"
                  : "Henüz sipariş bulunmuyor"}
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {hasFilters
                  ? "Arama veya durum filtresini değiştirerek tekrar deneyebilirsin."
                  : "İlk siparişini oluşturduğunda burada görünecek."}
              </p>

              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Filtreleri Temizle
                </button>
              ) : (
                <Link
                  href="/siparisler"
                  className="mt-5 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  İlk Siparişi Oluştur
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Sipariş
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Müşteri
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Tarih
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Tutar
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Durum
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        İşlem
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => {
                      const customer = getCustomer(order);

                      return (
                        <tr
                          key={order.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-5">
                            <Link
                              href={`/siparis-gecmisi/${order.id}`}
                              className="group inline-block"
                            >
                              <div className="font-bold text-slate-900 group-hover:text-slate-600">
                                #{order.order_number}
                              </div>

                              {order.notes ? (
                                <div className="mt-1 max-w-xs truncate text-xs text-slate-400">
                                  {order.notes}
                                </div>
                              ) : null}
                            </Link>
                          </td>

                          <td className="px-6 py-5">
                            <div className="font-semibold text-slate-900">
                              {customer?.company_name ||
                                "Müşteri bulunamadı"}
                            </div>

                            {customer?.contact_name ? (
                              <div className="mt-0.5 text-sm text-slate-400">
                                {customer.contact_name}
                              </div>
                            ) : null}
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-600">
                            {formatDate(order.created_at)}
                          </td>

                          <td className="px-6 py-5 text-right font-bold text-slate-900">
                            {formatMoney(order.total)}
                          </td>

                          <td className="px-6 py-5 text-right">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${getStatusClass(
                                order.status
                              )}`}
                            >
                              <span>
                                {getStatusIcon(order.status)}
                              </span>

                              <span>
                                {getStatusText(order.status)}
                              </span>
                            </span>
                          </td>

                          <td className="px-6 py-5 text-right">
                            <Link
                              href={`/siparis-gecmisi/${order.id}`}
                              className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                            >
                              Detay →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredOrders.map((order) => {
                  const customer = getCustomer(order);

                  return (
                    <Link
                      key={order.id}
                      href={`/siparis-gecmisi/${order.id}`}
                      className="block p-4 transition active:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-950">
                            #{order.order_number}
                          </p>

                          <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                            {customer?.company_name ||
                              "Müşteri bulunamadı"}
                          </p>

                          {customer?.contact_name ? (
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              {customer.contact_name}
                            </p>
                          ) : null}
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {getStatusIcon(order.status)}{" "}
                          {getStatusText(order.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[11px] font-medium text-slate-400">
                            Tarih
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-700">
                            {formatDate(order.created_at)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[11px] font-medium text-slate-400">
                            Tutar
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {formatMoney(order.total)}
                          </p>
                        </div>
                      </div>

                      {order.notes ? (
                        <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
                          <p className="text-[11px] font-medium text-slate-400">
                            Not
                          </p>

                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                            {order.notes}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-3 text-right text-xs font-bold text-slate-500">
                        Detayı Gör →
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

