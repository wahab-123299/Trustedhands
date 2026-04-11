import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { walletApi, userApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import BankDetailsForm from "@/components/bank/BankDetailsForm";

// ==============================
// TYPES
// ==============================

interface Transaction {
  _id: string;
  amount: number;
  type: "credit" | "debit";
  status: "pending" | "success" | "failed";
  reference: string;
  createdAt: string;
  description?: string;
}

interface WalletData {
  balance: number;
  transactions: Transaction[];
}

// ==============================
// COMPONENT
// ==============================

const Wallet = () => {
  const { user } = useAuth();

  const [wallet, setWallet] = useState<WalletData>({
    balance: 0,
    transactions: [],
  });

  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [hasBankDetails, setHasBankDetails] = useState(false);
  const [checkingBank, setCheckingBank] = useState(true);

  // ==============================
  // CHECK BANK DETAILS
  // ==============================

  const checkBankDetails = useCallback(async () => {
    try {
      setCheckingBank(true);
      const res = await userApi.getMe();
      const bankDetails = res.data.data?.bankDetails;
      setHasBankDetails(
        !!bankDetails?.accountNumber && 
        !!bankDetails?.bankCode && 
        !!bankDetails?.accountName
      );
    } catch {
      setHasBankDetails(false);
    } finally {
      setCheckingBank(false);
    }
  }, []);

  // ==============================
  // FETCH WALLET
  // ==============================

  const fetchWallet = useCallback(async () => {
    try {
      setLoading(true);
      const res = await walletApi.getBalance();
      
      // Handle nested API response structure
      const walletData = res.data?.data?.wallet;
      
      setWallet({
        balance: walletData?.balance ?? 0,
        transactions: walletData?.transactions ?? [],
      });
    } catch {
      toast.error("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
    checkBankDetails();
  }, [fetchWallet, checkBankDetails]);

  // ==============================
  // DEPOSIT (PAYSTACK INIT)
  // ==============================

  const handleDeposit = async () => {
    if (!amount || Number(amount) <= 0) {
      return toast.error("Enter valid amount");
    }

    try {
      setActionLoading(true);

      const res = await walletApi.initializeDeposit(Number(amount));

      // redirect to Paystack
      window.location.href = res.data.authorization_url;
    } catch {
      toast.error("Failed to initiate payment");
    } finally {
      setActionLoading(false);
    }
  };

  // ==============================
  // WITHDRAW (ARTISAN ONLY)
  // ==============================

  const handleWithdraw = async () => {
    if (!amount || Number(amount) <= 0) {
      return toast.error("Enter valid amount");
    }

    if (!hasBankDetails) {
      setShowBankForm(true);
      return toast.error("Please add bank details first");
    }

    try {
      setActionLoading(true);

      await walletApi.withdraw(Number(amount));

      toast.success("Withdrawal requested");
      setAmount("");
      fetchWallet();
    } catch (error: any) {
      if (error.message?.includes("bank details")) {
        setShowBankForm(true);
      }
      toast.error(error.message || "Withdrawal failed");
    } finally {
      setActionLoading(false);
    }
  };

  // ==============================
  // UI STATES
  // ==============================

  if (loading) {
    return <div className="p-6 text-center">Loading wallet...</div>;
  }

  // ==============================
  // UI
  // ==============================

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* TITLE */}
      <h1 className="text-2xl font-bold">My Wallet</h1>

      {/* BALANCE CARD */}
      <div className="bg-black text-white p-6 rounded-2xl shadow">
        <h2 className="text-sm text-gray-300">Available Balance</h2>
        <p className="text-3xl font-bold mt-2">
          ₦{wallet.balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* BANK DETAILS WARNING (Artisan only) */}
      {user?.role === "artisan" && !checkingBank && !hasBankDetails && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <p className="text-yellow-800 text-sm">
            ⚠️ <strong>Bank details required:</strong> Please add your bank account 
            to enable withdrawals.
          </p>
          <button
            onClick={() => setShowBankForm(!showBankForm)}
            className="mt-2 text-blue-600 text-sm underline"
          >
            {showBankForm ? "Hide form" : "Add bank details"}
          </button>
        </div>
      )}

      {/* BANK DETAILS FORM */}
      {showBankForm && user?.role === "artisan" && (
        <BankDetailsForm 
          embedded={true}
          onSuccess={() => {
            setShowBankForm(false);
            checkBankDetails();
            toast.success("Bank details added! You can now withdraw.");
          }}
        />
      )}

      {/* ACTIONS */}
      <div className="bg-white p-6 rounded-2xl shadow space-y-4">
        <h3 className="font-semibold">Wallet Actions</h3>

        <input
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border p-2 rounded-lg"
        />

        <div className="flex gap-3 flex-wrap">
          {/* Deposit */}
          <button
            onClick={handleDeposit}
            disabled={actionLoading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Deposit
          </button>

          {/* Withdraw (Artisan only) */}
          {user?.role === "artisan" && (
            <button
              onClick={handleWithdraw}
              disabled={actionLoading || checkingBank}
              className={`px-4 py-2 rounded-lg text-white ${
                hasBankDetails
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
              title={!hasBankDetails ? "Add bank details to enable withdrawal" : ""}
            >
              {checkingBank ? "Checking..." : "Withdraw"}
            </button>
          )}
        </div>

        {/* Bank status indicator */}
        {user?.role === "artisan" && hasBankDetails && (
          <p className="text-green-600 text-sm">
            ✓ Bank account connected. Withdrawals enabled.
          </p>
        )}
      </div>

      {/* TRANSACTIONS */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="font-semibold mb-4">Transaction History</h3>

        {wallet.transactions.length === 0 ? (
          <p className="text-gray-500">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {wallet.transactions.map((tx) => (
              <div
                key={tx._id}
                className="flex justify-between items-center border-b pb-2"
              >
                <div>
                  <p className="font-medium">
                    {tx.type === "credit" ? "Credit" : "Debit"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(tx.createdAt).toLocaleString("en-NG")}
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      tx.type === "credit"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}₦
                    {tx.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;