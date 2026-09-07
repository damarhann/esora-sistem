"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type ReportData = {
  summary: {
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
  top_products: {
    product_id: string;
    product_name: string;
    barcode: string | null;
    quantity: number;
    sales: number;
    cost: number;
    profit: number;
  }[];
  top_customers: {
    customer_id: string;
    company_name: string;
    order_count: number;
    sales: number;
  }[];
  daily_sales: {
    date: string;
    sales: number;
    orders: number;
  }[];
  critical_products: {
    product_id: string;
    product_name: string;
    barcode: string | null;
    stock: number;
    min_stock: number;
    unit: string;
  }[];
};

type Period = "today" | "week" | "month" | "year" | "custom";

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function getDateRange(period: Period, customStart: string, customEnd: string) {
  const now = new Date();

  const localDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  let start = new Date(localDate);
  let end = new Date(localDate);

  if (period === "today") {
    start = new Date(localDate);
    end = new Date(localDate);
  }

  if (period === "week") {
    const day = localDate.getDay();
    const diff = day === 0 ? 6 : day - 1;

    start = new Date(localDate);
    start.setDate(localDate.getDate() - diff);

    end = new Date(localDate);
  }

  if (period === "month") {
    start = new Date(
      localDate.getFullYear(),
      localDate.getMonth(),
      1
    );

    end = new Date(localDate);
  }

  if (period === "year") {
    start = new Date(localDate.getFullYear(), 0, 1);
    end = new Date(localDate);
  }

  if (period === "custom") {
    return {
      start: customStart,
      end: customEnd,
    };
  }

  return {
    start: `${start.getFullYear()}-${String(
      start.getMonth() + 1
    ).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,

    end: `${end.getFullYear()}-${String(
      end.getMonth() + 1
    ).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
  };
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("month");

  const today = new Date();

  const [customStart, setCustomStart] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-01`
  );

  const [customEnd, setCustomEnd] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`
  );

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(
    () => getDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  async function loadReport() {
    setLoading(true);
    setError("");

    const { data: result, error: rpcError } = await supabase.rpc(
      "get_sales_report",
      {
        p_start_date: range.start,
        p_end_date: range.end,
      }
    );

    if (rpcError) {
      console.error(rpcError);
      setError(rpcError.message);
      setData(null);
      setLoading(false);
      return;
    }

    setData(result as ReportData);
    setLoading(false);
  }

  useEffect(() => {
    loadReport();
  }, [range.start, range.end]);

  const summary = data?.summary;

  const maxDailySales = Math.max(
    ...(data?.daily_sales?.map((item) => Number(item.sales)) || [1]),
    1
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Raporlar
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              ESORA satış, kârlılık, müşteri ve stok analizleri
            </p>
          </div>

          <button
            onClick={loadReport}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Yükleniyor..." : "↻ Raporu Yenile"}
          </button>
        </div>

        {/* DATE FILTER */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                onClick={() => setPeriod(value as Period)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  period === value
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Başlangıç
                </label>

                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Bitiş
                </label>

                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </div>
            </div>
          )}

          <div className="mt-3 text-xs text-slate-400">
            Rapor dönemi: {range.start} → {range.end}
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-bold">Rapor yüklenemedi.</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {/* LOADING */}
        {loading && !data ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Rapor hazırlanıyor...
          </div>
        ) : data ? (
          <>
            {/* FINANCE CARDS */}
            <section>
              <div className="mb-3">
                <h2 className="text-lg font-bold text-slate-900">
                  Finansal Özet
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">
                    Toplam Satış
                  </div>

                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {formatMoney(summary?.total_sales || 0)}
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    İptal edilenler hariç
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">
                    Toplam Maliyet
                  </div>

                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {formatMoney(summary?.total_cost || 0)}
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    Sipariş anındaki alış fiyatlarına göre
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">
                    Brüt Kâr
                  </div>

                  <div className="mt-2 text-2xl font-bold text-emerald-600">
                    {formatMoney(summary?.total_profit || 0)}
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    Satış − maliyet
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">
                    Kâr Marjı
                  </div>

                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    %{formatNumber(summary?.profit_margin || 0)}
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    Brüt kâr / satış
                  </div>
                </div>

              </div>
            </section>

            {/* OPERATING CARDS */}
            <section>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">
                    Sipariş Sayısı
                  </div>

                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {formatNumber(summary?.order_count || 0)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">
                    İptal Edilen
                  </div>

                  <div className="mt-2 text-2xl font-bold text-red-600">
                    {formatNumber(summary?.cancelled_order_count || 0)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">
                    Dönem Tahsilatı
                  </div>

                  <div className="mt-2 text-2xl font-bold text-blue-600">
                    {formatMoney(summary?.total_collection || 0)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">
                    Güncel Açık Cari
                  </div>

                  <div className="mt-2 text-2xl font-bold text-orange-600">
                    {formatMoney(summary?.open_balance || 0)}
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    Tüm müşteriler
                  </div>
                </div>

              </div>
            </section>

            {/* DAILY SALES */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Günlük Satış Performansı
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Seçilen dönem içerisindeki günlük satışlar
                </p>
              </div>

              {data.daily_sales.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Bu dönemde satış bulunmuyor.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.daily_sales.map((item) => {
                    const percentage =
                      (Number(item.sales) / maxDailySales) * 100;

                    return (
                      <div key={item.date}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-600">
                            {new Date(
                              `${item.date}T12:00:00`
                            ).toLocaleDateString("tr-TR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </span>

                          <span className="font-bold text-slate-900">
                            {formatMoney(Number(item.sales))}
                          </span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-slate-900 transition-all"
                            style={{
                              width: `${Math.max(percentage, 2)}%`,
                            }}
                          />
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {item.orders} sipariş
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* TOP PRODUCTS + CUSTOMERS */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">

              {/* PRODUCTS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-900">
                    En Çok Satan Ürünler
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Ciroya göre ilk 10 ürün
                  </p>
                </div>

                {data.top_products.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Satış verisi bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.top_products.map((product, index) => (
                      <div
                        key={product.product_id}
                        className="rounded-xl border border-slate-100 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900">
                              {product.product_name}
                            </div>

                            {product.barcode && (
                              <div className="mt-0.5 text-xs text-slate-400">
                                {product.barcode}
                              </div>
                            )}

                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <div className="text-slate-400">
                                  Adet
                                </div>

                                <div className="font-semibold text-slate-700">
                                  {formatNumber(
                                    Number(product.quantity)
                                  )}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-400">
                                  Ciro
                                </div>

                                <div className="font-semibold text-slate-700">
                                  {formatMoney(
                                    Number(product.sales)
                                  )}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-400">
                                  Kâr
                                </div>

                                <div className="font-semibold text-emerald-600">
                                  {formatMoney(
                                    Number(product.profit)
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CUSTOMERS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-900">
                    En İyi Müşteriler
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Ciroya göre ilk 10 müşteri
                  </p>
                </div>

                {data.top_customers.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Müşteri satış verisi bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.top_customers.map((customer, index) => (
                      <div
                        key={customer.customer_id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-900">
                            {customer.company_name}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {customer.order_count} sipariş
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-slate-400">
                            Ciro
                          </div>

                          <div className="font-bold text-slate-900">
                            {formatMoney(
                              Number(customer.sales)
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </section>

            {/* STOCK */}
            <section>
              <div className="mb-3">
                <h2 className="text-lg font-bold text-slate-900">
                  Stok Analizi
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-slate-500">
                    Toplam Stok
                  </div>

                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {formatNumber(summary?.total_stock || 0)}
                  </div>

                  <div className="mt-1 text-xs text-slate-400">
                    Aktif ürünlerin toplam adedi
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-slate-500">
                    Stok Maliyet Değeri
                  </div>

                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {formatMoney(summary?.stock_cost || 0)}
                  </div>

                  <div className="mt-1 text-xs text-slate-400">
                    Mevcut stok × alış fiyatı
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-slate-500">
                    Kritik Stok
                  </div>

                  <div className="mt-2 text-2xl font-bold text-red-600">
                    {formatNumber(summary?.critical_stock || 0)}
                  </div>

                  <div className="mt-1 text-xs text-slate-400">
                    Minimum stok seviyesinde veya altında
                  </div>
                </div>

              </div>
            </section>

            {/* CRITICAL PRODUCTS */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Kritik Stoktaki Ürünler
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Yeniden sipariş verilmesi gereken ürünler
                </p>
              </div>

              {data.critical_products.length === 0 ? (
                <div className="rounded-xl bg-emerald-50 p-6 text-center text-sm font-medium text-emerald-700">
                  ✓ Kritik stokta ürün bulunmuyor.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                        <th className="px-3 py-3">
                          Ürün
                        </th>

                        <th className="px-3 py-3">
                          Barkod
                        </th>

                        <th className="px-3 py-3">
                          Mevcut
                        </th>

                        <th className="px-3 py-3">
                          Minimum
                        </th>

                        <th className="px-3 py-3">
                          Durum
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {data.critical_products.map((product) => (
                        <tr
                          key={product.product_id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-3 py-4 font-semibold text-slate-900">
                            {product.product_name}
                          </td>

                          <td className="px-3 py-4 text-slate-500">
                            {product.barcode || "-"}
                          </td>

                          <td className="px-3 py-4 font-bold text-red-600">
                            {formatNumber(
                              Number(product.stock)
                            )}{" "}
                            {product.unit}
                          </td>

                          <td className="px-3 py-4 text-slate-600">
                            {formatNumber(
                              Number(product.min_stock)
                            )}{" "}
                            {product.unit}
                          </td>

                          <td className="px-3 py-4">
                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                              Kritik
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </>
        ) : null}

      </div>
    </main>
  );
}

