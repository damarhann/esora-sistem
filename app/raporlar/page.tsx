"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type DatePreset = "today" | "week" | "month" | "year" | "custom";

type Summary = {
  total_sales: number;
  total_cost: number;
  total_profit: number;
  profit_margin: number;
  order_count: number;
  cancelled_order_count: number;
  total_collection: number;
  open_balance: number;
  total_stock: number;
  stock_cost: number;
  critical_stock: number;
};

type TopProduct = {
  product_id: string;
  product_name: string;
  barcode: string | null;
  quantity: number;
  sales: number;
  cost: number;
  profit: number;
};

type TopCustomer = {
  customer_id: string;
  company_name: string;
  order_count: number;
  sales: number;
};

type DailySale = {
  date: string;
  sales: number;
  orders: number;
};

type CriticalProduct = {
  product_id: string;
  product_name: string;
  barcode: string | null;
  stock: number;
  min_stock: number;
  unit: string | null;
};

type ReportData = {
  summary: Summary;
  top_products: TopProduct[];
  top_customers: TopCustomer[];
  daily_sales: DailySale[];
  critical_products: CriticalProduct[];
};

const emptySummary: Summary = {
  total_sales: 0,
  total_cost: 0,
  total_profit: 0,
  profit_margin: 0,
  order_count: 0,
  cancelled_order_count: 0,
  total_collection: 0,
  open_balance: 0,
  total_stock: 0,
  stock_cost: 0,
  critical_stock: 0,
};

const emptyReport: ReportData = {
  summary: emptySummary,
  top_products: [],
  top_customers: [],
  daily_sales: [],
  critical_products: [],
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

function formatDate(date: string) {
  if (!date) return "-";

  const parts = date.split("-");
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  return date;
}

function getTurkeyToday() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function parseDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return {
    year,
    month,
    day,
  };
}

function dateToString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateRange(
  preset: DatePreset,
  customStart: string,
  customEnd: string
) {
  const today = getTurkeyToday();

  if (preset === "custom") {
    if (!customStart || !customEnd) {
      return {
        start: customStart,
        end: customEnd,
        error: "Özel tarih aralığında başlangıç ve bitiş tarihlerini seçmelisin.",
      };
    }

    if (customStart > customEnd) {
      return {
        start: customStart,
        end: customEnd,
        error: "Başlangıç tarihi, bitiş tarihinden sonra olamaz.",
      };
    }

    return {
      start: customStart,
      end: customEnd,
      error: "",
    };
  }

  const { year, month, day } = parseDateParts(today);
  const current = new Date(year, month - 1, day);

  if (preset === "today") {
    return {
      start: today,
      end: today,
      error: "",
    };
  }

  if (preset === "week") {
    const dayOfWeek = current.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(current);
    monday.setDate(current.getDate() + mondayOffset);

    return {
      start: dateToString(monday),
      end: today,
      error: "",
    };
  }

  if (preset === "month") {
    const firstDay = new Date(year, month - 1, 1);

    return {
      start: dateToString(firstDay),
      end: today,
      error: "",
    };
  }

  const firstDay = new Date(year, 0, 1);

  return {
    start: dateToString(firstDay),
    end: today,
    error: "",
  };
}

function normalizeReport(value: unknown): ReportData {
  const data =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const rawSummary =
    data.summary && typeof data.summary === "object"
      ? (data.summary as Record<string, unknown>)
      : {};

  const rawProducts = Array.isArray(data.top_products)
    ? data.top_products
    : [];

  const rawCustomers = Array.isArray(data.top_customers)
    ? data.top_customers
    : [];

  const rawDailySales = Array.isArray(data.daily_sales)
    ? data.daily_sales
    : [];

  const rawCriticalProducts = Array.isArray(data.critical_products)
    ? data.critical_products
    : [];

  return {
    summary: {
      total_sales: Number(rawSummary.total_sales ?? 0),
      total_cost: Number(rawSummary.total_cost ?? 0),
      total_profit: Number(rawSummary.total_profit ?? 0),
      profit_margin: Number(rawSummary.profit_margin ?? 0),
      order_count: Number(rawSummary.order_count ?? 0),
      cancelled_order_count: Number(
        rawSummary.cancelled_order_count ?? 0
      ),
      total_collection: Number(rawSummary.total_collection ?? 0),
      open_balance: Number(rawSummary.open_balance ?? 0),
      total_stock: Number(rawSummary.total_stock ?? 0),
      stock_cost: Number(rawSummary.stock_cost ?? 0),
      critical_stock: Number(rawSummary.critical_stock ?? 0),
    },

    top_products: rawProducts.map((item) => {
      const product =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};

      return {
        product_id: String(product.product_id ?? ""),
        product_name: String(product.product_name ?? "Ürün"),
        barcode: product.barcode
          ? String(product.barcode)
          : null,
        quantity: Number(product.quantity ?? 0),
        sales: Number(product.sales ?? 0),
        cost: Number(product.cost ?? 0),
        profit: Number(product.profit ?? 0),
      };
    }),

    top_customers: rawCustomers.map((item) => {
      const customer =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};

      return {
        customer_id: String(customer.customer_id ?? ""),
        company_name: String(customer.company_name ?? "Müşteri"),
        order_count: Number(customer.order_count ?? 0),
        sales: Number(customer.sales ?? 0),
      };
    }),

    daily_sales: rawDailySales.map((item) => {
      const daily =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};

      return {
        date: String(daily.date ?? ""),
        sales: Number(daily.sales ?? 0),
        orders: Number(daily.orders ?? 0),
      };
    }),

    critical_products: rawCriticalProducts.map((item) => {
      const product =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};

      return {
        product_id: String(product.product_id ?? ""),
        product_name: String(product.product_name ?? "Ürün"),
        barcode: product.barcode
          ? String(product.barcode)
          : null,
        stock: Number(product.stock ?? 0),
        min_stock: Number(product.min_stock ?? 0),
        unit: product.unit ? String(product.unit) : null,
      };
    }),
  };
}

function LoadingBar() {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-900" />
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-sm">
        📊
      </div>

      <p className="font-semibold text-slate-800">{title}</p>

      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  description,
  valueClassName = "text-slate-950",
}: {
  title: string;
  value: string;
  icon: string;
  description?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p
            className={`mt-2 text-2xl font-bold tracking-tight sm:text-3xl ${valueClassName}`}
          >
            {value}
          </p>

          {description ? (
            <p className="mt-2 text-xs text-slate-400">{description}</p>
          ) : null}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function RaporlarPage() {
  const [preset, setPreset] = useState<DatePreset>("year");

  const today = useMemo(() => getTurkeyToday(), []);

  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);

  const [data, setData] = useState<ReportData>(emptyReport);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const requestIdRef = useRef(0);

  const range = useMemo(
    () => getDateRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const loadReport = useCallback(async () => {
    if (range.error) {
      setError(range.error);
      return;
    }

    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError("");

    const { data: result, error: rpcError } = await supabase.rpc(
      "get_sales_report",
      {
        p_start_date: range.start,
        p_end_date: range.end,
      }
    );

    if (requestId !== requestIdRef.current) {
      return;
    }

    if (rpcError) {
      setError(
        rpcError.message ||
          "Rapor alınırken beklenmeyen bir hata oluştu."
      );
      setLoading(false);
      setInitialLoading(false);
      return;
    }

    setData(normalizeReport(result));
    setLastUpdated(new Date());
    setLoading(false);
    setInitialLoading(false);
  }, [range.error, range.start, range.end]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const summary = data.summary;

  const periodLabel = `${formatDate(range.start)} → ${formatDate(
    range.end
  )}`;

  const profitIsPositive = summary.total_profit >= 0;
  const balanceIsPositive = summary.open_balance <= 0;

  const maxDailySales = useMemo(() => {
    return Math.max(
      ...data.daily_sales.map((item) => item.sales),
      1
    );
  }, [data.daily_sales]);

  const maxProductSales = useMemo(() => {
    return Math.max(
      ...data.top_products.map((item) => item.sales),
      1
    );
  }, [data.top_products]);

  const maxCustomerSales = useMemo(() => {
    return Math.max(
      ...data.top_customers.map((item) => item.sales),
      1
    );
  }, [data.top_customers]);

  function handlePresetChange(nextPreset: DatePreset) {
    setPreset(nextPreset);

    if (nextPreset !== "custom") {
      setError("");
    }
  }

  function handleCustomStart(value: string) {
    setCustomStart(value);

    if (value > customEnd) {
      setError(
        "Başlangıç tarihi, bitiş tarihinden sonra olamaz."
      );
    } else {
      setError("");
    }
  }

  function handleCustomEnd(value: string) {
    setCustomEnd(value);

    if (customStart > value) {
      setError(
        "Başlangıç tarihi, bitiş tarihinden sonra olamaz."
      );
    } else {
      setError("");
    }
  }

  function handlePrint() {
    window.print();
  }

  const lastUpdatedText = lastUpdated
    ? new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        dateStyle: "short",
        timeStyle: "short",
      }).format(lastUpdated)
    : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:mb-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 print:hidden">
              <Link
                href="/"
                className="transition hover:text-slate-900"
              >
                Ana Sayfa
              </Link>

              <span>›</span>

              <span className="font-medium text-slate-700">
                Raporlar
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Raporlar
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Satış, kârlılık, tahsilat, stok ve müşteri performansını
              tek ekranda takip et.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {lastUpdatedText ? (
              <span className="hidden text-xs text-slate-400 sm:inline">
                Son güncelleme: {lastUpdatedText}
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => void loadReport()}
              disabled={loading || !!range.error}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Yenileniyor..." : "↻ Yenile"}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              🖨️ Yazdır
            </button>
          </div>
        </div>

        {/* DATE FILTER */}
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                ["today", "Bugün"],
                ["week", "Bu Hafta"],
                ["month", "Bu Ay"],
                ["year", "Bu Yıl"],
                ["custom", "Özel Tarih"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    handlePresetChange(value as DatePreset)
                  }
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    preset === value
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {preset === "custom" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Başlangıç tarihi
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || undefined}
                    onChange={(event) =>
                      handleCustomStart(event.target.value)
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Bitiş tarihi
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart || undefined}
                    onChange={(event) =>
                      handleCustomEnd(event.target.value)
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>
              </div>
            ) : null}

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Rapor dönemi
              </p>

              <p className="font-semibold text-slate-900">
                {periodLabel}
              </p>
            </div>

            {range.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                ⚠️ {range.error}
              </div>
            ) : null}
          </div>
        </section>

        {initialLoading ? (
          <div className="space-y-5">
            <LoadingBar />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-36 animate-pulse rounded-2xl bg-slate-200"
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-80 animate-pulse rounded-2xl bg-slate-200"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {loading ? (
              <div className="mb-4">
                <LoadingBar />
              </div>
            ) : null}

            {error ? (
              <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-red-800">
                    Rapor yüklenemedi
                  </p>

                  <p className="mt-1 text-sm text-red-600">
                    {error}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadReport()}
                  className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
                >
                  Tekrar Dene
                </button>
              </div>
            ) : null}

            {/* PRINT HEADER */}
            <div className="mb-6 hidden print:block">
              <h1 className="text-3xl font-bold text-slate-950">
                ESORA — Satış Raporu
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Rapor dönemi: {periodLabel}
              </p>
            </div>

            {/* SUMMARY */}
            <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Toplam Satış"
                value={formatMoney(summary.total_sales)}
                icon="💰"
                description={`${formatNumber(
                  summary.order_count
                )} aktif sipariş`}
              />

              <SummaryCard
                title="Brüt Kâr"
                value={formatMoney(summary.total_profit)}
                icon={profitIsPositive ? "📈" : "📉"}
                valueClassName={
                  profitIsPositive
                    ? "text-emerald-600"
                    : "text-red-600"
                }
                description={`Kâr marjı %${formatNumber(
                  summary.profit_margin
                )}`}
              />

              <SummaryCard
                title="Toplam Maliyet"
                value={formatMoney(summary.total_cost)}
                icon="📦"
                description="Satılan ürünlerin maliyeti"
              />

              <SummaryCard
                title="Dönem Tahsilatı"
                value={formatMoney(summary.total_collection)}
                icon="💳"
                description="Müşterilerden alınan ödeme"
              />
            </section>

            <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Güncel Açık Cari"
                value={formatMoney(summary.open_balance)}
                icon="👥"
                valueClassName={
                  balanceIsPositive
                    ? "text-emerald-600"
                    : "text-red-600"
                }
                description={
                  balanceIsPositive
                    ? "Müşteri borcu bulunmuyor"
                    : "Müşterilerden alınacak"
                }
              />

              <SummaryCard
                title="Toplam Stok"
                value={formatNumber(summary.total_stock)}
                icon="🏷️"
                description="Aktif ürünlerdeki toplam miktar"
              />

              <SummaryCard
                title="Stok Maliyeti"
                value={formatMoney(summary.stock_cost)}
                icon="🧮"
                description="Mevcut stokların maliyet değeri"
              />

              <SummaryCard
                title="Kritik Stok"
                value={formatNumber(summary.critical_stock)}
                icon="⚠️"
                valueClassName={
                  summary.critical_stock > 0
                    ? "text-red-600"
                    : "text-emerald-600"
                }
                description={
                  summary.critical_stock > 0
                    ? "Minimum seviyede veya altında"
                    : "Kritik stok bulunmuyor"
                }
              />
            </section>

            {/* DAILY SALES */}
            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Günlük Satışlar
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Seçilen dönem içerisindeki günlük satış performansı
                  </p>
                </div>

                {data.daily_sales.length > 0 ? (
                  <span className="text-sm font-semibold text-slate-700">
                    {formatMoney(summary.total_sales)}
                  </span>
                ) : null}
              </div>

              {data.daily_sales.length === 0 ? (
                <EmptyState
                  title="Bu dönemde satış yok"
                  description="Seçtiğin tarih aralığında raporlanacak aktif satış bulunmuyor."
                />
              ) : (
                <div className="space-y-4">
                  {data.daily_sales.map((item) => {
                    const percentage =
                      (item.sales / maxDailySales) * 100;

                    return (
                      <div key={item.date}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="w-20 font-semibold text-slate-700">
                              {formatDate(item.date)}
                            </span>

                            <span className="text-xs text-slate-400">
                              {item.orders} sipariş
                            </span>
                          </div>

                          <span className="font-bold text-slate-900">
                            {formatMoney(item.sales)}
                          </span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-slate-900 transition-all"
                            style={{
                              width: `${Math.max(
                                percentage,
                                item.sales > 0 ? 3 : 0
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* PRODUCTS + CUSTOMERS */}
            <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
              {/* TOP PRODUCTS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-950">
                    En Çok Satan Ürünler
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Satış tutarına göre ilk 10 ürün
                  </p>
                </div>

                {data.top_products.length === 0 ? (
                  <EmptyState
                    title="Ürün satışı yok"
                    description="Bu dönem içerisinde aktif satış bulunmuyor."
                  />
                ) : (
                  <div className="space-y-4">
                    {data.top_products.map((product, index) => {
                      const percentage =
                        (product.sales / maxProductSales) * 100;

                      return (
                        <div key={product.product_id}>
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
                              {index + 1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                <Link
                                  href={`/urunler?search=${encodeURIComponent(
                                    product.product_name
                                  )}`}
                                  className="min-w-0 font-semibold text-slate-900 transition hover:text-slate-600 hover:underline"
                                >
                                  <span className="block truncate">
                                    {product.product_name}
                                  </span>
                                </Link>

                                <span className="shrink-0 font-bold text-slate-900">
                                  {formatMoney(product.sales)}
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                                {product.barcode ? (
                                  <span>
                                    Barkod: {product.barcode}
                                  </span>
                                ) : null}

                                <span>
                                  {formatNumber(product.quantity)} adet
                                </span>
                              </div>

                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-slate-700"
                                  style={{
                                    width: `${Math.max(
                                      percentage,
                                      3
                                    )}%`,
                                  }}
                                />
                              </div>

                              <div className="mt-2 flex items-center justify-between text-xs">
                                <span className="text-slate-400">
                                  Maliyet{" "}
                                  {formatMoney(product.cost)}
                                </span>

                                <span
                                  className={
                                    product.profit >= 0
                                      ? "font-semibold text-emerald-600"
                                      : "font-semibold text-red-600"
                                  }
                                >
                                  Kâr {formatMoney(product.profit)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* TOP CUSTOMERS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-950">
                    En İyi Müşteriler
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Satış tutarına göre ilk 10 müşteri
                  </p>
                </div>

                {data.top_customers.length === 0 ? (
                  <EmptyState
                    title="Müşteri satışı yok"
                    description="Bu dönem içerisinde müşterilere yapılmış aktif satış bulunmuyor."
                  />
                ) : (
                  <div className="space-y-4">
                    {data.top_customers.map((customer, index) => {
                      const percentage =
                        (customer.sales / maxCustomerSales) * 100;

                      return (
                        <div
                          key={customer.customer_id}
                          className="flex items-start gap-3"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                              <Link
                                href={`/musteriler/${customer.customer_id}`}
                                className="min-w-0 font-semibold text-slate-900 transition hover:text-slate-600 hover:underline"
                              >
                                <span className="block truncate">
                                  {customer.company_name}
                                </span>
                              </Link>

                              <span className="shrink-0 font-bold text-slate-900">
                                {formatMoney(customer.sales)}
                              </span>
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {customer.order_count} sipariş
                            </div>

                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-slate-700"
                                style={{
                                  width: `${Math.max(
                                    percentage,
                                    3
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* CRITICAL STOCK */}
            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Kritik Stoklar
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Minimum stok seviyesinde veya altında olan ürünler
                  </p>
                </div>

                <Link
                  href="/stok"
                  className="text-sm font-semibold text-slate-700 transition hover:text-slate-950 hover:underline"
                >
                  Tüm stokları gör →
                </Link>
              </div>

              {data.critical_products.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
                  <div className="text-3xl">✅</div>

                  <p className="mt-3 font-bold text-emerald-800">
                    Kritik stok bulunmuyor
                  </p>

                  <p className="mt-1 text-sm text-emerald-600">
                    Aktif ürünlerin tamamı minimum stok seviyesinin üzerinde.
                  </p>
                </div>
              ) : (
                <>
                  {/* DESKTOP */}
                  <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
                    <div className="grid grid-cols-[1fr_140px_140px_120px] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <span>Ürün</span>
                      <span>Stok</span>
                      <span>Minimum</span>
                      <span>Durum</span>
                    </div>

                    {data.critical_products.map((product) => {
                      const outOfStock = product.stock <= 0;

                      return (
                        <div
                          key={product.product_id}
                          className="grid grid-cols-[1fr_140px_140px_120px] items-center border-t border-slate-100 px-4 py-4"
                        >
                          <div className="min-w-0">
                            <Link
                              href={`/stok?search=${encodeURIComponent(
                                product.product_name
                              )}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {product.product_name}
                            </Link>

                            {product.barcode ? (
                              <p className="mt-1 text-xs text-slate-400">
                                Barkod: {product.barcode}
                              </p>
                            ) : null}
                          </div>

                          <div
                            className={`font-bold ${
                              outOfStock
                                ? "text-red-600"
                                : "text-amber-600"
                            }`}
                          >
                            {formatNumber(product.stock)}{" "}
                            {product.unit || ""}
                          </div>

                          <div className="text-sm text-slate-600">
                            {formatNumber(product.min_stock)}{" "}
                            {product.unit || ""}
                          </div>

                          <div>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                outOfStock
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {outOfStock
                                ? "Stok Yok"
                                : "Kritik"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* MOBILE */}
                  <div className="space-y-3 md:hidden">
                    {data.critical_products.map((product) => {
                      const outOfStock = product.stock <= 0;

                      return (
                        <Link
                          key={product.product_id}
                          href={`/stok?search=${encodeURIComponent(
                            product.product_name
                          )}`}
                          className="block rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {product.product_name}
                              </p>

                              {product.barcode ? (
                                <p className="mt-1 text-xs text-slate-400">
                                  {product.barcode}
                                </p>
                              ) : null}
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                                outOfStock
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {outOfStock
                                ? "Stok Yok"
                                : "Kritik"}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-slate-50 p-3">
                              <p className="text-xs text-slate-400">
                                Mevcut Stok
                              </p>

                              <p
                                className={`mt-1 font-bold ${
                                  outOfStock
                                    ? "text-red-600"
                                    : "text-amber-600"
                                }`}
                              >
                                {formatNumber(product.stock)}{" "}
                                {product.unit || ""}
                              </p>
                            </div>

                            <div className="rounded-lg bg-slate-50 p-3">
                              <p className="text-xs text-slate-400">
                                Minimum
                              </p>

                              <p className="mt-1 font-bold text-slate-700">
                                {formatNumber(product.min_stock)}{" "}
                                {product.unit || ""}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            {/* CANCELLED ORDERS */}
            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-slate-950">
                    İptal Edilen Siparişler
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Seçilen dönem içerisinde iptal edilen sipariş sayısı
                  </p>
                </div>

                <div
                  className={`rounded-xl px-4 py-3 text-center ${
                    summary.cancelled_order_count > 0
                      ? "bg-red-50 text-red-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <p className="text-2xl font-bold">
                    {formatNumber(
                      summary.cancelled_order_count
                    )}
                  </p>

                  <p className="text-xs font-semibold">
                    İptal
                  </p>
                </div>
              </div>
            </section>

            {/* FOOTER INFO */}
            <div className="flex flex-col gap-2 pb-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Rapor dönemi: {periodLabel}
              </span>

              {lastUpdatedText ? (
                <span>
                  Son güncelleme: {lastUpdatedText}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}