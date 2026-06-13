/**
 * Helper to convert double digits (10-99) to words
 */
const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertLessThanThousand(num: number): string {
  let str = "";
  if (num === 0) return "";
  
  if (num >= 100) {
    str += ones[Math.floor(num / 100)] + " Hundred ";
    num %= 100;
  }
  
  if (num >= 20) {
    str += tens[Math.floor(num / 10)] + " ";
    num %= 10;
  }
  
  if (num > 0) {
    str += ones[num] + " ";
  }
  
  return str.trim();
}

/**
 * Converts a number to words using the Indian numbering system (Lakhs, Crores).
 */
export function numberToWordsIndian(amount: number, currencyCode: string = 'INR'): string {
  // Absolute value, restrict to 2 decimal places
  let num = Math.round(amount * 100) / 100;
  if (isNaN(num) || num <= 0) {
    return "Zero " + (currencyCode === 'INR' ? "Rupees" : "Units") + " Only";
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let temp = integerPart;
  let words = "";

  // Extract parts using Indian naming logic:
  // Crores (1,00,00,000)
  // Lakhs (1,00,000)
  // Thousands (1,000)
  // Hundreds (100)
  // Tens / Units (1)
  
  const crore = Math.floor(temp / 10000000);
  temp %= 10000000;
  
  const lakh = Math.floor(temp / 100000);
  temp %= 100000;
  
  const thousand = Math.floor(temp / 1000);
  temp %= 1000;
  
  const remaining = temp;

  if (crore > 0) {
    words += convertLessThanThousand(crore) + " Crore ";
  }
  if (lakh > 0) {
    words += convertLessThanThousand(lakh) + " Lakh ";
  }
  if (thousand > 0) {
    words += convertLessThanThousand(thousand) + " Thousand ";
  }
  if (remaining > 0) {
    words += convertLessThanThousand(remaining) + " ";
  }

  words = words.trim();

  // Currency label
  let currencyLabel = "";
  let subCurrencyLabel = "";
  
  if (currencyCode === 'INR') {
    currencyLabel = words === "One" ? "Rupee" : "Rupees";
    subCurrencyLabel = "Paise";
  } else if (currencyCode === 'USD') {
    currencyLabel = words === "One" ? "Dollar" : "Dollars";
    subCurrencyLabel = "Cents";
  } else if (currencyCode === 'EUR') {
    currencyLabel = words === "One" ? "Euro" : "Euros";
    subCurrencyLabel = "Cents";
  } else if (currencyCode === 'GBP') {
    currencyLabel = words === "One" ? "Pound" : "Pounds";
    subCurrencyLabel = "Pence";
  } else {
    currencyLabel = "Units";
    subCurrencyLabel = "Cents";
  }

  let finalWords = words ? `${words} ${currencyLabel}` : `Zero ${currencyLabel}`;

  if (decimalPart > 0) {
    const decimalWords = convertLessThanThousand(decimalPart);
    if (decimalWords) {
      finalWords += ` and ${decimalWords} ${subCurrencyLabel}`;
    }
  }

  return finalWords.trim() + " Only";
}

/**
 * Helper to format date into standard picker string YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to add days to a date string YYYY-MM-DD
 */
export function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date for dynamic display, e.g. "12 Jun 2026"
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
