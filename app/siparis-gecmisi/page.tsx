"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Order = {
  id: string;
  order_number: number;
  customer_id: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
  customers: {
    company_name: string;
    contact_name: string | null;
  } | null;
};

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);

    const { data, error } = await supabase
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

    if (error) {
      console.error(error);
      alert("Siparişler yüklenemedi.");
      setLoading(false);
      return;
    }

    setOrders((data as unknown as Order[]) || []);
    setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-10">
        <p className="text-slate-500">
          Siparişler yükleniyor...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* BAŞLIK */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Siparişler
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Oluşturulan tüm siparişleri buradan takip edebilirsin.
            </p>
          </div>

          <Link
            href="/siparisler"
            className="rounded-xl bg-slate-900 px-5 py-3 text-center font-semibold text-white hover:bg-slate-800"
          >
            + Yeni Sipariş
          </Link>

        </div>

        {/* ÖZET */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Toplam Sipariş
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {orders.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Tamamlanan Sipariş
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {
                orders.filter(
                  (order) => order.status === "completed"
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Toplam Satış
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatPrice(
                orders.reduce(
                  (sum, order) =>
                    sum + Number(order.total || 0),
                  0
                )
              )}{" "}
              ₺
            </p>
          </div>

        </div>

        {/* DURUM ÖZETİ */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-600">
              Yeni
            </p>

            <p className="mt-1 text-2xl font-bold text-blue-800">
              {
                orders.filter(
                  (order) => order.status === "new"
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-4">
            <p className="text-sm font-medium text-yellow-600">
              Hazırlanıyor
            </p>

            <p className="mt-1 text-2xl font-bold text-yellow-800">
              {
                orders.filter(
                  (order) => order.status === "preparing"
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-600">
              Sevk Edildi
            </p>

            <p className="mt-1 text-2xl font-bold text-purple-800">
              {
                orders.filter(
                  (order) => order.status === "shipped"
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-600">
              Tamamlandı
            </p>

            <p className="mt-1 text-2xl font-bold text-green-800">
              {
                orders.filter(
                  (order) => order.status === "completed"
                ).length
              }
            </p>
          </div>

        </div>

        {/* SİPARİŞ TABLOSU */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {orders.length === 0 ? (
            <div className="p-12 text-center">

              <p className="text-lg font-semibold text-slate-700">
                Henüz sipariş bulunmuyor.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                İlk siparişini oluşturduğunda burada görünecek.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-slate-50">

                  <tr>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                      Sipariş
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                      Müşteri
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                      Tarih
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Tutar
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Durum
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {orders.map((order) => (

                    <tr
                      key={order.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => {
                        window.location.href =
                          `/siparis-gecmisi/${order.id}`;
                      }}
                    >

                      {/* SİPARİŞ NO */}
                      <td className="px-6 py-5">

                        <div className="font-bold text-slate-900">
                          #{order.order_number}
                        </div>

                      </td>

                      {/* MÜŞTERİ */}
                      <td className="px-6 py-5">

                        <div className="font-semibold text-slate-900">
                          {order.customers?.company_name ||
                            "Müşteri bulunamadı"}
                        </div>

                        {order.customers?.contact_name && (
                          <div className="text-sm text-slate-400">
                            {order.customers.contact_name}
                          </div>
                        )}

                      </td>

                      {/* TARİH */}
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {formatDate(order.created_at)}
                      </td>

                      {/* TUTAR */}
                      <td className="px-6 py-5 text-right font-bold text-slate-900">
                        {formatPrice(
                          Number(order.total)
                        )}{" "}
                        ₺
                      </td>

                      {/* DURUM */}
                      <td className="px-6 py-5 text-right">

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClass(
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

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}