"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
  customer_type: string | null;
  address: string | null;
  postal_code: string | null;
  tax_number: string | null;
  tax_office: string | null;
  email: string | null;
  payment_method: string | null;
  payment_term: number | null;
  credit_limit: number | null;
  notes: string | null;
  created_at: string;
  is_active?: boolean;
};

type Transaction = {
  id: string;
  transaction_type: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_number: number;
  total: number;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  new: "Yeni",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const STATUS_CLASSES: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  preparing: "bg-yellow-100 text-yellow-700",
  shipped: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const PAYMENT_METHODS = [
  { value: "Nakit", label: "Nakit" },
  { value: "Havale", label: "Havale" },
  { value: "EFT", label: "EFT" },
];

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();

  const customerId = String(params.id || "");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Nakit");
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const formatPrice = useCallback((value: number) => {
    return Number(value || 0).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const formatDate = useCallback((value: string) => {
    return new Date(value).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, []);

  const formatDateTime = useCallback((value: string) => {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const loadData = useCallback(
    async (showLoading = true) => {
      if (!customerId) return;

      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const [customerResult, transactionsResult, ordersResult] =
        await Promise.all([
          supabase
            .from("customers")
            .select("*")
            .eq("id", customerId)
            .single(),

          supabase
            .from("account_transactions")
            .select(
              "id, transaction_type, amount, payment_method, note, created_at"
            )
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false }),

          supabase
            .from("orders")
            .select("id, order_number, total, status, created_at")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false }),
        ]);

      if (customerResult.error) {
        console.error("Müşteri yüklenemedi:", customerResult.error);
        setCustomer(null);
      } else {
        setCustomer(customerResult.data);
      }

      if (transactionsResult.error) {
        console.error(
          "Cari hareketler yüklenemedi:",
          transactionsResult.error
        );
        setTransactions([]);
      } else {
        setTransactions(transactionsResult.data || []);
      }

      if (ordersResult.error) {
        console.error("Siparişler yüklenemedi:", ordersResult.error);
        setOrders([]);
      } else {
        setOrders(ordersResult.data || []);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [customerId]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  function parseAmount(value: string) {
    const normalized = value
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    return Number(normalized);
  }

  async function addPayment() {
    if (!customer) return;

    if (customer.is_active === false) {
      alert("Pasif müşteriye tahsilat eklenemez.");
      return;
    }

    const amount = parseAmount(paymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Geçerli bir tahsilat tutarı girin.");
      return;
    }

    if (currentBalance <= 0) {
      alert("Bu müşterinin şu anda tahsil edilecek borcu bulunmuyor.");
      return;
    }

    if (amount > currentBalance + 0.005) {
      alert(
        `Tahsilat tutarı mevcut borcu aşamaz.\n\nMevcut borç: ₺${formatPrice(
          currentBalance
        )}`
      );
      return;
    }

    if (!["Nakit", "Havale", "EFT"].includes(paymentMethod)) {
      alert("Geçerli bir ödeme yöntemi seçin.");
      return;
    }

    setSavingPayment(true);

    const { error } = await supabase.rpc("add_customer_payment", {
      p_customer_id: customerId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_note: paymentNote.trim() || null,
    });

    setSavingPayment(false);

    if (error) {
      console.error("Tahsilat hatası:", error);
      alert(`Tahsilat eklenemedi:\n${error.message}`);
      return;
    }

    setPaymentAmount("");
    setPaymentMethod("Nakit");
    setPaymentNote("");
    setPaymentModal(false);

    await loadData(false);

    alert("Tahsilat başarıyla kaydedildi.");
  }

  function openPaymentModal() {
    if (!customer) return;

    if (customer.is_active === false) {
      alert("Pasif müşteriden tahsilat alınamaz.");
      return;
    }

    if (currentBalance <= 0) {
      alert("Bu müşterinin şu anda tahsil edilecek borcu bulunmuyor.");
      return;
    }

    setPaymentAmount("");
    setPaymentMethod("Nakit");
    setPaymentNote("");
    setPaymentModal(true);
  }

  function getTransactionLabel(type: string) {
    switch (type) {
      case "sale":
        return "Satış";

      case "payment":
        return "Tahsilat";

      case "refund":
        return "Satış İptal İadesi";

      case "customer_refund":
        return "Müşteri İadesi";

      case "adjustment_debit":
        return "Borç Dekontu";

      case "adjustment_credit":
        return "Alacak Dekontu";

      default:
        return type;
    }
  }

  function getTransactionDirection(type: string) {
    switch (type) {
      case "sale":
      case "adjustment_debit":
        return "debit";

      case "payment":
      case "refund":
      case "adjustment_credit":
      case "customer_refund":
        return "credit";

      default:
        return "debit";
    }
  }

  const totalSales = useMemo(() => {
    return orders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
  }, [orders]);

  const activeOrders = useMemo(() => {
    return orders.filter((order) => order.status !== "cancelled");
  }, [orders]);

  const cancelledOrders = useMemo(() => {
    return orders.filter((order) => order.status === "cancelled");
  }, [orders]);

  const totalDebt = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.transaction_type === "sale" ||
          transaction.transaction_type === "adjustment_debit"
      )
      .reduce((sum, transaction) => {
        return sum + Number(transaction.amount || 0);
      }, 0);
  }, [transactions]);

  const totalPayment = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.transaction_type === "payment" ||
          transaction.transaction_type === "adjustment_credit" ||
          transaction.transaction_type === "refund"
      )
      .reduce((sum, transaction) => {
        return sum + Number(transaction.amount || 0);
      }, 0);
  }, [transactions]);

  const totalCustomerRefund = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.transaction_type === "customer_refund"
      )
      .reduce((sum, transaction) => {
        return sum + Number(transaction.amount || 0);
      }, 0);
  }, [transactions]);

  /*
   * CARİ MANTIĞI
   *
   * Borç:
   *   Satış + Borç Dekontu
   *
   * Alacak:
   *   Tahsilat + Alacak Dekontu + Satış İptal İadesi
   *
   * Müşteriye gerçek para iadesi:
   *   customer_refund
   *
   * customer_refund müşterinin ESORA'dan alacağını artırır.
   * Bu nedenle cari bakiyeye EKLENİR.
   *
   * Pozitif bakiye:
   *   Müşteri ESORA'ya borçlu
   *
   * Negatif bakiye:
   *   Müşteri ESORA'dan alacaklı
   */
  const currentBalance = useMemo(() => {
    return totalDebt - totalPayment + totalCustomerRefund;
  }, [totalDebt, totalPayment, totalCustomerRefund]);

  const creditLimit = useMemo(() => {
    return Math.max(Number(customer?.credit_limit || 0), 0);
  }, [customer?.credit_limit]);

  const availableCredit = useMemo(() => {
    if (creditLimit <= 0) return 0;

    return Math.max(creditLimit - Math.max(currentBalance, 0), 0);
  }, [creditLimit, currentBalance]);

  const usedCredit = useMemo(() => {
    if (creditLimit <= 0) return 0;

    return Math.min(Math.max(currentBalance, 0), creditLimit);
  }, [creditLimit, currentBalance]);

  const creditUsagePercent = useMemo(() => {
    if (creditLimit <= 0) return 0;

    return Math.min((usedCredit / creditLimit) * 100, 100);
  }, [creditLimit, usedCredit]);

  const customerBalanceText = useMemo(() => {
    if (currentBalance > 0.005) {
      return "Müşterinin ESORA'ya borcu";
    }

    if (currentBalance < -0.005) {
      return "Müşteri ESORA'dan alacaklı";
    }

    return "Cari hesap kapalı";
  }, [currentBalance]);

  const whatsappUrl = useMemo(() => {
    if (!customer?.phone) return null;

    const digits = customer.phone.replace(/\D/g, "");

    if (!digits) return null;

    let phone = digits;

    if (phone.startsWith("0")) {
      phone = phone.substring(1);
    }

    if (!phone.startsWith("90")) {
      phone = `90${phone}`;
    }

    return `https://wa.me/${phone}`;
  }, [customer?.phone]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border bg-white p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-56 rounded bg-gray-200" />
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="h-32 rounded-xl bg-gray-100" />
                <div className="h-32 rounded-xl bg-gray-100" />
                <div className="h-32 rounded-xl bg-gray-100" />
                <div className="h-32 rounded-xl bg-gray-100" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <button
            onClick={() => router.push("/musteriler")}
            className="mb-6 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            ← Müşterilere Dön
          </button>

          <div className="rounded-xl border bg-white p-8">
            <h1 className="text-xl font-semibold text-gray-900">
              Müşteri bulunamadı
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Müşteri mevcut değil veya bu müşteriye erişilemiyor.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* ÜST ALAN */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              onClick={() => router.push("/musteriler")}
              className="mb-3 text-sm text-gray-500 hover:text-gray-900"
            >
              ← Müşterilere Dön
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                {customer.company_name}
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  customer.is_active === false
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {customer.is_active === false ? "Pasif" : "Aktif"}
              </span>
            </div>

            <p className="mt-1 text-gray-500">
              {customer.customer_type || "Müşteri"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={openPaymentModal}
              disabled={
                currentBalance <= 0 || customer.is_active === false
              }
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Tahsilat Ekle
            </button>

            <button
              onClick={() =>
                router.push(`/musteriler?edit=${customer.id}`)
              }
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              ✏️ Düzenle
            </button>

            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                📞 Ara
              </a>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                WhatsApp
              </a>
            )}

            <button
              onClick={() => loadData(false)}
              disabled={refreshing}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {refreshing ? "Yenileniyor..." : "↻ Yenile"}
            </button>
          </div>
        </div>

        {/* PASİF UYARISI */}
        {customer.is_active === false && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">
              Bu müşteri pasif durumda.
            </p>

            <p className="mt-1 text-sm text-red-700">
              Yeni satış ve tahsilat işlemlerinde bu müşteri kullanılamaz.
            </p>
          </div>
        )}

        {/* ÖZET KARTLARI */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* CARİ BAKİYE */}
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">Cari Bakiye</p>

            <p
              className={`mt-2 text-2xl font-bold ${
                currentBalance > 0.005
                  ? "text-red-600"
                  : currentBalance < -0.005
                  ? "text-green-600"
                  : "text-gray-900"
              }`}
            >
              ₺{formatPrice(Math.abs(currentBalance))}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              {customerBalanceText}
            </p>
          </div>

          {/* SİPARİŞLER */}
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">Aktif Siparişler</p>

            <p className="mt-2 text-2xl font-bold">
              {activeOrders.length}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              ₺{formatPrice(totalSales)} toplam satış
            </p>

            {cancelledOrders.length > 0 && (
              <p className="mt-1 text-xs text-red-500">
                {cancelledOrders.length} iptal edilmiş sipariş
              </p>
            )}
          </div>

          {/* TAHSİLAT */}
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">Toplam Tahsilat</p>

            <p className="mt-2 text-2xl font-bold text-green-600">
              ₺{formatPrice(totalPayment)}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Cari tahsilatlar ve satış iadeleri
            </p>

            {totalCustomerRefund > 0 && (
              <p className="mt-1 text-xs text-orange-600">
                Müşteri iadesi: ₺
                {formatPrice(totalCustomerRefund)}
              </p>
            )}
          </div>

          {/* KREDİ */}
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">Kredi Limiti</p>

            <p className="mt-2 text-2xl font-bold">
              ₺{formatPrice(creditLimit)}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Vade: {customer.payment_term || 0} gün
            </p>

            {creditLimit > 0 ? (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${
                      creditUsagePercent >= 90
                        ? "bg-red-500"
                        : creditUsagePercent >= 70
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${creditUsagePercent}%` }}
                  />
                </div>

                <p className="mt-2 text-xs text-blue-600">
                  Kullanılabilir: ₺{formatPrice(availableCredit)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                Kredi limiti tanımlanmamış
              </p>
            )}
          </div>
        </div>

        {/* ANA BİLGİLER */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* FİRMA BİLGİLERİ */}
          <div className="rounded-xl border bg-white p-6 lg:col-span-2">
            <h2 className="mb-5 text-lg font-semibold">
              Firma Bilgileri
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">Firma Adı</p>
                <p className="mt-1 font-medium">
                  {customer.company_name}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Yetkili</p>
                <p className="mt-1 font-medium">
                  {customer.contact_name || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Telefon</p>
                <p className="mt-1 font-medium">
                  {customer.phone || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">E-posta</p>
                <p className="mt-1 break-all font-medium">
                  {customer.email || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">İl</p>
                <p className="mt-1 font-medium">
                  {customer.city || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">İlçe</p>
                <p className="mt-1 font-medium">
                  {customer.district || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Posta Kodu</p>
                <p className="mt-1 font-medium">
                  {customer.postal_code || "-"}
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs text-gray-500">Adres</p>
                <p className="mt-1 whitespace-pre-wrap font-medium">
                  {customer.address || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* TİCARİ BİLGİLER */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-5 text-lg font-semibold">
              Ticari Bilgiler
            </h2>

            <div className="space-y-5">
              <div>
                <p className="text-xs text-gray-500">
                  Müşteri Tipi
                </p>
                <p className="mt-1 font-medium">
                  {customer.customer_type || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Tercih Edilen Ödeme
                </p>
                <p className="mt-1 font-medium">
                  {customer.payment_method || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Vade</p>
                <p className="mt-1 font-medium">
                  {customer.payment_term || 0} gün
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Kredi Limiti
                </p>
                <p className="mt-1 font-medium">
                  ₺{formatPrice(creditLimit)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Vergi Dairesi
                </p>
                <p className="mt-1 font-medium">
                  {customer.tax_office || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Vergi No</p>
                <p className="mt-1 font-medium">
                  {customer.tax_number || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CARİ HAREKETLER */}
        <div className="mt-6 rounded-xl border bg-white p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Cari Hareketler
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Satış, tahsilat, iade ve diğer cari hareketleri
              </p>
            </div>

            <button
              onClick={openPaymentModal}
              disabled={
                currentBalance <= 0 || customer.is_active === false
              }
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Tahsilat
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">
                Henüz cari hareket yok
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Sipariş veya tahsilat oluşturulduğunda burada
                görünecek.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="px-3 py-3">Tarih</th>
                    <th className="px-3 py-3">İşlem</th>
                    <th className="px-3 py-3">Açıklama</th>
                    <th className="px-3 py-3">Ödeme</th>
                    <th className="px-3 py-3 text-right">
                      Tutar
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction) => {
                    const direction = getTransactionDirection(
                      transaction.transaction_type
                    );

                    const isCredit = direction === "credit";

                    return (
                      <tr
                        key={transaction.id}
                        className="border-b last:border-0 hover:bg-gray-50"
                      >
                        <td className="whitespace-nowrap px-3 py-4">
                          <div>
                            {formatDate(transaction.created_at)}
                          </div>

                          <div className="text-xs text-gray-400">
                            {formatDateTime(
                              transaction.created_at
                            ).split(" ")[1]}
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              isCredit
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {getTransactionLabel(
                              transaction.transaction_type
                            )}
                          </span>
                        </td>

                        <td className="max-w-xs px-3 py-4 text-gray-600">
                          {transaction.note || "-"}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4">
                          {transaction.payment_method || "-"}
                        </td>

                        <td
                          className={`whitespace-nowrap px-3 py-4 text-right font-semibold ${
                            isCredit
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {isCredit ? "-" : "+"}₺
                          {formatPrice(
                            Number(transaction.amount || 0)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SİPARİŞ GEÇMİŞİ */}
        <div className="mt-6 rounded-xl border bg-white p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Sipariş Geçmişi
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Müşteriye ait tüm siparişler
              </p>
            </div>

            <span className="text-sm text-gray-500">
              {orders.length} kayıt
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">
                Henüz sipariş yok
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Bu müşteriye ait siparişler burada görünecek.
              </p>
            </div>
          ) : (
            <>
              {/* MOBİL */}
              <div className="space-y-3 md:hidden">
                {orders.map((order) => {
                  const statusLabel =
                    STATUS_LABELS[order.status] || order.status;

                  const statusClass =
                    STATUS_CLASSES[order.status] ||
                    "bg-gray-100 text-gray-700";

                  return (
                    <button
                      key={order.id}
                      onClick={() =>
                        router.push(
                          `/siparis-gecmisi/${order.id}`
                        )
                      }
                      className="w-full rounded-xl border p-4 text-left hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">
                          #{order.order_number}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-500">
                            Tarih
                          </p>

                          <p className="mt-1 text-sm">
                            {formatDate(order.created_at)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            Toplam
                          </p>

                          <p
                            className={`mt-1 font-semibold ${
                              order.status === "cancelled"
                                ? "text-gray-400 line-through"
                                : "text-gray-900"
                            }`}
                          >
                            ₺{formatPrice(Number(order.total || 0))}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* MASAÜSTÜ */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="px-3 py-3">Sipariş</th>
                      <th className="px-3 py-3">Tarih</th>
                      <th className="px-3 py-3">Durum</th>
                      <th className="px-3 py-3 text-right">
                        Toplam
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => {
                      const statusLabel =
                        STATUS_LABELS[order.status] ||
                        order.status;

                      const statusClass =
                        STATUS_CLASSES[order.status] ||
                        "bg-gray-100 text-gray-700";

                      return (
                        <tr
                          key={order.id}
                          onClick={() =>
                            router.push(
                              `/siparis-gecmisi/${order.id}`
                            )
                          }
                          className="cursor-pointer border-b last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-3 py-4 font-medium">
                            #{order.order_number}
                          </td>

                          <td className="whitespace-nowrap px-3 py-4">
                            {formatDate(order.created_at)}
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                          </td>

                          <td
                            className={`px-3 py-4 text-right font-semibold ${
                              order.status === "cancelled"
                                ? "text-gray-400 line-through"
                                : "text-gray-900"
                            }`}
                          >
                            ₺{formatPrice(
                              Number(order.total || 0)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* NOTLAR */}
        <div className="mt-6 rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Notlar</h2>

          <div className="rounded-lg bg-gray-50 p-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
              {customer.notes ||
                "Bu müşteri için henüz not eklenmemiş."}
            </p>
          </div>
        </div>
      </div>

      {/* TAHSİLAT MODALI */}
      {paymentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingPayment) {
              setPaymentModal(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Tahsilat Ekle
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {customer.company_name}
                </p>
              </div>

              <button
                onClick={() => setPaymentModal(false)}
                disabled={savingPayment}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* TUTAR */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tahsilat Tutarı
                </label>

                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(event.target.value)
                  }
                  placeholder="Örn. 1.500,00"
                  autoFocus
                  disabled={savingPayment}
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                />
              </div>

              {/* ÖDEME YÖNTEMİ */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Ödeme Yöntemi
                </label>

                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                  disabled={savingPayment}
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option
                      key={method.value}
                      value={method.value}
                    >
                      {method.label}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-xs text-gray-400">
                  Tahsilat seçilen kasa/banka hesabına
                  aktarılacaktır.
                </p>
              </div>

              {/* NOT */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Not
                </label>

                <textarea
                  value={paymentNote}
                  onChange={(event) =>
                    setPaymentNote(event.target.value)
                  }
                  placeholder="Örn. Elden tahsil edildi"
                  rows={3}
                  disabled={savingPayment}
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                />
              </div>

              {/* BORÇ BİLGİSİ */}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex justify-between text-sm">
                  <span>Mevcut Borç</span>

                  <strong
                    className={
                      currentBalance > 0
                        ? "text-red-600"
                        : "text-gray-900"
                    }
                  >
                    ₺
                    {formatPrice(
                      Math.max(currentBalance, 0)
                    )}
                  </strong>
                </div>

                {creditLimit > 0 && (
                  <div className="mt-2 flex justify-between text-sm">
                    <span>Kullanılabilir Kredi</span>

                    <strong className="text-blue-600">
                      ₺{formatPrice(availableCredit)}
                    </strong>
                  </div>
                )}

                {paymentAmount &&
                  Number.isFinite(parseAmount(paymentAmount)) &&
                  parseAmount(paymentAmount) > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <div className="flex justify-between text-sm">
                        <span>Tahsilat Sonrası Bakiye</span>

                        <strong
                          className={
                            currentBalance -
                              parseAmount(paymentAmount) >
                            0.005
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >
                          ₺
                          {formatPrice(
                            Math.abs(
                              currentBalance -
                                parseAmount(paymentAmount)
                            )
                          )}
                        </strong>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPaymentModal(false)}
                disabled={savingPayment}
                className="flex-1 rounded-lg border px-4 py-3 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Vazgeç
              </button>

              <button
                onClick={addPayment}
                disabled={
                  savingPayment ||
                  currentBalance <= 0 ||
                  customer.is_active === false
                }
                className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPayment
                  ? "Kaydediliyor..."
                  : "Tahsilatı Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

