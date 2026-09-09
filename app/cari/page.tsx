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

type BalanceFilter = "all" | "debt" | "credit" | "closed";

type PaymentMethod = "Nakit" | "Havale" | "EFT";

export default function CariPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerBalance | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("Nakit");
  const [paymentNote, setPaymentNote] = useState("");

  const [refundAmount, setRefundAmount] = useState("");
  const [refundPaymentMethod, setRefundPaymentMethod] =
    useState<PaymentMethod>("Nakit");
  const [refundNote, setRefundNote] = useState("");

  const [selectedCashAccountId, setSelectedCashAccountId] =
    useState("");
  const [selectedBankAccountId, setSelectedBankAccountId] =
    useState("");

  const [selectedRefundCashAccountId, setSelectedRefundCashAccountId] =
    useState("");
  const [selectedRefundBankAccountId, setSelectedRefundBankAccountId] =
    useState("");

  const [savingPayment, setSavingPayment] = useState(false);
  const [savingRefund, setSavingRefund] = useState(false);

  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] =
    useState<BalanceFilter>("all");

  const [transactionFilter, setTransactionFilter] =
    useState("all");

  useEffect(() => {
    loadCari();
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (showPaymentModal && !savingPayment) {
        setShowPaymentModal(false);
        return;
      }

      if (showRefundModal && !savingRefund) {
        setShowRefundModal(false);
        return;
      }

      if (selectedCustomer) {
        setSelectedCustomer(null);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    showPaymentModal,
    showRefundModal,
    selectedCustomer,
    savingPayment,
    savingRefund,
  ]);

  async function loadCari(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

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
      console.error(customersResult.error);

      alert(
        `Müşteriler yüklenemedi.\n\n${customersResult.error.message}`
      );

      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (transactionsResult.error) {
      console.error(transactionsResult.error);

      alert(
        `Cari hareketleri yüklenemedi.\n\n${transactionsResult.error.message}`
      );

      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (cashAccountsResult.error) {
      console.error(cashAccountsResult.error);

      setCashAccounts([]);

      console.warn(
        "Kasa hesapları yüklenemedi:",
        cashAccountsResult.error.message
      );
    } else {
      setCashAccounts(
        (cashAccountsResult.data || []).map((account) => ({
          id: account.id,
          name: account.name,
          balance: Number(account.balance || 0),
          is_active: Boolean(account.is_active),
        }))
      );
    }

    if (bankAccountsResult.error) {
      console.error(bankAccountsResult.error);

      setBankAccounts([]);

      console.warn(
        "Banka hesapları yüklenemedi:",
        bankAccountsResult.error.message
      );
    } else {
      setBankAccounts(
        (bankAccountsResult.data || []).map((account) => ({
          id: account.id,
          bank_name: account.bank_name,
          account_name: account.account_name,
          iban: account.iban,
          balance: Number(account.balance || 0),
          is_active: Boolean(account.is_active),
        }))
      );
    }

    setCustomers((customersResult.data || []) as Customer[]);

    setTransactions(
      (transactionsResult.data || []).map(
        (transaction: AccountTransaction) => ({
          id: transaction.id,
          customer_id: transaction.customer_id,
          transaction_type: transaction.transaction_type,
          amount: Number(transaction.amount || 0),
          reference_id: transaction.reference_id || null,
          payment_method: transaction.payment_method || null,
          note: transaction.note || null,
          created_at: transaction.created_at,
        })
      )
    );

    setLoading(false);
    setRefreshing(false);
  }

  const customerBalances = useMemo(() => {
    return customers.map((customer) => {
      const customerTransactions = transactions.filter(
        (transaction) =>
          transaction.customer_id === customer.id
      );

      const sales = customerTransactions
        .filter(
          (transaction) =>
            transaction.transaction_type === "sale"
        )
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
          0
        );

      const payments = customerTransactions
        .filter(
          (transaction) =>
            transaction.transaction_type === "payment"
        )
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
          0
        );

      const refunds = customerTransactions
        .filter(
          (transaction) =>
            transaction.transaction_type === "refund"
        )
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
          0
        );

      const customerRefunds = customerTransactions
        .filter(
          (transaction) =>
            transaction.transaction_type === "customer_refund"
        )
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
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

    return customerBalances.filter((customer) => {
      const matchesSearch =
        !query ||
        customer.company_name
          .toLocaleLowerCase("tr-TR")
          .includes(query) ||
        customer.contact_name
          ?.toLocaleLowerCase("tr-TR")
          .includes(query) ||
        customer.phone?.includes(query) ||
        customer.city
          ?.toLocaleLowerCase("tr-TR")
          .includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (
        balanceFilter === "debt" &&
        customer.balance <= 0
      ) {
        return false;
      }

      if (
        balanceFilter === "credit" &&
        customer.balance >= 0
      ) {
        return false;
      }

      if (
        balanceFilter === "closed" &&
        customer.balance !== 0
      ) {
        return false;
      }

      return true;
    });
  }, [
    customerBalances,
    search,
    balanceFilter,
  ]);

  const totalSales = useMemo(
    () =>
      customerBalances.reduce(
        (sum, customer) => sum + customer.sales,
        0
      ),
    [customerBalances]
  );

  const totalPayments = useMemo(
    () =>
      customerBalances.reduce(
        (sum, customer) => sum + customer.payments,
        0
      ),
    [customerBalances]
  );

  const totalRefunds = useMemo(
    () =>
      customerBalances.reduce(
        (sum, customer) => sum + customer.refunds,
        0
      ),
    [customerBalances]
  );

  const totalCustomerRefunds = useMemo(
    () =>
      customerBalances.reduce(
        (sum, customer) =>
          sum + customer.customerRefunds,
        0
      ),
    [customerBalances]
  );

  const totalCustomerDebt = useMemo(
    () =>
      customerBalances.reduce(
        (sum, customer) =>
          sum + Math.max(customer.balance, 0),
        0
      ),
    [customerBalances]
  );

  const totalCustomerCredit = useMemo(
    () =>
      customerBalances.reduce(
        (sum, customer) =>
          sum + Math.max(-customer.balance, 0),
        0
      ),
    [customerBalances]
  );

  const debtCustomerCount = useMemo(
    () =>
      customerBalances.filter(
        (customer) => customer.balance > 0
      ).length,
    [customerBalances]
  );

  const creditCustomerCount = useMemo(
    () =>
      customerBalances.filter(
        (customer) => customer.balance < 0
      ).length,
    [customerBalances]
  );

  const closedCustomerCount = useMemo(
    () =>
      customerBalances.filter(
        (customer) => customer.balance === 0
      ).length,
    [customerBalances]
  );

  const totalCash = useMemo(
    () =>
      cashAccounts.reduce(
        (sum, account) =>
          sum + Number(account.balance || 0),
        0
      ),
    [cashAccounts]
  );

  const totalBank = useMemo(
    () =>
      bankAccounts.reduce(
        (sum, account) =>
          sum + Number(account.balance || 0),
        0
      ),
    [bankAccounts]
  );

  const totalLiquidAssets =
    totalCash + totalBank;

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

  function formatShortDate(value: string) {
    return new Date(value).toLocaleDateString(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  function parsePaymentAmount(value: string) {
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
      const parts = cleaned.split(".");
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
        return "Satış İadesi";
      case "customer_refund":
        return "Müşteri İadesi";
      default:
        return transactionType;
    }
  }

  function getTransactionClass(
    transactionType: string
  ) {
    switch (transactionType) {
      case "sale":
        return "bg-red-50 text-red-700 ring-red-200";
      case "payment":
        return "bg-green-50 text-green-700 ring-green-200";
      case "refund":
        return "bg-blue-50 text-blue-700 ring-blue-200";
      case "customer_refund":
        return "bg-orange-50 text-orange-700 ring-orange-200";
      default:
        return "bg-slate-50 text-slate-700 ring-slate-200";
    }
  }

  function getTransactionAmount(
    transaction: AccountTransaction
  ) {
    if (
      transaction.transaction_type === "sale"
    ) {
      return {
        text: `+${formatPrice(transaction.amount)} ₺`,
        className: "text-red-600",
      };
    }

    if (
      transaction.transaction_type === "refund"
    ) {
      return {
        text: `-${formatPrice(transaction.amount)} ₺`,
        className: "text-blue-600",
      };
    }

    if (
      transaction.transaction_type ===
      "customer_refund"
    ) {
      return {
        text: `+${formatPrice(transaction.amount)} ₺`,
        className: "text-orange-600",
      };
    }

    return {
      text: `-${formatPrice(transaction.amount)} ₺`,
      className: "text-green-600",
    };
  }

  function getBalanceLabel(balance: number) {
    if (balance > 0) {
      return "Borçlu";
    }

    if (balance < 0) {
      return "Alacaklı";
    }

    return "Kapalı";
  }

  function getBalanceColor(balance: number) {
    if (balance > 0) {
      return "red";
    }

    if (balance < 0) {
      return "blue";
    }

    return "green";
  }

  function getLastTransaction(
    customerId: string
  ) {
    return transactions.find(
      (transaction) =>
        transaction.customer_id === customerId
    );
  }

  function openCustomer(
    customer: CustomerBalance
  ) {
    setSelectedCustomer(customer);
    setTransactionFilter("all");
  }

  function closeCustomer() {
    if (
      showPaymentModal ||
      showRefundModal
    ) {
      return;
    }

    setSelectedCustomer(null);
  }

  function openPaymentModal() {
    if (!selectedCustomer) {
      return;
    }

    setPaymentAmount("");
    setPaymentMethod("Nakit");
    setPaymentNote("");

    const firstCash =
      cashAccounts.find(
        (account) => account.is_active
      );

    const firstBank =
      bankAccounts.find(
        (account) => account.is_active
      );

    setSelectedCashAccountId(
      firstCash?.id || ""
    );

    setSelectedBankAccountId(
      firstBank?.id || ""
    );

    setShowPaymentModal(true);
  }

  function openRefundModal() {
    if (!selectedCustomer) {
      return;
    }

    const availableCredit = Math.max(
      -selectedCustomer.balance,
      0
    );

    if (availableCredit <= 0) {
      alert(
        "Bu müşterinin iade edilecek alacağı bulunmuyor."
      );
      return;
    }

    setRefundAmount(
      availableCredit
        .toFixed(2)
        .replace(".", ",")
    );

    setRefundPaymentMethod("Nakit");
    setRefundNote("");

    const firstCash =
      cashAccounts.find(
        (account) => account.is_active
      );

    const firstBank =
      bankAccounts.find(
        (account) => account.is_active
      );

    setSelectedRefundCashAccountId(
      firstCash?.id || ""
    );

    setSelectedRefundBankAccountId(
      firstBank?.id || ""
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
        account.id === selectedCashAccountId
    );

  const selectedBankAccount =
    bankAccounts.find(
      (account) =>
        account.id === selectedBankAccountId
    );

  const selectedRefundCashAccount =
    cashAccounts.find(
      (account) =>
        account.id === selectedRefundCashAccountId
    );

  const selectedRefundBankAccount =
    bankAccounts.find(
      (account) =>
        account.id === selectedRefundBankAccountId
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
    Boolean(selectedPaymentAccountId);

  const hasRequiredRefundAccount =
    Boolean(selectedRefundAccountId);

  async function addPayment() {
    if (!selectedCustomer) {
      return;
    }

    const amount =
      parsePaymentAmount(paymentAmount);

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
      amount > selectedCustomer.balance
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
            `Fazla tahsilat girmek istediğinize emin misiniz?`
        );

      if (!confirmed) {
        return;
      }
    }

    if (!hasRequiredPaymentAccount) {
      alert(
        paymentMethod === "Nakit"
          ? "Tahsilat için aktif bir kasa hesabı seçmelisiniz."
          : "Tahsilat için aktif bir banka hesabı seçmelisiniz."
      );
      return;
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

    setSavingPayment(false);
    setShowPaymentModal(false);

    await loadCari(true);

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
      parsePaymentAmount(refundAmount);

    const availableCredit = Math.max(
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

    if (availableCredit <= 0) {
      alert(
        "Bu müşterinin iade edilecek alacağı bulunmuyor."
      );
      return;
    }

    if (amount > availableCredit) {
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

    if (!hasRequiredRefundAccount) {
      alert(
        refundPaymentMethod === "Nakit"
          ? "İade için aktif bir kasa hesabı seçmelisiniz."
          : "İade için aktif bir banka hesabı seçmelisiniz."
      );
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
          `İade: ${formatPrice(amount)} ₺`
      );
      return;
    }

    const accountName =
      "name" in selectedAccount
        ? selectedAccount.name
        : `${selectedAccount.bank_name} / ${selectedAccount.account_name}`;

    const confirmed =
      window.confirm(
        `Müşteriye ${formatPrice(
          amount
        )} ₺ iade yapılacak.\n\n` +
          `Müşteri: ${selectedCustomer.company_name}\n` +
          `Yöntem: ${refundPaymentMethod}\n` +
          `Hesap: ${accountName}\n\n` +
          `Bu işlem seçilen hesaptan para çıkaracaktır.\n\n` +
          `Devam etmek istiyor musunuz?`
      );

    if (!confirmed) {
      return;
    }

    setSavingRefund(true);

    const { error } =
      await supabase.rpc(
        "add_customer_refund",
        {
          p_customer_id:
            selectedCustomer.id,
          p_amount: amount,
          p_payment_method:
            refundPaymentMethod,
          p_note:
            refundNote.trim() || null,
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

    setSavingRefund(false);
    setShowRefundModal(false);

    await loadCari(true);

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
          .filter((transaction) => {
            if (
              transactionFilter === "all"
            ) {
              return true;
            }

            return (
              transaction.transaction_type ===
              transactionFilter
            );
          })
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
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl p-6">
          <div className="mb-8 animate-pulse">
            <div className="h-8 w-52 rounded-lg bg-slate-200" />
            <div className="mt-3 h-4 w-80 rounded bg-slate-200" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>

          <div className="mt-6 h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between print:hidden">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-xl text-white shadow-lg">
                ₺
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Finans
                </p>

                <h1 className="text-3xl font-black tracking-tight text-slate-900">
                  Cari Hesaplar
                </h1>
              </div>
            </div>

            <p className="max-w-2xl text-sm text-slate-500">
              Müşteri bakiyelerini, satışları,
              tahsilatları ve cari hareketleri tek
              ekrandan yönetin.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadCari(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            >
              ↻
            </span>

            {refreshing
              ? "Yenileniyor..."
              : "Yenile"}
          </button>
        </div>

        {/* ANA ÖZET */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
          <div className="group overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Müşteri Borcu
                  </p>

                  <p className="mt-2 text-2xl font-black tracking-tight text-red-600">
                    {formatPrice(
                      totalCustomerDebt
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-lg">
                  ↑
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">
                  Borçlu müşteri
                </span>

                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">
                  {debtCustomerCount}
                </span>
              </div>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Toplam Tahsilat
                  </p>

                  <p className="mt-2 text-2xl font-black tracking-tight text-green-600">
                    {formatPrice(
                      totalPayments
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-lg">
                  ✓
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">
                  Gerçekleşen müşteri tahsilatları
                </span>
              </div>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Müşteri Alacağı
                  </p>

                  <p className="mt-2 text-2xl font-black tracking-tight text-blue-600">
                    {formatPrice(
                      totalCustomerCredit
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg">
                  ↓
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">
                  Alacaklı müşteri
                </span>

                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600">
                  {creditCustomerCount}
                </span>
              </div>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Kasa + Banka
                  </p>

                  <p className="mt-2 text-2xl font-black tracking-tight text-white">
                    {formatPrice(
                      totalLiquidAssets
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg text-white">
                  $
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                <span className="text-slate-400">
                  Kasa
                </span>

                <span className="font-bold text-white">
                  {formatPrice(totalCash)} ₺
                </span>

                <span className="text-slate-600">
                  /
                </span>

                <span className="text-slate-400">
                  Banka
                </span>

                <span className="font-bold text-white">
                  {formatPrice(totalBank)} ₺
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* İKİNCİ ÖZET */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3 print:hidden">
          <button
            type="button"
            onClick={() =>
              setBalanceFilter(
                balanceFilter === "debt"
                  ? "all"
                  : "debt"
              )
            }
            className={`rounded-2xl border p-4 text-left transition ${
              balanceFilter === "debt"
                ? "border-red-300 bg-red-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Borçlu Hesaplar
                </p>

                <p className="mt-1 text-xl font-black text-red-600">
                  {debtCustomerCount}
                </p>
              </div>

              <span className="text-xl">
                🔴
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setBalanceFilter(
                balanceFilter === "credit"
                  ? "all"
                  : "credit"
              )
            }
            className={`rounded-2xl border p-4 text-left transition ${
              balanceFilter === "credit"
                ? "border-blue-300 bg-blue-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Müşteri Alacaklı
                </p>

                <p className="mt-1 text-xl font-black text-blue-600">
                  {creditCustomerCount}
                </p>
              </div>

              <span className="text-xl">
                🔵
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setBalanceFilter(
                balanceFilter === "closed"
                  ? "all"
                  : "closed"
              )
            }
            className={`rounded-2xl border p-4 text-left transition ${
              balanceFilter === "closed"
                ? "border-green-300 bg-green-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-green-200 hover:bg-green-50/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Kapalı Hesaplar
                </p>

                <p className="mt-1 text-xl font-black text-green-600">
                  {closedCustomerCount}
                </p>
              </div>

              <span className="text-xl">
                🟢
              </span>
            </div>
          </button>
        </div>

        {/* MÜŞTERİ TABLOSU */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:hidden">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black tracking-tight text-slate-900">
                    Müşteri Cari Hesapları
                  </h2>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                    {filteredCustomers.length}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-400">
                  Müşterilerin güncel cari durumunu
                  görüntüleyin.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    ⌕
                  </span>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Müşteri, telefon veya şehir..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-900 focus:bg-white sm:w-80"
                  />
                </div>

                <select
                  value={balanceFilter}
                  onChange={(e) =>
                    setBalanceFilter(
                      e.target
                        .value as BalanceFilter
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900"
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

          {filteredCustomers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                ⌕
              </div>

              <p className="mt-4 font-bold text-slate-800">
                Müşteri bulunamadı
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Arama veya filtre kriterlerini
                değiştirmeyi deneyin.
              </p>

              {(search ||
                balanceFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setBalanceFilter(
                      "all"
                    );
                  }}
                  className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Müşteri
                      </th>

                      <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Satış
                      </th>

                      <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Tahsilat
                      </th>

                      <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                        İade
                      </th>

                      <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Bakiye
                      </th>

                      <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                        İşlem
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map(
                      (customer) => {
                        const lastTransaction =
                          getLastTransaction(
                            customer.id
                          );

                        const balanceColor =
                          getBalanceColor(
                            customer.balance
                          );

                        return (
                          <tr
                            key={customer.id}
                            className="group transition hover:bg-slate-50"
                          >
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600">
                                  {customer.company_name
                                    .slice(
                                      0,
                                      1
                                    )
                                    .toLocaleUpperCase(
                                      "tr-TR"
                                    )}
                                </div>

                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900">
                                    {
                                      customer.company_name
                                    }
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                    {customer.contact_name && (
                                      <span>
                                        {
                                          customer.contact_name
                                        }
                                      </span>
                                    )}

                                    {customer.city && (
                                      <>
                                        <span>
                                          •
                                        </span>

                                        <span>
                                          {
                                            customer.city
                                          }
                                        </span>
                                      </>
                                    )}

                                    {lastTransaction && (
                                      <>
                                        <span>
                                          •
                                        </span>

                                        <span>
                                          Son işlem{" "}
                                          {formatShortDate(
                                            lastTransaction.created_at
                                          )}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-5 text-right">
                              <span className="font-bold text-red-600">
                                {formatPrice(
                                  customer.sales
                                )}{" "}
                                ₺
                              </span>
                            </td>

                            <td className="px-5 py-5 text-right">
                              <span className="font-bold text-green-600">
                                {formatPrice(
                                  customer.payments
                                )}{" "}
                                ₺
                              </span>
                            </td>

                            <td className="px-5 py-5 text-right">
                              <span className="font-bold text-blue-600">
                                {formatPrice(
                                  customer.refunds
                                )}{" "}
                                ₺
                              </span>
                            </td>

                            <td className="px-5 py-5 text-right">
                              <div className="flex flex-col items-end">
                                <span
                                  className={`font-black ${
                                    balanceColor ===
                                    "red"
                                      ? "text-red-600"
                                      : balanceColor ===
                                        "blue"
                                      ? "text-blue-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {formatPrice(
                                    Math.abs(
                                      customer.balance
                                    )
                                  )}{" "}
                                  ₺
                                </span>

                                <span
                                  className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    balanceColor ===
                                    "red"
                                      ? "bg-red-50 text-red-600"
                                      : balanceColor ===
                                        "blue"
                                      ? "bg-blue-50 text-blue-600"
                                      : "bg-green-50 text-green-600"
                                  }`}
                                >
                                  {getBalanceLabel(
                                    customer.balance
                                  )}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openCustomer(
                                    customer
                                  )
                                }
                                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white opacity-90 transition hover:bg-slate-700 hover:opacity-100"
                              >
                                Detay →
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBİL */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredCustomers.map(
                  (customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() =>
                        openCustomer(
                          customer
                        )
                      }
                      className="w-full p-5 text-left transition active:bg-slate-100"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600">
                            {customer.company_name
                              .slice(
                                0,
                                1
                              )
                              .toLocaleUpperCase(
                                "tr-TR"
                              )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">
                              {
                                customer.company_name
                              }
                            </p>

                            {customer.contact_name && (
                              <p className="mt-1 truncate text-xs text-slate-400">
                                {
                                  customer.contact_name
                                }
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p
                            className={`font-black ${
                              customer.balance >
                              0
                                ? "text-red-600"
                                : customer.balance <
                                  0
                                ? "text-blue-600"
                                : "text-green-600"
                            }`}
                          >
                            {formatPrice(
                              Math.abs(
                                customer.balance
                              )
                            )}{" "}
                            ₺
                          </p>

                          <p className="mt-1 text-[10px] font-bold text-slate-400">
                            {getBalanceLabel(
                              customer.balance
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-red-50 p-3">
                          <p className="text-[9px] font-black uppercase text-red-400">
                            Satış
                          </p>

                          <p className="mt-1 text-xs font-black text-red-600">
                            {formatPrice(
                              customer.sales
                            )}{" "}
                            ₺
                          </p>
                        </div>

                        <div className="rounded-xl bg-green-50 p-3">
                          <p className="text-[9px] font-black uppercase text-green-500">
                            Tahsilat
                          </p>

                          <p className="mt-1 text-xs font-black text-green-600">
                            {formatPrice(
                              customer.payments
                            )}{" "}
                            ₺
                          </p>
                        </div>

                        <div className="rounded-xl bg-blue-50 p-3">
                          <p className="text-[9px] font-black uppercase text-blue-400">
                            İade
                          </p>

                          <p className="mt-1 text-xs font-black text-blue-600">
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

      {/* CARİ DETAY */}
      {selectedCustomer && (
        <div
          className="cari-print-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCustomer();
            }
          }}
        >
          <div className="cari-print-card flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7 sm:py-5 print:hidden">
              <div className="flex min-w-0 items-center gap-4">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white sm:flex">
                  {selectedCustomer.company_name
                    .slice(
                      0,
                      1
                    )
                    .toLocaleUpperCase(
                      "tr-TR"
                    )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                      {
                        selectedCustomer.company_name
                      }
                    </h2>

                    <span
                      className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex ${
                        selectedCustomer.balance >
                        0
                          ? "bg-red-50 text-red-600"
                          : selectedCustomer.balance <
                            0
                          ? "bg-blue-50 text-blue-600"
                          : "bg-green-50 text-green-600"
                      }`}
                    >
                      {getBalanceLabel(
                        selectedCustomer.balance
                      )}
                    </span>
                  </div>

                  {selectedCustomer.contact_name && (
                    <p className="mt-1 text-sm text-slate-500">
                      {
                        selectedCustomer.contact_name
                      }
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={closeCustomer}
                className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            {/* PRINT HEADER */}
            <div className="hidden print:block">
              <img
                src="/esoralogo.png"
                alt="ESORA"
                className="h-16 w-auto object-contain"
              />

              <div className="mt-4 border-b border-slate-300 pb-4">
                <h1 className="text-2xl font-black">
                  Cari Hesap Ekstresi
                </h1>

                <p className="mt-2">
                  Müşteri:{" "}
                  <strong>
                    {
                      selectedCustomer.company_name
                    }
                  </strong>
                </p>

                <p className="mt-1">
                  Tarih:{" "}
                  {new Date().toLocaleDateString(
                    "tr-TR"
                  )}
                </p>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="cari-print-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              {/* ÖZET */}
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-400">
                    Toplam Satış
                  </p>

                  <p className="mt-2 text-xl font-black text-red-600">
                    {formatPrice(
                      selectedCustomer.sales
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-green-500">
                    Toplam Tahsilat
                  </p>

                  <p className="mt-2 text-xl font-black text-green-600">
                    {formatPrice(
                      selectedCustomer.payments
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                    Satış İadesi
                  </p>

                  <p className="mt-2 text-xl font-black text-blue-600">
                    {formatPrice(
                      selectedCustomer.refunds
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div
                  className={`rounded-2xl p-4 text-white ${
                    selectedCustomer.balance >
                    0
                      ? "bg-red-600"
                      : selectedCustomer.balance <
                        0
                      ? "bg-blue-600"
                      : "bg-green-600"
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider opacity-80">
                    Güncel Bakiye
                  </p>

                  <p className="mt-2 text-xl font-black">
                    {formatPrice(
                      Math.abs(
                        selectedCustomer.balance
                      )
                    )}{" "}
                    ₺
                  </p>

                  <p className="mt-1 text-xs font-semibold opacity-80">
                    {getBalanceLabel(
                      selectedCustomer.balance
                    )}
                  </p>
                </div>
              </div>

              {/* BİLGİLER */}
              <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Müşteri Bilgileri
                    </p>

                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      Hesap Profili
                    </h3>
                  </div>

                  {selectedCustomer.credit_limit !==
                    null && (
                    <div className="rounded-xl bg-slate-50 px-4 py-3 sm:text-right">
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Kredi Limiti
                      </p>

                      <p className="mt-1 font-black text-slate-900">
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

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Telefon
                    </p>

                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {selectedCustomer.phone ||
                        "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Şehir
                    </p>

                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {selectedCustomer.city ||
                        "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Vade
                    </p>

                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {selectedCustomer.payment_term !==
                      null
                        ? `${selectedCustomer.payment_term} gün`
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Ödeme Tercihi
                    </p>

                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {selectedCustomer.payment_method ||
                        "-"}
                    </p>
                  </div>
                </div>

                {selectedCustomer.credit_limit !==
                  null &&
                  selectedCustomer.credit_limit >
                    0 && (
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">
                          Kredi kullanımı
                        </span>

                        <span className="font-bold text-slate-700">
                          {formatPrice(
                            Math.max(
                              selectedCustomer.balance,
                              0
                            )
                          )}{" "}
                          /{" "}
                          {formatPrice(
                            Number(
                              selectedCustomer.credit_limit
                            )
                          )}{" "}
                          ₺
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            selectedCustomer.balance >=
                            selectedCustomer.credit_limit
                              ? "bg-red-500"
                              : "bg-slate-900"
                          }`}
                          style={{
                            width: `${Math.min(
                              (Math.max(
                                selectedCustomer.balance,
                                0
                              ) /
                                Number(
                                  selectedCustomer.credit_limit
                                )) *
                                100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
              </div>

              {/* BUTONLAR */}
              <div className="mb-6 flex flex-wrap gap-3 print:hidden">
                <button
                  type="button"
                  onClick={openPaymentModal}
                  disabled={
                    selectedCustomer.balance <=
                      0 ||
                    savingPayment
                  }
                  className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                    className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↩ Müşteriye İade Et
                  </button>
                )}

                <button
                  type="button"
                  onClick={
                    printCustomerStatement
                  }
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  🖨 Cari Ekstre
                </button>
              </div>

              {/* ALACAK UYARISI */}
              {selectedCustomer.balance <
                0 && (
                <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
                  <div>
                    <p className="font-black text-blue-800">
                      Müşterinin{" "}
                      {formatPrice(
                        Math.abs(
                          selectedCustomer.balance
                        )
                      )}{" "}
                      ₺ alacağı bulunuyor.
                    </p>

                    <p className="mt-1 text-sm text-blue-600">
                      Bu tutarı müşteriye iade
                      edebilir veya cari hesapta
                      bırakabilirsiniz.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      openRefundModal
                    }
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    İade İşlemi
                  </button>
                </div>
              )}

              {/* HAREKETLER */}
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="font-black text-slate-900">
                        Cari Hareketleri
                      </h3>

                      <p className="mt-1 text-xs text-slate-400">
                        {selectedCustomerTransactions.length}{" "}
                        hareket
                      </p>
                    </div>

                    <select
                      value={
                        transactionFilter
                      }
                      onChange={(e) =>
                        setTransactionFilter(
                          e.target.value
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-slate-900 print:hidden"
                    >
                      <option value="all">
                        Tüm Hareketler
                      </option>

                      <option value="sale">
                        Satışlar
                      </option>

                      <option value="payment">
                        Tahsilatlar
                      </option>

                      <option value="refund">
                        Satış İadeleri
                      </option>

                      <option value="customer_refund">
                        Müşteri İadeleri
                      </option>
                    </select>
                  </div>
                </div>

                {selectedCustomerTransactions.length ===
                0 ? (
                  <div className="p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                      📄
                    </div>

                    <p className="mt-3 font-bold text-slate-700">
                      Hareket bulunmuyor
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Bu filtreye uygun cari hareket
                      bulunamadı.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-white">
                          <th className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Tarih
                          </th>

                          <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                            İşlem
                          </th>

                          <th className="min-w-[240px] px-5 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Açıklama
                          </th>

                          <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Ödeme
                          </th>

                          <th className="whitespace-nowrap px-5 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Tutar
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {selectedCustomerTransactions.map(
                          (transaction) => {
                            const amount =
                              getTransactionAmount(
                                transaction
                              );

                            return (
                              <tr
                                key={
                                  transaction.id
                                }
                                className="transition hover:bg-slate-50"
                              >
                                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                                  {formatDate(
                                    transaction.created_at
                                  )}
                                </td>

                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset ${getTransactionClass(
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

                                <td className="px-5 py-4 text-sm text-slate-500">
                                  {transaction.payment_method ||
                                    "-"}
                                </td>

                                <td
                                  className={`whitespace-nowrap px-5 py-4 text-right font-black ${amount.className}`}
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

              {/* PRINT FOOTER */}
              <div className="mt-8 hidden border-t border-slate-300 pt-4 print:block">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    ESORA Cari Hesap Ekstresi
                  </span>

                  <span>
                    Oluşturulma:{" "}
                    {new Date().toLocaleString(
                      "tr-TR"
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAHSİLAT MODALI */}
      {showPaymentModal &&
        selectedCustomer && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                if (!savingPayment) {
                  setShowPaymentModal(
                    false
                  );
                }
              }
            }}
          >
            <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-green-600">
                      Finansal İşlem
                    </p>

                    <h2 className="mt-1 text-xl font-black text-slate-900">
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
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl text-slate-400 hover:bg-slate-100 disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-2xl bg-red-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-400">
                    Mevcut Cari Borç
                  </p>

                  <p className="mt-2 text-3xl font-black text-red-600">
                    {formatPrice(
                      selectedCustomer.balance
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
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
                          e.target.value
                        )
                      }
                      placeholder="0,00"
                      disabled={
                        savingPayment
                      }
                      autoFocus
                      className="w-full rounded-xl border border-slate-300 px-4 py-4 pr-12 text-xl font-black outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-100"
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">
                      ₺
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
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
                        method === "Nakit"
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-slate-900"
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
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Kasa Hesabı
                    </label>

                    {cashAccounts.length ===
                    0 ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Aktif kasa hesabı bulunamadı.
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
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-slate-900"
                        >
                          <option value="">
                            Kasa seçin
                          </option>

                          {cashAccounts.map(
                            (account) => (
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
                          <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                            <span className="text-xs text-slate-500">
                              Mevcut bakiye
                            </span>

                            <span className="font-black text-slate-900">
                              {formatPrice(
                                selectedCashAccount.balance
                              )}{" "}
                              ₺
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {isBankPayment && (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Banka Hesabı
                    </label>

                    {bankAccounts.length ===
                    0 ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Aktif banka hesabı bulunamadı.
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
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-slate-900"
                        >
                          <option value="">
                            Banka hesabı seçin
                          </option>

                          {bankAccounts.map(
                            (account) => (
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
                          <div className="mt-2 rounded-xl bg-slate-50 p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">
                                Mevcut bakiye
                              </span>

                              <span className="font-black text-slate-900">
                                {formatPrice(
                                  selectedBankAccount.balance
                                )}{" "}
                                ₺
                              </span>
                            </div>

                            {selectedBankAccount.iban && (
                              <p className="mt-2 break-all text-[11px] text-slate-400">
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

                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-green-600">
                    Finansal Etki
                  </p>

                  <p className="mt-1 text-sm leading-6 text-green-800">
                    <strong>
                      {formatPrice(
                        parsePaymentAmount(
                          paymentAmount
                        ) || 0
                      )}{" "}
                      ₺
                    </strong>{" "}
                    tahsilat{" "}
                    <strong>
                      {paymentMethod ===
                      "Nakit"
                        ? selectedCashAccount?.name ||
                          "seçilecek kasa"
                        : selectedBankAccount
                        ? `${selectedBankAccount.bank_name} - ${selectedBankAccount.account_name}`
                        : "seçilecek banka hesabı"}
                    </strong>{" "}
                    hesabına eklenecek.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Açıklama
                  </label>

                  <textarea
                    value={
                      paymentNote
                    }
                    onChange={(e) =>
                      setPaymentNote(
                        e.target.value
                      )
                    }
                    placeholder="Ödeme ile ilgili not..."
                    rows={3}
                    disabled={
                      savingPayment
                    }
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-6">
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
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Vazgeç
                </button>

                <button
                  type="button"
                  onClick={addPayment}
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
                  className="flex-1 rounded-xl bg-green-600 px-4 py-3.5 text-sm font-black text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingPayment
                    ? "Kaydediliyor..."
                    : "Tahsilatı Kaydet"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* MÜŞTERİ İADE MODALI */}
      {showRefundModal &&
        selectedCustomer && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                if (!savingRefund) {
                  setShowRefundModal(
                    false
                  );
                }
              }
            }}
          >
            <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">
                      Finansal İşlem
                    </p>

                    <h2 className="mt-1 text-xl font-black text-slate-900">
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
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl text-slate-400 hover:bg-slate-100 disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-2xl bg-blue-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-500">
                    Müşterinin Alacağı
                  </p>

                  <p className="mt-2 text-3xl font-black text-blue-700">
                    {formatPrice(
                      Math.abs(
                        selectedCustomer.balance
                      )
                    )}{" "}
                    ₺
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
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
                          e.target.value
                        )
                      }
                      placeholder="0,00"
                      disabled={
                        savingRefund
                      }
                      autoFocus
                      className="w-full rounded-xl border border-slate-300 px-4 py-4 pr-12 text-xl font-black outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">
                      ₺
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    En fazla{" "}
                    {formatPrice(
                      Math.abs(
                        selectedCustomer.balance
                      )
                    )}{" "}
                    ₺ iade edilebilir.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
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
                        method === "Nakit"
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-slate-900"
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

                {!isBankRefund && (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Para Çıkacak Kasa
                    </label>

                    {cashAccounts.length ===
                    0 ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Aktif kasa hesabı bulunamadı.
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
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-slate-900"
                        >
                          <option value="">
                            Kasa seçin
                          </option>

                          {cashAccounts.map(
                            (account) => (
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
                          <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                            <span className="text-xs text-slate-500">
                              Mevcut bakiye
                            </span>

                            <span className="font-black text-slate-900">
                              {formatPrice(
                                selectedRefundCashAccount.balance
                              )}{" "}
                              ₺
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {isBankRefund && (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Para Çıkacak Banka
                    </label>

                    {bankAccounts.length ===
                    0 ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Aktif banka hesabı bulunamadı.
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
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-slate-900"
                        >
                          <option value="">
                            Banka hesabı seçin
                          </option>

                          {bankAccounts.map(
                            (account) => (
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
                          <div className="mt-2 rounded-xl bg-slate-50 p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">
                                Mevcut bakiye
                              </span>

                              <span className="font-black text-slate-900">
                                {formatPrice(
                                  selectedRefundBankAccount.balance
                                )}{" "}
                                ₺
                              </span>
                            </div>

                            {selectedRefundBankAccount.iban && (
                              <p className="mt-2 break-all text-[11px] text-slate-400">
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

                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">
                    Finansal Etki
                  </p>

                  <p className="mt-1 text-sm leading-6 text-orange-800">
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
                      {refundPaymentMethod ===
                      "Nakit"
                        ? selectedRefundCashAccount?.name ||
                          "seçilecek kasa"
                        : selectedRefundBankAccount
                        ? `${selectedRefundBankAccount.bank_name} - ${selectedRefundBankAccount.account_name}`
                        : "seçilecek banka hesabı"}
                    </strong>{" "}
                    hesabından çıkacak.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Açıklama
                  </label>

                  <textarea
                    value={
                      refundNote
                    }
                    onChange={(e) =>
                      setRefundNote(
                        e.target.value
                      )
                    }
                    placeholder="İade ile ilgili not..."
                    rows={3}
                    disabled={
                      savingRefund
                    }
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-6">
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
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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
                  className="flex-1 rounded-xl bg-orange-500 px-4 py-3.5 text-sm font-black text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
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

          html,
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
            display: block !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
          }

          .cari-print-card {
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .cari-print-scroll {
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          button {
            display: none !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          th,
          td {
            border-bottom: 1px solid #ddd !important;
          }

          .overflow-x-auto {
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}