import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Users, 
  FileText, 
  Plus, 
  Trash2, 
  Tag, 
  Landmark, 
  FileSignature, 
  Download, 
  Printer, 
  RotateCcw, 
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Currency,
  Clock,
  Briefcase,
  Eye,
  EyeOff
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  SellerDetails, 
  ClientDetails, 
  InvoiceMeta, 
  LineItem, 
  PaymentDetails, 
  DiscountInfo, 
  AdditionalCharge, 
  CURRENCIES, 
  INDIAN_STATES, 
  PAYMENT_TERMS_OPTIONS 
} from './types';
import { 
  numberToWordsIndian, 
  getTodayDateString, 
  addDaysToDate, 
  formatDateDisplay 
} from './utils';

export default function App() {
  // --- STATE PERSISTENCE LOADERS & DEFAULTS ---
  const defaultSeller: SellerDetails = {
    companyName: 'Genesis Technologies Pvt Ltd',
    address: 'Block A, 4th Floor, Prestige Tech Park\nOuter Ring Road, Marathahalli\nBengaluru, Karnataka - 560103',
    state: 'Karnataka',
    regLabel: 'GSTIN',
    regValue: '29AAAAA1111A1Z1',
    email: 'accounts@genesistech.com',
    phone: '+91 80 4455 6677',
    panNumber: 'ABCDE1234F',
    isGstRegistered: true,
    gstin: '29AAAAA1111A1Z1',
  };

  const defaultPayment: PaymentDetails = {
    accountName: 'Genesis Technologies Pvt Ltd',
    bankName: 'ICICI Bank Limited',
    accountNumber: '000205001234',
    ifscCode: 'ICIC0000002',
    branch: 'Prestige Tech Park Branch',
    upiId: 'genesis@icici',
    showAccountName: true,
    showBankName: true,
    showAccountNumber: true,
    showIfscCode: true,
    showBranch: true,
    showUpiId: true,
  };

  const defaultNotesText = "1. Please pay within the due date mentioned on the invoice.\n2. Standard payments can be processed via Bank Transfer or UPI details provided above.\n3. Goods or services delivered once cannot be refunded or cancelled.\n4. Thank you for choosing Genesis Technologies!";

  // --- PERSISTED STATE ---
  const [seller, setSeller] = useState<SellerDetails>(() => {
    const saved = localStorage.getItem('invoice_sf_seller');
    return saved ? { ...defaultSeller, ...JSON.parse(saved) } : defaultSeller;
  });

  const [payment, setPayment] = useState<PaymentDetails>(() => {
    const saved = localStorage.getItem('invoice_sf_payment');
    return saved ? { ...defaultPayment, ...JSON.parse(saved) } : defaultPayment;
  });

  const [notesTemplate, setNotesTemplate] = useState<string>(() => {
    const saved = localStorage.getItem('invoice_sf_notes_template');
    return saved || defaultNotesText;
  });

  const [fieldConfig, setFieldConfig] = useState(() => {
    const saved = localStorage.getItem('invoice_sf_field_config');
    const defaults = {
      showSellerAddress: true,
      showSellerEmail: true,
      showSellerPhone: true,
      showSellerPan: true,
      showSellerGstin: true,
      showSellerReg: true,
      showClientAddress: true,
      showClientGstin: true,
      showClientPlaceOfSupply: true,
      showInvoiceNumber: true,
      showInvoiceDate: true,
      showDueDate: true,
      showPaymentTerms: true,
      showSignatureBlock: true,
      signatoryTitle: 'Authorized Signatory',
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  useEffect(() => {
    localStorage.setItem('invoice_sf_field_config', JSON.stringify(fieldConfig));
  }, [fieldConfig]);

  const toggleFieldConfig = (key: keyof Omit<typeof fieldConfig, 'signatoryTitle'>) => {
    setFieldConfig(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const [invoiceCounter, setInvoiceCounter] = useState<number>(() => {
    const saved = localStorage.getItem('invoice_sf_counter');
    return saved ? parseInt(saved, 10) : 402;
  });

  // --- TRANSENT PER-INVOICE STATE ---
  const [client, setClient] = useState<ClientDetails>({
    name: 'Cosmic Ventures Bangalore Inc.',
    address: 'Tower B, Ground Floor, Global Tech Oasis\nBannerghatta Road\nBengaluru, Karnataka - 560076',
    gstin: '29BBBBB2222B1Z2',
    placeOfSupply: 'Karnataka',
  });

  const [invoiceMeta, setInvoiceMeta] = useState<InvoiceMeta>({
    invoiceNumber: 'GEN/2026/402',
    invoiceDate: getTodayDateString(),
    dueDate: addDaysToDate(getTodayDateString(), 15),
    paymentTerms: 'Net 15',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: 'Enterprise Cloud Subscription Suite', quantity: 1, rate: 45000, gstRate: 18 },
    { id: '2', description: 'Premium Integration Support & Consulting', quantity: 2, rate: 12500, gstRate: 18 },
    { id: '3', description: 'Single Sign-On Activation Module', quantity: 1, rate: 8000, gstRate: 12 },
  ]);

  const [gstMode, setGstMode] = useState<'global' | 'item'>('item');
  const [globalGstRate, setGlobalGstRate] = useState<number>(18);

  const [discount, setDiscount] = useState<DiscountInfo>({
    enabled: true,
    type: 'percentage',
    value: 5,
  });

  const [charges, setCharges] = useState<AdditionalCharge>({
    enabled: true,
    label: 'Courier & Shipping Charges',
    amount: 350,
  });

  const [activeNotes, setActiveNotes] = useState<string>(notesTemplate);
  const [currency, setCurrency] = useState(() => CURRENCIES[0]);

  // Collapsible section toggles for UI layout focus
  const [openedCard, setOpenedCard] = useState<string>('seller');

  // Sync state changes to local storage
  useEffect(() => {
    localStorage.setItem('invoice_sf_seller', JSON.stringify(seller));
  }, [seller]);

  useEffect(() => {
    localStorage.setItem('invoice_sf_payment', JSON.stringify(payment));
  }, [payment]);

  useEffect(() => {
    localStorage.setItem('invoice_sf_notes_template', notesTemplate);
  }, [notesTemplate]);

  useEffect(() => {
    localStorage.setItem('invoice_sf_counter', invoiceCounter.toString());
  }, [invoiceCounter]);

  // Watch Invoice Date & Payment Terms to update Due Date automatically
  useEffect(() => {
    let daysToAdd = 0;
    if (invoiceMeta.paymentTerms === 'Due on Receipt') daysToAdd = 0;
    else if (invoiceMeta.paymentTerms === 'Net 7') daysToAdd = 7;
    else if (invoiceMeta.paymentTerms === 'Net 15') daysToAdd = 15;
    else if (invoiceMeta.paymentTerms === 'Net 30') daysToAdd = 30;
    else return; // If custom, let user edit due date freely

    const calculatedDueDate = addDaysToDate(invoiceMeta.invoiceDate, daysToAdd);
    setInvoiceMeta(prev => ({ ...prev, dueDate: calculatedDueDate }));
  }, [invoiceMeta.invoiceDate, invoiceMeta.paymentTerms]);

  // Manage Invoice Number auto-update when counter changes
  const updateInvoiceNumberFromCounter = (counterVal: number) => {
    setInvoiceMeta(prev => ({
      ...prev,
      invoiceNumber: `GEN/2026/${counterVal}`
    }));
  };

  // Sync counter change triggers
  const handleIncrementCounter = () => {
    const nextCount = invoiceCounter + 1;
    setInvoiceCounter(nextCount);
    updateInvoiceNumberFromCounter(nextCount);
  };

  // Update dynamic items global rate when global rate setting changes
  useEffect(() => {
    if (gstMode === 'global') {
      setLineItems(prev => prev.map(item => ({ ...item, gstRate: globalGstRate })));
    }
  }, [gstMode, globalGstRate]);

  // --- MASTER CALCULATION ENGINE ---
  const calculations = useMemo(() => {
    // 1. Raw Subtotal
    const subtotal = lineItems.reduce((sum, item) => {
      const q = item.quantity || 0;
      const r = item.rate || 0;
      return sum + (q * r);
    }, 0);

    // 2. Discount amount calculation (before tax)
    let discountAmount = 0;
    if (discount.enabled) {
      if (discount.type === 'percentage') {
        discountAmount = subtotal * ((discount.value || 0) / 100);
      } else {
        discountAmount = discount.value || 0;
      }
    }
    // Cap discount to prevent negative totals
    const finalDiscountAmount = Math.max(0, Math.min(subtotal, discountAmount));
    const taxableSubtotal = subtotal - finalDiscountAmount;

    // 3. Tax / GST Calculations
    let totalTax = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const isGstEnabled = seller.isGstRegistered;
    const isSameState = seller.state === client.placeOfSupply;

    const computedItems = lineItems.map(item => {
      const q = item.quantity || 0;
      const r = item.rate || 0;
      const rawItemAmount = q * r;

      // Proportional discount distribution for individual line tax logic (crucial for per-item tax split)
      const ratio = subtotal > 0 ? rawItemAmount / subtotal : 0;
      const itemDiscountAllocated = finalDiscountAmount * ratio;
      const itemTaxableAmount = Math.max(0, rawItemAmount - itemDiscountAllocated);

      let itemTaxRate = 0;
      if (isGstEnabled) {
        itemTaxRate = gstMode === 'global' ? globalGstRate : (item.gstRate || 0);
      }

      const itemTaxAmount = itemTaxableAmount * (itemTaxRate / 100);
      let itemCgst = 0;
      let itemSgst = 0;
      let itemIgst = 0;

      if (isGstEnabled) {
        if (isSameState) {
          itemCgst = itemTaxAmount / 2;
          itemSgst = itemTaxAmount / 2;
        } else {
          itemIgst = itemTaxAmount;
        }
      }

      return {
        ...item,
        amount: rawItemAmount,
        taxableAmount: itemTaxableAmount,
        taxRate: itemTaxRate,
        tax: itemTaxAmount,
        cgst: itemCgst,
        sgst: itemSgst,
        igst: itemIgst,
      };
    });

    if (isGstEnabled) {
      computedItems.forEach(item => {
        totalTax += item.tax;
        cgst += item.cgst;
        sgst += item.sgst;
        igst += item.igst;
      });
    }

    // 4. Additional Charges
    const chargeAmount = charges.enabled ? (charges.amount || 0) : 0;

    // 5. Final Grand Total
    const grandTotal = taxableSubtotal + totalTax + chargeAmount;

    return {
      subtotal,
      discountAmount: finalDiscountAmount,
      taxableSubtotal,
      totalTax,
      cgst,
      sgst,
      igst,
      chargeAmount,
      grandTotal,
      computedItems,
      isSameState,
      isGstEnabled
    };
  }, [lineItems, discount, charges, seller, client, gstMode, globalGstRate]);

  const hasClientDetailsVisible = useMemo(() => {
    return !!(
      client.name?.trim() || 
      (fieldConfig.showClientAddress && client.address?.trim()) || 
      (calculations.isGstEnabled && (
        (fieldConfig.showClientGstin && client.gstin?.trim()) || 
        (fieldConfig.showClientPlaceOfSupply && client.placeOfSupply?.trim())
      ))
    );
  }, [client, fieldConfig, calculations.isGstEnabled]);

  // --- FORM ACTIONS ---
  const handleAddLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      gstRate: gstMode === 'global' ? globalGstRate : 18
    };
    setLineItems(prev => [...prev, newItem]);
  };

  const handleUpdateLineItem = (id: string, field: keyof LineItem, val: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: val };
        // If GST mode is global, always enforce global rate
        if (field === 'gstRate' && gstMode === 'global') {
          updated.gstRate = globalGstRate;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      // Keep at least one empty line item rather than completely blanking
      setLineItems([{ id: Date.now().toString(), description: '', quantity: 1, rate: 0, gstRate: 18 }]);
      return;
    }
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const handleResetInvoiceData = () => {
    // Reset client details, keeps seller & bank
    setClient({
      name: '',
      address: '',
      gstin: '',
      placeOfSupply: seller.state || 'Karnataka',
    });
    // Set dynamic metadata
    setInvoiceMeta({
      invoiceNumber: `GEN/2026/${invoiceCounter}`,
      invoiceDate: getTodayDateString(),
      dueDate: addDaysToDate(getTodayDateString(), 15),
      paymentTerms: 'Net 15',
    });
    // Reset lines
    setLineItems([
      { id: Date.now().toString(), description: '', quantity: 1, rate: 0, gstRate: 18 }
    ]);
    setDiscount({
      enabled: false,
      type: 'percentage',
      value: 0
    });
    setCharges({
      enabled: false,
      label: 'Other Charges',
      amount: 0
    });
    setActiveNotes(notesTemplate);
  };

  // Toggle active card
  const toggleCard = (cardId: string) => {
    setOpenedCard(prev => prev === cardId ? '' : cardId);
  };

  // --- PDF GENERATOR IN JS-PDF ---
  const handleDownloadPDF = () => {
    try {
      // pt size limits: A4 is 595.28 x 841.89 points
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      // Colors
      const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo-600
      const darkText: [number, number, number] = [15, 23, 42]; // Slate-900
      const grayText: [number, number, number] = [71, 85, 105]; // Slate-600
      const borderLine: [number, number, number] = [226, 232, 240]; // Slate-200

      let y = 50;

      // 1. HEADER BRANDING & METADATA
      // Seller Brand (Left)
      if (seller.companyName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(darkText[0], darkText[1], darkText[2]);
        doc.text(seller.companyName, 40, y);
      }
      
      // Invoice Heading (Right)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("INVOICE", 555, y, { align: 'right' });

      y += 18;

      // Seller Details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      
      let sellerY = y;
      if (fieldConfig.showSellerAddress && seller.address) {
        const sellerLines = seller.address.split('\n');
        sellerLines.forEach(line => {
          if (line.trim()) {
            doc.text(line, 40, sellerY);
            sellerY += 12;
          }
        });
      }

      if (fieldConfig.showSellerEmail && seller.email) {
        doc.text(`Email: ${seller.email}`, 40, sellerY);
        sellerY += 12;
      }
      if (fieldConfig.showSellerPhone && seller.phone) {
        doc.text(`Phone: ${seller.phone}`, 40, sellerY);
        sellerY += 12;
      }
      if (fieldConfig.showSellerPan && seller.panNumber) {
        doc.text(`PAN: ${seller.panNumber.toUpperCase()}`, 40, sellerY);
        sellerY += 12;
      }
      if (seller.isGstRegistered) {
        if (fieldConfig.showSellerGstin && seller.gstin) {
          doc.text(`GSTIN: ${seller.gstin.toUpperCase()}`, 40, sellerY);
          sellerY += 12;
        }
      } else {
        if (fieldConfig.showSellerReg && seller.regValue) {
          doc.text(`${seller.regLabel || 'Reg No'}: ${seller.regValue}`, 40, sellerY);
          sellerY += 12;
        }
      }

      // Invoice Details (Right Grid align)
      let metaY = y;
      doc.setFontSize(8.5);
      
      const drawPdfMeta = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkText[0], darkText[1], darkText[2]);
        doc.text(label, 440, metaY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(grayText[0], grayText[1], grayText[2]);
        doc.text(value, 555, metaY, { align: 'right' });
        metaY += 13;
      };

      if (fieldConfig.showInvoiceNumber && invoiceMeta.invoiceNumber) {
        drawPdfMeta("Invoice No:", invoiceMeta.invoiceNumber);
      }
      if (fieldConfig.showInvoiceDate && invoiceMeta.invoiceDate) {
        drawPdfMeta("Date:", formatDateDisplay(invoiceMeta.invoiceDate));
      }
      if (fieldConfig.showDueDate && invoiceMeta.dueDate) {
        drawPdfMeta("Due Date:", formatDateDisplay(invoiceMeta.dueDate));
      }
      if (fieldConfig.showPaymentTerms && invoiceMeta.paymentTerms) {
        drawPdfMeta("Terms:", invoiceMeta.paymentTerms);
      }

      // Pivot Y
      y = Math.max(sellerY, metaY) + 15;

      // Horizontal Divider
      doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
      doc.setLineWidth(1);
      doc.line(40, y, 555, y);
      y += 15;

      // 2. CLIENT "BILL TO" SECTION
      const hasClientDetailsVisible = client.name || (fieldConfig.showClientAddress && client.address) || (calculations.isGstEnabled && (fieldConfig.showClientGstin && client.gstin || fieldConfig.showClientPlaceOfSupply && client.placeOfSupply));
      
      if (hasClientDetailsVisible) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text("BILL TO (CLIENT)", 40, y);
        y += 12;

        if (client.name) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(darkText[0], darkText[1], darkText[2]);
          doc.text(client.name, 40, y);
          y += 13;
        }

        if (fieldConfig.showClientAddress && client.address) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(grayText[0], grayText[1], grayText[2]);
          const clientLines = client.address.split('\n');
          clientLines.forEach(line => {
            if (line.trim()) {
              doc.text(line, 40, y);
              y += 12;
            }
          });
        }

        if (calculations.isGstEnabled) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(grayText[0], grayText[1], grayText[2]);
          if (fieldConfig.showClientGstin && client.gstin) {
            doc.text(`GSTIN: ${client.gstin.toUpperCase()}`, 40, y);
            y += 12;
          }
          if (fieldConfig.showClientPlaceOfSupply && client.placeOfSupply) {
            doc.text(`Place of Supply: ${client.placeOfSupply}`, 40, y);
            y += 12;
          }
        }
        y += 15;
      }

      // 3. TABLE OF LINE ITEMS
      const tableHeaders = ['#', 'Item & Description', 'Qty', 'Unit Rate', 'Amount'];
      if (calculations.isGstEnabled) {
        tableHeaders.splice(4, 0, 'GST %');
      }

      const tableRows = calculations.computedItems.map((item, index) => {
        const row = [
          String(index + 1),
          item.description || 'Service/Item',
          String(item.quantity || 1),
          `${currency.symbol}${(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ];
        if (calculations.isGstEnabled) {
          row.push(`${item.taxRate}%`);
        }
        row.push(`${currency.symbol}${(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        return row;
      });

      // Format custom column configurations based on column indices
      const columnStyles: any = {};
      
      if (calculations.isGstEnabled) {
        columnStyles[0] = { halign: 'center', cellWidth: 25 };
        columnStyles[1] = { halign: 'left' };
        columnStyles[2] = { halign: 'center', cellWidth: 35 };
        columnStyles[3] = { halign: 'right', cellWidth: 70 };
        columnStyles[4] = { halign: 'center', cellWidth: 45 };
        columnStyles[5] = { halign: 'right', cellWidth: 85 };
      } else {
        columnStyles[0] = { halign: 'center', cellWidth: 25 };
        columnStyles[1] = { halign: 'left' };
        columnStyles[2] = { halign: 'center', cellWidth: 45 };
        columnStyles[3] = { halign: 'right', cellWidth: 90 };
        columnStyles[4] = { halign: 'right', cellWidth: 105 };
      }

      // Render Table using autotable
      // Note: we can use import as jsPDF does, or standard invocation
      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: y,
        theme: 'striped',
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          cellPadding: 6,
        },
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        columnStyles,
        alternateRowStyles: {
          fillColor: [250, 251, 252]
        },
        margin: { left: 40, right: 40 }
      });

      // Get Y post-table
      let finalY = (doc as any).lastAutoTable.finalY + 15;

      // 4. SUMMARY BOX & BANK DETAILS
      // If height remaining is poor, move to new page
      if (finalY > 600) {
        doc.addPage();
        finalY = 50;
      }

      let leftBoxY = finalY;
      let rightBoxY = finalY;

      // Total details
      const scoreX = 555;
      const labelX = 440;

      const drawTotalLine = (label: string, symbol: string, value: number, isSub: boolean) => {
        doc.setFont('helvetica', isSub ? 'normal' : 'bold');
        doc.setFontSize(isSub ? 8.5 : 10);
        doc.setTextColor(isSub ? grayText[0] : darkText[0], isSub ? grayText[1] : darkText[1], isSub ? grayText[2] : darkText[2]);
        doc.text(label, labelX, rightBoxY, { align: 'right' });
        doc.text(`${symbol}${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, scoreX, rightBoxY, { align: 'right' });
        rightBoxY += 13;
      };

      // Raw Subtotal
      drawTotalLine("Subtotal:", currency.symbol, calculations.subtotal, true);

      // Discount
      if (discount.enabled && calculations.discountAmount > 0) {
        drawTotalLine(
          `Discount (${discount.type === 'percentage' ? `${discount.value}%` : 'Fixed'}):`, 
          `- ${currency.symbol}`, 
          calculations.discountAmount, 
          true
        );
      }

      // GST Rates Split
      if (calculations.isGstEnabled) {
        if (calculations.isSameState) {
          if (calculations.cgst > 0) {
            drawTotalLine("CGST:", currency.symbol, calculations.cgst, true);
          }
          if (calculations.sgst > 0) {
            drawTotalLine("SGST:", currency.symbol, calculations.sgst, true);
          }
        } else {
          if (calculations.igst > 0) {
            drawTotalLine("IGST:", currency.symbol, calculations.igst, true);
          }
        }
        if (calculations.totalTax > 0) {
          drawTotalLine("Total Tax:", currency.symbol, calculations.totalTax, true);
        }
      }

      // Additional charges
      if (charges.enabled && calculations.chargeAmount > 0) {
        drawTotalLine(`${charges.label || 'Additional Charges'}:`, currency.symbol, calculations.chargeAmount, true);
      }

      // Visual line
      rightBoxY += 3;
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(1);
      doc.line(labelX - 45, rightBoxY, scoreX, rightBoxY);
      rightBoxY += 12;

      // Grand Total Highlight
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Grand Total:", labelX, rightBoxY, { align: 'right' });
      doc.text(`${currency.symbol}${calculations.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, scoreX, rightBoxY, { align: 'right' });

      // BANKING block (Left column)
      let hasBank = false;
      if (payment.showAccountName && payment.accountName) hasBank = true;
      if (payment.showBankName && payment.bankName) hasBank = true;
      if (payment.showAccountNumber && payment.accountNumber) hasBank = true;
      if (payment.showIfscCode && payment.ifscCode) hasBank = true;
      if (payment.showBranch && payment.branch) hasBank = true;
      if (payment.showUpiId && payment.upiId) hasBank = true;

      if (hasBank) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text("BANK & PAYMENT DETAILS", 40, leftBoxY);
        leftBoxY += 11;

        const drawBankRowPdf = (lbl: string, val: string) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(darkText[0], darkText[1], darkText[2]);
          doc.text(`${lbl}:`, 40, leftBoxY);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(grayText[0], grayText[1], grayText[2]);
          doc.text(val, 120, leftBoxY);
          leftBoxY += 11;
        };

        if (payment.showAccountName && payment.accountName) drawBankRowPdf("Account Name", payment.accountName);
        if (payment.showBankName && payment.bankName) drawBankRowPdf("Bank Name", payment.bankName);
        if (payment.showAccountNumber && payment.accountNumber) drawBankRowPdf("Account Number", payment.accountNumber);
        if (payment.showIfscCode && payment.ifscCode) drawBankRowPdf("IFSC Code", payment.ifscCode);
        if (payment.showBranch && payment.branch) drawBankRowPdf("Branch", payment.branch);
        if (payment.showUpiId && payment.upiId) drawBankRowPdf("UPI ID", payment.upiId);
      }

      leftBoxY += 5;

      // Total in words
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text("GRAND TOTAL IN WORDS", 40, leftBoxY);
      leftBoxY += 10;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(darkText[0], darkText[1], darkText[2]);
      const wordString = numberToWordsIndian(calculations.grandTotal, currency.code);
      const wrappedWords = doc.splitTextToSize(wordString, 250);
      wrappedWords.forEach((wordLine: string) => {
        doc.text(wordLine, 40, leftBoxY);
        leftBoxY += 10;
      });

      // Horizontal divide
      const bottomY = Math.max(leftBoxY, rightBoxY) + 15;
      let notesY = bottomY;
      if (notesY > 740) {
        doc.addPage();
        notesY = 50;
      }

      doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
      doc.setLineWidth(1);
      doc.line(40, notesY, 555, notesY);
      notesY += 15;

      // Terms & Notes
      if (activeNotes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("TERMS & CONDITIONS", 40, notesY);
        notesY += 11;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // Slate-400
        const notesLines = activeNotes.split('\n');
        notesLines.forEach(line => {
          const splitLines = doc.splitTextToSize(line, 515);
          splitLines.forEach((splitLine: string) => {
            doc.text(splitLine, 40, notesY);
            notesY += 9.5;
          });
        });
      }

      // Signature Block
      if (fieldConfig.showSignatureBlock) {
        let sigY = notesY + 20;
        if (sigY > 780) {
          doc.addPage();
          sigY = 50;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(grayText[0], grayText[1], grayText[2]);
        if (seller.companyName) {
          doc.text(`For ${seller.companyName}`, 555, sigY, { align: 'right' });
        }
        doc.text(fieldConfig.signatoryTitle || "Authorized Signatory", 555, sigY + 35, { align: 'right' });
      }

      // Save PDF File
      const invoiceNumSafe = invoiceMeta?.invoiceNumber || 'INV-TEMP';
      const fileName = `${invoiceNumSafe.replace(/[\/\\?%*:|"<>\s]/g, '_')}_invoice.pdf`;
      doc.save(fileName);
    } catch (e) {
      console.error(e);
      alert("Error generating PDF invoice. Check input fields.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const hasBank = useMemo(() => {
    return (
      (payment.showAccountName && !!payment.accountName) ||
      (payment.showBankName && !!payment.bankName) ||
      (payment.showAccountNumber && !!payment.accountNumber) ||
      (payment.showIfscCode && !!payment.ifscCode) ||
      (payment.showBranch && !!payment.branch) ||
      (payment.showUpiId && !!payment.upiId)
    );
  }, [payment]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans print:bg-white print:text-black print:min-h-0 print:p-0">
      
      {/* --- TOP BRAND NAVIGATION BAR --- */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs px-4 sm:px-6 py-4 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white rounded-xl p-2.5 flex items-center justify-center shadow-md shadow-indigo-200">
              <Building2 className="h-6 w-6" id="brand-logo-icon" />
            </div>
            <div>
              <h1 className="text-xl font-display font-medium tracking-tight text-slate-900 leading-none">
                Invoice Generator
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                v2.1 · Indian & Global Multi-Tax Engine
              </p>
            </div>
          </div>
          
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Currency Selector */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              {CURRENCIES.map(curr => (
                <button
                  key={curr.code}
                  onClick={() => setCurrency(curr)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    currency.code === curr.code
                      ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  id={`currency-select-${curr.code}`}
                >
                  {curr.symbol} {curr.code}
                </button>
              ))}
            </div>

            {/* Reset Client Trigger */}
            <button
              onClick={handleResetInvoiceData}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              title="Reset client particulars, line items, discounts & charges"
              id="reset-invoice-trigger"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Invoice State
            </button>

            {/* Generation Actions */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              id="print-invoice-trigger"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>

            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-indigo-100"
              id="pdf-download-trigger"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </button>
          </div>
        </div>
      </header>

      {/* --- CORE TWO COLUMN CONTENT STAGE --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:py-0 print:px-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:grid-cols-1 print:gap-0">
          
          {/* ========================================================= */}
          {/* LEFT PANEL: CONFIG & EDIT FORM (COLLAPSED ON PRINT)       */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-4 print:hidden" id="editor-column">
            
            {/* CARD 1: SELLER DETAILS */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <button 
                onClick={() => toggleCard('seller')}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/70 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                id="toggle-seller-card"
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-slate-600 bg-slate-200/60 p-1.5 rounded-lg">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Company Details (Seller)</h2>
                    <p className="text-[11px] text-slate-500">Persisted across sessions via localStorage</p>
                  </div>
                </div>
                {openedCard === 'seller' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {openedCard === 'seller' && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Company / Seller Name</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold"
                      value={seller.companyName}
                      onChange={e => setSeller(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="e.g. Acme Corporation"
                      id="seller-company-name-input"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-600">Address (Multi-line)</label>
                      <button
                        type="button"
                        onClick={() => toggleFieldConfig('showSellerAddress')}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                          fieldConfig.showSellerAddress ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                        }`}
                      >
                        {fieldConfig.showSellerAddress ? (
                          <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                        ) : (
                          <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                        )}
                      </button>
                    </div>
                    <textarea 
                      rows={3}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono text-xs"
                      value={seller.address}
                      onChange={e => setSeller(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Address Line 1&#10;Address Line 2&#10;Pin Code / Zip"
                      id="seller-address-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Seller State</label>
                      <select
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        value={seller.state}
                        onChange={e => setSeller(prev => ({ ...prev, state: e.target.value }))}
                        id="seller-state-select"
                      >
                        {INDIAN_STATES.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-600">PAN Number</label>
                        <button
                          type="button"
                          onClick={() => toggleFieldConfig('showSellerPan')}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                            fieldConfig.showSellerPan ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          {fieldConfig.showSellerPan ? (
                            <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                          )}
                        </button>
                      </div>
                      <input 
                        type="text"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono uppercase"
                        value={seller.panNumber}
                        onChange={e => setSeller(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                        placeholder="e.g. ABCDE1234F"
                        maxLength={10}
                        id="seller-pan-input"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-600">Business Email</label>
                        <button
                          type="button"
                          onClick={() => toggleFieldConfig('showSellerEmail')}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                            fieldConfig.showSellerEmail ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          {fieldConfig.showSellerEmail ? (
                            <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                          )}
                        </button>
                      </div>
                      <input 
                        type="email"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                        value={seller.email}
                        onChange={e => setSeller(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="billing@company.com"
                        id="seller-email-input"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-600">Phone Number</label>
                        <button
                          type="button"
                          onClick={() => toggleFieldConfig('showSellerPhone')}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                            fieldConfig.showSellerPhone ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          {fieldConfig.showSellerPhone ? (
                            <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                          )}
                        </button>
                      </div>
                      <input 
                        type="text"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                        value={seller.phone}
                        onChange={e => setSeller(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+91 99999 88888"
                        id="seller-phone-input"
                      />
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Toggle Mode: Reg Labels */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Are you GST Registered?</label>
                      <p className="text-[10px] text-slate-400">Enables GST, state code filters & splits</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
                      <button 
                        type="button"
                        onClick={() => setSeller(prev => ({ ...prev, isGstRegistered: true }))}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          seller.isGstRegistered 
                            ? 'bg-white text-indigo-600 shadow-xs font-semibold' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        id="toggle-gst-registered-yes"
                      >
                        Yes
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSeller(prev => ({ ...prev, isGstRegistered: false }))}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          !seller.isGstRegistered 
                            ? 'bg-white text-indigo-600 shadow-xs font-semibold' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        id="toggle-gst-registered-no"
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {seller.isGstRegistered ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-indigo-600">GSTIN Number</label>
                        <button
                          type="button"
                          onClick={() => toggleFieldConfig('showSellerGstin')}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                            fieldConfig.showSellerGstin ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          {fieldConfig.showSellerGstin ? (
                            <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                          )}
                        </button>
                      </div>
                      <input 
                        type="text"
                        className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg text-sm bg-indigo-50/20 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono uppercase font-semibold"
                        value={seller.gstin}
                        onChange={e => setSeller(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                        placeholder="e.g. 29AAAAA0000A1Z1"
                        maxLength={15}
                        id="seller-gstin-input"
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2 items-center">
                          <Briefcase className="h-4 w-4 text-slate-500 shrink-0" />
                          <span className="text-xs font-semibold text-slate-600">Custom Identifiers (UDYAM, CIN etc.)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFieldConfig('showSellerReg')}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                            fieldConfig.showSellerReg ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          {fieldConfig.showSellerReg ? (
                            <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                          )}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5 font-semibold">Label (e.g. CIN)</label>
                          <input 
                            type="text"
                            value={seller.regLabel}
                            onChange={e => setSeller(prev => ({ ...prev, regLabel: e.target.value }))}
                            placeholder="e.g. CIN"
                            className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs font-mono"
                            id="seller-reg-label-input"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5 font-semibold">Value</label>
                          <input 
                            type="text"
                            value={seller.regValue}
                            onChange={e => setSeller(prev => ({ ...prev, regValue: e.target.value }))}
                            placeholder="e.g. U12345KA2..."
                            className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs font-mono uppercase"
                            id="seller-reg-value-input"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CARD 2: CLIENT DETAILS */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <button 
                onClick={() => toggleCard('client')}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/70 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                id="toggle-client-card"
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-slate-600 bg-slate-200/60 p-1.5 rounded-lg">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Client Details (Bill To)</h2>
                    <p className="text-[11px] text-slate-500">Not saved, starts clean each time</p>
                  </div>
                </div>
                {openedCard === 'client' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {openedCard === 'client' && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Client Company / Person Name</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      value={client.name}
                      onChange={e => setClient(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Cosmic Ventures Bangalore Inc."
                      id="client-name-input"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-600">Client Address (Multi-line)</label>
                      <button
                        type="button"
                        onClick={() => toggleFieldConfig('showClientAddress')}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                          fieldConfig.showClientAddress ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                        }`}
                      >
                        {fieldConfig.showClientAddress ? (
                          <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                        ) : (
                          <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                        )}
                      </button>
                    </div>
                    <textarea 
                      rows={3}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono text-xs"
                      value={client.address}
                      onChange={e => setClient(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Street, Building Name, Room&#10;City, State, Zip Code"
                      id="client-address-input"
                    />
                  </div>

                  {seller.isGstRegistered && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-600">Place of Supply</label>
                          <button
                            type="button"
                            onClick={() => toggleFieldConfig('showClientPlaceOfSupply')}
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                              fieldConfig.showClientPlaceOfSupply ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                            }`}
                          >
                            {fieldConfig.showClientPlaceOfSupply ? (
                              <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                            ) : (
                              <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                            )}
                          </button>
                        </div>
                        <select
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          value={client.placeOfSupply}
                          onChange={e => setClient(prev => ({ ...prev, placeOfSupply: e.target.value }))}
                          id="client-place-of-supply-select"
                        >
                          {INDIAN_STATES.map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                        <p className="text-[9px] text-slate-450 mt-1">
                          Determines IGST vs CGST+SGST
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-600">Client GSTIN</label>
                          <button
                            type="button"
                            onClick={() => toggleFieldConfig('showClientGstin')}
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                              fieldConfig.showClientGstin ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                            }`}
                          >
                            {fieldConfig.showClientGstin ? (
                              <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                            ) : (
                              <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                            )}
                          </button>
                        </div>
                        <input 
                          type="text"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono uppercase"
                          value={client.gstin}
                          onChange={e => setClient(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                          placeholder="e.g. 29BBBBB0000B1Z2"
                          maxLength={15}
                          id="client-gstin-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CARD 3: INVOICE META */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <button 
                onClick={() => toggleCard('meta')}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/70 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                id="toggle-meta-card"
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-slate-600 bg-slate-200/60 p-1.5 rounded-lg">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Invoice Information</h2>
                    <p className="text-[11px] text-slate-500">Numbers, dates & conditions</p>
                  </div>
                </div>
                {openedCard === 'meta' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {openedCard === 'meta' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-end gap-2.5">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-600">Invoice Number</label>
                        <button
                          type="button"
                          onClick={() => toggleFieldConfig('showInvoiceNumber')}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                            fieldConfig.showInvoiceNumber ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          {fieldConfig.showInvoiceNumber ? (
                            <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                          )}
                        </button>
                      </div>
                      <input 
                        type="text"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                        value={invoiceMeta.invoiceNumber}
                        onChange={e => setInvoiceMeta(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                        placeholder="GEN/2026/101"
                        id="invoice-number-input"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleIncrementCounter}
                      title="Increment serial counter and update Invoice #"
                      className="px-3 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 leading-none"
                      id="increment-serial-trigger"
                    >
                      <span>Counter:</span>
                      <strong className="font-mono text-xs">{invoiceCounter}</strong>
                      <span className="text-indigo-500 ml-0.5 font-bold">+</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-600">Invoice Date</label>
                        <button
                          type="button"
                          onClick={() => toggleFieldConfig('showInvoiceDate')}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                            fieldConfig.showInvoiceDate ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          {fieldConfig.showInvoiceDate ? (
                            <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                          )}
                        </button>
                      </div>
                      <input 
                        type="date"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                        value={invoiceMeta.invoiceDate}
                        onChange={e => setInvoiceMeta(prev => ({ ...prev, invoiceDate: e.target.value }))}
                        id="invoice-date-input"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-600">Payment Terms</label>
                        <button
                          type="button"
                          onClick={() => toggleFieldConfig('showPaymentTerms')}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                            fieldConfig.showPaymentTerms ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          {fieldConfig.showPaymentTerms ? (
                            <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                          )}
                        </button>
                      </div>
                      <select
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        value={invoiceMeta.paymentTerms}
                        onChange={e => setInvoiceMeta(prev => ({ ...prev, paymentTerms: e.target.value }))}
                        id="payment-terms-select"
                      >
                        {PAYMENT_TERMS_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-600">Due Date</label>
                      <button
                        type="button"
                        onClick={() => toggleFieldConfig('showDueDate')}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                          fieldConfig.showDueDate ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                        }`}
                      >
                        {fieldConfig.showDueDate ? (
                          <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                        ) : (
                          <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                        )}
                      </button>
                    </div>
                    <input 
                      type="date"
                      disabled={invoiceMeta.paymentTerms !== 'Custom'}
                      className={`w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono ${
                        invoiceMeta.paymentTerms !== 'Custom' 
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed' 
                          : 'bg-slate-50'
                      }`}
                      value={invoiceMeta.dueDate}
                      onChange={e => setInvoiceMeta(prev => ({ ...prev, dueDate: e.target.value }))}
                      id="due-date-input"
                    />
                    {invoiceMeta.paymentTerms !== 'Custom' && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due date calculation locked to payment terms config. Set to "Custom" to override manually.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 4: LINE ITEMS */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-50/70 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="text-slate-600 bg-slate-200/60 p-1.5 rounded-lg border border-slate-100">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Line Items ({lineItems.length})</h2>
                    <p className="text-[11px] text-slate-500">Goods, consultancies, licensing fees</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors"
                  id="add-line-item-trigger"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Row
                </button>
              </div>

              {/* Dynamic Line List */}
              <div className="p-4 space-y-4">
                {lineItems.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-3 relative group"
                    id={`line-item-row-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-400">ITEM #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(item.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors"
                        title="Delete this row"
                        id={`delete-line-item-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Item Details & Description</label>
                      <input 
                        type="text"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                        value={item.description}
                        onChange={e => handleUpdateLineItem(item.id, 'description', e.target.value)}
                        placeholder="e.g. Enterprise Cloud Licensing (Yearly)"
                        id={`itme-description-${index}`}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Qty</label>
                        <input 
                          type="number"
                          min="1"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-mono text-center"
                          value={item.quantity || ''}
                          onChange={e => handleUpdateLineItem(item.id, 'quantity', parseInt(e.target.value, 10) || 0)}
                          id={`item-qty-${index}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Rate ({currency.symbol})</label>
                        <input 
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-mono text-right"
                          value={item.rate || ''}
                          onChange={e => handleUpdateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          id={`item-rate-${index}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Total ({currency.symbol})</label>
                        <div className="w-full px-2.5 py-1.5 bg-slate-100/75 border border-slate-200 rounded-lg text-sm font-mono text-right text-slate-600 select-none">
                          {((item.quantity || 0) * (item.rate || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Tax Selector for Item if GST enabled */}
                    {seller.isGstRegistered && (
                      <div className="pt-2 border-t border-slate-200">
                        {gstMode === 'item' ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-slate-500">GST Rate (%)</span>
                            <select
                              className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-md font-mono"
                              value={item.gstRate}
                              onChange={e => handleUpdateLineItem(item.id, 'gstRate', parseInt(e.target.value, 10))}
                              id={`item-gst-select-${index}`}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-indigo-500" />
                            Global rule applies: GST fixed at {globalGstRate}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* GST configuration selection bar when registered */}
              {seller.isGstRegistered && (
                <div className="mx-4 mb-4 p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-indigo-900">Tax Application Style</span>
                      <p className="text-[10px] text-slate-500">Set tax per line or apply a global rate</p>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-200/60 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setGstMode('item')}
                        className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${
                          gstMode === 'item'
                            ? 'bg-white text-indigo-600 shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        id="gst-mode-item-trigger"
                      >
                        Per Item
                      </button>
                      <button
                        type="button"
                        onClick={() => setGstMode('global')}
                        className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${
                          gstMode === 'global'
                            ? 'bg-white text-indigo-600 shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        id="gst-mode-global-trigger"
                      >
                        Global
                      </button>
                    </div>
                  </div>

                  {gstMode === 'global' && (
                    <div className="flex items-center justify-between gap-4 pt-2 border-t border-indigo-100">
                      <span className="text-xs font-medium text-indigo-800">Global GST Rate (%)</span>
                      <select
                        className="px-3 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-semibold"
                        value={globalGstRate}
                        onChange={e => setGlobalGstRate(parseInt(e.target.value, 10))}
                        id="global-gst-rate-select"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18% (Standard Services)</option>
                        <option value="28">28%</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CARD 5: DISCOUNT & DISADVANTAGES */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <button 
                onClick={() => toggleCard('adjustments')}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/70 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                id="toggle-adjustments-card"
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-slate-600 bg-slate-200/60 p-1.5 rounded-lg">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Discount & Charges (Optional)</h2>
                    <p className="text-[11px] text-slate-500">Apply deductions or delivery metrics</p>
                  </div>
                </div>
                {openedCard === 'adjustments' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {openedCard === 'adjustments' && (
                <div className="p-5 space-y-4">
                  {/* Discount Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="discount-enable-checkbox"
                          checked={discount.enabled}
                          onChange={e => setDiscount(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-200 rounded"
                        />
                        <label htmlFor="discount-enable-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                          Apply Discount (Before Tax calculation)
                        </label>
                      </div>
                    </div>

                    {discount.enabled && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Discount Type</label>
                          <select
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                            value={discount.type}
                            onChange={e => setDiscount(prev => ({ ...prev, type: e.target.value as any }))}
                            id="discount-type-select"
                          >
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed Amount ({currency.symbol})</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Value ({discount.type === 'percentage' ? '%' : currency.symbol})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                            value={discount.value || ''}
                            onChange={e => setDiscount(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                            placeholder="0"
                            id="discount-value-input"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <hr className="border-slate-100" />

                  {/* Delivery / Shipping Charges */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="shipping-enable-checkbox"
                          checked={charges.enabled}
                          onChange={e => setCharges(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-200 rounded"
                        />
                        <label htmlFor="shipping-enable-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                          Add Additional Charges (Shipping, Handling, etc.)
                        </label>
                      </div>
                    </div>

                    {charges.enabled && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Label</label>
                          <input
                            type="text"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            value={charges.label}
                            onChange={e => setCharges(prev => ({ ...prev, label: e.target.value }))}
                            placeholder="e.g. Shipping Fee"
                            id="shipping-label-input"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Amount ({currency.symbol})</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right"
                            value={charges.amount || ''}
                            onChange={e => setCharges(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                            placeholder="0.00"
                            id="shipping-amount-input"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 6: NOTES TEMPLATE */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <button 
                onClick={() => toggleCard('notes')}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/70 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                id="toggle-notes-card"
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-slate-600 bg-slate-200/60 p-1.5 rounded-lg">
                    <FileSignature className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Terms & Free Notes</h2>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 mt-0.5">Define conditions / default notes template</p>
                  </div>
                </div>
                {openedCard === 'notes' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {openedCard === 'notes' && (
                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-600">Active Notes (On this Invoice)</label>
                      <button 
                        type="button"
                        onClick={() => setActiveNotes(notesTemplate)}
                        className="text-[10px] text-indigo-500 hover:text-indigo-600"
                        id="reset-notes-to-template-trigger"
                      >
                        Reset to template default
                      </button>
                    </div>
                    <textarea 
                      rows={4}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-sans"
                      value={activeNotes}
                      onChange={e => setActiveNotes(e.target.value)}
                      placeholder="Enter terms of payments, refunds, account details etc."
                      id="active-notes-textarea"
                    />
                  </div>

                  <hr className="border-slate-100" />

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Global Template Defaults (Saves to Cache)
                    </label>
                    <textarea 
                      rows={4}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-indigo-50/10 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-sans text-slate-600"
                      value={notesTemplate}
                      onChange={e => setNotesTemplate(e.target.value)}
                      placeholder="Default notes that load for every invoice creation..."
                      id="notes-template-textarea"
                    />
                  </div>

                  <hr className="border-slate-100" />

                  <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Digital Signature Block</span>
                      <button
                        type="button"
                        onClick={() => toggleFieldConfig('showSignatureBlock')}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                          fieldConfig.showSignatureBlock ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                        }`}
                      >
                        {fieldConfig.showSignatureBlock ? (
                          <><Eye className="h-3.5 w-3.5" /><span>Visible</span></>
                        ) : (
                          <><EyeOff className="h-3.5 w-3.5" /><span>Hidden</span></>
                        )}
                      </button>
                    </div>

                    {fieldConfig.showSignatureBlock && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5 font-semibold">Signatory Designation Title</label>
                        <input
                          type="text"
                          value={fieldConfig.signatoryTitle}
                          onChange={e => setFieldConfig(prev => ({ ...prev, signatoryTitle: e.target.value }))}
                          placeholder="e.g. Authorized Signatory, CEO, Director"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          id="signatory-title-input"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 7: BANKING PAYMENT DETAILS */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <button 
                onClick={() => toggleCard('payment')}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/70 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
                id="toggle-payment-card"
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-slate-600 bg-slate-200/60 p-1.5 rounded-lg">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Payment & Bank Details</h2>
                    <p className="text-[11px] text-slate-500">Persisted across sessions / toggle displays</p>
                  </div>
                </div>
                {openedCard === 'payment' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {openedCard === 'payment' && (
                <div className="p-5 space-y-4">
                  
                  {/* Beneficiary Name */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600">Account Holder Name</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={payment.showAccountName}
                          onChange={e => setPayment(prev => ({ ...prev, showAccountName: e.target.checked }))}
                          className="h-3 w-3 text-indigo-500"
                        />
                        Show in invoice
                      </label>
                    </div>
                    <input 
                      type="text"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50"
                      value={payment.accountName}
                      onChange={e => setPayment(prev => ({ ...prev, accountName: e.target.value }))}
                      placeholder="Acme Inc."
                      id="bank-account-name-input"
                    />
                  </div>

                  {/* Bank Name */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600">Bank Name</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={payment.showBankName}
                          onChange={e => setPayment(prev => ({ ...prev, showBankName: e.target.checked }))}
                          className="h-3 w-3 text-indigo-500"
                        />
                        Show
                      </label>
                    </div>
                    <input 
                      type="text"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50"
                      value={payment.bankName}
                      onChange={e => setPayment(prev => ({ ...prev, bankName: e.target.value }))}
                      placeholder="HDFC Bank"
                      id="bank-name-input"
                    />
                  </div>

                  {/* Account Number */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-600">Account No.</label>
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={payment.showAccountNumber}
                            onChange={e => setPayment(prev => ({ ...prev, showAccountNumber: e.target.checked }))}
                            className="h-3 w-3 text-indigo-500"
                          />
                          Show
                        </label>
                      </div>
                      <input 
                        type="text"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 font-mono"
                        value={payment.accountNumber}
                        onChange={e => setPayment(prev => ({ ...prev, accountNumber: e.target.value }))}
                        placeholder="50200..."
                        id="bank-account-num-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-600">IFSC Code</label>
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={payment.showIfscCode}
                            onChange={e => setPayment(prev => ({ ...prev, showIfscCode: e.target.checked }))}
                            className="h-3 w-3 text-indigo-500"
                          />
                          Show
                        </label>
                      </div>
                      <input 
                        type="text"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 font-mono uppercase"
                        value={payment.ifscCode}
                        onChange={e => setPayment(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                        placeholder="HDFC0001"
                        id="bank-ifsc-input"
                      />
                    </div>
                  </div>

                  {/* Branch & UPI ID */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-600">Branch Name</label>
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={payment.showBranch}
                            onChange={e => setPayment(prev => ({ ...prev, showBranch: e.target.checked }))}
                            className="h-3 w-3 text-indigo-500"
                          />
                          Show
                        </label>
                      </div>
                      <input 
                        type="text"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50"
                        value={payment.branch}
                        onChange={e => setPayment(prev => ({ ...prev, branch: e.target.value }))}
                        placeholder="Electronic City"
                        id="bank-branch-name-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-indigo-600">UPI ID</label>
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={payment.showUpiId}
                            onChange={e => setPayment(prev => ({ ...prev, showUpiId: e.target.checked }))}
                            className="h-3 w-3 text-indigo-500"
                          />
                          Show
                        </label>
                      </div>
                      <input 
                        type="text"
                        className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg text-sm bg-indigo-50/20 font-mono text-slate-700"
                        value={payment.upiId}
                        onChange={e => setPayment(prev => ({ ...prev, upiId: e.target.value }))}
                        placeholder="acme@upi"
                        id="bank-upi-id-input"
                      />
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT PANEL: LIVE LAYOUT INVOICE SHEET                    */}
          {/* ========================================================= */}
          <div className="lg:col-span-12 xl:col-span-7 print:col-span-12" id="preview-column">
            
            {/* INVOICE CONTAINER (Matches print sizes, styled beautifully) */}
            <div 
              className="bg-white rounded-2xl border border-slate-250 hover:shadow-lg transition-all mx-auto max-w-[800px] shadow-sm p-6 sm:p-10 text-slate-800 leading-normal text-xs font-sans print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none"
              id="live-invoice-stage"
            >
              {/* BRAND HEADER */}
              <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-slate-100">
                
                {/* Seller Profile */}
                <div className="space-y-2 max-w-[50%]">
                  {seller.companyName && (
                    <h3 className="text-xl font-display font-bold text-slate-900 tracking-tight">
                      {seller.companyName}
                    </h3>
                  )}
                  <div className="space-y-0.5 text-slate-500 font-medium">
                    {fieldConfig.showSellerAddress && seller.address && (
                      <p className="whitespace-pre-line text-[10.5px] leading-relaxed">
                        {seller.address}
                      </p>
                    )}
                    
                    <div className="pt-2 text-[10px] space-y-1 font-mono">
                      {fieldConfig.showSellerEmail && seller.email && (
                        <div className="text-slate-500 block">Email: <span className="text-slate-700">{seller.email}</span></div>
                      )}
                      {fieldConfig.showSellerPhone && seller.phone && (
                        <div className="text-slate-500 block">Phone: <span className="text-slate-700">{seller.phone}</span></div>
                      )}
                      {fieldConfig.showSellerPan && seller.panNumber && (
                        <div className="text-slate-500 block">PAN: <span className="text-slate-700 uppercase">{seller.panNumber}</span></div>
                      )}
                      
                      {seller.isGstRegistered ? (
                        fieldConfig.showSellerGstin && seller.gstin && (
                          <div className="text-indigo-600 font-semibold block">
                            GSTIN: <span className="uppercase">{seller.gstin}</span>
                          </div>
                        )
                      ) : (
                        fieldConfig.showSellerReg && seller.regValue && (
                          <div className="text-slate-500 block font-sans">
                            <span>{seller.regLabel || 'ID'}: <strong className="font-mono text-slate-700 uppercase">{seller.regValue}</strong></span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Invoice Meta Grid */}
                <div className="text-left sm:text-right space-y-3 min-w-[200px]">
                  {fieldConfig.showInvoiceNumber && invoiceMeta.invoiceNumber && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-indigo-500 font-bold">INVOICE DOCUMENT</span>
                      <h2 className="text-2xl font-mono font-bold text-slate-800 tracking-tight">
                        {invoiceMeta.invoiceNumber}
                      </h2>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:flex sm:flex-col gap-x-4 gap-y-1.5 text-slate-500 font-medium pt-1">
                    {fieldConfig.showInvoiceDate && invoiceMeta.invoiceDate && (
                      <div className="sm:text-right">
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">DATE OF ISSUE</span>
                        <strong className="text-[11px] text-slate-700 font-mono">
                          {formatDateDisplay(invoiceMeta.invoiceDate)}
                        </strong>
                      </div>
                    )}

                    {fieldConfig.showDueDate && invoiceMeta.dueDate && (
                      <div className="sm:text-right sm:mt-1">
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">DATE DUE</span>
                        <strong className="text-[11px] text-slate-700 font-mono">
                          {formatDateDisplay(invoiceMeta.dueDate)}
                        </strong>
                      </div>
                    )}

                    {fieldConfig.showPaymentTerms && invoiceMeta.paymentTerms && (
                      <div className="sm:text-right sm:mt-1">
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">TERMS</span>
                        <strong className="text-[10.5px] text-indigo-600">
                          {invoiceMeta.paymentTerms}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CLIENT BILL TO */}
              {hasClientDetailsVisible && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-b border-slate-100">
                  <div>
                    <h4 className="text-[9.5px] uppercase tracking-widest text-slate-400 font-bold mb-1.5">BILL TO CLIENT:</h4>
                    <div className="space-y-1">
                      {client.name && (
                        <div className="text-sm font-bold text-slate-900 leading-tight">
                          {client.name}
                        </div>
                      )}
                      {fieldConfig.showClientAddress && client.address && (
                        <p className="whitespace-pre-line text-slate-500 text-[10.5px] leading-relaxed">
                          {client.address}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Additional supplier-specific outputs */}
                  {calculations.isGstEnabled && (
                    <div className="space-y-2 md:text-right flex flex-col justify-end">
                      {fieldConfig.showClientGstin && client.gstin && (
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">CLIENT GSTIN</span>
                          <strong className="text-xs font-mono uppercase text-slate-700">{client.gstin}</strong>
                        </div>
                      )}
                      {fieldConfig.showClientPlaceOfSupply && client.placeOfSupply && (
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">PLACE OF SUPPLY</span>
                          <strong className="text-xs text-slate-700">{client.placeOfSupply}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ITEMS DETAILS TABLE */}
              <div className="py-6 overflow-x-auto">
                <table className="w-full text-left border-collapse" id="invoice-items-pre-table">
                  <thead>
                    <tr className="border-b border-slate-200/90 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="py-2.5 w-8 text-center text-slate-350">#</th>
                      <th className="py-2.5 text-left">Services or Item Description</th>
                      <th className="py-2.5 w-12 text-center">Qty</th>
                      <th className="py-2.5 w-24 text-right">Unit Rate</th>
                      {calculations.isGstEnabled && (
                        <th className="py-2.5 w-16 text-center">GST %</th>
                      )}
                      <th className="py-2.5 w-28 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
                    {calculations.computedItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 pr-4 font-medium">
                          {item.description || <span className="text-slate-350 italic">Generic Description / Consulting Fee</span>}
                        </td>
                        <td className="py-3 text-center font-mono font-medium">{item.quantity || 1}</td>
                        <td className="py-3 text-right font-mono">
                          {currency.symbol}{(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        {calculations.isGstEnabled && (
                          <td className="py-3 text-center font-mono font-medium text-slate-500">
                            {item.taxRate}%
                          </td>
                        )}
                        <td className="py-3 text-right font-mono font-semibold">
                          {currency.symbol}{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* DISCOUNTS, TAX SLIDES, AND GRAND TOTAL SUMMARY */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-slate-100">
                
                {/* Bank / Left Panel block */}
                <div className="md:col-span-6 space-y-4">
                  {/* Words */}
                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[8.5px] uppercase tracking-wider text-slate-400 font-bold block">TOTAL AMOUNT IN WORDS</span>
                    <div className="text-[10.5px] font-semibold text-slate-800 italic leading-relaxed font-sans">
                      {numberToWordsIndian(calculations.grandTotal, currency.code)}
                    </div>
                  </div>

                  {/* Payment Details */}
                  {hasBank && (
                    <div className="space-y-2">
                      <span className="text-[8.5px] uppercase tracking-wider text-slate-400 font-bold block">PAYMENT INFORMATION</span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10.5px]">
                        {payment.showAccountName && payment.accountName && (
                          <div>
                            <span className="text-slate-400">Account Holder:</span>
                            <div className="font-semibold text-slate-700">{payment.accountName}</div>
                          </div>
                        )}
                        {payment.showBankName && payment.bankName && (
                          <div>
                            <span className="text-slate-400">Bank Name:</span>
                            <div className="font-semibold text-slate-700">{payment.bankName}</div>
                          </div>
                        )}
                        {payment.showAccountNumber && payment.accountNumber && (
                          <div>
                            <span className="text-slate-400">Account Number:</span>
                            <div className="font-semibold text-slate-700 font-mono">{payment.accountNumber}</div>
                          </div>
                        )}
                        {payment.showIfscCode && payment.ifscCode && (
                          <div>
                            <span className="text-slate-400">IFSC Code:</span>
                            <div className="font-semibold text-slate-700 font-mono uppercase">{payment.ifscCode}</div>
                          </div>
                        )}
                        {payment.showBranch && payment.branch && (
                          <div>
                            <span className="text-slate-400">Branch Location:</span>
                            <div className="font-semibold text-slate-700">{payment.branch}</div>
                          </div>
                        )}
                        {payment.showUpiId && payment.upiId && (
                          <div>
                            <span className="text-indigo-600">UPI ID Account:</span>
                            <div className="font-semibold text-indigo-700 font-mono">{payment.upiId}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Math totals Right Panel */}
                <div className="md:col-span-6 space-y-2 text-right">
                  <div className="flex justify-between text-[11px] font-medium text-slate-500">
                    <span>Subtotal Raw:</span>
                    <span className="font-mono">{currency.symbol}{calculations.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {discount.enabled && calculations.discountAmount > 0 && (
                    <div className="flex justify-between text-[11px] text-emerald-600 font-medium bg-emerald-50/50 px-2 py-0.5 rounded-md">
                      <span>Discount ({discount.type === 'percentage' ? `${discount.value}%` : 'Fixed'}):</span>
                      <span className="font-mono">- {currency.symbol}{calculations.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {calculations.isGstEnabled && (
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                      {calculations.isSameState ? (
                        <>
                          {calculations.cgst > 0 && (
                            <div className="flex justify-between text-[10.5px] text-slate-500 font-medium">
                              <span className="text-slate-400">CGST (Intrastate 50% split):</span>
                              <span className="font-mono">{currency.symbol}{calculations.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {calculations.sgst > 0 && (
                            <div className="flex justify-between text-[10.5px] text-slate-500 font-medium">
                              <span className="text-slate-400">SGST (Intrastate 50% split):</span>
                              <span className="font-mono">{currency.symbol}{calculations.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        calculations.igst > 0 && (
                          <div className="flex justify-between text-[10.5px] text-slate-500 font-medium">
                            <span className="text-slate-400">IGST (Interstate Full Rate):</span>
                            <span className="font-mono">{currency.symbol}{calculations.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )
                      )}
                      
                      {calculations.totalTax > 0 && (
                        <div className="flex justify-between text-[10.5px] text-slate-600 font-bold">
                          <span>Computed GST Tax:</span>
                          <span className="font-mono">{currency.symbol}{calculations.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {charges.enabled && calculations.chargeAmount > 0 && (
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>{charges.label || 'Other Charges'}:</span>
                      <span className="font-mono">{currency.symbol}{calculations.chargeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {/* Grand total banner */}
                  <div className="pt-2 border-t-2 border-indigo-600 flex justify-between items-center">
                    <span className="text-sm font-display font-extrabold text-indigo-700 leading-none">GRAND TOTAL:</span>
                    <span className="text-lg font-mono font-black text-indigo-600 leading-none">
                      {currency.symbol}{calculations.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* NOTES / TERMS BOX */}
              {activeNotes && (
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block mb-1">NOTES & TERMS OF ENGAGEMENT</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans whitespace-pre-line bg-slate-50/45 p-3 rounded-lg border border-slate-100">
                    {activeNotes}
                  </p>
                </div>
              )}

              {/* SIGNATURE AREA */}
              {fieldConfig.showSignatureBlock && (
                <div className="mt-12 flex justify-between items-end pointer-events-none">
                  <div className="text-[9px] text-slate-300 font-mono">
                    Generated via Online Portal · System Stamp Validated
                  </div>
                  <div className="text-right space-y-10">
                    {seller.companyName && (
                      <span className="block text-[9.5px] font-bold text-slate-500">
                        For {seller.companyName}
                      </span>
                    )}
                    <div className="border-t border-slate-300 w-44 pt-1 inline-block text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                      {fieldConfig.signatoryTitle || "Authorized Signatory"}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Print Help Banner (Hidden during raw print) */}
            <div className="mt-4 p-4 rounded-xl bg-slate-100 border border-slate-200 flex gap-2.5 max-w-[800px] mx-auto print:hidden">
              <AlertCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 leading-relaxed">
                <strong>Pro-Tip:</strong> The live preview represents an absolute visual reference of the resulting invoice. You can press <strong>Download PDF</strong> to acquire a highly optimized vector copy or use the <strong>Print</strong> button to open details in standard desktop page spool managers.
              </div>
            </div>

          </div>

        </div>
      </main>

    </div>
  );
}
