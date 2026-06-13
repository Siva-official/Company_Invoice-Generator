export interface SellerDetails {
  companyName: string;
  address: string;
  state: string; // Used for SGST/CGST vs IGST calculation
  regLabel: string; // Editable (e.g. "GSTIN", "CIN", "UDYAM No.")
  regValue: string;
  email: string;
  phone: string;
  panNumber: string;
  isGstRegistered: boolean;
  gstin: string;
}

export interface ClientDetails {
  name: string;
  address: string;
  gstin: string;
  placeOfSupply: string; // Indian State for CGST/SGST vs IGST
}

export interface InvoiceMeta {
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  paymentTerms: string; // "Due on Receipt", "Net 7", "Net 15", "Net 30", "Custom"
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  gstRate: number; // For per-item tax rate selection if per-item tax is used
}

export type DiscountType = 'percentage' | 'fixed';

export interface DiscountInfo {
  enabled: boolean;
  type: DiscountType;
  value: number; // % or flat amount
}

export interface AdditionalCharge {
  enabled: boolean;
  label: string; // e.g. "Shipping Charges", "Handling Fees"
  amount: number;
}

export interface PaymentDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
  // Field-specific toggles to control final invoice display
  showAccountName: boolean;
  showBankName: boolean;
  showAccountNumber: boolean;
  showIfscCode: boolean;
  showBranch: boolean;
  showUpiId: boolean;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
];

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", 
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", 
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", 
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", 
  "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export const PAYMENT_TERMS_OPTIONS = [
  "Due on Receipt",
  "Net 7",
  "Net 15",
  "Net 30",
  "Custom"
];
