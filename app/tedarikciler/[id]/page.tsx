"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Supplier = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  tax_number: string | null;
  tax_office: string | null;
  payment_method: string | null;
  payment_term: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type Transaction = {
  id: string;
  transaction_type: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
  reference_id: string | null;
  created_at: string;
};

type Purchase = {
  id: string;
  purchase_number: number;
  status: string;
  total: number;
  notes: string | null;
  created_at: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function transactionLabel(type: string) {
  switch (type) {
    case "purchase":
      return "Alış";
    case "payment":
      return "Ödeme";
    case "adjustment_debit":
      return "Borç Düzeltme";
    case "adjustment_credit":
      return "Alacak Düzeltme";
    case "refund":
      return "İade";
    default:
      return type;
  }
}

function transactionIsDebit(type: string) {
  return (
    type === "purchase" ||
    type === "adjustment_debit"
  );
}

function purchaseStatusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Taslak";
    case "ordered":
      return "Sipariş Verildi";
    case "received":
      return "Teslim Alındı";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal";
    default:
      return status;
  }
}

function purchaseStatusClass(status: string) {
  switch (status) {
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "draft":
      return "bg-slate-100 text-slate-600";
    case "ordered":
      return "bg-blue-100 text-blue-700";
    case "received":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-emerald-100 text-emerald-700";
  }
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();

  const supplierId = params.id as string;

  const [supplier, setSupplier] =
    useState<Supplier | null>(null);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [savingPayment, setSavingPayment] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showPaymentModal, setShowPaymentModal] =
    useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "Havale / EFT",
    note: "",
  });

  async function loadData() {
    setLoading(true);
    setError("");

    const [
      supplierResult,
      transactionResult,
      purchaseResult,
    ] = await Promise.all([
      supabase
        .from("suppliers")
        .select("*")
        .eq("id", supplierId)
        .single(),

      supabase
        .from("supplier_transactions")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("purchase_orders")
        .select(
          "id, purchase_number, status, total, notes, created_at"
        )
        .eq("supplier_id", supplierId)
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (supplierResult.error) {
      console.error(supplierResult.error);
      setError(supplierResult.error.message);
      setLoading(false);
      return;
    }

    if (transactionResult.error) {
      console.error(transactionResult.error);
      setError(transactionResult.error.message);
      setLoading(false);
      return;
    }

    if (purchaseResult.error) {
      console.error(purchaseResult.error);
      setError(purchaseResult.error.message);
      setLoading(false);
      return;
    }

    setSupplier(
      supplierResult.data as Supplier
    );

    setTransactions(
      (transactionResult.data || []) as Transaction[]
    );

    setPurchases(
      (purchaseResult.data || []) as Purchase[]
    );

    setLoading(false);
  }

  useEffect(() => {
    if (supplierId) {
      loadData();
    }
  }, [supplierId]);

  /*
   * =========================================================
   * TEDARİKÇİ CARİ HESAP MANTIĞI
   * =========================================================
   *
   * purchase:
   * Tedarikçiye borç oluşturur.
   *
   * payment:
   * Tedarikçiye yaptığımız gerçek ödemedir.
   *
   * refund:
   * İptal edilen alışın cari geri alma hareketidir.
   *
   * adjustment_debit:
   * Ek borç oluşturur.
   *
   * adjustment_credit:
   * Borcu azaltır / tedarikçiden alacağımızı artırır.
   */

  // Geçmişte oluşturulan bütün alışların toplamı.
  // İptal edilen alışlar da burada görünür.
  const totalPurchases = transactions
    .filter(
      (item) =>
        item.transaction_type === "purchase"
    )
    .reduce(
      (total, item) =>
        total + Number(item.amount),
      0
    );

  // Tedarikçiye gerçekten yapılan ödemeler.
  // İadeler burada KESİNLİKLE sayılmaz.
  const totalPayments = transactions
    .filter(
      (item) =>
        item.transaction_type === "payment"
    )
    .reduce(
      (total, item) =>
        total + Number(item.amount),
      0
    );

  // İptal/iade hareketlerinin toplamı.
  const totalRefunds = transactions
    .filter(
      (item) =>
        item.transaction_type === "refund"
    )
    .reduce(
      (total, item) =>
        total + Number(item.amount),
      0
    );

  // Ek borç düzeltmeleri.
  const totalDebitAdjustments = transactions
    .filter(
      (item) =>
        item.transaction_type ===
        "adjustment_debit"
    )
    .reduce(
      (total, item) =>
        total + Number(item.amount),
      0
    );

  // Alacak düzeltmeleri.
  const totalCreditAdjustments = transactions
    .filter(
      (item) =>
        item.transaction_type ===
        "adjustment_credit"
    )
    .reduce(
      (total, item) =>
        total + Number(item.amount),
      0
    );

  // İadeler düşüldükten sonraki gerçek alış.
  const netPurchases =
    totalPurchases - totalRefunds;

  // Cari hesabın toplam borç tarafı.
  const totalDebt =
    totalPurchases +
    totalDebitAdjustments;

  // Cari hesabın toplam alacak tarafı.
  const totalCredit =
    totalPayments +
    totalRefunds +
    totalCreditAdjustments;

  // Pozitifse tedarikçiye borçluyuz.
  // Negatifse tedarikçiden alacağımız var.
  const netBalance =
    totalDebt - totalCredit;

  const currentDebt =
    Math.max(netBalance, 0);

  const supplierReceivable =
    Math.max(-netBalance, 0);

  // Aktif, yani iptal edilmemiş alışlar.
  const activePurchases =
    purchases.filter(
      (purchase) =>
        purchase.status !== "cancelled"
    );

  const activePurchaseCount =
    activePurchases.length;

  async function addPayment() {
    setError("");

    const amount = Number(
      paymentForm.amount
    );

    if (!amount || amount <= 0) {
      setError(
        "Ödeme tutarı 0'dan büyük olmalıdır."
      );
      return;
    }

    if (amount > currentDebt) {
      setError(
        "Ödeme tutarı mevcut tedarikçi borcundan fazla olamaz."
      );
      return;
    }

    setSavingPayment(true);

    const { data: paymentId, error: paymentError } =
  await supabase.rpc("add_supplier_payment", {
    p_supplier_id: supplierId,
    p_amount: amount,
    p_payment_method: paymentForm.payment_method,
    p_note:
      paymentForm.note.trim() ||
      "Tedarikçiye ödeme yapıldı.",
  });

    if (paymentError) {
      console.error(paymentError);
      setError(paymentError.message);
      setSavingPayment(false);
      return;
    }

    setPaymentForm({
      amount: "",
      payment_method: "Havale / EFT",
      note: "",
    });

    setShowPaymentModal(false);
    setSavingPayment(false);

    await loadData();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Tedarikçi bilgileri yükleniyor...
        </div>
      </main>
    );
  }

  if (!supplier) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          Tedarikçi bulunamadı.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <button
              onClick={() =>
                router.push("/tedarikciler")
              }
              className="mb-3 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Tedarikçilere Dön
            </button>

            <h1 className="text-2xl font-bold text-slate-900">
              {supplier.company_name}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Tedarikçi cari ve alış detayları
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            <button
  onClick={() =>
    setShowPaymentModal(true)
  }
  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
>
  + Tedarikçiye Ödeme
</button>

            <button
              onClick={() =>
                router.push(
                  `/alislar?tedarikci=${supplierId}`
                )
              }
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              + Yeni Alış
            </button>

          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-bold">
              İşlem gerçekleştirilemedi.
            </div>

            <div className="mt-1">
              {error}
            </div>
          </div>
        )}

        {/* SUMMARY */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">

          {/* TOPLAM ALIŞ */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Toplam Alış
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {formatMoney(
                totalPurchases
              )}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Geçmiş tüm alışlar
            </div>
          </div>

          {/* TOPLAM İADE */}
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="text-sm text-red-700">
              Toplam İade
            </div>

            <div className="mt-2 text-2xl font-bold text-red-700">
              {formatMoney(
                totalRefunds
              )}
            </div>

            <div className="mt-1 text-xs text-red-500">
              İptal edilen alışlar
            </div>
          </div>

          {/* NET ALIŞ */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Net Alış
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {formatMoney(
                netPurchases
              )}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Alış − İade
            </div>
          </div>

          {/* TOPLAM ÖDEME */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="text-sm text-emerald-700">
              Toplam Ödeme
            </div>

            <div className="mt-2 text-2xl font-bold text-emerald-700">
              {formatMoney(
                totalPayments
              )}
            </div>

            <div className="mt-1 text-xs text-emerald-600">
              Gerçek ödemeler
            </div>
          </div>

          {/* GÜNCEL BORÇ */}
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <div className="text-sm text-orange-700">
              Güncel Borç
            </div>

            <div className="mt-2 text-2xl font-bold text-orange-700">
              {formatMoney(
                currentDebt
              )}
            </div>

            <div className="mt-1 text-xs text-orange-600">
              Tedarikçiye ödenecek
            </div>
          </div>

          {/* TEDARİKÇİDEN ALACAK */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="text-sm text-blue-700">
              Tedarikçiden Alacak
            </div>

            <div className="mt-2 text-2xl font-bold text-blue-700">
              {formatMoney(
                supplierReceivable
              )}
            </div>

            <div className="mt-1 text-xs text-blue-600">
              Tedarikçiden alınacak
            </div>
          </div>

        </section>

        {/* PURCHASE COUNT */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="text-sm text-slate-500">
              Aktif Alış Sayısı:
            </span>{" "}
            <strong className="text-slate-900">
              {activePurchaseCount}
            </strong>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="text-sm text-slate-500">
              Toplam Alış Kaydı:
            </span>{" "}
            <strong className="text-slate-900">
              {purchases.length}
            </strong>
          </div>
        </div>

        {/* SUPPLIER INFO */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Firma Bilgileri
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Tedarikçi iletişim ve ödeme bilgileri
              </p>
            </div>

            {supplier.is_active ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Aktif
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                Pasif
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">

            <div>
              <div className="text-xs font-semibold text-slate-400">
                Yetkili
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {supplier.contact_name || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400">
                Telefon
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {supplier.phone || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400">
                E-posta
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {supplier.email || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400">
                Ödeme
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {supplier.payment_method ||
                  "Nakit"}

                {Number(
                  supplier.payment_term
                ) > 0 &&
                  ` · ${supplier.payment_term} gün`}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400">
                Konum
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {[
                  supplier.city,
                  supplier.district,
                ]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="text-xs font-semibold text-slate-400">
                Adres
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {supplier.address || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400">
                Vergi
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {supplier.tax_number || "-"}
              </div>

              {supplier.tax_office && (
                <div className="mt-1 text-xs text-slate-400">
                  {supplier.tax_office}
                </div>
              )}
            </div>

          </div>

          {supplier.notes && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-400">
                Not
              </div>

              <div className="mt-1 text-sm text-slate-700">
                {supplier.notes}
              </div>
            </div>
          )}

        </section>

        {/* PURCHASE HISTORY */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Alış Geçmişi
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Bu tedarikçiden yapılan tüm alışlar
            </p>
          </div>

          {purchases.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Henüz alış kaydı bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">

                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-400">

                    <th className="px-5 py-4">
                      Alış No
                    </th>

                    <th className="px-5 py-4">
                      Tarih
                    </th>

                    <th className="px-5 py-4">
                      Durum
                    </th>

                    <th className="px-5 py-4">
                      Not
                    </th>

                    <th className="px-5 py-4 text-right">
                      Tutar
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {purchases.map((purchase) => (
                    <tr
                      key={purchase.id}
                      onClick={() =>
                        router.push(
                          `/alislar/${purchase.id}`
                        )
                      }
                      className={`cursor-pointer border-b border-slate-100 last:border-0 transition hover:bg-slate-50 ${
                        purchase.status ===
                        "cancelled"
                          ? "bg-red-50/30"
                          : ""
                      }`}
                    >

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        #{purchase.purchase_number}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(
                          purchase.created_at
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${purchaseStatusClass(
                            purchase.status
                          )}`}
                        >
                          {purchaseStatusLabel(
                            purchase.status
                          )}
                        </span>
                      </td>

                      <td className="max-w-[260px] truncate px-5 py-4 text-slate-500">
                        {purchase.notes || "-"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-slate-900">
                        {formatMoney(
                          Number(
                            purchase.total
                          )
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}

        </section>

        {/* ACCOUNT HISTORY */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Cari Hareketler
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Alış, ödeme, iade ve diğer cari hareketlerin tamamı
            </p>
          </div>

          {transactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Henüz cari hareket bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm">

                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-400">

                    <th className="px-5 py-4">
                      Tarih
                    </th>

                    <th className="px-5 py-4">
                      İşlem
                    </th>

                    <th className="px-5 py-4">
                      Açıklama
                    </th>

                    <th className="px-5 py-4">
                      Ödeme Yöntemi
                    </th>

                    <th className="px-5 py-4 text-right">
                      Tutar
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {transactions.map(
                    (transaction) => {
                      const debit =
                        transactionIsDebit(
                          transaction.transaction_type
                        );

                      return (
                        <tr
                          key={transaction.id}
                          className="border-b border-slate-100 last:border-0"
                        >

                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                            {formatDate(
                              transaction.created_at
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={
                                debit
                                  ? "rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700"
                                  : "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                              }
                            >
                              {transactionLabel(
                                transaction.transaction_type
                              )}
                            </span>
                          </td>

                          <td className="max-w-[360px] truncate px-5 py-4 text-slate-600">
                            {transaction.note ||
                              "-"}
                          </td>

                          <td className="px-5 py-4 text-slate-500">
                            {transaction.payment_method ||
                              "-"}
                          </td>

                          <td
                            className={`whitespace-nowrap px-5 py-4 text-right font-bold ${
                              debit
                                ? "text-orange-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {debit ? "+" : "-"}
                            {formatMoney(
                              Number(
                                transaction.amount
                              )
                            )}
                          </td>

                        </tr>
                      );
                    }
                  )}
                </tbody>

              </table>
            </div>
          )}

        </section>

        {/* PAYMENT MODAL */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

              <div className="flex items-center justify-between border-b border-slate-200 p-5">

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Tedarikçiye Ödeme
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Mevcut borç:{" "}
                    <strong>
                      {formatMoney(
                        currentDebt
                      )}
                    </strong>
                  </p>
                </div>

                <button
                  onClick={() =>
                    setShowPaymentModal(false)
                  }
                  className="text-xl text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>

              </div>

              <div className="space-y-4 p-5">

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Ödeme Tutarı *
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      paymentForm.amount
                    }
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        amount:
                          e.target.value,
                      })
                    }
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Ödeme Yöntemi
                  </label>

                  <select
                    value={
                      paymentForm.payment_method
                    }
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_method:
                          e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                  >
                    <option>Nakit</option>
                    <option>
                      Havale / EFT
                    </option>
                    <option>
                      Kredi Kartı
                    </option>
                    <option>Çek</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Açıklama
                  </label>

                  <textarea
                    rows={3}
                    value={
                      paymentForm.note
                    }
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        note: e.target.value,
                      })
                    }
                    placeholder="Ödeme açıklaması..."
                    className="w-full resize-none rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>

              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 p-5">

                <button
                  onClick={() =>
                    setShowPaymentModal(false)
                  }
                  className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Vazgeç
                </button>

                <button
  onClick={addPayment}
  disabled={savingPayment}
  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
>
  {savingPayment
    ? "Kaydediliyor..."
    : "Ödemeyi Kaydet"}
</button>
              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}

