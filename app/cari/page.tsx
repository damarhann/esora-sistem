"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  city: string | null;
  payment_method: string | null;
  payment_term: number | null;
  credit_limit: number | null;
};

type AccountTransaction = {
  id: string;
  customer_id: string;
  transaction_type: string;
  amount: number;
  reference_id: string | null;
  payment_method: string | null;
  note: string | null;
  created_at: string;
};

type CustomerBalance = Customer & {
  sales: number;
  payments: number;
  refunds: number;
  balance: number;
};

export default function CariPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerBalance | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Nakit");
  const [paymentNote, setPaymentNote] = useState("");

  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    loadCari();
  }, []);

  async function loadCari() {
    setLoading(true);

    const [customersResult, transactionsResult] =
      await Promise.all([
        supabase
          .from("customers")
          .select(
            `
              id,
              company_name,
              contact_name,
              phone,
              city,
              payment_method,
              payment_term,
              credit_limit
            `
          )
          .order("company_name", {
            ascending: true,
          }),

        supabase
          .from("account_transactions")
          .select("*")
          .order("created_at", {
            ascending: false,
          }),
      ]);

    if (customersResult.error) {
      console.error(
        "CUSTOMERS ERROR:",
        customersResult.error
      );

      alert(
        "Müşteriler yüklenirken bir hata oluştu."
      );

      setLoading(false);
      return;
    }

    if (transactionsResult.error) {
      console.error(
        "TRANSACTIONS ERROR:",
        transactionsResult.error
      );

      alert(
        "Cari hareketleri yüklenirken bir hata oluştu."
      );

      setLoading(false);
      return;
    }

    setCustomers(customersResult.data || []);
    setTransactions(transactionsResult.data || []);

    setLoading(false);
  }

  const customerBalances = useMemo(() => {
    return customers.map((customer) => {
      const customerTransactions =
        transactions.filter(
          (transaction) =>
            transaction.customer_id === customer.id
        );

      const sales =
        customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === "sale"
          )
          .reduce(
            (sum, transaction) =>
              sum + Number(transaction.amount || 0),
            0
          );

      const payments =
        customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === "payment"
          )
          .reduce(
            (sum, transaction) =>
              sum + Number(transaction.amount || 0),
            0
          );

      const refunds =
        customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === "refund"
          )
          .reduce(
            (sum, transaction) =>
              sum + Number(transaction.amount || 0),
            0
          );

      const balance =
        sales - payments - refunds;

      return {
        ...customer,
        sales,
        payments,
        refunds,
        balance,
      };
    });
  }, [customers, transactions]);

  const totalSales = useMemo(() => {
    return customerBalances.reduce(
      (sum, customer) =>
        sum + customer.sales,
      0
    );
  }, [customerBalances]);

  const totalPayments = useMemo(() => {
    return customerBalances.reduce(
      (sum, customer) =>
        sum + customer.payments,
      0
    );
  }, [customerBalances]);

  const totalRefunds = useMemo(() => {
    return customerBalances.reduce(
      (sum, customer) =>
        sum + customer.refunds,
      0
    );
  }, [customerBalances]);

  const totalCustomerDebt = useMemo(() => {
  return customerBalances.reduce(
    (sum, customer) =>
      sum + Math.max(customer.balance, 0),
    0
  );
}, [customerBalances]);

const totalCustomerCredit = useMemo(() => {
  return customerBalances.reduce(
    (sum, customer) =>
      sum + Math.max(-customer.balance, 0),
    0
  );
}, [customerBalances]);

  function formatPrice(value: number) {
    return Number(value || 0).toLocaleString(
      "tr-TR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function getTransactionText(
    transactionType: string
  ) {
    switch (transactionType) {
      case "sale":
        return "Satış";

      case "payment":
        return "Tahsilat";

      case "refund":
        return "İade";

      default:
        return transactionType;
    }
  }

  function getTransactionClass(
    transactionType: string
  ) {
    switch (transactionType) {
      case "sale":
        return "bg-red-100 text-red-700";

      case "payment":
        return "bg-green-100 text-green-700";

      case "refund":
        return "bg-blue-100 text-blue-700";

      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  function getTransactionAmount(
    transaction: AccountTransaction
  ) {
    if (
      transaction.transaction_type === "sale"
    ) {
      return `+${formatPrice(
        Number(transaction.amount)
      )} ₺`;
    }

    return `-${formatPrice(
      Number(transaction.amount)
    )} ₺`;
  }

  function openCustomer(
    customer: CustomerBalance
  ) {
    setSelectedCustomer(customer);
  }

  function openPaymentModal() {
    if (!selectedCustomer) {
      return;
    }

    setPaymentAmount("");
    setPaymentMethod("Nakit");
    setPaymentNote("");
    setShowPaymentModal(true);
  }

  async function addPayment() {
    if (!selectedCustomer) {
      return;
    }

    const amount = Number(
      paymentAmount.replace(",", ".")
    );

    if (!amount || amount <= 0) {
      alert(
        "Geçerli bir tahsilat tutarı girin."
      );
      return;
    }

    if (
      selectedCustomer.balance <= 0
    ) {
      alert(
        "Bu müşterinin mevcut borcu bulunmuyor."
      );
      return;
    }

    if (
      amount > selectedCustomer.balance
    ) {
      const confirmed = window.confirm(
        `Tahsilat tutarı mevcut cari borçtan yüksek.\n\n` +
          `Mevcut borç: ${formatPrice(
            selectedCustomer.balance
          )} ₺\n` +
          `Tahsilat: ${formatPrice(
            amount
          )} ₺\n\n` +
          "Fazla tahsilat girmek istediğinize emin misiniz?"
      );

      if (!confirmed) {
        return;
      }
    }

    setSavingPayment(true);

    const { error } =
      await supabase.rpc(
        "add_customer_payment",
        {
          p_customer_id:
            selectedCustomer.id,
          p_amount: amount,
          p_payment_method:
            paymentMethod,
          p_note:
            paymentNote.trim() || null,
        }
      );

    if (error) {
      console.error(
        "PAYMENT ERROR:",
        error
      );

      alert(
        `Tahsilat eklenemedi.\n\n${error.message}`
      );

      setSavingPayment(false);
      return;
    }

    setSavingPayment(false);
    setShowPaymentModal(false);

    alert(
      `${formatPrice(amount)} ₺ tahsilat başarıyla eklendi.`
    );

    await loadCari();

    setSelectedCustomer(null);
  }

  const selectedCustomerTransactions =
    selectedCustomer
      ? transactions
          .filter(
            (transaction) =>
              transaction.customer_id ===
              selectedCustomer.id
          )
          .sort(
            (a, b) =>
              new Date(
                b.created_at
              ).getTime() -
              new Date(
                a.created_at
              ).getTime()
          )
      : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-10">
        <p className="text-slate-500">
          Cari hesaplar yükleniyor...
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
              Cari Hesaplar
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Müşteri borçlarını ve tahsilatlarını yönetin.
            </p>
          </div>

          <button
            type="button"
            onClick={loadCari}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Yenile
          </button>
        </div>

        {/* ÖZET KARTLARI */}
          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
          Toplam Müşteri Borcu
          </p>

          <p className="mt-2 text-2xl font-bold text-red-600">
          {formatPrice(totalCustomerDebt)} ₺
         </p>
       </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Toplam Satış
            </p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              {formatPrice(totalSales)} ₺
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Toplam Tahsilat
            </p>

            <p className="mt-2 text-2xl font-bold text-green-600">
              {formatPrice(totalPayments)} ₺
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Toplam İade
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-600">
              {formatPrice(totalRefunds)} ₺
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <p className="text-sm font-medium text-slate-500">
    Müşteri Alacağı
  </p>

  <p className="mt-2 text-2xl font-bold text-blue-600">
    {formatPrice(totalCustomerCredit)} ₺
  </p>
</div>

        </div>

        {/* MÜŞTERİLER */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-900">
              Müşteri Cari Hesapları
            </h2>
          </div>

          {customerBalances.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              Henüz müşteri bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                      Müşteri
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Satış
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Tahsilat
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      İade
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      Bakiye
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">
                      İşlem
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {customerBalances.map(
                    (customer) => (
                      <tr
                        key={customer.id}
                        className="hover:bg-slate-50"
                      >

                        <td className="px-6 py-5">
                          <div className="font-semibold text-slate-900">
                            {customer.company_name}
                          </div>

                          {customer.contact_name && (
                            <div className="mt-1 text-xs text-slate-400">
                              {customer.contact_name}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-5 text-right font-semibold text-red-600">
                          {formatPrice(
                            customer.sales
                          )}{" "}
                          ₺
                        </td>

                        <td className="px-6 py-5 text-right font-semibold text-green-600">
                          {formatPrice(
                            customer.payments
                          )}{" "}
                          ₺
                        </td>

                        <td className="px-6 py-5 text-right font-semibold text-blue-600">
                          {formatPrice(
                            customer.refunds
                          )}{" "}
                          ₺
                        </td>

                        <td className="px-6 py-5 text-right">
  {customer.balance > 0 ? (
    <div>
      <div className="font-bold text-red-600">
        {formatPrice(customer.balance)} ₺
      </div>

      <div className="mt-1 text-xs font-medium text-slate-400">
        Borç
      </div>
    </div>
  ) : customer.balance < 0 ? (
    <div>
      <div className="font-bold text-blue-600">
        {formatPrice(Math.abs(customer.balance))} ₺
      </div>

      <div className="mt-1 text-xs font-medium text-blue-500">
        Müşteri Alacaklı
      </div>
    </div>
  ) : (
    <div>
      <div className="font-bold text-green-600">
        0,00 ₺
      </div>

      <div className="mt-1 text-xs font-medium text-green-500">
        Hesap Kapalı
      </div>
    </div>
  )}
</td>

                        <td className="px-6 py-5 text-right">

                          <button
                            type="button"
                            onClick={() =>
                              openCustomer(
                                customer
                              )
                            }
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                          >
                            Detay
                          </button>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>

      {/* CARİ DETAY MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-slate-200 p-6">

              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {selectedCustomer.company_name}
                </h2>

                {selectedCustomer.contact_name && (
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedCustomer.contact_name}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedCustomer(null)
                }
                className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>

            </div>

            <div className="max-h-[calc(90vh-90px)] overflow-y-auto p-6">

              {/* CARİ ÖZET */}
              <div className="mb-6 grid gap-4 md:grid-cols-4">

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-400">
                    Satış
                  </p>

                  <p className="mt-1 text-lg font-bold text-red-600">
                    {formatPrice(
                      selectedCustomer.sales
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-400">
                    Tahsilat
                  </p>

                  <p className="mt-1 text-lg font-bold text-green-600">
                    {formatPrice(
                      selectedCustomer.payments
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-400">
                    İade
                  </p>

                  <p className="mt-1 text-lg font-bold text-blue-600">
                    {formatPrice(
                      selectedCustomer.refunds
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900 p-4 text-white">
                  <p className="text-xs font-semibold text-slate-300">
                    Güncel Bakiye
                  </p>

                  <p className="mt-1 text-lg font-bold">
                    {formatPrice(
                      selectedCustomer.balance
                    )}{" "}
                    ₺
                  </p>
                </div>

              </div>

              {/* MÜŞTERİ BİLGİLERİ */}
              <div className="mb-6 rounded-xl border border-slate-200 p-5">

                <div className="grid gap-4 md:grid-cols-3">

                  {selectedCustomer.phone && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Telefon
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedCustomer.phone}
                      </p>
                    </div>
                  )}

                  {selectedCustomer.city && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Şehir
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedCustomer.city}
                      </p>
                    </div>
                  )}

                  {selectedCustomer.payment_term !==
                    null && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Vade
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedCustomer.payment_term} gün
                      </p>
                    </div>
                  )}

                </div>

              </div>

              {/* BUTONLAR */}
              <div className="mb-6 flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={openPaymentModal}
                  disabled={
                    selectedCustomer.balance <= 0
                  }
                  className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Tahsilat Ekle
                </button>

              </div>

              {/* HAREKETLER */}
              <div className="overflow-hidden rounded-xl border border-slate-200">

                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <h3 className="font-bold text-slate-900">
                    Cari Hareketleri
                  </h3>
                </div>

                {selectedCustomerTransactions.length ===
                0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Bu müşteriye ait cari hareket bulunmuyor.
                  </div>
                ) : (
                  <div className="overflow-x-auto">

                    <table className="w-full">

                      <thead>
                        <tr className="border-b border-slate-200">

                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">
                            Tarih
                          </th>

                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">
                            İşlem
                          </th>

                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">
                            Açıklama
                          </th>

                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">
                            Ödeme Yöntemi
                          </th>

                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">
                            Tutar
                          </th>

                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">

                        {selectedCustomerTransactions.map(
                          (transaction) => (
                            <tr
                              key={transaction.id}
                            >

                              <td className="px-5 py-4 text-sm text-slate-500">
                                {formatDate(
                                  transaction.created_at
                                )}
                              </td>

                              <td className="px-5 py-4">

                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getTransactionClass(
                                    transaction.transaction_type
                                  )}`}
                                >
                                  {getTransactionText(
                                    transaction.transaction_type
                                  )}
                                </span>

                              </td>

                              <td className="px-5 py-4 text-sm text-slate-700">
                                {transaction.note ||
                                  "-"}
                              </td>

                              <td className="px-5 py-4 text-sm text-slate-600">
                                {transaction.payment_method ||
                                  "-"}
                              </td>

                              <td
                                className={`px-5 py-4 text-right font-bold ${
                                  transaction.transaction_type ===
                                  "sale"
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {getTransactionAmount(
                                  transaction
                                )}
                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>
                )}

              </div>

            </div>

          </div>

        </div>
      )}

      {/* TAHSİLAT MODAL */}
      {showPaymentModal &&
        selectedCustomer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">

            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">

              <div className="border-b border-slate-200 p-6">

                <h2 className="text-xl font-bold text-slate-900">
                  Tahsilat Ekle
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedCustomer.company_name}
                </p>

              </div>

              <div className="space-y-5 p-6">

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-400">
                    Mevcut Cari Bakiye
                  </p>

                  <p className="mt-1 text-xl font-bold text-red-600">
                    {formatPrice(
                      selectedCustomer.balance
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Tahsilat Tutarı
                  </label>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={paymentAmount}
                    onChange={(e) =>
                      setPaymentAmount(
                        e.target.value
                      )
                    }
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Ödeme Yöntemi
                  </label>

                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900"
                  >
                    <option value="Nakit">
                      Nakit
                    </option>

                    <option value="Havale">
                      Havale
                    </option>

                    <option value="EFT">
                      EFT
                    </option>

                    <option value="Kredi Kartı">
                      Kredi Kartı
                    </option>

                    <option value="Çek">
                      Çek
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Açıklama
                  </label>

                  <textarea
                    value={paymentNote}
                    onChange={(e) =>
                      setPaymentNote(
                        e.target.value
                      )
                    }
                    placeholder="Ödeme ile ilgili not..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  />
                </div>

              </div>

              <div className="flex gap-3 border-t border-slate-200 p-6">

                <button
                  type="button"
                  onClick={() =>
                    setShowPaymentModal(false)
                  }
                  disabled={savingPayment}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Vazgeç
                </button>

                <button
                  type="button"
                  onClick={addPayment}
                  disabled={savingPayment}
                  className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPayment
                    ? "Kaydediliyor..."
                    : "Tahsilatı Kaydet"}
                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}