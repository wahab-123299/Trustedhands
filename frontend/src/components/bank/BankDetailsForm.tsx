import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { artisanApi, paymentApi } from "@/services/api";

interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

interface Bank {
  name: string;
  code: string;
}

// Fallback banks in case API fails
const FALLBACK_BANKS: Bank[] = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank", code: "023" },
  { name: "Diamond Bank", code: "063" },
  { name: "Ecobank", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank", code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Heritage Bank", code: "030" },
  { name: "Keystone Bank", code: "082" },
  { name: "Polaris Bank", code: "076" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC", code: "221" },
  { name: "Standard Chartered", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "SunTrust Bank", code: "100" },
  { name: "Union Bank", code: "032" },
  { name: "United Bank for Africa", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

interface BankDetailsFormProps {
  onSuccess?: () => void;
  embedded?: boolean;
}

const BankDetailsForm = ({ onSuccess, embedded = false }: BankDetailsFormProps) => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  
  // Searchable dropdown state
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bankName: "",
    accountNumber: "",
    accountName: "",
    bankCode: "",
  });

  // Fetch available banks on mount
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const res = await paymentApi.getBanks();
        const apiBanks = res.data.data?.banks || [];
        setBanks(apiBanks.length > 0 ? apiBanks : FALLBACK_BANKS);
      } catch {
        console.warn("Using fallback banks list");
        setBanks(FALLBACK_BANKS);
      }
    };
    fetchBanks();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter banks based on search
  const filteredBanks = banks.filter(bank =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bank.code.includes(searchTerm)
  );

  // Handle bank selection
  const handleSelectBank = (bank: Bank) => {
    setBankDetails(prev => ({
      ...prev,
      bankCode: bank.code,
      bankName: bank.name,
      accountName: "",
    }));
    setSearchTerm(bank.name);
    setIsDropdownOpen(false);
    setVerified(false);
  };

  // Handle input change (typing)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsDropdownOpen(true);
    
    // Check if input matches a bank name exactly
    const matchedBank = banks.find(
      bank => bank.name.toLowerCase() === value.toLowerCase()
    );
    
    if (matchedBank) {
      setBankDetails(prev => ({
        ...prev,
        bankCode: matchedBank.code,
        bankName: matchedBank.name,
        accountName: "",
      }));
    } else {
      // Clear bank code if no match
      setBankDetails(prev => ({
        ...prev,
        bankCode: "",
        bankName: value, // Allow custom bank name
        accountName: "",
      }));
    }
    setVerified(false);
  };

  // Verify account when bank and account number are entered
  const verifyAccount = async () => {
    if (!bankDetails.bankCode || bankDetails.accountNumber.length !== 10) return;
    
    try {
      setVerifying(true);
      const res = await paymentApi.verifyAccount({
        accountNumber: bankDetails.accountNumber,
        bankCode: bankDetails.bankCode,
      });
      
      setBankDetails(prev => ({
        ...prev,
        accountName: res.data.data?.accountName || "",
      }));
      setVerified(true);
      toast.success("Account verified successfully!");
    } catch {
      toast.error("Failed to verify account");
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  };

  // Handle account number change
  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setBankDetails(prev => ({ ...prev, accountNumber: value, accountName: "" }));
    setVerified(false);
  };

  // Verify when account number is complete
  useEffect(() => {
    if (bankDetails.accountNumber.length === 10 && bankDetails.bankCode) {
      verifyAccount();
    }
  }, [bankDetails.accountNumber, bankDetails.bankCode]);

  // Submit bank details
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verified) {
      return toast.error("Please verify your account first");
    }

    try {
      setLoading(true);
      await artisanApi.updateBankDetails(bankDetails);
      toast.success("Bank details saved successfully!");
      onSuccess?.();
    } catch {
      toast.error("Failed to save bank details");
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Searchable Bank Selection */}
      <div ref={dropdownRef} className="relative">
        <label className="block text-sm font-medium mb-1">Select Bank</label>
        <input
          type="text"
          placeholder="Type or select bank..."
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsDropdownOpen(true)}
          className="w-full border p-2 rounded-lg bg-white"
          required
        />
        
        {/* Dropdown */}
        {isDropdownOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
            {filteredBanks.length > 0 ? (
              filteredBanks.map((bank, index) => (
                <div
                  key={`${bank.code}-${index}`}
                  onClick={() => handleSelectBank(bank)}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                >
                  <div className="font-medium">{bank.name}</div>
                  <div className="text-xs text-gray-500">Code: {bank.code}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-gray-500 text-sm">
                No banks found. Type to search or add custom.
              </div>
            )}
          </div>
        )}
        
        {/* Selected indicator */}
        {bankDetails.bankCode && (
          <div className="mt-1 text-xs text-green-600">
            ✓ Selected: {bankDetails.bankName} (Code: {bankDetails.bankCode})
          </div>
        )}
      </div>

      {/* Account Number */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Account Number
          {verifying && <span className="text-blue-500 ml-2">Verifying...</span>}
          {verified && <span className="text-green-500 ml-2">✓ Verified</span>}
        </label>
        <input
          type="text"
          placeholder="10 digit account number"
          value={bankDetails.accountNumber}
          onChange={handleAccountNumberChange}
          className="w-full border p-2 rounded-lg"
          required
          maxLength={10}
          pattern="\d{10}"
        />
      </div>

      {/* Account Name (Auto-filled) */}
      <div>
        <label className="block text-sm font-medium mb-1">Account Name</label>
        <input
          type="text"
          value={bankDetails.accountName}
          disabled
          className="w-full border p-2 rounded-lg bg-gray-100"
          placeholder={verifying ? "Verifying..." : "Will auto-fill after verification"}
        />
      </div>

      {/* Hidden Bank Name Field */}
      <input type="hidden" value={bankDetails.bankName} />

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !verified}
        className={`w-full py-2 rounded-lg text-white ${
          loading || !verified
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading ? "Saving..." : "Save Bank Details"}
      </button>
    </form>
  );

  if (embedded) {
    return formContent;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow">
      <h3 className="font-semibold text-lg mb-4">Bank Account Details</h3>
      <p className="text-sm text-gray-500 mb-4">
        Required for withdrawals. Your account will be verified automatically.
      </p>
      {formContent}
    </div>
  );
};

export default BankDetailsForm;