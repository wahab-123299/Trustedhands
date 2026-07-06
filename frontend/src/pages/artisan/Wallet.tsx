import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { walletApi, paymentApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import BankDetailsForm from "@/components/bank/BankDetailsForm";

// ==============================
// TYPES
// ==============================

interface Transaction {
  _id: string;
  amount: number;
  type: "credit" | "debit" | "deposit" | "withdrawal";
  status: "pending" | "success" | "failed";
  reference: string;
  createdAt: string;
  description?: string;
}

interface WalletData {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  availableForWithdrawal: number;
  transactions: Transaction[];
}

// ==============================
// COMPONENT
// ==============================

const Wallet = () => {
  const { user } = useAuth();

  const [wallet, setWallet] = useState<WalletData>({
    balance: 0,
    pendingBalance: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    availableForWithdrawal: 0,
    transactions: [],
  });

  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [hasBankDetails, setHasBankDetails] = useState(false);
  const [checkingBank, setCheckingBank] = useState(true);

  // ==============================
  // CHECK BANK DETAILS FROM WALLET (NOT user profile)
  // ==============================
  const checkBankDetails = useCallback(async () => {
    try {
      setCheckingBank(true);
      const res = await paymentApi.getWallet();
      
      // FIXED: Check wallet bank details (NOT user profile - they are separate collections)
      const walletData = res.data.data?.wallet;
      const bankDetails = walletData?.bankDetails;

      console.log('[Wallet] Wallet bank details:', bankDetails);

      setHasBankDetails(
        !!bankDetails?.accountNumber && 
        !!bankDetails?.bankCode && 
        !!bankDetails?.accountName
      );
    } catch (err) {
      console.error('[Wallet] checkBankDetails error:', err);
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
      
      const walletData = res.data?.data?.wallet;
      
      setWallet({
        balance: walletData?.balance ?? 0,
        pendingBalance: walletData?.pendingBalance ?? 0,
        totalEarned: walletData?.totalEarned ?? 0,
        totalWithdrawn: walletData?.totalWithdrawn ?? 0,
        availableForWithdrawal: walletData?.availableForWithdrawal ?? 0,
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
  // DEPOSIT (PAYSTACK INIT) - Artisan only
  // ==============================

  const handleDeposit = async () => {
    if (!amount || Number(amount) <= 0) {
      return toast.error("Enter valid amount");
    }

    const depositAmount = Number(amount);

    if (depositAmount < 1000) {
      return toast.error("Minimum deposit is ₦1,000");
    }

    try {
      setActionLoading(true);

      // FIXED: Calls the correct wallet deposit endpoint (artisan only)
      // Was incorrectly calling /payments/initialize which requires customer role
      const res = await walletApi.initializeDeposit(depositAmount);

      // Redirect to Paystack
      if (res.data.data?.authorization_url) {
        window.location.href = res.data.data.authorization_url;
      } else {
        toast.error("Failed to get payment link");
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || "Failed to initiate deposit";
      toast.error(message);
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

    const withdrawAmount = Number(amount);

    if (withdrawAmount < 500) {
      return toast.error("Minimum withdrawal is ₦500");
    }

    if (!hasBankDetails) {
      setShowBankForm(true);
      return toast.error("Please add bank details first");
    }

    try {
      setActionLoading(true);

      const res = await walletApi.withdraw(withdrawAmount);

      toast.success(res.data.message || "Withdrawal requested successfully");
      setAmount("");
      fetchWallet();
      checkBankDetails();
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || "Withdrawal failed";
      
      if (message.toLowerCase().includes("bank")) {
        setShowBankForm(true);
      }
      
      toast.error(message);
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

      {/* BALANCE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black text-white p-6 rounded-2xl shadow">
          <h2 className="text-sm text-gray-300">Available Balance</h2>
          <p className="text-3xl font-bold mt-2">
            ₦{wallet.balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl shadow">
          <h2 className="text-sm text-emerald-600">Available for Withdrawal</h2>
          <p className="text-3xl font-bold mt-2 text-emerald-700">
            ₦{wallet.availableForWithdrawal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* PENDING BALANCE INFO */}
      {wallet.pendingBalance > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <p className="text-yellow-800 text-sm">
            ⏳ <strong>Pending Balance:</strong> ₦{wallet.pendingBalance.toLocaleString()} 
            (held in escrow until job completion)
          </p>
        </div>
      )}

      {/* BANK DETAILS WARNING */}
      {!checkingBank && !hasBankDetails && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <p className="text-red-800 text-sm">
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
      {showBankForm && (
        <div className="bg-white p-6 rounded-2xl shadow border">
          <h3 className="font-semibold mb-4">Bank Account Details</h3>
          <BankDetailsForm 
            embedded={true}
            onSuccess={() => {
              setShowBankForm(false);
              checkBankDetails();
              toast.success("Bank details added! You can now withdraw.");
            }}
          />
        </div>
      )}

      {/* ACTIONS */}
      <div className="bg-white p-6 rounded-2xl shadow space-y-4">
        <h3 className="font-semibold">Wallet Actions</h3>

        <input
          type="number"
          placeholder="Enter amount (₦)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border p-3 rounded-lg"
          min="500"
        />

        <div className="flex gap-3 flex-wrap">
          {/* Deposit */}
          <button
            onClick={handleDeposit}
            disabled={actionLoading}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {actionLoading ? "Processing..." : "Deposit"}
          </button>

          {/* Withdraw */}
          <button
            onClick={handleWithdraw}
            disabled={actionLoading || checkingBank || !hasBankDetails}
            className={`px-6 py-3 rounded-lg text-white ${
              hasBankDetails
                ? "bg-red-600 hover:bg-red-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            title={!hasBankDetails ? "Add bank details to enable withdrawal" : ""}
          >
            {checkingBank ? "Checking..." : actionLoading ? "Processing..." : "Withdraw"}
          </button>
        </div>

        {/* Bank status */}
        {hasBankDetails && (
          <p className="text-green-600 text-sm">
            ✓ Bank account connected. Withdrawals enabled.
          </p>
        )}
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow text-center">
          <p className="text-gray-500 text-sm">Total Earned</p>
          <p className="text-xl font-bold text-emerald-600">
            ₦{wallet.totalEarned.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow text-center">
          <p className="text-gray-500 text-sm">Total Withdrawn</p>
          <p className="text-xl font-bold text-blue-600">
            ₦{wallet.totalWithdrawn.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow text-center">
          <p className="text-gray-500 text-sm">Pending</p>
          <p className="text-xl font-bold text-yellow-600">
            ₦{wallet.pendingBalance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* TRANSACTIONS */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="font-semibold mb-4">Transaction History</h3>

        {wallet.transactions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {wallet.transactions.map((tx) => (
              <div
                key={tx._id}
                className="flex justify-between items-center border-b pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium capitalize">
                    {tx.description || tx.type}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(tx.createdAt).toLocaleString("en-NG")}
                  </p>
                  <p className="text-xs text-gray-400">
                    Ref: {tx.reference?.slice(-8) || 'N/A'}
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      ['credit', 'deposit'].includes(tx.type)
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {['credit', 'deposit'].includes(tx.type) ? "+" : "-"}₦
                    {tx.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-xs capitalize ${
                    tx.status === 'success' ? 'text-green-500' :
                    tx.status === 'pending' ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
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