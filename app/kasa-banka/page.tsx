"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type CashAccount = {
  id: string;
  name: string;
  balance: number;
  is_active: boolean;
  created_at: string;
};

type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  iban: string | null;
  balance: number;
  is_active: boolean;
  created_at: string;
};

type CashBankTransaction = {
  id: string;
  account_type: "cash" | "bank";
  account_id: string;
  transaction_type:
    | "income"
    | "expense"
    | "transfer_in"
    | "transfer_out";
  amount: number;
  customer_id: string | null;
  reference_id: string | null;
  payment_method: string | null;
  note: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
};

type ModalType =
  | "income"
  | "expense"
  | "transfer"
  | "cash"
  | "bank"
  | null;

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function KasaBankaPage() {
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<CashBankTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState<ModalType>(null);

  // Banka düzenleme
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankIsActive, setBankIsActive] = useState(true);

  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");

  const [amount, setAmount] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [note, setNote] = useState("");

  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");

  const [search, setSearch] = useState("");
  const [transactionFilter, setTransactionFilter] = useState<
    "all" | "income" | "expense" | "transfer"
  >("all");

  async function loadData() {
    setLoading(true);

    const [
      { data: cashData, error: cashError },
      { data: bankData, error: bankError },
      { data: transactionData, error: transactionError },
      { data: customerData, error: customerError },
    ] = await Promise.all([
      supabase
        .from("cash_accounts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),

      supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),

      supabase
        .from("cash_bank_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),

      supabase
        .from("customers")
        .select("id, company_name, contact_name")
        .order("company_name", { ascending: true }),
    ]);

    if (cashError) {
      console.error("Kasa yükleme hatası:", cashError);
    }

    if (bankError) {
      console.error("Banka yükleme hatası:", bankError);
    }

    if (transactionError) {
      console.error("Hareket yükleme hatası:", transactionError);
    }

    if (customerError) {
      console.error("Müşteri yükleme hatası:", customerError);
    }

    setCashAccounts(cashData || []);
    setBankAccounts(bankData || []);
    setTransactions(transactionData || []);
    setCustomers(customerData || []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalCash = useMemo(
    () =>
      cashAccounts.reduce(
        (sum, account) => sum + Number(account.balance || 0),
        0
      ),
    [cashAccounts]
  );

  const totalBank = useMemo(
    () =>
      bankAccounts.reduce(
        (sum, account) => sum + Number(account.balance || 0),
        0
      ),
    [bankAccounts]
  );

  const grandTotal = totalCash + totalBank;

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();

    customers.forEach((customer) => {
      map.set(customer.id, customer);
    });

    return map;
  }, [customers]);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();

    cashAccounts.forEach((account) => {
      map.set(`cash:${account.id}`, `Kasa - ${account.name}`);
    });

    bankAccounts.forEach((account) => {
      map.set(
        `bank:${account.id}`,
        `Banka - ${account.bank_name} / ${account.account_name}`
      );
    });

    return map;
  }, [cashAccounts, bankAccounts]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");

    return transactions.filter((transaction) => {
      if (
        transactionFilter !== "all" &&
        transactionFilter !== "transfer"
      ) {
        if (transaction.transaction_type !== transactionFilter) {
          return false;
        }
      }

      if (transactionFilter === "transfer") {
        if (
          transaction.transaction_type !== "transfer_in" &&
          transaction.transaction_type !== "transfer_out"
        ) {
          return false;
        }
      }

      if (!term) return true;

      const customer = transaction.customer_id
        ? customerMap.get(transaction.customer_id)
        : null;

      const accountName =
        accountMap.get(
          `${transaction.account_type}:${transaction.account_id}`
        ) || "";

      const customerName =
        customer?.company_name ||
        customer?.contact_name ||
        "";

      const searchable = [
        accountName,
        customerName,
        transaction.note || "",
        transaction.payment_method || "",
        transaction.transaction_type,
        String(transaction.amount),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return searchable.includes(term);
    });
  }, [
    transactions,
    search,
    transactionFilter,
    customerMap,
    accountMap,
  ]);

  function resetModal() {
    setModal(null);

    setEditingBankId(null);
    setBankIsActive(true);

    setAccountName("");
    setBankName("");
    setAccountHolder("");
    setIban("");

    setAmount("");
    setSelectedAccount("");
    setSelectedCustomer("");
    setNote("");

    setTransferFrom("");
    setTransferTo("");
  }

  function openAddBankModal() {
    setEditingBankId(null);
    setBankIsActive(true);
    setBankName("");
    setAccountHolder("");
    setIban("");
    setModal("bank");
  }

  function openEditBankModal(account: BankAccount) {
    setEditingBankId(account.id);
    setBankName(account.bank_name);
    setAccountHolder(account.account_name);
    setIban(account.iban || "");
    setBankIsActive(account.is_active);
    setModal("bank");
  }

  async function addCashAccount() {
    if (!accountName.trim()) {
      alert("Kasa adı girin.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("cash_accounts").insert({
      name: accountName.trim(),
      balance: 0,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      alert(`Kasa oluşturulamadı:\n${error.message}`);
      return;
    }

    resetModal();
    await loadData();
  }

  async function saveBankAccount() {
    if (!bankName.trim()) {
      alert("Banka adı girin.");
      return;
    }

    if (!accountHolder.trim()) {
      alert("Hesap adı girin.");
      return;
    }

    setSaving(true);

    if (editingBankId) {
      const { error } = await supabase
        .from("bank_accounts")
        .update({
          bank_name: bankName.trim(),
          account_name: accountHolder.trim(),
          iban: iban.trim() || null,
          is_active: bankIsActive,
        })
        .eq("id", editingBankId);

      setSaving(false);

      if (error) {
        alert(`Banka hesabı güncellenemedi:\n${error.message}`);
        return;
      }

      resetModal();
      await loadData();

      alert("Banka hesabı başarıyla güncellendi.");
      return;
    }

    const { error } = await supabase.from("bank_accounts").insert({
      bank_name: bankName.trim(),
      account_name: accountHolder.trim(),
      iban: iban.trim() || null,
      balance: 0,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      alert(`Banka hesabı oluşturulamadı:\n${error.message}`);
      return;
    }

    resetModal();
    await loadData();

    alert("Banka hesabı başarıyla eklendi.");
  }

  // =========================================================
  // GELİR - RPC
  // =========================================================

  async function addIncome() {
    const numericAmount = Number(amount.replace(",", "."));

    if (!numericAmount || numericAmount <= 0) {
      alert("Geçerli bir tutar girin.");
      return;
    }

    if (!selectedAccount) {
      alert("Gelirin aktarılacağı hesap seçilmeli.");
      return;
    }

    const [accountType, accountId] = selectedAccount.split(":");

    if (accountType !== "cash" && accountType !== "bank") {
      alert("Geçersiz hesap seçimi.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc(
      "create_cash_bank_income",
      {
        p_account_type: accountType,
        p_account_id: accountId,
        p_amount: numericAmount,
        p_customer_id: selectedCustomer || null,
        p_payment_method: null,
        p_note: note.trim() || null,
      }
    );

    setSaving(false);

    if (error) {
      alert(`Gelir kaydedilemedi:\n${error.message}`);
      return;
    }

    resetModal();
    await loadData();

    alert(`${money(numericAmount)} gelir başarıyla kaydedildi.`);
  }

  // =========================================================
  // GİDER - RPC
  // =========================================================

  async function addExpense() {
    const numericAmount = Number(amount.replace(",", "."));

    if (!numericAmount || numericAmount <= 0) {
      alert("Geçerli bir tutar girin.");
      return;
    }

    if (!selectedAccount) {
      alert("Giderin düşüleceği hesap seçilmeli.");
      return;
    }

    const [accountType, accountId] = selectedAccount.split(":");

    if (accountType !== "cash" && accountType !== "bank") {
      alert("Geçersiz hesap seçimi.");
      return;
    }

    let currentBalance = 0;

    if (accountType === "cash") {
      currentBalance = Number(
        cashAccounts.find((x) => x.id === accountId)?.balance || 0
      );
    } else {
      currentBalance = Number(
        bankAccounts.find((x) => x.id === accountId)?.balance || 0
      );
    }

    if (currentBalance < numericAmount) {
      alert(
        `Yetersiz bakiye.\nMevcut: ${money(
          currentBalance
        )}\nGider: ${money(numericAmount)}`
      );
      return;
    }

    if (
      !confirm(
        `${money(
          numericAmount
        )} gider kaydedilecek. Devam edilsin mi?`
      )
    ) {
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc(
      "create_cash_bank_expense",
      {
        p_account_type: accountType,
        p_account_id: accountId,
        p_amount: numericAmount,
        p_note: note.trim() || null,
      }
    );

    setSaving(false);

    if (error) {
      alert(`Gider kaydedilemedi:\n${error.message}`);
      return;
    }

    resetModal();
    await loadData();

    alert(`${money(numericAmount)} gider başarıyla kaydedildi.`);
  }

  function accountValue(type: "cash" | "bank", id: string) {
    return `${type}:${id}`;
  }

  // =========================================================
  // VİRMAN - RPC
  // =========================================================

  async function makeTransfer() {
    const numericAmount = Number(amount.replace(",", "."));

    if (!numericAmount || numericAmount <= 0) {
      alert("Geçerli bir tutar girin.");
      return;
    }

    if (!transferFrom || !transferTo) {
      alert("Gönderen ve alıcı hesap seçilmeli.");
      return;
    }

    if (transferFrom === transferTo) {
      alert("Gönderen ve alıcı hesap aynı olamaz.");
      return;
    }

    const [fromType, fromId] = transferFrom.split(":");
    const [toType, toId] = transferTo.split(":");

    if (
      (fromType !== "cash" && fromType !== "bank") ||
      (toType !== "cash" && toType !== "bank")
    ) {
      alert("Geçersiz hesap seçimi.");
      return;
    }

    let fromBalance = 0;

    if (fromType === "cash") {
      fromBalance = Number(
        cashAccounts.find((x) => x.id === fromId)?.balance || 0
      );
    } else {
      fromBalance = Number(
        bankAccounts.find((x) => x.id === fromId)?.balance || 0
      );
    }

    if (fromBalance < numericAmount) {
      alert(
        `Gönderen hesapta yeterli bakiye yok.\nMevcut: ${money(
          fromBalance
        )}\nVirman: ${money(numericAmount)}`
      );
      return;
    }

    const fromName =
      accountMap.get(`${fromType}:${fromId}`) || "Hesap";

    const toName =
      accountMap.get(`${toType}:${toId}`) || "Hesap";

    if (
      !confirm(
        `${money(
          numericAmount
        )} tutarında virman yapılacak.\n\n` +
          `Gönderen: ${fromName}\n` +
          `Alıcı: ${toName}\n\n` +
          `Devam edilsin mi?`
      )
    ) {
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc(
      "create_cash_bank_transfer",
      {
        p_source_account_type: fromType,
        p_source_account_id: fromId,
        p_destination_account_type: toType,
        p_destination_account_id: toId,
        p_amount: numericAmount,
        p_note:
          note.trim() ||
          `Virman → ${toName}`,
      }
    );

    setSaving(false);

    if (error) {
      alert(`Virman sırasında hata oluştu:\n${error.message}`);
      return;
    }

    resetModal();
    await loadData();

    alert(
      `${money(
        numericAmount
      )} virman başarıyla gerçekleştirildi.`
    );
  }

  const transactionLabel = (type: string) => {
    switch (type) {
      case "income":
        return "Gelir";
      case "expense":
        return "Gider";
      case "transfer_in":
        return "Virman Giriş";
      case "transfer_out":
        return "Virman Çıkış";
      default:
        return type;
    }
  };

  const transactionSign = (type: string) => {
    if (type === "income" || type === "transfer_in") {
      return "+";
    }

    return "-";
  };

  const transactionAmountClass = (type: string) => {
    if (type === "income" || type === "transfer_in") {
      return "text-emerald-600";
    }

    return "text-red-600";
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Kasa & Banka
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Kasa, banka hesapları ve para hareketlerini yönetin.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModal("income")}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              + Gelir
            </button>

            <button
              onClick={() => setModal("expense")}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              − Gider
            </button>

            <button
              onClick={() => setModal("transfer")}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              ⇄ Virman
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-500">
              Toplam Kasa
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {money(totalCash)}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {cashAccounts.length} aktif kasa
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-500">
              Toplam Banka
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {money(totalBank)}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {bankAccounts.length} aktif banka hesabı
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
            <div className="text-sm font-medium text-slate-500">
              Toplam Mevcut Para
            </div>

            <div className="mt-2 text-2xl font-bold text-emerald-600">
              {money(grandTotal)}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Kasa + banka
            </div>
          </div>
        </div>

        {/* ACCOUNTS */}
        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* CASH */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Kasalar
                </h2>

                <p className="text-xs text-slate-500">
                  Fiziki nakit hesapları
                </p>
              </div>

              <button
                onClick={() => setModal("cash")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Kasa Ekle
              </button>
            </div>

            <div className="p-4">
              {cashAccounts.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Henüz kasa hesabı yok.
                </div>
              ) : (
                <div className="space-y-3">
                  {cashAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-4"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {account.name}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Kasa
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-slate-900">
                          {money(Number(account.balance))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* BANK */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Banka Hesapları
                </h2>

                <p className="text-xs text-slate-500">
                  Banka ve IBAN hesapları
                </p>
              </div>

              <button
                onClick={openAddBankModal}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Banka Ekle
              </button>
            </div>

            <div className="p-4">
              {bankAccounts.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Henüz banka hesabı yok.
                </div>
              ) : (
                <div className="space-y-3">
                  {bankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="rounded-xl border border-slate-100 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">
                            {account.bank_name}
                          </div>

                          <div className="mt-1 text-sm text-slate-600">
                            {account.account_name}
                          </div>

                          {account.iban && (
                            <div className="mt-1 truncate text-xs text-slate-400">
                              {account.iban}
                            </div>
                          )}

                          <div className="mt-3">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              Aktif
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-3">
                          <div className="font-bold text-slate-900">
                            {money(Number(account.balance))}
                          </div>

                          <button
                            onClick={() => openEditBankModal(account)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            ✏️ Düzenle
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* TRANSACTIONS */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Para Hareketleri
                </h2>

                <p className="text-xs text-slate-500">
                  Kasa ve banka hesaplarındaki son hareketler
                </p>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hesap, müşteri veya açıklama ara..."
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400 md:w-80"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Tümü"],
                ["income", "Gelir"],
                ["expense", "Gider"],
                ["transfer", "Virman"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() =>
                    setTransactionFilter(
                      value as
                        | "all"
                        | "income"
                        | "expense"
                        | "transfer"
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    transactionFilter === value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Yükleniyor...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Gösterilecek hareket bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tarih</th>
                    <th className="px-5 py-3 font-semibold">İşlem</th>
                    <th className="px-5 py-3 font-semibold">Hesap</th>
                    <th className="px-5 py-3 font-semibold">Müşteri</th>
                    <th className="px-5 py-3 font-semibold">Açıklama</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Tutar
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map((transaction) => {
                    const customer = transaction.customer_id
                      ? customerMap.get(transaction.customer_id)
                      : null;

                    const accountName =
                      accountMap.get(
                        `${transaction.account_type}:${transaction.account_id}`
                      ) || "Hesap";

                    return (
                      <tr
                        key={transaction.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {dateTime(transaction.created_at)}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {transactionLabel(
                              transaction.transaction_type
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4 font-medium text-slate-800">
                          {accountName}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {customer?.company_name ||
                            customer?.contact_name ||
                            "—"}
                        </td>

                        <td className="max-w-[280px] px-5 py-4 text-slate-500">
                          <div className="truncate">
                            {transaction.note || "—"}
                          </div>
                        </td>

                        <td
                          className={`whitespace-nowrap px-5 py-4 text-right font-bold ${transactionAmountClass(
                            transaction.transaction_type
                          )}`}
                        >
                          {transactionSign(
                            transaction.transaction_type
                          )}
                          {money(Number(transaction.amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* MODAL BACKDROP */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) {
              resetModal();
            }
          }}
        >
          {/* ADD CASH */}
          {modal === "cash" && (
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-xl font-bold text-slate-900">
                  Yeni Kasa
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Yeni bir nakit kasa hesabı oluştur.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Kasa Adı
                  </label>

                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Örn. Merkez Kasa"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    disabled={saving}
                    onClick={resetModal}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Vazgeç
                  </button>

                  <button
                    disabled={saving}
                    onClick={addCashAccount}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving
                      ? "Kaydediliyor..."
                      : "Kasa Oluştur"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ADD / EDIT BANK */}
          {modal === "bank" && (
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingBankId
                    ? "Banka Hesabını Düzenle"
                    : "Yeni Banka Hesabı"}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {editingBankId
                    ? "Banka hesap bilgilerini güncelle."
                    : "Banka hesabını sisteme ekle."}
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Banka
                  </label>

                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Örn. Ziraat Bankası"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Hesap Adı
                  </label>

                  <input
                    value={accountHolder}
                    onChange={(e) =>
                      setAccountHolder(e.target.value)
                    }
                    placeholder="Örn. ESORA Ticari Hesap"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    IBAN
                  </label>

                  <input
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="TR..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                {editingBankId && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          Hesap Durumu
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          Pasif hesaplar yeni gelir, gider ve virman işlemlerinde
                          kullanılmaz.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setBankIsActive((value) => !value)
                        }
                        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                          bankIsActive
                            ? "bg-emerald-600"
                            : "bg-slate-300"
                        }`}
                        aria-label="Banka hesabı durumunu değiştir"
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                            bankIsActive
                              ? "left-6"
                              : "left-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="mt-2 text-xs font-semibold">
                      {bankIsActive ? (
                        <span className="text-emerald-600">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Pasif
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {editingBankId && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <strong>Not:</strong> Hesap bakiyesi bu ekrandan
                    değiştirilemez. Bakiye yalnızca gelir, gider ve virman
                    işlemleriyle değişir.
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    disabled={saving}
                    onClick={resetModal}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Vazgeç
                  </button>

                  <button
                    disabled={saving}
                    onClick={saveBankAccount}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving
                      ? "Kaydediliyor..."
                      : editingBankId
                      ? "Değişiklikleri Kaydet"
                      : "Banka Ekle"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* INCOME / EXPENSE */}
          {(modal === "income" || modal === "expense") && (
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-xl font-bold text-slate-900">
                  {modal === "income"
                    ? "Gelir Ekle"
                    : "Gider Ekle"}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {modal === "income"
                    ? "Kasa veya banka hesabına para girişi oluştur."
                    : "Kasa veya banka hesabından para çıkışı oluştur."}
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Tutar
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-semibold outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Hesap
                  </label>

                  <select
                    value={selectedAccount}
                    onChange={(e) =>
                      setSelectedAccount(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                  >
                    <option value="">Hesap seçin</option>

                    {cashAccounts.length > 0 && (
                      <optgroup label="Kasalar">
                        {cashAccounts.map((account) => (
                          <option
                            key={account.id}
                            value={accountValue(
                              "cash",
                              account.id
                            )}
                          >
                            {account.name} —{" "}
                            {money(Number(account.balance))}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {bankAccounts.length > 0 && (
                      <optgroup label="Bankalar">
                        {bankAccounts.map((account) => (
                          <option
                            key={account.id}
                            value={accountValue(
                              "bank",
                              account.id
                            )}
                          >
                            {account.bank_name} /{" "}
                            {account.account_name} —{" "}
                            {money(Number(account.balance))}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {modal === "income" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Müşteri
                      <span className="ml-1 font-normal text-slate-400">
                        (opsiyonel)
                      </span>
                    </label>

                    <select
                      value={selectedCustomer}
                      onChange={(e) =>
                        setSelectedCustomer(e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                    >
                      <option value="">
                        Müşteri seçmeden devam et
                      </option>

                      {customers.map((customer) => (
                        <option
                          key={customer.id}
                          value={customer.id}
                        >
                          {customer.company_name}
                          {customer.contact_name
                            ? ` — ${customer.contact_name}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Açıklama
                  </label>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      modal === "income"
                        ? "Örn. Diğer gelir"
                        : "Örn. Elektrik faturası"
                    }
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    disabled={saving}
                    onClick={resetModal}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Vazgeç
                  </button>

                  <button
                    disabled={saving}
                    onClick={
                      modal === "income"
                        ? addIncome
                        : addExpense
                    }
                    className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                      modal === "income"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {saving
                      ? "Kaydediliyor..."
                      : modal === "income"
                      ? "Geliri Kaydet"
                      : "Gideri Kaydet"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TRANSFER */}
          {modal === "transfer" && (
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-xl font-bold text-slate-900">
                  Kasa / Banka Virmanı
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Parayı bir hesaptan diğerine aktar.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Tutar
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-semibold outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Gönderen Hesap
                  </label>

                  <select
                    value={transferFrom}
                    onChange={(e) =>
                      setTransferFrom(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                  >
                    <option value="">
                      Gönderen hesap
                    </option>

                    {cashAccounts.map((account) => (
                      <option
                        key={`from-cash-${account.id}`}
                        value={accountValue(
                          "cash",
                          account.id
                        )}
                      >
                        Kasa - {account.name} —{" "}
                        {money(Number(account.balance))}
                      </option>
                    ))}

                    {bankAccounts.map((account) => (
                      <option
                        key={`from-bank-${account.id}`}
                        value={accountValue(
                          "bank",
                          account.id
                        )}
                      >
                        Banka - {account.bank_name} /{" "}
                        {account.account_name} —{" "}
                        {money(Number(account.balance))}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-center text-xl text-slate-400">
                  ↓
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Alıcı Hesap
                  </label>

                  <select
                    value={transferTo}
                    onChange={(e) =>
                      setTransferTo(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                  >
                    <option value="">
                      Alıcı hesap
                    </option>

                    {cashAccounts.map((account) => (
                      <option
                        key={`to-cash-${account.id}`}
                        value={accountValue(
                          "cash",
                          account.id
                        )}
                      >
                        Kasa - {account.name} —{" "}
                        {money(Number(account.balance))}
                      </option>
                    ))}

                    {bankAccounts.map((account) => (
                      <option
                        key={`to-bank-${account.id}`}
                        value={accountValue(
                          "bank",
                          account.id
                        )}
                      >
                        Banka - {account.bank_name} /{" "}
                        {account.account_name} —{" "}
                        {money(Number(account.balance))}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Açıklama
                  </label>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Örn. Bankaya nakit yatırıldı"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    disabled={saving}
                    onClick={resetModal}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Vazgeç
                  </button>

                  <button
                    disabled={saving}
                    onClick={makeTransfer}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving
                      ? "Aktarılıyor..."
                      : "Virmanı Gerçekleştir"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

