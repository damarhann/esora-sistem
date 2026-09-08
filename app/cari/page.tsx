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

type CashAccount = {
  id: string;
  name: string;
  balance: number;
  is_active: boolean;
};

type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  iban: string | null;
  balance: number;
  is_active: boolean;
};

type CustomerBalance = Customer & {
  sales: number;
  payments: number;
  refunds: number;
  customerRefunds: number;
  balance: number;
};

type BalanceFilter =
  | "all"
  | "debt"
  | "credit"
  | "closed";

type PaymentMethod =
  | "Nakit"
  | "Havale"
  | "EFT";

export default function CariPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] =
    useState<AccountTransaction[]>([]);

  const [cashAccounts, setCashAccounts] =
    useState<CashAccount[]>([]);

  const [bankAccounts, setBankAccounts] =
    useState<BankAccount[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingAccounts, setLoadingAccounts] =
    useState(false);

  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerBalance | null>(null);

  const [showPaymentModal, setShowPaymentModal] =
    useState(false);

  const [showRefundModal, setShowRefundModal] =
    useState(false);

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("Nakit");

  const [paymentNote, setPaymentNote] =
    useState("");

  const [refundAmount, setRefundAmount] =
    useState("");

  const [refundPaymentMethod, setRefundPaymentMethod] =
    useState<PaymentMethod>("Nakit");

  const [refundNote, setRefundNote] =
    useState("");

  const [selectedCashAccountId, setSelectedCashAccountId] =
    useState("");

  const [selectedBankAccountId, setSelectedBankAccountId] =
    useState("");

  const [selectedRefundCashAccountId, setSelectedRefundCashAccountId] =
    useState("");

  const [selectedRefundBankAccountId, setSelectedRefundBankAccountId] =
    useState("");

  const [savingPayment, setSavingPayment] =
    useState(false);

  const [savingRefund, setSavingRefund] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [balanceFilter, setBalanceFilter] =
    useState<BalanceFilter>("all");

  useEffect(() => {
    loadCari();
  }, []);

  async function loadCari() {
    setLoading(true);
    setLoadingAccounts(true);

    const [
      customersResult,
      transactionsResult,
      cashAccountsResult,
      bankAccountsResult,
    ] = await Promise.all([
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
        .select(
          `
            id,
            customer_id,
            transaction_type,
            amount,
            reference_id,
            payment_method,
            note,
            created_at
          `
        )
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("cash_accounts")
        .select(
          `
            id,
            name,
            balance,
            is_active
          `
        )
        .eq("is_active", true)
        .order("name", {
          ascending: true,
        }),

      supabase
        .from("bank_accounts")
        .select(
          `
            id,
            bank_name,
            account_name,
            iban,
            balance,
            is_active
          `
        )
        .eq("is_active", true)
        .order("bank_name", {
          ascending: true,
        }),
    ]);

    if (customersResult.error) {
      console.error(
        "CUSTOMERS ERROR:",
        customersResult.error
      );

      alert(
        `Müşteriler yüklenemedi.\n\n${customersResult.error.message}`
      );

      setLoading(false);
      setLoadingAccounts(false);
      return;
    }

    if (transactionsResult.error) {
      console.error(
        "TRANSACTIONS ERROR:",
        transactionsResult.error
      );

      alert(
        `Cari hareketleri yüklenemedi.\n\n${transactionsResult.error.message}`
      );

      setLoading(false);
      setLoadingAccounts(false);
      return;
    }

    if (cashAccountsResult.error) {
      console.error(
        "CASH ACCOUNTS ERROR:",
        cashAccountsResult.error
      );

      alert(
        `Kasa hesapları yüklenemedi.\n\n${cashAccountsResult.error.message}\n\nSupabase RLS politikalarını kontrol edin.`
      );

      setCashAccounts([]);
    } else {
      const normalizedCashAccounts: CashAccount[] =
        (cashAccountsResult.data || []).map(
          (account) => ({
            id: account.id,
            name: account.name,
            balance: Number(
              account.balance || 0
            ),
            is_active: Boolean(
              account.is_active
            ),
          })
        );

      setCashAccounts(
        normalizedCashAccounts
      );
    }

    if (bankAccountsResult.error) {
      console.error(
        "BANK ACCOUNTS ERROR:",
        bankAccountsResult.error
      );

      alert(
        `Banka hesapları yüklenemedi.\n\n${bankAccountsResult.error.message}\n\nSupabase RLS politikalarını kontrol edin.`
      );

      setBankAccounts([]);
    } else {
      const normalizedBankAccounts: BankAccount[] =
        (bankAccountsResult.data || []).map(
          (account) => ({
            id: account.id,
            bank_name: account.bank_name,
            account_name:
              account.account_name,
            iban: account.iban,
            balance: Number(
              account.balance || 0
            ),
            is_active: Boolean(
              account.is_active
            ),
          })
        );

      setBankAccounts(
        normalizedBankAccounts
      );
    }

    setCustomers(
      (customersResult.data ||
        []) as Customer[]
    );

    setTransactions(
      (transactionsResult.data || []).map(
        (transaction: AccountTransaction) => ({
          id: transaction.id,
          customer_id:
            transaction.customer_id,
          transaction_type:
            transaction.transaction_type,
          amount: Number(
            transaction.amount || 0
          ),
          reference_id:
            transaction.reference_id || null,
          payment_method:
            transaction.payment_method ||
            null,
          note:
            transaction.note || null,
          created_at:
            transaction.created_at,
        })
      )
    );

    setLoading(false);
    setLoadingAccounts(false);
  }

  const customerBalances = useMemo(() => {
    return customers.map((customer) => {
      const customerTransactions =
        transactions.filter(
          (transaction) =>
            transaction.customer_id ===
            customer.id
        );

      const sales =
        customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type ===
              "sale"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              Number(
                transaction.amount || 0
              ),
            0
          );

      const payments =
        customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type ===
              "payment"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              Number(
                transaction.amount || 0
              ),
            0
          );

      const refunds =
        customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type ===
              "refund"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              Number(
                transaction.amount || 0
              ),
            0
          );

      const customerRefunds =
        customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type ===
              "customer_refund"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              Number(
                transaction.amount || 0
              ),
            0
          );

      const balance =
        sales -
        payments -
        refunds +
        customerRefunds;

      return {
        ...customer,
        sales,
        payments,
        refunds,
        customerRefunds,
        balance,
      };
    });
  }, [customers, transactions]);

  const filteredCustomers = useMemo(() => {
    const query = search
      .trim()
      .toLocaleLowerCase("tr-TR");

    return customerBalances.filter(
      (customer) => {
        const matchesSearch =
          !query ||
          customer.company_name
            .toLocaleLowerCase(
              "tr-TR"
            )
            .includes(query) ||
          customer.contact_name
            ?.toLocaleLowerCase(
              "tr-TR"
            )
            .includes(query) ||
          customer.phone?.includes(
            query
          ) ||
          customer.city
            ?.toLocaleLowerCase(
              "tr-TR"
            )
            .includes(query);

        if (!matchesSearch) {
          return false;
        }

        if (balanceFilter === "debt") {
          return customer.balance > 0;
        }

        if (balanceFilter === "credit") {
          return customer.balance < 0;
        }

        if (balanceFilter === "closed") {
          return customer.balance === 0;
        }

        return true;
      }
    );
  }, [
    customerBalances,
    search,
    balanceFilter,
  ]);

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
        sum +
        Math.max(
          customer.balance,
          0
        ),
      0
    );
  }, [customerBalances]);

  const totalCustomerCredit = useMemo(() => {
    return customerBalances.reduce(
      (sum, customer) =>
        sum +
        Math.max(
          -customer.balance,
          0
        ),
      0
    );
  }, [customerBalances]);

  const debtCustomerCount = useMemo(() => {
    return customerBalances.filter(
      (customer) =>
        customer.balance > 0
    ).length;
  }, [customerBalances]);

  const creditCustomerCount = useMemo(() => {
    return customerBalances.filter(
      (customer) =>
        customer.balance < 0
    ).length;
  }, [customerBalances]);

  const closedCustomerCount = useMemo(() => {
    return customerBalances.filter(
      (customer) =>
        customer.balance === 0
    ).length;
  }, [customerBalances]);

  function formatPrice(value: number) {
    return Number(
      value || 0
    ).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value: string) {
    return new Date(
      value
    ).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function parsePaymentAmount(
    value: string
  ) {
    const cleaned = value
      .trim()
      .replace(/\s/g, "");

    if (!cleaned) {
      return NaN;
    }

    if (
      cleaned.includes(",") &&
      cleaned.includes(".")
    ) {
      return Number(
        cleaned
          .replace(/\./g, "")
          .replace(",", ".")
      );
    }

    if (cleaned.includes(",")) {
      return Number(
        cleaned.replace(",", ".")
      );
    }

    if (cleaned.includes(".")) {
      const parts =
        cleaned.split(".");

      const lastPart =
        parts[parts.length - 1];

      if (
        parts.length === 2 &&
        lastPart.length === 2
      ) {
        return Number(cleaned);
      }

      return Number(
        cleaned.replace(/\./g, "")
      );
    }

    return Number(cleaned);
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

      case "customer_refund":
        return "Para İadesi";

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

      case "customer_refund":
        return "bg-orange-100 text-orange-700";

      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  function getTransactionAmount(
    transaction: AccountTransaction
  ) {
    if (
      transaction.transaction_type ===
      "sale"
    ) {
      return {
        text: `+${formatPrice(
          Number(transaction.amount)
        )} ₺`,
        className: "text-red-600",
      };
    }

    if (
      transaction.transaction_type ===
      "refund"
    ) {
      return {
        text: `-${formatPrice(
          Number(transaction.amount)
        )} ₺`,
        className: "text-blue-600",
      };
    }

    if (
      transaction.transaction_type ===
      "customer_refund"
    ) {
      return {
        text: `+${formatPrice(
          Number(transaction.amount)
        )} ₺`,
        className: "text-orange-600",
      };
    }

    return {
      text: `-${formatPrice(
        Number(transaction.amount)
      )} ₺`,
      className: "text-green-600",
    };
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

    const firstCashAccount =
      cashAccounts.find(
        (account) =>
          account.is_active
      );

    const firstBankAccount =
      bankAccounts.find(
        (account) =>
          account.is_active
      );

    setSelectedCashAccountId(
      firstCashAccount?.id || ""
    );

    setSelectedBankAccountId(
      firstBankAccount?.id || ""
    );

    setShowPaymentModal(true);
  }

  function openRefundModal() {
    if (!selectedCustomer) {
      return;
    }

    const customerCredit =
      Math.max(
        -selectedCustomer.balance,
        0
      );

    if (customerCredit <= 0) {
      alert(
        "Bu müşterinin iade edilecek alacağı bulunmuyor."
      );
      return;
    }

    setRefundAmount(
      customerCredit
        .toFixed(2)
        .replace(".", ",")
    );

    setRefundPaymentMethod("Nakit");
    setRefundNote("");

    const firstCashAccount =
      cashAccounts.find(
        (account) =>
          account.is_active
      );

    const firstBankAccount =
      bankAccounts.find(
        (account) =>
          account.is_active
      );

    setSelectedRefundCashAccountId(
      firstCashAccount?.id || ""
    );

    setSelectedRefundBankAccountId(
      firstBankAccount?.id || ""
    );

    setShowRefundModal(true);
  }

  const isBankPayment =
    paymentMethod === "Havale" ||
    paymentMethod === "EFT";

  const isBankRefund =
    refundPaymentMethod === "Havale" ||
    refundPaymentMethod === "EFT";

  const selectedCashAccount =
    cashAccounts.find(
      (account) =>
        account.id ===
        selectedCashAccountId
    );

  const selectedBankAccount =
    bankAccounts.find(
      (account) =>
        account.id ===
        selectedBankAccountId
    );

  const selectedRefundCashAccount =
    cashAccounts.find(
      (account) =>
        account.id ===
        selectedRefundCashAccountId
    );

  const selectedRefundBankAccount =
    bankAccounts.find(
      (account) =>
        account.id ===
        selectedRefundBankAccountId
    );

  const selectedPaymentAccountId =
    paymentMethod === "Nakit"
      ? selectedCashAccountId
      : selectedBankAccountId;

  const selectedRefundAccountId =
    refundPaymentMethod === "Nakit"
      ? selectedRefundCashAccountId
      : selectedRefundBankAccountId;

  const hasRequiredPaymentAccount =
    Boolean(
      selectedPaymentAccountId
    );

  const hasRequiredRefundAccount =
    Boolean(
      selectedRefundAccountId
    );

  async function addPayment() {
    if (!selectedCustomer) {
      return;
    }

    const amount =
      parsePaymentAmount(
        paymentAmount
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
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
      amount >
      selectedCustomer.balance
    ) {
      const confirmed =
        window.confirm(
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

    if (
      !hasRequiredPaymentAccount
    ) {
      if (
        paymentMethod === "Nakit"
      ) {
        alert(
          "Tahsilat için aktif bir kasa hesabı seçmelisiniz."
        );
      } else {
        alert(
          "Tahsilat için aktif bir banka hesabı seçmelisiniz."
        );
      }

      return;
    }

    setSavingPayment(true);

    const { data, error } =
      await supabase.rpc(
        "add_customer_payment",
        {
          p_customer_id:
            selectedCustomer.id,
          p_amount: amount,
          p_payment_method:
            paymentMethod,
          p_note:
            paymentNote.trim() ||
            null,
          p_account_id:
            selectedPaymentAccountId,
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

    console.log(
      "TAHSİLAT SONUCU:",
      data
    );

    setSavingPayment(false);
    setShowPaymentModal(false);

    await loadCari();

    setSelectedCustomer(null);

    alert(
      `${formatPrice(
        amount
      )} ₺ tahsilat başarıyla eklendi.`
    );
  }

  async function addCustomerRefund() {
    if (!selectedCustomer) {
      return;
    }

    const amount =
      parsePaymentAmount(
        refundAmount
      );

    const availableCredit =
      Math.max(
        -selectedCustomer.balance,
        0
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        "Geçerli bir iade tutarı girin."
      );
      return;
    }

    if (
      availableCredit <= 0
    ) {
      alert(
        "Bu müşterinin iade edilecek alacağı bulunmuyor."
      );
      return;
    }

    if (
      amount > availableCredit
    ) {
      alert(
        `İade tutarı müşterinin alacağından fazla olamaz.\n\n` +
          `Müşteri alacağı: ${formatPrice(
            availableCredit
          )} ₺\n` +
          `İade tutarı: ${formatPrice(
            amount
          )} ₺`
      );
      return;
    }

    if (
      !hasRequiredRefundAccount
    ) {
      if (
        refundPaymentMethod ===
        "Nakit"
      ) {
        alert(
          "İade için aktif bir kasa hesabı seçmelisiniz."
        );
      } else {
        alert(
          "İade için aktif bir banka hesabı seçmelisiniz."
        );
      }

      return;
    }

    const selectedAccount =
      isBankRefund
        ? selectedRefundBankAccount
        : selectedRefundCashAccount;

    if (!selectedAccount) {
      alert(
        "İade hesabı bulunamadı."
      );
      return;
    }

    if (
      amount >
      Number(selectedAccount.balance || 0)
    ) {
      alert(
        `Seçilen hesapta yeterli bakiye yok.\n\n` +
          `Mevcut bakiye: ${formatPrice(
            Number(
              selectedAccount.balance || 0
            )
          )} ₺\n` +
          `İade: ${formatPrice(
            amount
          )} ₺`
      );
      return;
    }

    const confirmed =
  window.confirm(
    `Müşteriye ${formatPrice(
      amount
    )} ₺ iade yapılacak.\n\n` +
      `Müşteri: ${selectedCustomer.company_name}\n` +
      `Yöntem: ${refundPaymentMethod}\n` +
      `Hesap: ${
        "name" in selectedAccount
          ? selectedAccount.name
          : `${selectedAccount.bank_name} / ${selectedAccount.account_name}`
      }\n\n` +
      "Bu işlem seçilen kasa veya banka hesabından para çıkaracaktır.\n\nDevam etmek istiyor musunuz?"
  );

    if (!confirmed) {
      return;
    }

    setSavingRefund(true);

    const { data, error } =
      await supabase.rpc(
        "add_customer_refund",
        {
          p_customer_id:
            selectedCustomer.id,
          p_amount: amount,
          p_payment_method:
            refundPaymentMethod,
          p_note:
            refundNote.trim() ||
            null,
          p_account_type:
            isBankRefund
              ? "bank"
              : "cash",
          p_account_id:
            selectedRefundAccountId,
        }
      );

    if (error) {
      console.error(
        "CUSTOMER REFUND ERROR:",
        error
      );

      alert(
        `Müşteri iadesi yapılamadı.\n\n${error.message}`
      );

      setSavingRefund(false);
      return;
    }

    console.log(
      "MÜŞTERİ İADE SONUCU:",
      data
    );

    setSavingRefund(false);
    setShowRefundModal(false);

    await loadCari();

    setSelectedCustomer(null);

    alert(
      `${formatPrice(
        amount
      )} ₺ müşteri iadesi başarıyla yapıldı.`
    );
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

  function printCustomerStatement() {
    if (!selectedCustomer) {
      return;
    }

    window.print();
  }

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
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl">
        {/* BAŞLIK */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Cari Hesaplar
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Müşteri borçlarını, tahsilatlarını ve cari hareketlerini yönetin.
            </p>
          </div>

          <button
            type="button"
            onClick={loadCari}
            disabled={loadingAccounts}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingAccounts
              ? "Yükleniyor..."
              : "↻ Yenile"}
          </button>
        </div>

        {/* ÖZET KARTLARI */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5 print:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Müşteri Borcu
            </p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              {formatPrice(
                totalCustomerDebt
              )}{" "}
              ₺
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {debtCustomerCount} borçlu müşteri
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Toplam Satış
            </p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              {formatPrice(
                totalSales
              )}{" "}
              ₺
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Toplam Tahsilat
            </p>

            <p className="mt-2 text-2xl font-bold text-green-600">
              {formatPrice(
                totalPayments
              )}{" "}
              ₺
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Toplam İade
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-600">
              {formatPrice(
                totalRefunds
              )}{" "}
              ₺
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Müşteri Alacağı
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-600">
              {formatPrice(
                totalCustomerCredit
              )}{" "}
              ₺
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {creditCustomerCount} alacaklı müşteri
            </p>
          </div>
        </div>

        {/* HIZLI DURUM */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3 print:hidden">
          <button
            type="button"
            onClick={() =>
              setBalanceFilter(
                balanceFilter ===
                  "debt"
                  ? "all"
                  : "debt"
              )
            }
            className={`rounded-xl border p-4 text-left transition ${
              balanceFilter === "debt"
                ? "border-red-300 bg-red-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <p className="text-xs font-semibold text-slate-400">
              BORÇLU HESAPLAR
            </p>

            <p className="mt-1 text-xl font-bold text-red-600">
              {debtCustomerCount}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setBalanceFilter(
                balanceFilter ===
                  "credit"
                  ? "all"
                  : "credit"
              )
            }
            className={`rounded-xl border p-4 text-left transition ${
              balanceFilter ===
              "credit"
                ? "border-blue-300 bg-blue-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <p className="text-xs font-semibold text-slate-400">
              MÜŞTERİ ALACAKLI
            </p>

            <p className="mt-1 text-xl font-bold text-blue-600">
              {creditCustomerCount}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setBalanceFilter(
                balanceFilter ===
                  "closed"
                  ? "all"
                  : "closed"
              )
            }
            className={`rounded-xl border p-4 text-left transition ${
              balanceFilter ===
              "closed"
                ? "border-green-300 bg-green-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <p className="text-xs font-semibold text-slate-400">
              KAPALI HESAPLAR
            </p>

            <p className="mt-1 text-xl font-bold text-green-600">
              {closedCustomerCount}
            </p>
          </button>
        </div>

        {/* MÜŞTERİLER */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Müşteri Cari Hesapları
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  {filteredCustomers.length} müşteri gösteriliyor
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Müşteri, telefon veya şehir ara..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:bg-white sm:w-80"
                />

                <select
                  value={balanceFilter}
                  onChange={(e) =>
                    setBalanceFilter(
                      e.target
                        .value as BalanceFilter
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-900"
                >
                  <option value="all">
                    Tüm Hesaplar
                  </option>

                  <option value="debt">
                    Borçlu Hesaplar
                  </option>

                  <option value="credit">
                    Müşteri Alacaklı
                  </option>

                  <option value="closed">
                    Kapalı Hesaplar
                  </option>
                </select>
              </div>
            </div>
          </div>

          {filteredCustomers.length ===
          0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl">
                🔎
              </div>

              <p className="mt-3 font-semibold text-slate-700">
                Müşteri bulunamadı
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Arama veya filtre kriterlerini değiştirmeyi deneyin.
              </p>
            </div>
          ) : (
            <>
              {/* MASAÜSTÜ */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Müşteri
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Satış
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tahsilat
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        İade
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Bakiye
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        İşlem
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map(
                      (customer) => (
                        <tr
                          key={
                            customer.id
                          }
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-5">
                            <div className="font-semibold text-slate-900">
                              {
                                customer.company_name
                              }
                            </div>

                            {customer.contact_name && (
                              <div className="mt-1 text-xs text-slate-400">
                                {
                                  customer.contact_name
                                }
                              </div>
                            )}

                            {customer.phone && (
                              <div className="mt-1 text-xs text-slate-400">
                                {
                                  customer.phone
                                }
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
                            {customer.balance >
                            0 ? (
                              <div>
                                <div className="font-bold text-red-600">
                                  {formatPrice(
                                    customer.balance
                                  )}{" "}
                                  ₺
                                </div>

                                <div className="mt-1 text-xs font-medium text-red-400">
                                  Borç
                                </div>
                              </div>
                            ) : customer.balance <
                              0 ? (
                              <div>
                                <div className="font-bold text-blue-600">
                                  {formatPrice(
                                    Math.abs(
                                      customer.balance
                                    )
                                  )}{" "}
                                  ₺
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
                              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
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

              {/* MOBİL */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredCustomers.map(
                  (customer) => (
                    <button
                      key={
                        customer.id
                      }
                      type="button"
                      onClick={() =>
                        openCustomer(
                          customer
                        )
                      }
                      className="w-full p-5 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">
                            {
                              customer.company_name
                            }
                          </p>

                          {customer.contact_name && (
                            <p className="mt-1 text-xs text-slate-400">
                              {
                                customer.contact_name
                              }
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          {customer.balance >
                          0 ? (
                            <>
                              <p className="font-bold text-red-600">
                                {formatPrice(
                                  customer.balance
                                )}{" "}
                                ₺
                              </p>

                              <p className="text-xs text-red-400">
                                Borç
                              </p>
                            </>
                          ) : customer.balance <
                            0 ? (
                            <>
                              <p className="font-bold text-blue-600">
                                {formatPrice(
                                  Math.abs(
                                    customer.balance
                                  )
                                )}{" "}
                                ₺
                              </p>

                              <p className="text-xs text-blue-500">
                                Alacaklı
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-green-600">
                                0,00 ₺
                              </p>

                              <p className="text-xs text-green-500">
                                Kapalı
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-red-50 p-2">
                          <p className="text-[10px] font-semibold text-red-400">
                            SATIŞ
                          </p>

                          <p className="mt-1 text-xs font-bold text-red-600">
                            {formatPrice(
                              customer.sales
                            )}{" "}
                            ₺
                          </p>
                        </div>

                        <div className="rounded-lg bg-green-50 p-2">
                          <p className="text-[10px] font-semibold text-green-500">
                            TAHSİLAT
                          </p>

                          <p className="mt-1 text-xs font-bold text-green-600">
                            {formatPrice(
                              customer.payments
                            )}{" "}
                            ₺
                          </p>
                        </div>

                        <div className="rounded-lg bg-blue-50 p-2">
                          <p className="text-[10px] font-semibold text-blue-400">
                            İADE
                          </p>

                          <p className="mt-1 text-xs font-bold text-blue-600">
                            {formatPrice(
                              customer.refunds
                            )}{" "}
                            ₺
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* CARİ DETAY MODAL */}
      {selectedCustomer && (
        <div className="cari-print-modal fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="cari-print-card max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-6 print:hidden">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                  {
                    selectedCustomer.company_name
                  }
                </h2>

                {selectedCustomer.contact_name && (
                  <p className="mt-1 text-sm text-slate-500">
                    {
                      selectedCustomer.contact_name
                    }
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedCustomer(
                    null
                  )
                }
                className="rounded-lg px-3 py-2 text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

           <div className="cari-print-scroll max-h-[calc(94vh-90px)] overflow-y-auto p-4 sm:p-6">
  <div className="mb-6 hidden print:block">
    <img
      src="/esoralogo.png"
      alt="ESORA"
      className="h-16 w-auto object-contain"
    />

    <h2 className="mt-2 text-xl font-bold">
      Cari Hesap Ekstresi
    </h2>

    <p className="mt-2">
      Müşteri:{" "}
      {selectedCustomer.company_name}
    </p>
                <p>
                  Tarih:{" "}
                  {new Date().toLocaleDateString(
                    "tr-TR"
                  )}
                </p>
              </div>

              {/* CARİ ÖZET */}
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-xs font-semibold text-red-400">
                    TOPLAM SATIŞ
                  </p>

                  <p className="mt-1 text-lg font-bold text-red-600">
                    {formatPrice(
                      selectedCustomer.sales
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-xs font-semibold text-green-500">
                    TOPLAM TAHSİLAT
                  </p>

                  <p className="mt-1 text-lg font-bold text-green-600">
                    {formatPrice(
                      selectedCustomer.payments
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xs font-semibold text-blue-400">
                    TOPLAM İADE
                  </p>

                  <p className="mt-1 text-lg font-bold text-blue-600">
                    {formatPrice(
                      selectedCustomer.refunds
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div
                  className={`rounded-xl p-4 ${
                    selectedCustomer.balance >
                    0
                      ? "bg-red-600 text-white"
                      : selectedCustomer.balance <
                        0
                      ? "bg-blue-600 text-white"
                      : "bg-green-600 text-white"
                  }`}
                >
                  <p className="text-xs font-semibold opacity-80">
                    GÜNCEL BAKİYE
                  </p>

                  <p className="mt-1 text-lg font-bold">
                    {formatPrice(
                      Math.abs(
                        selectedCustomer.balance
                      )
                    )}{" "}
                    ₺
                  </p>

                  <p className="mt-1 text-xs font-medium opacity-80">
                    {selectedCustomer.balance >
                    0
                      ? "Müşteri borçlu"
                      : selectedCustomer.balance <
                        0
                      ? "Müşteri alacaklı"
                      : "Hesap kapalı"}
                  </p>
                </div>
              </div>

              {/* MÜŞTERİ BİLGİLERİ */}
              <div className="mb-6 rounded-xl border border-slate-200 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">
                    Müşteri Bilgileri
                  </h3>

                  {selectedCustomer.credit_limit !==
                    null && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        Kredi Limiti
                      </p>

                      <p className="text-sm font-bold text-slate-700">
                        {formatPrice(
                          Number(
                            selectedCustomer.credit_limit
                          )
                        )}{" "}
                        ₺
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {selectedCustomer.phone && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Telefon
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {
                          selectedCustomer.phone
                        }
                      </p>
                    </div>
                  )}

                  {selectedCustomer.city && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Şehir
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {
                          selectedCustomer.city
                        }
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
                        {
                          selectedCustomer.payment_term
                        }{" "}
                        gün
                      </p>
                    </div>
                  )}

                  {selectedCustomer.payment_method && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Ödeme Tercihi
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {
                          selectedCustomer.payment_method
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* BUTONLAR */}
              <div className="mb-6 flex flex-wrap gap-3 print:hidden">
                <button
                  type="button"
                  onClick={
                    openPaymentModal
                  }
                  disabled={
                    selectedCustomer.balance <=
                    0
                  }
                  className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Tahsilat Ekle
                </button>

                {selectedCustomer.balance <
                  0 && (
                  <button
                    type="button"
                    onClick={
                      openRefundModal
                    }
                    disabled={
                      savingRefund
                    }
                    className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ↩ Müşteriye İade Et
                  </button>
                )}

                <button
                  type="button"
                  onClick={
                    printCustomerStatement
                  }
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  🖨 Cari Ekstre
                </button>
              </div>

              {/* MÜŞTERİ ALACAĞI UYARISI */}
              {selectedCustomer.balance <
                0 && (
                <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 print:hidden">
                  <p className="font-bold text-blue-700">
                    Müşterinin{" "}
                    {formatPrice(
                      Math.abs(
                        selectedCustomer.balance
                      )
                    )}{" "}
                    ₺ alacağı bulunuyor.
                  </p>

                  <p className="mt-1 text-sm text-blue-600">
                    İade işlemi yapıldığında seçilen kasa veya banka hesabından para çıkar ve müşteri alacağı kapanır.
                  </p>
                </div>
              )}

              {/* HAREKETLER */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <h3 className="font-bold text-slate-900">
                    Cari Hareketleri
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    {
                      selectedCustomerTransactions.length
                    }{" "}
                    hareket
                  </p>
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
                        <tr className="border-b border-slate-200 bg-white">
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
                            Ödeme
                          </th>

                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">
                            Tutar
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {selectedCustomerTransactions.map(
                          (
                            transaction
                          ) => {
                            const amount =
                              getTransactionAmount(
                                transaction
                              );

                            return (
                              <tr
                                key={
                                  transaction.id
                                }
                                className="hover:bg-slate-50"
                              >
                                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
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

                                <td className="min-w-[220px] px-5 py-4 text-sm text-slate-700">
                                  {
                                    transaction.note
                                  ||
                                    "-"
                                  }
                                </td>

                                <td className="px-5 py-4 text-sm text-slate-600">
                                  {
                                    transaction.payment_method ||
                                    "-"
                                  }
                                </td>

                                <td
                                  className={`whitespace-nowrap px-5 py-4 text-right font-bold ${amount.className}`}
                                >
                                  {
                                    amount.text
                                  }
                                </td>
                              </tr>
                            );
                          }
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
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Tahsilat Ekle
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        selectedCustomer.company_name
                      }
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowPaymentModal(
                        false
                      )
                    }
                    disabled={
                      savingPayment
                    }
                    className="rounded-lg px-3 py-2 text-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-xs font-semibold text-red-400">
                    MEVCUT MÜŞTERİ BORCU
                  </p>

                  <p className="mt-1 text-2xl font-bold text-red-600">
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

                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={
                        paymentAmount
                      }
                      onChange={(e) =>
                        setPaymentAmount(
                          e.target
                            .value
                        )
                      }
                      placeholder="0,00"
                      disabled={
                        savingPayment
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-lg font-semibold outline-none focus:border-slate-900 disabled:bg-slate-100"
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">
                      ₺
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Ödeme Yöntemi
                  </label>

                  <select
                    value={
                      paymentMethod
                    }
                    onChange={(e) => {
                      const method =
                        e.target
                          .value as PaymentMethod;

                      setPaymentMethod(
                        method
                      );

                      if (
                        method ===
                        "Nakit"
                      ) {
                        setSelectedBankAccountId(
                          ""
                        );

                        if (
                          !selectedCashAccountId &&
                          cashAccounts.length >
                            0
                        ) {
                          setSelectedCashAccountId(
                            cashAccounts[0]
                              .id
                          );
                        }
                      } else {
                        setSelectedCashAccountId(
                          ""
                        );

                        if (
                          !selectedBankAccountId &&
                          bankAccounts.length >
                            0
                        ) {
                          setSelectedBankAccountId(
                            bankAccounts[0]
                              .id
                          );
                        }
                      }
                    }}
                    disabled={
                      savingPayment
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
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
                  </select>
                </div>

                {paymentMethod ===
                  "Nakit" && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Kasa Hesabı
                    </label>

                    {cashAccounts.length ===
                    0 ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-700">
                          Aktif kasa hesabı bulunamadı.
                        </p>

                        <p className="mt-1 text-xs text-red-500">
                          Supabase RLS politikalarını ve oturum yetkisini kontrol edin.
                        </p>
                      </div>
                    ) : (
                      <>
                        <select
                          value={
                            selectedCashAccountId
                          }
                          onChange={(e) =>
                            setSelectedCashAccountId(
                              e.target
                                .value
                            )
                          }
                          disabled={
                            savingPayment
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
                        >
                          <option value="">
                            Kasa seçin
                          </option>

                          {cashAccounts.map(
                            (
                              account
                            ) => (
                              <option
                                key={
                                  account.id
                                }
                                value={
                                  account.id
                                }
                              >
                                {
                                  account.name
                                }{" "}
                                —{" "}
                                {formatPrice(
                                  account.balance
                                )}{" "}
                                ₺
                              </option>
                            )
                          )}
                        </select>

                        {selectedCashAccount && (
                          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">
                                Mevcut kasa bakiyesi
                              </span>

                              <span className="text-sm font-bold text-slate-900">
                                {formatPrice(
                                  selectedCashAccount.balance
                                )}{" "}
                                ₺
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {isBankPayment && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Banka Hesabı
                    </label>

                    {bankAccounts.length ===
                    0 ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-700">
                          Aktif banka hesabı bulunamadı.
                        </p>

                        <p className="mt-1 text-xs text-red-500">
                          Havale/EFT tahsilatı için en az bir aktif banka hesabı oluşturmalısınız.
                        </p>
                      </div>
                    ) : (
                      <>
                        <select
                          value={
                            selectedBankAccountId
                          }
                          onChange={(e) =>
                            setSelectedBankAccountId(
                              e.target
                                .value
                            )
                          }
                          disabled={
                            savingPayment
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
                        >
                          <option value="">
                            Banka hesabı seçin
                          </option>

                          {bankAccounts.map(
                            (
                              account
                            ) => (
                              <option
                                key={
                                  account.id
                                }
                                value={
                                  account.id
                                }
                              >
                                {
                                  account.bank_name
                                }{" "}
                                -{" "}
                                {
                                  account.account_name
                                }{" "}
                                —{" "}
                                {formatPrice(
                                  account.balance
                                )}{" "}
                                ₺
                              </option>
                            )
                          )}
                        </select>

                        {selectedBankAccount && (
                          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">
                                Mevcut banka bakiyesi
                              </span>

                              <span className="text-sm font-bold text-slate-900">
                                {formatPrice(
                                  selectedBankAccount.balance
                                )}{" "}
                                ₺
                              </span>
                            </div>

                            {selectedBankAccount.iban && (
                              <p className="mt-1 break-all text-[11px] text-slate-400">
                                {
                                  selectedBankAccount.iban
                                }
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Finansal Etki
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {paymentMethod ===
                    "Nakit" ? (
                      <>
                        Tahsilat{" "}
                        <strong>
                          {
                            selectedCashAccount?.name ||
                            "seçilecek kasa"
                          }
                        </strong>{" "}
                        hesabına eklenecek.
                      </>
                    ) : (
                      <>
                        Tahsilat{" "}
                        <strong>
                          {selectedBankAccount
                            ? `${selectedBankAccount.bank_name} - ${selectedBankAccount.account_name}`
                            : "seçilecek banka hesabına"}
                        </strong>{" "}
                        hesabına eklenecek.
                      </>
                    )}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Açıklama
                  </label>

                  <textarea
                    value={
                      paymentNote
                    }
                    onChange={(e) =>
                      setPaymentNote(
                        e.target
                          .value
                      )
                    }
                    placeholder="Ödeme ile ilgili not..."
                    rows={3}
                    disabled={
                      savingPayment
                    }
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 p-6">
                <button
                  type="button"
                  onClick={() =>
                    setShowPaymentModal(
                      false
                    )
                  }
                  disabled={
                    savingPayment
                  }
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Vazgeç
                </button>

                <button
                  type="button"
                  onClick={
                    addPayment
                  }
                  disabled={
                    savingPayment ||
                    !hasRequiredPaymentAccount ||
                    (paymentMethod ===
                      "Nakit" &&
                      cashAccounts.length ===
                        0) ||
                    (isBankPayment &&
                      bankAccounts.length ===
                        0)
                  }
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

      {/* MÜŞTERİ PARA İADESİ MODAL */}
      {showRefundModal &&
        selectedCustomer && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Müşteriye Para İadesi
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        selectedCustomer.company_name
                      }
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowRefundModal(
                        false
                      )
                    }
                    disabled={
                      savingRefund
                    }
                    className="rounded-lg px-3 py-2 text-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6">
                {/* ALACAK */}
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xs font-semibold text-blue-500">
                    MÜŞTERİNİN ALACAĞI
                  </p>

                  <p className="mt-1 text-2xl font-bold text-blue-700">
                    {formatPrice(
                      Math.abs(
                        selectedCustomer.balance
                      )
                    )}{" "}
                    ₺
                  </p>
                </div>

                {/* TUTAR */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    İade Tutarı
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={
                        refundAmount
                      }
                      onChange={(e) =>
                        setRefundAmount(
                          e.target
                            .value
                        )
                      }
                      placeholder="0,00"
                      disabled={
                        savingRefund
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-lg font-semibold outline-none focus:border-slate-900 disabled:bg-slate-100"
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">
                      ₺
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    En fazla{" "}
                    {formatPrice(
                      Math.abs(
                        selectedCustomer.balance
                      )
                    )}{" "}
                    ₺ iade edilebilir.
                  </p>
                </div>

                {/* ÖDEME YÖNTEMİ */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    İade Yöntemi
                  </label>

                  <select
                    value={
                      refundPaymentMethod
                    }
                    onChange={(e) => {
                      const method =
                        e.target
                          .value as PaymentMethod;

                      setRefundPaymentMethod(
                        method
                      );

                      if (
                        method ===
                        "Nakit"
                      ) {
                        setSelectedRefundBankAccountId(
                          ""
                        );

                        if (
                          !selectedRefundCashAccountId &&
                          cashAccounts.length >
                            0
                        ) {
                          setSelectedRefundCashAccountId(
                            cashAccounts[0]
                              .id
                          );
                        }
                      } else {
                        setSelectedRefundCashAccountId(
                          ""
                        );

                        if (
                          !selectedRefundBankAccountId &&
                          bankAccounts.length >
                            0
                        ) {
                          setSelectedRefundBankAccountId(
                            bankAccounts[0]
                              .id
                          );
                        }
                      }
                    }}
                    disabled={
                      savingRefund
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
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
                  </select>
                </div>

                {/* KASA */}
                {!isBankRefund && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Para Çıkacak Kasa
                    </label>

                    {cashAccounts.length ===
                    0 ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-700">
                          Aktif kasa hesabı bulunamadı.
                        </p>
                      </div>
                    ) : (
                      <>
                        <select
                          value={
                            selectedRefundCashAccountId
                          }
                          onChange={(e) =>
                            setSelectedRefundCashAccountId(
                              e.target
                                .value
                            )
                          }
                          disabled={
                            savingRefund
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
                        >
                          <option value="">
                            Kasa seçin
                          </option>

                          {cashAccounts.map(
                            (
                              account
                            ) => (
                              <option
                                key={
                                  account.id
                                }
                                value={
                                  account.id
                                }
                              >
                                {
                                  account.name
                                }{" "}
                                —{" "}
                                {formatPrice(
                                  account.balance
                                )}{" "}
                                ₺
                              </option>
                            )
                          )}
                        </select>

                        {selectedRefundCashAccount && (
                          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">
                                Mevcut kasa bakiyesi
                              </span>

                              <span className="text-sm font-bold text-slate-900">
                                {formatPrice(
                                  selectedRefundCashAccount.balance
                                )}{" "}
                                ₺
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* BANKA */}
                {isBankRefund && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Para Çıkacak Banka
                    </label>

                    {bankAccounts.length ===
                    0 ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-700">
                          Aktif banka hesabı bulunamadı.
                        </p>
                      </div>
                    ) : (
                      <>
                        <select
                          value={
                            selectedRefundBankAccountId
                          }
                          onChange={(e) =>
                            setSelectedRefundBankAccountId(
                              e.target
                                .value
                            )
                          }
                          disabled={
                            savingRefund
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
                        >
                          <option value="">
                            Banka hesabı seçin
                          </option>

                          {bankAccounts.map(
                            (
                              account
                            ) => (
                              <option
                                key={
                                  account.id
                                }
                                value={
                                  account.id
                                }
                              >
                                {
                                  account.bank_name
                                }{" "}
                                -{" "}
                                {
                                  account.account_name
                                }{" "}
                                —{" "}
                                {formatPrice(
                                  account.balance
                                )}{" "}
                                ₺
                              </option>
                            )
                          )}
                        </select>

                        {selectedRefundBankAccount && (
                          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">
                                Mevcut banka bakiyesi
                              </span>

                              <span className="text-sm font-bold text-slate-900">
                                {formatPrice(
                                  selectedRefundBankAccount.balance
                                )}{" "}
                                ₺
                              </span>
                            </div>

                            {selectedRefundBankAccount.iban && (
                              <p className="mt-1 break-all text-[11px] text-slate-400">
                                {
                                  selectedRefundBankAccount.iban
                                }
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* FİNANSAL ETKİ */}
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                    Finansal Etki
                  </p>

                  <p className="mt-1 text-sm text-orange-800">
                    {refundPaymentMethod ===
                    "Nakit" ? (
                      <>
                        <strong>
                          {formatPrice(
                            parsePaymentAmount(
                              refundAmount
                            ) || 0
                          )}{" "}
                          ₺
                        </strong>{" "}
                        tutar{" "}
                        <strong>
                          {
                            selectedRefundCashAccount?.name ||
                            "seçilecek kasa"
                          }
                        </strong>{" "}
                        hesabından çıkacak.
                      </>
                    ) : (
                      <>
                        <strong>
                          {formatPrice(
                            parsePaymentAmount(
                              refundAmount
                            ) || 0
                          )}{" "}
                          ₺
                        </strong>{" "}
                        tutar{" "}
                        <strong>
                          {selectedRefundBankAccount
                            ? `${selectedRefundBankAccount.bank_name} - ${selectedRefundBankAccount.account_name}`
                            : "seçilecek banka hesabından"}
                        </strong>{" "}
                        hesabından çıkacak.
                      </>
                    )}
                  </p>
                </div>

                {/* AÇIKLAMA */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Açıklama
                  </label>

                  <textarea
                    value={
                      refundNote
                    }
                    onChange={(e) =>
                      setRefundNote(
                        e.target
                          .value
                      )
                    }
                    placeholder="İade ile ilgili not..."
                    rows={3}
                    disabled={
                      savingRefund
                    }
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 p-6">
                <button
                  type="button"
                  onClick={() =>
                    setShowRefundModal(
                      false
                    )
                  }
                  disabled={
                    savingRefund
                  }
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Vazgeç
                </button>

                <button
                  type="button"
                  onClick={
                    addCustomerRefund
                  }
                  disabled={
                    savingRefund ||
                    !hasRequiredRefundAccount ||
                    (!isBankRefund &&
                      cashAccounts.length ===
                        0) ||
                    (isBankRefund &&
                      bankAccounts.length ===
                        0)
                  }
                  className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingRefund
                    ? "İade Yapılıyor..."
                    : "İadeyi Gerçekleştir"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* PRINT CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          body {
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          .cari-print-modal,
          .cari-print-modal * {
            visibility: visible !important;
          }

          .cari-print-modal {
            position: absolute !important;
            inset: 0 !important;
            background: white !important;
            display: block !important;
          }

          .cari-print-card {
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          .cari-print-scroll {
            max-height: none !important;
            overflow: visible !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          button {
            display: none !important;
          }

          table {
            width: 100% !important;
          }

          .overflow-x-auto {
            overflow: visible !important;
          }
        }
      `}
      </style>
    </div>
  );
}