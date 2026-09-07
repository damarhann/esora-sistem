"use client";

import { useEffect, useState } from "react";
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

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Nakit");
  const [paymentNote, setPaymentNote] = useState("");

  const [savingPayment, setSavingPayment] = useState(false);

  async function loadData() {
    if (!params.id) return;

    setLoading(true);

    const customerId = String(params.id);

    const [customerResult, transactionsResult, ordersResult] =
      await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .eq("id", customerId)
          .single(),

        supabase
          .from("account_transactions")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),

        supabase
          .from("orders")
          .select("id, order_number, total, status, created_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
      ]);

    if (customerResult.error) {
      console.error(customerResult.error);
      setCustomer(null);
    } else {
      setCustomer(customerResult.data);
    }

    if (transactionsResult.error) {
      console.error(transactionsResult.error);
      setTransactions([]);
    } else {
      setTransactions(transactionsResult.data || []);
    }

    if (ordersResult.error) {
      console.error(ordersResult.error);
      setOrders([]);
    } else {
      setOrders(ordersResult.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (params.id) {
      loadData();
    }
  }, [params.id]);

  async function addPayment() {
    const amount = Number(paymentAmount.replace(",", "."));

    if (!amount || amount <= 0) {
      alert("Geçerli bir tahsilat tutarı girin.");
      return;
    }

    setSavingPayment(true);

    const { error } = await supabase.rpc("add_customer_payment", {
      p_customer_id: String(params.id),
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_note: paymentNote || null,
    });

    setSavingPayment(false);

    if (error) {
      console.error(error);
      alert(`Tahsilat eklenemedi:\n${error.message}`);
      return;
    }

    alert("Tahsilat başarıyla eklendi.");

    setPaymentAmount("");
    setPaymentMethod("Nakit");
    setPaymentNote("");
    setPaymentModal(false);

    await loadData();
  }

  function formatPrice(value: number) {
    return Number(value || 0).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function getTransactionLabel(type: string) {
    switch (type) {
      case "sale":
        return "Satış";
      case "payment":
        return "Tahsilat";
      case "refund":
        return "İade";
      case "adjustment_debit":
        return "Borç Dekontu";
      case "adjustment_credit":
        return "Alacak Dekontu";
      default:
        return type;
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-gray-500">Müşteri yükleniyor...</p>
        </div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          <button
            onClick={() => router.back()}
            className="mb-6 rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            ← Geri
          </button>

          <div className="rounded-xl border bg-white p-8">
            <h1 className="text-xl font-semibold">
              Müşteri bulunamadı
            </h1>
          </div>
        </div>
      </main>
    );
  }

  const totalDebt = transactions
    .filter(
      (transaction) =>
        transaction.transaction_type === "sale" ||
        transaction.transaction_type === "adjustment_debit"
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const totalPayment = transactions
    .filter(
      (transaction) =>
        transaction.transaction_type === "payment" ||
        transaction.transaction_type === "adjustment_credit" ||
        transaction.transaction_type === "refund"
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const currentBalance = totalDebt - totalPayment;

  const totalSales = orders.reduce(
    (sum, order) => sum + Number(order.total),
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* Üst alan */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-3 text-sm text-gray-500 hover:text-gray-900"
            >
              ← Müşterilere Dön
            </button>

            <h1 className="text-3xl font-bold text-gray-900">
              {customer.company_name}
            </h1>

            <p className="mt-1 text-gray-500">
              {customer.customer_type || "Müşteri"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setPaymentModal(true)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
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

            {customer.phone && (
              <a
                href={`https://wa.me/90${customer.phone
                  .replace(/\D/g, "")
                  .replace(/^0/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Özet kartları */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Cari Bakiye
            </p>

            <p
              className={`mt-2 text-2xl font-bold ${
                currentBalance > 0
                  ? "text-red-600"
                  : currentBalance < 0
                  ? "text-green-600"
                  : "text-gray-900"
              }`}
            >
              ₺{formatPrice(Math.abs(currentBalance))}
            </p>

            <p className="mt-1 text-xs text-gray-400">
             {currentBalance > 0
  ? "Müşterinin ESORA'ya borcu"
  : currentBalance < 0
  ? "Müşteri ESORA'dan alacaklı"
  : "Cari hesap kapalı"}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Toplam Sipariş
            </p>

            <p className="mt-2 text-2xl font-bold">
              {orders.length}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              ₺{formatPrice(totalSales)} toplam satış
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Toplam Tahsilat
            </p>

            <p className="mt-2 text-2xl font-bold text-green-600">
              ₺{formatPrice(totalPayment)}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Tüm tahsilatlar
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Kredi Limiti
            </p>

            <p className="mt-2 text-2xl font-bold">
              ₺{formatPrice(Number(customer.credit_limit || 0))}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Vade: {customer.payment_term || 0} gün
            </p>
          </div>

        </div>

        {/* Ana bilgiler */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Firma bilgileri */}
          <div className="rounded-xl border bg-white p-6 lg:col-span-2">
            <h2 className="mb-5 text-lg font-semibold">
              Firma Bilgileri
            </h2>

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <p className="text-xs text-gray-500">
                  Firma Adı
                </p>
                <p className="mt-1 font-medium">
                  {customer.company_name}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Yetkili
                </p>
                <p className="mt-1 font-medium">
                  {customer.contact_name || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Telefon
                </p>
                <p className="mt-1 font-medium">
                  {customer.phone || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  E-posta
                </p>
                <p className="mt-1 font-medium">
                  {customer.email || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  İl
                </p>
                <p className="mt-1 font-medium">
                  {customer.city || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  İlçe
                </p>
                <p className="mt-1 font-medium">
                  {customer.district || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Posta Kodu
                </p>
                <p className="mt-1 font-medium">
                  {customer.postal_code || "-"}
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs text-gray-500">
                  Adres
                </p>
                <p className="mt-1 font-medium">
                  {customer.address || "-"}
                </p>
              </div>

            </div>
          </div>

          {/* Ticari bilgiler */}
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
                  Ödeme Yöntemi
                </p>
                <p className="mt-1 font-medium">
                  {customer.payment_method || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Vade
                </p>
                <p className="mt-1 font-medium">
                  {customer.payment_term || 0} gün
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Kredi Limiti
                </p>
                <p className="mt-1 font-medium">
                  ₺{formatPrice(Number(customer.credit_limit || 0))}
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
                <p className="text-xs text-gray-500">
                  Vergi No
                </p>
                <p className="mt-1 font-medium">
                  {customer.tax_number || "-"}
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* Cari hareketleri */}
        <div className="mt-6 rounded-xl border bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Cari Hareketler
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Satış ve tahsilat hareketleri
              </p>
            </div>

            <button
              onClick={() => setPaymentModal(true)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
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
                Sipariş veya tahsilat oluşturulduğunda burada görünecek.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                    const isPayment =
                      transaction.transaction_type === "payment" ||
                      transaction.transaction_type === "adjustment_credit" ||
                      transaction.transaction_type === "refund";

                    return (
                      <tr
                        key={transaction.id}
                        className="border-b last:border-0"
                      >
                        <td className="px-3 py-4">
                          {formatDate(transaction.created_at)}
                        </td>

                        <td className="px-3 py-4 font-medium">
                          {getTransactionLabel(
                            transaction.transaction_type
                          )}
                        </td>

                        <td className="px-3 py-4 text-gray-600">
                          {transaction.note || "-"}
                        </td>

                        <td className="px-3 py-4">
                          {transaction.payment_method || "-"}
                        </td>

                        <td
                          className={`px-3 py-4 text-right font-semibold ${
                            isPayment
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {isPayment ? "-" : "+"}₺
                          {formatPrice(Number(transaction.amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sipariş geçmişi */}
        <div className="mt-6 rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Sipariş Geçmişi
          </h2>

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
            <div className="overflow-x-auto">
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
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() =>
                        router.push(`/siparis-gecmisi/${order.id}`)
                      }
                      className="cursor-pointer border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-3 py-4 font-medium">
                        #{order.order_number}
                      </td>

                      <td className="px-3 py-4">
                        {formatDate(order.created_at)}
                      </td>

                      <td className="px-3 py-4">
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          {order.status}
                        </span>
                      </td>

                      <td className="px-3 py-4 text-right font-semibold">
                        ₺{formatPrice(Number(order.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notlar */}
        <div className="mt-6 rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Notlar
          </h2>

          <div className="rounded-lg bg-gray-50 p-4">
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {customer.notes ||
                "Bu müşteri için henüz not eklenmemiş."}
            </p>
          </div>
        </div>

      </div>

      {/* Tahsilat Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">

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
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tahsilat Tutarı
                </label>

                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(e.target.value)
                  }
                  placeholder="Örn. 1000"
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Ödeme Yöntemi
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value)
                  }
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
                >
                  <option>Nakit</option>
                  <option>Havale / EFT</option>
                  <option>Kredi Kartı</option>
                  <option>Çek</option>
                  <option>Diğer</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Not
                </label>

                <textarea
                  value={paymentNote}
                  onChange={(e) =>
                    setPaymentNote(e.target.value)
                  }
                  placeholder="Örn. Elden tahsil edildi"
                  rows={3}
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex justify-between text-sm">
                  <span>Mevcut Borç</span>
                  <strong>
                    ₺{formatPrice(Math.max(currentBalance, 0))}
                  </strong>
                </div>
              </div>

            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPaymentModal(false)}
                className="flex-1 rounded-lg border px-4 py-3 font-medium hover:bg-gray-50"
              >
                Vazgeç
              </button>

              <button
                onClick={addPayment}
                disabled={savingPayment}
                className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
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