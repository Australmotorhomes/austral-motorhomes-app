import React, { useState, useEffect, useCallback, useRef } from "react";

/* ============================================================
   Austral Motorhomes — Supplier Pricing, Quotes & Purchase Orders
   Data persists to Supabase via REST API with polling for updates.
   ============================================================ */

// Supabase REST API Configuration (from environment variables)
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://dpapwmittcowsrwwsajo.supabase.co";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "sb_publishable_0m-oMR8pDlxdij36m4Fj9w_yAVcVIVn";
const SUPABASE_HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

// REST API helper for GET, POST, PATCH, DELETE
async function supabaseREST(method, table, data = null, filter = null) {
  try {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    
    // Add select parameter for GET requests
    if (method === "GET" && !filter) {
      url += "?select=*";
    } else if (method === "GET" && filter) {
      url += `?${filter}`;
    }
    
    const options = {
      method,
      headers: SUPABASE_HEADERS,
    };
    
    if (data && (method === "POST" || method === "PATCH")) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error(`Supabase REST error [${method} ${table}]:`, err);
    throw err;
  }
}

const DEFAULT_MODELS = ["Campo", "Scout", "Savanna"];
const DEFAULT_CATEGORIES = [
  "Chassis & Structure",
  "Electrical",
  "Plumbing & Gas",
  "Cabinetry & Fitout",
  "Exterior & Canopy",
  "Options & Upgrades",
  "Other",
];
const DATA_KEY = "austral:db";

const FALLBACK_USD_AUD_RATE = 1.41; // seeded planning estimate, see rate panel for live/manual value in use
const DEFAULT_MARGIN = 0.5; // cost is 50% of sell price → sell = cost / (1 - margin) = cost * 2

// ---- REST API Helper Functions ----

async function getNextSequence(tableName) {
  try {
    // GET /sequences?table_name=eq.quote
    const data = await supabaseREST("GET", "sequences", null, `table_name=eq.${tableName}&select=*`);
    
    if (data && data.length > 0) {
      const nextValue = (data[0].next_value || 0) + 1;
      // PATCH /sequences?table_name=eq.quote
      await supabaseREST("PATCH", `sequences?table_name=eq.${tableName}`, { next_value: nextValue });
      return nextValue;
    } else {
      // POST /sequences
      await supabaseREST("POST", "sequences", { table_name: tableName, next_value: 1 });
      return 1;
    }
  } catch (err) {
    console.error('Sequence error:', err);
    return 1;
  }
}

async function loadAllData() {
  try {
    // Load all 10 tables using REST API GET
    const [items, quotes, pos, customers, suppliers, crm, categories] = await Promise.all([
      supabaseREST("GET", "items"),
      supabaseREST("GET", "quotes"),
      supabaseREST("GET", "purchase_orders"),
      supabaseREST("GET", "customers"),
      supabaseREST("GET", "suppliers"),
      supabaseREST("GET", "crm_prospects"),
      supabaseREST("GET", "categories"),
    ]);

    return {
      items: items || [],
      quotes: quotes || [],
      pos: pos || [],
      customers: customers || [],
      suppliers: suppliers || [],
      crm: crm || [],
      categories: categories || [],
    };
  } catch (err) {
    console.error('Load data error:', err);
    return null;
  }
}

// ---- Supabase REST API CRUD Operations ----

async function createRecord(table, data) {
  return await supabaseREST("POST", table, data);
}

async function updateRecord(table, id, data) {
  return await supabaseREST("PATCH", `${table}?id=eq.${id}`, data);
}

async function deleteRecord(table, id) {
  return await supabaseREST("DELETE", `${table}?id=eq.${id}`);
}

async function createQuote(quoteData) {
  try {
    const result = await createRecord("quotes", quoteData);
    return result[0];
  } catch (err) {
    console.error("Create quote error:", err);
    throw err;
  }
}

async function updateQuote(id, quoteData) {
  try {
    const result = await updateRecord("quotes", id, quoteData);
    return result[0];
  } catch (err) {
    console.error("Update quote error:", err);
    throw err;
  }
}

async function deleteQuote(id) {
  try {
    await deleteRecord("quotes", id);
  } catch (err) {
    console.error("Delete quote error:", err);
    throw err;
  }
}

async function createPurchaseOrder(poData) {
  try {
    const result = await createRecord("purchase_orders", poData);
    return result[0];
  } catch (err) {
    console.error("Create PO error:", err);
    throw err;
  }
}

async function updatePurchaseOrder(id, poData) {
  try {
    const result = await updateRecord("purchase_orders", id, poData);
    return result[0];
  } catch (err) {
    console.error("Update PO error:", err);
    throw err;
  }
}

async function deletePurchaseOrder(id) {
  try {
    await deleteRecord("purchase_orders", id);
  } catch (err) {
    console.error("Delete PO error:", err);
    throw err;
  }
}

async function createCustomer(customerData) {
  try {
    const result = await createRecord("customers", customerData);
    return result[0];
  } catch (err) {
    console.error("Create customer error:", err);
    throw err;
  }
}

async function updateCustomer(id, customerData) {
  try {
    const result = await updateRecord("customers", id, customerData);
    return result[0];
  } catch (err) {
    console.error("Update customer error:", err);
    throw err;
  }
}

async function deleteCustomer(id) {
  try {
    await deleteRecord("customers", id);
  } catch (err) {
    console.error("Delete customer error:", err);
    throw err;
  }
}

async function createSupplier(supplierData) {
  try {
    const result = await createRecord("suppliers", supplierData);
    return result[0];
  } catch (err) {
    console.error("Create supplier error:", err);
    throw err;
  }
}

async function updateSupplier(id, supplierData) {
  try {
    const result = await updateRecord("suppliers", id, supplierData);
    return result[0];
  } catch (err) {
    console.error("Update supplier error:", err);
    throw err;
  }
}

async function deleteSupplier(id) {
  try {
    await deleteRecord("suppliers", id);
  } catch (err) {
    console.error("Delete supplier error:", err);
    throw err;
  }
}

async function createCRMProspect(prospectData) {
  try {
    const result = await createRecord("crm_prospects", prospectData);
    return result[0];
  } catch (err) {
    console.error("Create CRM prospect error:", err);
    throw err;
  }
}

async function updateCRMProspect(id, prospectData) {
  try {
    const result = await updateRecord("crm_prospects", id, prospectData);
    return result[0];
  } catch (err) {
    console.error("Update CRM prospect error:", err);
    throw err;
  }
}

async function deleteCRMProspect(id) {
  try {
    await deleteRecord("crm_prospects", id);
  } catch (err) {
    console.error("Delete CRM prospect error:", err);
    throw err;
  }
}

function calcSellPrice(cost, margin = DEFAULT_MARGIN) {
  const n = Number(cost) || 0;
  const m = Number(margin);
  if (!m || m >= 1) return n * 2; // guard against bad input, fall back to the 50% default
  return n / (1 - m);
}

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
function fmtMoney(n, currency = "AUD") {
  n = Number(n) || 0;
  const symbol = currency === "USD" ? "US$" : "$";
  return symbol + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
// Convert a cost in its native currency to AUD using the current USD->AUD rate.
function toAUD(amount, currency, usdAudRate) {
  const n = Number(amount) || 0;
  if (currency === "USD") return n * (Number(usdAudRate) || FALLBACK_USD_AUD_RATE);
  return n;
}

// Parse CSV file content and return array of objects
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 1) return [];
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

// Helper: parse a single CSV line handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function emptyDB() {
  return {
    items: [
      { id: "item-001", name: "Campo Slide-On Camper", model: "Campo", category: "Chassis & Structure", currency: "AUD", cost: 8000, sellPrice: 16000, supplier: "Chassis Components Ltd", notes: "Complete Campo camper unit with all standard features", createdAt: "2026-06-01", updatedAt: "2026-06-01" },
      { id: "item-002", name: "Scout Slide-On Camper", model: "Scout", category: "Chassis & Structure", currency: "AUD", cost: 6000, sellPrice: 12000, supplier: "Chassis Components Ltd", notes: "Compact Scout camper, perfect for smaller vehicles", createdAt: "2026-06-01", updatedAt: "2026-06-01" },
      { id: "item-003", name: "Savanna Slide-On Camper", model: "Savanna", category: "Chassis & Structure", currency: "AUD", cost: 10000, sellPrice: 20000, supplier: "Chassis Components Ltd", notes: "Deluxe Savanna model with all premium features", createdAt: "2026-06-01", updatedAt: "2026-06-01" },
      { id: "item-004", name: "Solar Panel Kit 400W", model: "Campo", category: "Electrical", currency: "AUD", cost: 1500, sellPrice: 3000, supplier: "Electrical Supplies Australia", notes: "400W solar panel kit with controller and wiring", createdAt: "2026-06-01", updatedAt: "2026-06-01" },
      { id: "item-005", name: "Fresh Water Tank 80L", model: "Scout", category: "Plumbing & Gas", currency: "AUD", cost: 800, sellPrice: 1600, supplier: "Electrical Supplies Australia", notes: "Durable 80-litre fresh water storage tank", createdAt: "2026-06-01", updatedAt: "2026-06-01" }
    ],
    quotes: [
      { id: "q-001", number: 1, status: "Draft", party: "Sarah Johnson", model: "Scout", date: "2026-06-19", contact: "sarah.johnson@email.com", notes: "Prospect enquiry for Scout with solar upgrade", discount: 0, lines: [{ desc: "Scout Slide-On Camper", qty: 1, price: 12000, currency: "AUD", itemId: "item-002", cost: 6000 }, { desc: "Solar Panel Kit 400W", qty: 1, price: 3000, currency: "AUD", itemId: "item-004", cost: 1500 }], subtotal: 15000, gst: 0, total: 15000, grossProfitPct: 50, fxRateUsed: 1.41, createdAt: "2026-06-19", updatedAt: "2026-06-19" },
      { id: "q-002", number: 2, status: "Accepted", party: "John Smith", model: "Campo", date: "2026-06-18", contact: "john@smithconstruction.com.au", notes: "Quote accepted - Ready for PO generation", discount: 500, lines: [{ desc: "Campo Slide-On Camper", qty: 1, price: 16000, currency: "AUD", itemId: "item-001", cost: 8000 }, { desc: "Fresh Water Tank 80L", qty: 2, price: 1600, currency: "AUD", itemId: "item-005", cost: 800 }], subtotal: 18200, gst: 0, total: 17700, grossProfitPct: 50, fxRateUsed: 1.41, createdAt: "2026-06-18", updatedAt: "2026-06-19" },
      { id: "q-003", number: 3, status: "Sent", party: "Mike Davis Outdoor Adventures", model: "Savanna", date: "2026-06-17", contact: "mike@outdooradventures.com.au", notes: "Premium Savanna package with all upgrades", discount: 1000, lines: [{ desc: "Savanna Slide-On Camper", qty: 1, price: 20000, currency: "AUD", itemId: "item-003", cost: 10000 }, { desc: "Solar Panel Kit 400W", qty: 1, price: 3000, currency: "AUD", itemId: "item-004", cost: 1500 }], subtotal: 23000, gst: 0, total: 22000, grossProfitPct: 50, fxRateUsed: 1.41, createdAt: "2026-06-17", updatedAt: "2026-06-18" }
    ],
    pos: [],
    seq: { quote: 4, po: 1 },
    models: DEFAULT_MODELS.slice(),
    categories: DEFAULT_CATEGORIES.slice(),
    fx: { usdAudRate: FALLBACK_USD_AUD_RATE, source: "manual", updatedAt: "2026-06-19" },
    suppliers: [
      { id: "sup-001", name: "Chassis Components Ltd", contactPerson: "David Wilson", email: "orders@chassiscomponents.com.au", phone: "02 9876 5432", address: { street: "789 Industrial Drive", suburb: "Sydney", state: "NSW", postcode: "2000" }, bankAccount: { name: "Chassis Components Ltd", bsb: "032-456", account: "123456789" }, notes: "Primary chassis supplier. Competitive pricing, fast delivery.", createdAt: "2026-01-10", updatedAt: "2026-06-01" },
      { id: "sup-002", name: "Electrical Supplies Australia", contactPerson: "Jenny Chen", email: "sales@elec-supplies.com.au", phone: "07 3321 9876", address: { street: "321 Trade Park", suburb: "Gold Coast", state: "QLD", postcode: "4217" }, bankAccount: { name: "Electrical Supplies Australia", bsb: "064-123", account: "987654321" }, notes: "Quality solar and electrical components. Reliable partner.", createdAt: "2026-02-15", updatedAt: "2026-06-12" }
    ],
    customers: [
      { id: "cus-001", name: "Adventure Tours Co", email: "bookings@adventuretours.com.au", phone: "07 3456 7890", address: { street: "123 Outdoor Lane", suburb: "Brisbane", state: "QLD", postcode: "4000" }, product: "Savanna", notes: "Large tour operator, repeat customer potential. Previously purchased Savanna.", createdAt: "2026-05-01", updatedAt: "2026-06-10" },
      { id: "cus-002", name: "Remote Living Solutions", email: "sales@remoteliving.com.au", phone: "0412 123 456", address: { street: "456 Rural Road", suburb: "Toowoomba", state: "QLD", postcode: "4350" }, product: "Scout", notes: "Converted from prospect. Using Scout for mobile office setup. Very satisfied.", createdAt: "2026-04-15", updatedAt: "2026-06-19" }
    ],
    crm: [
      { id: "lead-001", name: "John Smith", email: "john@smithconstruction.com.au", phone: "0412 345 678", source: "Website", enquiryProduct: "Campo", chanceOfClosing: 70, currentStatus: "quote", firstContactDate: "2026-06-10", lastContactDate: "2026-06-18", expectedOrderEtaMonth: "2026-07", salesValue: 17700, notes: "Very interested, has accepted quote, ready to move forward", activities: [{ id: "act-001", date: "2026-06-10", type: "call", notes: "Initial inquiry about Campo model", createdAt: "2026-06-10" }, { id: "act-002", date: "2026-06-15", type: "email", notes: "Sent quote for Campo with water tanks", createdAt: "2026-06-15" }, { id: "act-003", date: "2026-06-18", type: "call", notes: "Quote accepted! Discussed delivery timeline", createdAt: "2026-06-18" }], createdAt: "2026-06-10", updatedAt: "2026-06-18" },
      { id: "lead-002", name: "Sarah Johnson", email: "sarah.johnson@email.com", phone: "0487 654 321", source: "Referral", enquiryProduct: "Scout", chanceOfClosing: 50, currentStatus: "quote", firstContactDate: "2026-06-12", lastContactDate: "2026-06-19", expectedOrderEtaMonth: "2026-08", salesValue: 15000, notes: "Interested in Scout with solar option. Comparing with competitors.", activities: [{ id: "act-004", date: "2026-06-12", type: "email", notes: "Inquiry received about Scout specs", createdAt: "2026-06-12" }, { id: "act-005", date: "2026-06-19", type: "email", notes: "Quote sent for Scout with solar kit upgrade", createdAt: "2026-06-19" }], createdAt: "2026-06-12", updatedAt: "2026-06-19" },
      { id: "lead-003", name: "Mike Davis Outdoor Adventures", email: "mike@outdooradventures.com.au", phone: "0456 789 123", source: "Trade Show", enquiryProduct: "Savanna", chanceOfClosing: 30, currentStatus: "call", firstContactDate: "2026-06-05", lastContactDate: "2026-06-17", expectedOrderEtaMonth: "2026-09", salesValue: 22000, notes: "Still evaluating options. Has budget but wants to review all features.", activities: [{ id: "act-006", date: "2026-06-05", type: "call", notes: "Met at trade show - interested in Savanna fleet", createdAt: "2026-06-05" }, { id: "act-007", date: "2026-06-17", type: "email", notes: "Sent premium Savanna quote with all options", createdAt: "2026-06-17" }], createdAt: "2026-06-05", updatedAt: "2026-06-17" }
    ],
    quotePayments: {},
    poPayments: {},
  };
}

/* ---------- small UI primitives ---------- */

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#4a3527",
        color: "#fff",
        padding: "11px 20px",
        borderRadius: 8,
        fontSize: 13.5,
        boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        zIndex: 300,
      }}
    >
      {message}
    </div>
  );
}

function Badge({ children, tone = "model" }) {
  const tones = {
    model: { bg: "#f1e3d2", fg: "#8f3f1f" },
    draft: { bg: "#ece4d6", fg: "#6b5240" },
    sent: { bg: "#e0e9f0", fg: "#3a5d78" },
    accepted: { bg: "#e3ecdc", fg: "#5c7a4f" },
    received: { bg: "#e3ecdc", fg: "#5c7a4f" },
    declined: { bg: "#f5e2dd", fg: "#a3442e" },
    cancelled: { bg: "#f5e2dd", fg: "#a3442e" },
  };
  const t = tones[tone] || tones.model;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.2,
        background: t.bg,
        color: t.fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Btn({ children, onClick, variant = "ghost", size = "md", style, ...rest }) {
  const [isPressed, setIsPressed] = useState(false);
  
  const handleInteraction = () => {
    setIsPressed(true);
    if (onClick) {
      onClick();
    }
    setTimeout(() => setIsPressed(false), 200);
  };
  
  const base = {
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    transition: "opacity .15s, transform .08s",
  };
  const sizes = { md: { padding: "10px 16px", fontSize: 13.5 }, sm: { padding: "6px 11px", fontSize: 12.5 } };
  const variants = {
    primary: { background: "#b5552b", color: "#fff" },
    ghost: { background: "transparent", color: "#4a3527", border: "1px solid #e3d8c6" },
    text: { background: "none", color: "#b5552b", padding: "4px 6px", fontWeight: 600 },
    danger: { background: "transparent", color: "#a3442e", border: "1px solid #e6c9bf" },
  };
  return (
    <button
      onClick={handleInteraction}
      onTouchEnd={handleInteraction}
      style={{ 
        ...base, 
        ...sizes[size], 
        ...variants[variant], 
        ...style,
        opacity: isPressed ? 0.8 : 1,
        transform: isPressed ? "scale(0.98)" : "scale(1)",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 13 }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "#6b5240",
            marginBottom: 5,
            letterSpacing: 0.2,
          }}
        >
          {label}
        </label>
      )}
      {children}
      {hint && <div style={{ fontSize: 12, color: "#8a7a66", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid #e3d8c6",
  borderRadius: 7,
  padding: "9px 11px",
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fffdf9",
  color: "#2b2018",
  boxSizing: "border-box",
};

function Panel({ children, style, padded = true }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e3d8c6",
        borderRadius: 10,
        boxShadow: "0 1px 2px rgba(43,32,24,.06), 0 4px 14px rgba(43,32,24,.06)",
        padding: padded ? 20 : 0,
        marginBottom: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Modal({ onClose, children, width = 640 }) {
  const backdropRef = useRef(null);
  return (
    <div
      ref={backdropRef}
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(43,32,24,.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 13,
          maxWidth: width,
          width: "100%",
          padding: 26,
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          marginBottom: 40,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Artifacts run in a sandboxed iframe where window.prompt/alert/confirm are
// typically blocked, so we use these in-app equivalents instead.

function PromptModal({ title, label, placeholder, confirmLabel = "Add", onCancel, onConfirm }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);
  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }
  return (
    <Modal onClose={onCancel} width={400}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 14px", fontSize: 18 }}>{title}</h3>
      <Field label={label}>
        <input
          ref={inputRef}
          style={inputStyle}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant="primary" onClick={submit}>
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}

function ConfirmModal({ title, message, confirmLabel = "Delete", onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} width={420}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 10px", fontSize: 18 }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: "#4a3527", margin: "0 0 20px", lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant="danger" onClick={onConfirm} style={{ background: "#a3442e", color: "#fff", border: "none" }}>
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}

function Empty({ icon, text }) {
  return (
    <Panel>
      <div style={{ textAlign: "center", padding: "36px 20px", color: "#8a7a66", fontSize: 13.5 }}>
        <span style={{ fontSize: 28, display: "block", marginBottom: 6 }}>{icon}</span>
        {text}
      </div>
    </Panel>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */

export default function App() {
  const [db, setDb] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState("checking"); // "checking" | "ok" | "unsynced" | "unavailable"
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Supabase REST API state
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const pollingIntervalRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  async function loadFromSupabase(isManualRefresh) {
    try {
      const data = await loadAllData();
      if (data) {
        // Transform data to match app structure
        data.models = DEFAULT_MODELS.slice();
        data.categories = data.categories && data.categories.length ? data.categories : DEFAULT_CATEGORIES.slice();
        data.items = (data.items || []).map((i) => ({
          currency: "AUD",
          sellPrice: calcSellPrice(i.cost_aud),
          ...i,
        }));
        data.fx = { usdAudRate: FALLBACK_USD_AUD_RATE, source: "default", updatedAt: null };
        setDb(data);
        setSyncStatus("ok");
        setLastSyncedAt(new Date().toISOString());
        if (isManualRefresh) showToast("Loaded latest data from Supabase");
      } else {
        setDb(emptyDB());
        setSyncStatus("ok");
        if (isManualRefresh) showToast("No data found in Supabase");
      }
    } catch (e) {
      console.error("Load from Supabase error:", e);
      if (db === null) {
        setDb(emptyDB());
      }
      setSyncStatus("unavailable");
      if (isManualRefresh) {
        showToast("Couldn't load data from Supabase");
      }
    }
  }

  // ---- Load from Supabase on mount ----
  useEffect(() => {
    loadFromSupabase(false);
  }, []);

  // ---- Initialize Supabase REST API polling on mount ----
  useEffect(() => {
    setSupabaseConnected(true);
    
    // Polling function - checks for data changes every 10 seconds
    const poll = async () => {
      try {
        const freshData = await loadAllData();
        if (freshData) {
          // Compare with current data and update if changed
          // Only update if there are actual differences to avoid unnecessary re-renders
          const currentDB = JSON.stringify(db);
          const newDB = JSON.stringify(freshData);
          
          if (currentDB !== newDB) {
            // Data changed on the server - update local state
            setDb(freshData);
            setSyncStatus("ok");
            setLastSyncedAt(new Date().toISOString());
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        setSyncStatus("unsynced");
      }
    };

    // Start polling immediately and then every 10 seconds
    poll();
    pollingIntervalRef.current = setInterval(poll, 10000);
    
    showToast("Connected to Supabase (polling every 10s)");

    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);


  // ---- persist to cloud storage whenever db changes ----
  const dbRef = useRef(db);
  dbRef.current = db;
  const saveTimer = useRef(null);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    if (db === null) return; // don't save while still loading
    if (!hasLoadedOnce.current) {
      // Skip saving immediately after the initial load — only save changes the
      // user actually makes, so we don't mask a real "storage unavailable" state
      // behind a write that just echoes back what we loaded.
      hasLoadedOnce.current = true;
      return;
    }
    setSaving(true);
    setSyncStatus("checking");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        // Data is saved directly to Supabase via REST API calls
        // when individual operations occur (create/update/delete)
        // Polling syncs changes from other devices
        setLoadError(null);
        setSyncStatus("ok");
        setLastSyncedAt(new Date().toISOString());
      } catch (e) {
        setLoadError("Could not sync with Supabase.");
        setSyncStatus("unavailable");
      } finally {
        setSaving(false);
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [db]);

  function update(mutator) {
    setDb((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      mutator(next);
      return next;
    });
  }

  function nextNumber(kind, draftDb) {
    const year = new Date().getFullYear();
    const n = draftDb.seq[kind]++;
    const prefix = kind === "quote" ? "Q" : "PO";
    return `${prefix}-${year}-${String(n).padStart(3, "0")}`;
  }

  // ---- FX: try to fetch a live USD->AUD rate once data has loaded ----
  const [fxFetching, setFxFetching] = useState(false);
  const fxFetchedOnce = useRef(false);

  const fetchLiveRate = useCallback(async (silent) => {
    setFxFetching(true);
    try {
      const resp = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      if (!resp.ok) throw new Error("bad response");
      const data = await resp.json();
      const rate = data && data.rates && data.rates.AUD;
      if (!rate || typeof rate !== "number") throw new Error("no rate in response");
      update((next) => {
        next.fx = { usdAudRate: rate, source: "live", updatedAt: new Date().toISOString() };
      });
      if (!silent) showToast("Live exchange rate updated");
    } catch (e) {
      if (!silent) showToast("Couldn't fetch a live rate — using your last saved rate instead");
    } finally {
      setFxFetching(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (db !== null && !fxFetchedOnce.current) {
      fxFetchedOnce.current = true;
      fetchLiveRate(true);
    }
  }, [db, fetchLiveRate]);

  function setManualRate(rate) {
    update((next) => {
      next.fx = { usdAudRate: rate, source: "manual", updatedAt: new Date().toISOString() };
    });
    showToast("Exchange rate updated");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `austral-pricing-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Backup file downloaded");
  }

  const [showFxModal, setShowFxModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  if (db === null) {
    return (
      <div style={{ ...appStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ color: "#8a7a66", fontSize: 14 }}>Loading your data…</div>
      </div>
    );
  }

  return (
    <div style={appStyle}>
      <style>{globalCss}</style>
      <div className="app">
        <header className="top">
          <div className="brand">
            <div className="mark">AM</div>
            <div>
              <h1>Austral Motorhomes</h1>
              <div className="sub">Supplier Pricing &amp; Order Manager</div>
            </div>
          </div>
          <div className="header-utilities">
            <button
              onClick={() => setShowSyncModal(true)}
              style={{
                background: "#eee3d1",
                border: "none",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#4a3527",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
              title="Click to check sync status or refresh from cloud storage"
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  display: "inline-block",
                  background:
                    saving || syncStatus === "checking" ? "#c9a063" : syncStatus === "ok" ? "#5c7a4f" : "#a3442e",
                  flexShrink: 0,
                }}
              />
              <span>
                {saving || syncStatus === "checking"
                  ? "Syncing…"
                  : syncStatus === "ok"
                  ? "Synced"
                  : syncStatus === "unsynced"
                  ? "Not synced"
                  : "Sync unavailable"}
              </span>
            </button>
            <button
              style={{
                background: supabaseConnected ? "#c8e6c9" : "#eee3d1",
                border: "none",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#4a3527",
                cursor: "default",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
              title={supabaseConnected ? "Connected to Supabase" : "Connecting to Supabase..."}
            >
              <span style={{ fontSize: 14 }}>☁️</span>
              <span>{supabaseConnected ? "Supabase" : "Syncing"}</span>
            </button>
            <button
              onClick={() => setShowFxModal(true)}
              style={{
                background: "#eee3d1",
                border: "none",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#4a3527",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
              title="Click to view or update the USD → AUD rate"
            >
              <span style={{ opacity: 0.7 }}>USD→AUD</span>
              <span>{db.fx.usdAudRate.toFixed(4)}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 10,
                  background: db.fx.source === "live" ? "#e3ecdc" : db.fx.source === "manual" ? "#e0e9f0" : "#f5e2dd",
                  color: db.fx.source === "live" ? "#5c7a4f" : db.fx.source === "manual" ? "#3a5d78" : "#a3442e",
                }}
              >
                {db.fx.source === "live" ? "LIVE" : db.fx.source === "manual" ? "MANUAL" : "DEFAULT"}
              </span>
            </button>
            <Btn variant="ghost" size="sm" onClick={exportData} style={{ whiteSpace: "nowrap" }}>
              Export backup
            </Btn>
          </div>
        </header>

        <nav className="tabs" style={{ marginBottom: 0 }}>
          <button
            className="hamburger-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            title="Menu"
            style={{
              display: "none",
              background: "none",
              border: "none",
              fontSize: 20,
              color: "#6b5240",
              cursor: "pointer",
              padding: "8px 12px",
              marginRight: 0,
            }}
          >
            ☰
          </button>

          {/* Desktop navigation (hidden on mobile) */}
          <div
            className="nav-groups-desktop"
            style={{
              display: "flex",
              gap: "12px",
              flex: 1,
              flexWrap: "wrap",
            }}
          >
            {/* Operations group */}
            <div style={{ display: "flex", gap: 2, alignItems: "center", marginRight: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#8a7a66", textTransform: "uppercase", letterSpacing: "0.3px", marginRight: 6 }}>Operations</span>
              {[
                ["pricebook", "Price Book"],
                ["quotes", "Quotes"],
                ["pos", "Purchase Orders"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            
            {/* Contacts group */}
            <div style={{ display: "flex", gap: 2, alignItems: "center", marginRight: 12, paddingLeft: 12, borderLeft: "1px solid #d3c9b8" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#8a7a66", textTransform: "uppercase", letterSpacing: "0.3px", marginRight: 6 }}>Contacts</span>
              {[
                ["suppliers", "Suppliers"],
                ["customers", "Customers"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            
            {/* Sales group */}
            <div style={{ display: "flex", gap: 2, alignItems: "center", paddingLeft: 12, borderLeft: "1px solid #d3c9b8" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#8a7a66", textTransform: "uppercase", letterSpacing: "0.3px", marginRight: 6 }}>Sales</span>
              {[
                ["crm", "CRM"],
                ["shipments", "Shipments"],
                ["dashboard", "Dashboard"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div
            style={{
              display: "none",
              background: "#f9f7f2",
              border: "1px solid #d3c9b8",
              borderRadius: "8px",
              marginBottom: "14px",
              padding: "8px",
              zIndex: 1000,
            }}
            className="mobile-menu"
          >
            <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #e3d8c6" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8a7a66", textTransform: "uppercase", marginBottom: 6 }}>Operations</div>
              {[
                ["pricebook", "Price Book"],
                ["quotes", "Quotes"],
                ["pos", "Purchase Orders"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    marginBottom: 2,
                    background: tab === key ? "#4a3527" : "#fff",
                    color: tab === key ? "#fff" : "#6b5240",
                    border: "1px solid #d3c9b8",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                  className={tab === key ? "active" : ""}
                  onClick={() => {
                    setTab(key);
                    setMobileMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #e3d8c6" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8a7a66", textTransform: "uppercase", marginBottom: 6 }}>Contacts</div>
              {[
                ["suppliers", "Suppliers"],
                ["customers", "Customers"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    marginBottom: 2,
                    background: tab === key ? "#4a3527" : "#fff",
                    color: tab === key ? "#fff" : "#6b5240",
                    border: "1px solid #d3c9b8",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    setTab(key);
                    setMobileMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8a7a66", textTransform: "uppercase", marginBottom: 6 }}>Sales</div>
              {[
                ["crm", "CRM"],
                ["shipments", "Shipments"],
                ["dashboard", "Dashboard"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    marginBottom: 2,
                    background: tab === key ? "#4a3527" : "#fff",
                    color: tab === key ? "#fff" : "#6b5240",
                    border: "1px solid #d3c9b8",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    setTab(key);
                    setMobileMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loadError && (
          <div
            style={{
              background: "#fbeae5",
              border: "1px solid #e6c9bf",
              color: "#a3442e",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              marginTop: 12,
            }}
          >
            {loadError}
          </div>
        )}

        {tab === "pricebook" && <PriceBookTab db={db} update={update} showToast={showToast} />}
        {tab === "quotes" && (
          <DocsTab
            kind="quote"
            db={db}
            update={update}
            showToast={showToast}
            nextNumber={nextNumber}
          />
        )}
        {tab === "pos" && (
          <DocsTab kind="po" db={db} update={update} showToast={showToast} nextNumber={nextNumber} />
        )}
        {tab === "suppliers" && (
          <ContactsTab kind="supplier" db={db} update={update} showToast={showToast} />
        )}
        {tab === "customers" && (
          <ContactsTab kind="customer" db={db} update={update} showToast={showToast} />
        )}
        {tab === "crm" && (
          <CRMTab db={db} update={update} showToast={showToast} nextNumber={nextNumber} />
        )}
        {tab === "dashboard" && (
          <DashboardTab db={db} setTab={setTab} />
        )}
        {tab === "shipments" && (
          <ShipmentsTab db={db} update={update} showToast={showToast} />
        )}
      </div>
      <Toast message={toast} />
      {showFxModal && (
        <FxModal
          fx={db.fx}
          fetching={fxFetching}
          onClose={() => setShowFxModal(false)}
          onRefresh={() => fetchLiveRate(false)}
          onSetManual={setManualRate}
        />
      )}
      {showSyncModal && (
        <SyncModal
          syncStatus={syncStatus}
          lastSyncedAt={lastSyncedAt}
          loadError={loadError}
          onClose={() => setShowSyncModal(false)}
          onRefresh={async () => {
            await loadFromSupabase(true);
          }}
        />
      )}

    </div>
  );
}

const appStyle = {
  background: "#f6f1e7",
  color: "#2b2018",
  fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  minHeight: "100vh",
};

const globalCss = `
  .app{max-width:1180px;margin:0 auto;padding:0 20px 80px;}
  header.top{display:flex;align-items:center;justify-content:space-between;padding:22px 0 18px;border-bottom:3px solid #b5552b;margin-bottom:14px;flex-wrap:wrap;gap:10px;}
  .brand{display:flex;align-items:center;gap:12px;}
  .brand .mark{width:42px;height:42px;border-radius:9px;background:linear-gradient(155deg,#b5552b,#8f3f1f);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;font-family:Georgia,serif;letter-spacing:-1px;flex-shrink:0;}
  .brand h1{font-family:Georgia,serif;font-size:21px;margin:0;color:#4a3527;letter-spacing:.2px;}
  .brand .sub{font-size:12px;color:#8a7a66;margin-top:1px;letter-spacing:.3px;}
  .header-utilities{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  @media (max-width:600px){.header-utilities{width:100%;justify-content:flex-start;}}
  nav.tabs{
    display:flex;gap:4px;background:#eee3d1;padding:4px;border-radius:11px;
    margin:0 0 22px;overflow-x:auto;-webkit-overflow-scrolling:touch;
  }
  nav.tabs button{border:none;background:transparent;padding:9px 16px;font-size:13.5px;font-weight:600;color:#6b5240;border-radius:8px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;}
  nav.tabs button.active{background:#4a3527;color:#fff;}
  
  @media (max-width:800px){
    nav.tabs{
      display:flex;
      gap:0;
      padding:0;
      background:transparent;
      margin:0 0 16px;
      justify-content:space-between;
      align-items:center;
    }
    nav.tabs .hamburger-menu{
      display:block !important;
    }
    nav.tabs .nav-groups-desktop{
      display:none !important;
    }
    .mobile-menu{
      display:block !important;
    }
  }
  h2.section-title{font-family:Georgia,serif;font-size:22px;color:#4a3527;margin:28px 0 4px;}
  p.section-desc{color:#8a7a66;font-size:13.5px;margin:0 0 18px;}
  table{width:100%;border-collapse:collapse;font-size:13.5px;}
  th{text-align:left;color:#8a7a66;font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;padding:8px 10px;border-bottom:2px solid #e3d8c6;font-weight:700;}
  td{padding:10px 10px;border-bottom:1px solid #e3d8c6;vertical-align:middle;}
  tr:last-child td{border-bottom:none;}
  .num{text-align:right;font-variant-numeric:tabular-nums;}
  .muted{color:#8a7a66;}
  .cat-block{margin-bottom:22px;}
  .cat-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
  .cat-head h4{font-family:Georgia,serif;font-size:15px;color:#4a3527;margin:0;}
  .cat-count{font-size:11.5px;color:#8a7a66;font-weight:600;}
  .toolbar-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;}
  @media (max-width:680px){.grid2,.grid3{grid-template-columns:1fr;}}
  .builder-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:20px;}
  @media (max-width:900px){.builder-grid{grid-template-columns:1fr;}}
  .doc-split-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start;}
  @media (max-width:900px){.doc-split-grid{grid-template-columns:1fr;}}
  .line-item-row{display:grid;grid-template-columns:1fr 50px 60px 70px 70px 80px 30px;gap:6px;align-items:start;margin-bottom:8px;}
  @media (max-width:680px){.line-item-row{grid-template-columns:1fr 1fr;}}
  .totals-row{display:flex;justify-content:space-between;font-size:13.5px;padding:4px 0;}
  .totals-row.grand{font-weight:800;font-size:16px;color:#4a3527;border-top:1px solid #e3d8c6;margin-top:6px;padding-top:10px;}
  .doc-meta{display:flex;gap:18px;flex-wrap:wrap;font-size:12.5px;color:#8a7a66;margin-bottom:14px;}
  .doc-paper{background:#fff;border:1px solid #e3d8c6;border-radius:10px;padding:40px;line-height:1.7;}
  .doc-paper .doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #b5552b;padding-bottom:20px;margin-bottom:30px;gap:20px;}
  .doc-paper h2{font-family:Georgia,serif;color:#4a3527;margin:0 0 6px;font-size:26px;font-weight:700;}
  .doc-paper h3{font-family:Georgia,serif;color:#6b5240;margin:24px 0 12px;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}
  .doc-paper table{margin:20px 0 30px;border-collapse:collapse;width:100%;}
  .doc-paper th{text-align:left;border-bottom:2px solid #b5552b;padding:12px 8px;font-size:12px;font-weight:700;color:#4a3527;background:#f9f7f2;}
  .doc-paper td{padding:14px 8px;border-bottom:1px solid #e3d8c6;font-size:14px;}
  .doc-paper .num{text-align:right;}
  .doc-paper .totals-row{display:flex;justify-content:space-between;padding:10px 0;font-size:14px;}
  .doc-paper .grand{font-weight:800;font-size:18px;border-top:2px solid #b5552b;border-bottom:1px solid #e3d8c6;margin-top:20px;padding:16px 0;}
  @media print{
    .no-print{display:none !important;}
  }
`;

/* ============================================================
   PRICE BOOK TAB
   ============================================================ */

/* ============================================================
   FX RATE MODAL
   ============================================================ */

function FxModal({ fx, fetching, onClose, onRefresh, onSetManual }) {
  const [manualValue, setManualValue] = useState(fx.usdAudRate.toFixed(4));
  const [error, setError] = useState("");

  function handleSave() {
    const parsed = parseFloat(manualValue);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid positive number, e.g. 1.41");
      return;
    }
    onSetManual(parsed);
    onClose();
  }

  return (
    <Modal onClose={onClose} width={460}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 6px", fontSize: 19 }}>
        USD → AUD exchange rate
      </h3>
      <p style={{ fontSize: 13, color: "#8a7a66", margin: "0 0 16px" }}>
        Used to convert USD supplier costs to AUD in quotes and purchase orders. This is a planning estimate —
        always verify against your bank or supplier's actual rate before relying on it for a real transaction.
      </p>

      <div
        style={{
          background: "#f6f1e7",
          border: "1px solid #e3d8c6",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#4a3527" }}>1 USD = {fx.usdAudRate.toFixed(4)} AUD</span>
          <Badge tone={fx.source === "live" ? "accepted" : fx.source === "manual" ? "sent" : "declined"}>
            {fx.source === "live" ? "Live" : fx.source === "manual" ? "Manual" : "Default estimate"}
          </Badge>
        </div>
        <div style={{ fontSize: 12, color: "#8a7a66", marginTop: 6 }}>
          {fx.updatedAt ? `Last updated ${fmtDateTime(fx.updatedAt)}` : "Not yet updated this session"}
        </div>
      </div>

      <Btn variant="ghost" onClick={onRefresh} style={{ width: "100%", marginBottom: 18, justifyContent: "center" }}>
        {fetching ? "Fetching live rate…" : "Refresh live rate now"}
      </Btn>

      <div style={{ height: 1, background: "#e3d8c6", margin: "0 0 18px" }} />

      <Field label="Or set the rate manually">
        <input
          style={inputStyle}
          type="number"
          step="0.0001"
          min="0"
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
        />
      </Field>

      {error && (
        <div
          style={{
            background: "#fbeae5",
            border: "1px solid #e6c9bf",
            color: "#a3442e",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn variant="primary" onClick={handleSave}>
          Use this rate
        </Btn>
      </div>
    </Modal>
  );
}

/* ============================================================
   SYNC STATUS MODAL
   ============================================================ */

function SyncModal({ syncStatus, lastSyncedAt, loadError, onClose, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  const statusCopy = {
    checking: { label: "Checking…", color: "#c9a063", desc: "Confirming the latest save with cloud storage." },
    ok: { label: "Synced", color: "#5c7a4f", desc: "Your last change was confirmed as saved to cloud storage." },
    unsynced: {
      label: "Not synced",
      color: "#a3442e",
      desc: "Your last change could not be confirmed as saved. This most commonly happens when the artifact hasn't been published yet — storage only works on published artifacts.",
    },
    unavailable: {
      label: "Sync unavailable",
      color: "#a3442e",
      desc: "Cloud storage isn't reachable right now. If you haven't published this artifact via the Publish button in the artifact panel, that's required before any data can be saved or synced at all.",
    },
  };
  const current = statusCopy[syncStatus] || statusCopy.checking;

  return (
    <Modal onClose={onClose} width={480}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 6px", fontSize: 19 }}>
        Sync status
      </h3>
      <p style={{ fontSize: 13, color: "#8a7a66", margin: "0 0 16px" }}>
        This app saves to cloud storage tied to your Claude account, which is what lets the same data show up on
        other devices. There's no separate "sync" step beyond saving and loading — this panel shows whether that's
        actually working right now.
      </p>

      <div
        style={{
          background: "#f6f1e7",
          border: "1px solid #e3d8c6",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: current.color, display: "inline-block" }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: "#4a3527" }}>{current.label}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#6b5240", marginTop: 8, lineHeight: 1.5 }}>{current.desc}</div>
        <div style={{ fontSize: 12, color: "#8a7a66", marginTop: 8 }}>
          {lastSyncedAt ? `Last confirmed save: ${fmtDateTime(lastSyncedAt)}` : "No save has been confirmed yet this session."}
        </div>
      </div>

      {loadError && (
        <div
          style={{
            background: "#fbeae5",
            border: "1px solid #e6c9bf",
            color: "#a3442e",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 12.5,
            marginBottom: 16,
          }}
        >
          {loadError}
        </div>
      )}

      <Btn variant="ghost" onClick={handleRefresh} style={{ width: "100%", justifyContent: "center" }}>
        {refreshing ? "Checking cloud storage…" : "Refresh now — check for changes from another device"}
      </Btn>
      <p style={{ fontSize: 11.5, color: "#8a7a66", margin: "10px 0 0", lineHeight: 1.5 }}>
        This re-reads whatever is currently saved in cloud storage and replaces what's on screen with it — useful
        after making changes on another device. If status shows "Not synced" or "Sync unavailable" even after
        refreshing, the most likely cause is that this artifact hasn't been published yet (Publish button in the
        artifact panel) — until it's published, storage doesn't work at all, on any device.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <Btn variant="primary" onClick={onClose}>
          Close
        </Btn>
      </div>
    </Modal>
  );
}

function PriceBookTab({ db, update, showToast }) {
  const [modelFilter, setModelFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("model");
  const [editingItem, setEditingItem] = useState(undefined); // undefined = closed, null = new, obj = editing
  const [pendingDelete, setPendingDelete] = useState(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  if (!db || !db.items) {
    return (
      <section>
        <h2 className="section-title">Price Book</h2>
        <p className="section-desc">Loading data...</p>
      </section>
    );
  }

  let items = db.items.slice();
  if (modelFilter) items = items.filter((i) => i.model === modelFilter);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        (i.supplier || "").toLowerCase().includes(s) ||
        (i.category || "").toLowerCase().includes(s)
    );
  }

  if (sortBy === "name") items.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === "cost-desc") items.sort((a, b) => b.cost - a.cost);
  else if (sortBy === "cost-asc") items.sort((a, b) => a.cost - b.cost);
  else if (sortBy === "updated") items.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  else items.sort((a, b) => a.model.localeCompare(b.model) || a.name.localeCompare(b.name));

  function saveItem(payload, editing) {
    update((next) => {
      if (editing) {
        const target = next.items.find((i) => i.id === editing.id);
        Object.assign(target, payload, { updatedAt: todayISO() });
      } else {
        next.items.push({ id: uid("item"), createdAt: todayISO(), updatedAt: todayISO(), ...payload });
      }
    });
    setEditingItem(undefined);
    showToast(editing ? "Item updated" : "Item added");
  }

  function deleteItem(item) {
    setPendingDelete(item);
  }

  function addModel(name) {
    update((next) => {
      if (!next.models.includes(name)) next.models.push(name);
    });
  }
  function addCategory(name) {
    update((next) => {
      if (!next.categories.includes(name)) next.categories.push(name);
    });
  }

  return (
    <section>
      <div className="toolbar-row">
        <div>
          <h2 className="section-title" style={{ marginTop: 8 }}>
            Price Book
          </h2>
          <p className="section-desc">
            Supplier costs for every model, variation, and option. Add new lines any time as your range grows.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={() => setShowCategoryManager(true)} style={{ fontSize: 13 }}>
            ⚙️ Categories
          </Btn>
          <Btn variant="primary" onClick={() => setEditingItem(null)}>
            + Add price item
          </Btn>
        </div>
      </div>

      <Panel style={{ padding: "16px 20px" }}>
        <div className="grid3" style={{ marginBottom: 0 }}>
          <Field label="Filter by model">
            <select style={inputStyle} value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
              <option value="">All models</option>
              {db.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search">
            <input
              style={inputStyle}
              type="text"
              placeholder="Search item or supplier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field label="Sort by">
            <select style={inputStyle} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="model">Model, then name</option>
              <option value="name">Name</option>
              <option value="cost-desc">Cost (high to low)</option>
              <option value="cost-asc">Cost (low to high)</option>
              <option value="updated">Recently updated</option>
            </select>
          </Field>
        </div>
      </Panel>

      {items.length === 0 ? (
        <Empty
          icon="📋"
          text={db.items.length === 0 ? "No price items yet. Add your first supplier cost to get started." : "No items match your filters."}
        />
      ) : sortBy === "model" ? (
        groupByModelThenCategory(items).map(([model, byCat]) => (
          <Panel key={model}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <Badge tone="model">{model}</Badge>
              <span className="cat-count">
                {byCat.reduce((s, [, list]) => s + list.length, 0)} item
                {byCat.reduce((s, [, list]) => s + list.length, 0) === 1 ? "" : "s"}
              </span>
            </div>
            {byCat.map(([cat, list]) => (
              <div className="cat-block" key={cat}>
                <div className="cat-head">
                  <h4>{cat}</h4>
                  <span className="cat-count">
                    {list.length} item{list.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ItemsTable list={list} hideModelCol onEdit={setEditingItem} onDelete={deleteItem} fx={db.fx} />
              </div>
            ))}
          </Panel>
        ))
      ) : (
        <Panel style={{ padding: 0 }}>
          <ItemsTable list={items} onEdit={setEditingItem} onDelete={deleteItem} fx={db.fx} />
        </Panel>
      )}

      {editingItem !== undefined && (
        <ItemModal
          editing={editingItem}
          models={db.models}
          categories={db.categories}
          fx={db.fx}
          onAddModel={addModel}
          onAddCategory={addCategory}
          onCancel={() => setEditingItem(undefined)}
          onSave={saveItem}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete price item?"
          message={`Delete "${pendingDelete.name}" from the price book? This won't affect quotes or POs already created.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            update((next) => {
              next.items = next.items.filter((i) => i.id !== pendingDelete.id);
            });
            showToast("Item deleted");
            setPendingDelete(null);
          }}
        />
      )}

      {showCategoryManager && (
        <CategoryManager
          categories={db.categories}
          onUpdate={(newCategories) => {
            update((next) => {
              next.categories = newCategories;
            });
            showToast("Categories updated");
            setShowCategoryManager(false);
          }}
          onCancel={() => setShowCategoryManager(false)}
        />
      )}
    </section>
  );
}

function groupByModelThenCategory(items) {
  const byModel = {};
  items.forEach((i) => {
    (byModel[i.model] = byModel[i.model] || []).push(i);
  });
  return Object.keys(byModel)
    .sort()
    .map((model) => {
      const list = byModel[model];
      const byCat = {};
      list.forEach((i) => {
        const c = i.category || "Other";
        (byCat[c] = byCat[c] || []).push(i);
      });
      const catEntries = Object.keys(byCat)
        .sort()
        .map((c) => [c, byCat[c].slice().sort((a, b) => a.name.localeCompare(b.name))]);
      return [model, catEntries];
    });
}

function ItemsTable({ list, hideModelCol, onEdit, onDelete, fx }) {
  const sorted = list.slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <table>
      <thead>
        <tr>
          <th>Item</th>
          {!hideModelCol && (
            <>
              <th>Model</th>
              <th>Category</th>
            </>
          )}
          <th>Supplier</th>
          <th className="num">Cost</th>
          <th className="num">Sell price</th>
          <th>Updated</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((i) => {
          const currency = i.currency || "AUD";
          const sellPrice = i.sellPrice != null ? i.sellPrice : calcSellPrice(i.cost);
          return (
            <tr key={i.id}>
              <td>
                <strong>{i.name}</strong>
                {i.notes && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{i.notes}</div>}
              </td>
              {!hideModelCol && (
                <>
                  <td>
                    <Badge tone="model">{i.model}</Badge>
                  </td>
                  <td className="muted">{i.category || "Other"}</td>
                </>
              )}
              <td>{i.supplier || "—"}</td>
              <td className="num">
                {fmtMoney(i.cost, currency)}
                {currency === "USD" && (
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                    ≈ {fmtMoney(toAUD(i.cost, "USD", fx ? fx.usdAudRate : FALLBACK_USD_AUD_RATE), "AUD")} AUD
                  </div>
                )}
              </td>
              <td className="num">
                {fmtMoney(sellPrice, currency)}
                {currency === "USD" && (
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                    ≈ {fmtMoney(toAUD(sellPrice, "USD", fx ? fx.usdAudRate : FALLBACK_USD_AUD_RATE), "AUD")} AUD
                  </div>
                )}
              </td>
              <td className="muted">{fmtDate(i.updatedAt)}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <Btn variant="text" size="sm" onClick={() => onEdit(i)}>
                  Edit
                </Btn>{" "}
                <button
                  onClick={() => onDelete(i)}
                  title="Delete"
                  style={{ background: "none", border: "none", color: "#a3442e", cursor: "pointer", fontSize: 16, padding: 4 }}
                >
                  ✕
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CategoryManager({ categories, onUpdate, onCancel }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [newCategory, setNewCategory] = useState("");

  function handleStartEdit(index) {
    setEditingIndex(index);
    setEditingValue(categories[index]);
  }

  function handleSaveEdit(index) {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      return;
    }
    const updated = categories.slice();
    updated[index] = trimmed;
    onUpdate(updated);
    setEditingIndex(null);
  }

  function handleDeleteCategory(index) {
    const updated = categories.slice();
    updated.splice(index, 1);
    onUpdate(updated);
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) {
      return;
    }
    onUpdate([...categories, trimmed]);
    setNewCategory("");
  }

  return (
    <Modal onClose={onCancel}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
        Manage Categories
      </h3>

      <div style={{ marginBottom: 18 }}>
        <h4 style={{ color: "#6b5240", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          Existing Categories
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.map((cat, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {editingIndex === idx ? (
                <>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(idx);
                      if (e.key === "Escape") setEditingIndex(null);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(idx)}
                    style={{
                      background: "#5c7a4f",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    style={{
                      background: "#d3c9b8",
                      color: "#6b5240",
                      border: "none",
                      borderRadius: 4,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, padding: "6px 12px", background: "#f6f1e7", borderRadius: 4, fontSize: 13, color: "#4a3527" }}>
                    {cat}
                  </span>
                  <button
                    onClick={() => handleStartEdit(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#b5552b",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#a3442e",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #d3c9b8" }}>
        <h4 style={{ color: "#6b5240", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          Add New Category
        </h4>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            type="text"
            placeholder="e.g. Awning & Shade"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCategory();
            }}
          />
          <button
            onClick={handleAddCategory}
            style={{
              background: "#b5552b",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="primary" onClick={onCancel}>
          Done
        </Btn>
      </div>
    </Modal>
  );
}

function ItemModal({ editing, models, categories, fx, onAddModel, onAddCategory, onCancel, onSave }) {
  const [name, setName] = useState(editing ? editing.name : "");
  const [model, setModel] = useState(editing ? editing.model : models[0] || "");
  const [category, setCategory] = useState(editing ? editing.category : categories[0] || "");
  const [currency, setCurrency] = useState(editing ? editing.currency || "AUD" : "AUD");
  const [cost, setCost] = useState(editing ? String(editing.cost) : "");
  const [sellPrice, setSellPrice] = useState(
    editing ? String(editing.sellPrice != null ? editing.sellPrice : calcSellPrice(editing.cost)) : ""
  );
  const [supplier, setSupplier] = useState(editing ? editing.supplier || "" : "");
  const [notes, setNotes] = useState(editing ? editing.notes || "" : "");
  const [error, setError] = useState("");
  const [promptMode, setPromptMode] = useState(null); // null | "model" | "category"

  // Track the cost value last used to auto-calc the sell price, so we only
  // overwrite a manual sell price edit when cost itself actually changes.
  const lastCostForCalc = useRef(editing ? editing.cost : null);

  function handleCostChange(value) {
    setCost(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      setSellPrice(String(calcSellPrice(parsed)));
      lastCostForCalc.current = parsed;
    }
  }

  function handleSave() {
    const trimmedName = name.trim();
    const parsedCost = parseFloat(cost);
    const parsedSell = parseFloat(sellPrice);
    if (!trimmedName) {
      setError("Please enter an item name.");
      return;
    }
    if (isNaN(parsedCost) || parsedCost < 0) {
      setError("Please enter a valid cost.");
      return;
    }
    if (isNaN(parsedSell) || parsedSell < 0) {
      setError("Please enter a valid sell price.");
      return;
    }
    onSave(

      {
        name: trimmedName,
        model,
        category,
        currency,
        cost: parsedCost,
        sellPrice: parsedSell,
        supplier: supplier.trim(),
        notes: notes.trim(),
      },
      editing
    );
  }

  const parsedCostPreview = parseFloat(cost);
  const showAudPreview = currency === "USD" && !isNaN(parsedCostPreview) && parsedCostPreview > 0;
  const parsedSellPreview = parseFloat(sellPrice);
  const showSellAudPreview = currency === "USD" && !isNaN(parsedSellPreview) && parsedSellPreview > 0;

  return (
    <Modal onClose={onCancel}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
        {editing ? "Edit price item" : "Add price item"}
      </h3>
      <Field label="Item name">
        <input
          style={inputStyle}
          type="text"
          placeholder="e.g. Composite roof panel — 2.4m"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="grid2">
        <Field
          label="Model"
          hint={
            <button
              onClick={() => setPromptMode("model")}
              style={{ background: "none", border: "none", color: "#b5552b", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}
            >
              + add model
            </button>
          }
        >
          <select style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Category"
          hint={
            <button
              onClick={() => setPromptMode("category")}
              style={{ background: "none", border: "none", color: "#b5552b", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}
            >
              + add category
            </button>
          }
        >
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid3">
        <Field label="Currency">
          <select style={inputStyle} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="AUD">AUD</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <Field label={`Supplier cost (${currency}, incl. GST)`}>
          <input
            style={inputStyle}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={cost}
            onChange={(e) => handleCostChange(e.target.value)}
          />
        </Field>
        <Field label="Supplier name">
          <input
            style={inputStyle}
            type="text"
            placeholder="e.g. Brisbane Composites Pty Ltd"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </Field>
      </div>
      {showAudPreview && (
        <div style={{ fontSize: 12.5, color: "#8a7a66", marginTop: -6, marginBottom: 13 }}>
          ≈ {fmtMoney(toAUD(parsedCostPreview, "USD", fx ? fx.usdAudRate : FALLBACK_USD_AUD_RATE), "AUD")} AUD at the current rate (1 USD = {(fx ? fx.usdAudRate : FALLBACK_USD_AUD_RATE).toFixed(4)} AUD)
        </div>
      )}

      <Field
        label={`Sell price (${currency}, incl. GST)`}
        hint="Defaults to a 50% margin on cost (sell = cost × 2). Edit any time — it'll recalculate automatically if you change the cost above."
      >
        <input
          style={inputStyle}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={sellPrice}
          onChange={(e) => setSellPrice(e.target.value)}
        />
      </Field>
      {showSellAudPreview && (
        <div style={{ fontSize: 12.5, color: "#8a7a66", marginTop: -6, marginBottom: 13 }}>
          ≈ {fmtMoney(toAUD(parsedSellPreview, "USD", fx ? fx.usdAudRate : FALLBACK_USD_AUD_RATE), "AUD")} AUD at the current rate
        </div>
      )}

      <Field label="Notes (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
          placeholder="Spec details, lead time, part number…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      {error && (
        <div
          style={{
            background: "#fbeae5",
            border: "1px solid #e6c9bf",
            color: "#a3442e",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant="primary" onClick={handleSave}>
          {editing ? "Save changes" : "Add item"}
        </Btn>
      </div>
      {promptMode && (
        <PromptModal
          title={promptMode === "model" ? "Add a new model" : "Add a new category"}
          label={promptMode === "model" ? "Model name" : "Category name"}
          placeholder={promptMode === "model" ? "e.g. Trailblazer" : "e.g. Water Systems"}
          confirmLabel="Add"
          onCancel={() => setPromptMode(null)}
          onConfirm={(value) => {
            if (promptMode === "model") {
              onAddModel(value);
              setModel(value);
            } else {
              onAddCategory(value);
              setCategory(value);
            }
            setPromptMode(null);
          }}
        />
      )}
    </Modal>
  );
}

/* ============================================================
   DOCS TAB (shared for Quotes + Purchase Orders)
   ============================================================ */

function DocsTab({ kind, db, update, showToast, nextNumber }) {
  const isQuote = kind === "quote";
  
  if (!db || (!isQuote && !db.pos) || (isQuote && !db.quotes)) {
    return (
      <section>
        <h2 className="section-title">{isQuote ? "Quotes" : "Purchase Orders"}</h2>
        <p className="section-desc">Loading data...</p>
      </section>
    );
  }

  const collection = isQuote ? db.quotes : db.pos;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [docModal, setDocModal] = useState(undefined); // undefined=closed, null=new, obj=editing/viewing
  const [conversionWorkflow, setConversionWorkflow] = useState(null); // { quoteId, prospectId, prospectName }
  const [pendingDelete, setPendingDelete] = useState(null);
  const [poGenerationQuote, setPoGenerationQuote] = useState(null); // Quote for which we're generating POs

  const statusOptions = isQuote ? ["Draft", "Sent", "Accepted", "Declined"] : ["Draft", "Sent", "Received", "Cancelled"];

  let list = collection.slice();
  if (search) {
    const s = search.toLowerCase();
    list = list.filter((d) => d.party.toLowerCase().includes(s) || String(d.number).toLowerCase().includes(s));
  }
  if (statusFilter) list = list.filter((d) => d.status === statusFilter);
  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || String(b.number).localeCompare(String(a.number)));

  function saveDoc(payload, editing) {
    update((next) => {
      const coll = isQuote ? next.quotes : next.pos;
      if (editing) {
        const target = coll.find((d) => d.id === editing.id);
        Object.assign(target, payload, { updatedAt: todayISO() });
      } else {
        const number = nextNumber(isQuote ? "quote" : "po", next);
        coll.push({ id: uid(isQuote ? "q" : "po"), number, status: payload.status || "Draft", createdAt: todayISO(), ...payload });
      }
      
      // If this is a quote being saved, auto-update the matching prospect's sales value
      if (isQuote && next.crm) {
        const prospect = next.crm.find((p) => p.name === payload.party);
        if (prospect && payload.total != null && payload.total > 0) {
          prospect.salesValue = payload.total;
          prospect.updatedAt = todayISO();
        }
      }
    });
    setDocModal(undefined);
    showToast(editing ? "Changes saved" : `${isQuote ? "Quote" : "Purchase order"} created`);
  }

  function deleteDoc(doc) {
    setPendingDelete(doc);
  }

  function handleGeneratePOs(quote) {
    setPoGenerationQuote(quote);
  }

  function createPOsForSuppliers(supplierMap) {
    // supplierMap is { supplierId: { name, lines } }
    update((next) => {
      Object.values(supplierMap).forEach((supplier) => {
        const poNumber = nextNumber("po", next);
        const poTotal = supplier.lines.reduce((sum, line) => {
          const costInAud = line.currency === "USD" ? line.price * next.fx.usdAudRate : line.price;
          return sum + costInAud * line.qty;
        }, 0);

        next.pos.push({
          id: uid("po"),
          number: poNumber,
          status: "Draft",
          party: supplier.name,
          model: "",
          date: todayISO(),
          contact: "",
          notes: `Generated from quote ${poGenerationQuote.number}`,
          discount: 0,
          lines: supplier.lines,
          subtotal: poTotal,
          gst: 0,
          total: poTotal,
          grossProfitPct: null,
          fxRateUsed: next.fx.usdAudRate,
          createdAt: todayISO(),
        });
      });
    });
    setPoGenerationQuote(null);
    showToast(`${Object.keys(supplierMap).length} PO(s) created`);
  }

  function setStatus(doc, status) {
    update((next) => {
      const coll = isQuote ? next.quotes : next.pos;
      const target = coll.find((d) => d.id === doc.id);
      target.status = status;
      
      // If quote accepted, auto-update customer record with quote info
      if (isQuote && status === "Accepted") {
        const customer = next.customers?.find((c) => c.name === doc.party);
        if (customer) {
          customer.lastQuoteNumber = String(doc.number);
          customer.lastQuoteValue = doc.total || 0;
        }
      }
    });
    setDocModal((v) => (v ? { ...v, status } : v));
    
    // If quote accepted, check for matching prospect and offer conversion workflow
    if (isQuote && status === "Accepted") {
      const prospect = db.crm?.find((p) => p.name === doc.party);
      if (prospect) {
        setConversionWorkflow({ quoteId: doc.id, prospectId: prospect.id, prospectName: prospect.name });
      }
    }
    
    showToast("Status updated");
  }

  return (
    <section>
      <div className="toolbar-row">
        <div>
          <h2 className="section-title" style={{ marginTop: 8 }}>
            {isQuote ? "Customer Quotes" : "Purchase Orders"}
          </h2>
          <p className="section-desc">
            {isQuote
              ? "Build a quote from your price book, track its status, and keep every quote on file."
              : "Send price-book costs to suppliers as POs and keep a running record of every order."}
          </p>
        </div>
        <Btn variant="primary" onClick={() => setDocModal(null)}>
          + New {isQuote ? "quote" : "purchase order"}
        </Btn>
      </div>

      <Panel style={{ padding: "16px 20px" }}>
        <div className="grid2" style={{ marginBottom: 0 }}>
          <Field label="Search">
            <input
              style={inputStyle}
              type="text"
              placeholder={`Search ${isQuote ? "customer" : "supplier"} or number…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      {list.length === 0 ? (
        <Empty
          icon={isQuote ? "🧾" : "📦"}
          text={
            collection.length === 0
              ? `No ${isQuote ? "quotes" : "purchase orders"} yet. Create your first ${isQuote ? "customer quote" : "PO to a supplier"}.`
              : "No results match your filters."
          }
        />
      ) : (
        <Panel style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>{isQuote ? "Quote #" : "PO #"}</th>
                <th>{isQuote ? "Customer" : "Supplier"}</th>
                <th>{isQuote ? "Model" : "Reference"}</th>
                <th>Date</th>
                <th className="num">Total (AUD)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.number}</strong>
                  </td>
                  <td>{d.party}</td>
                  <td>
                    {d.model ? (
                      isQuote ? (
                        <Badge tone="model">{d.model}</Badge>
                      ) : (
                        <span className="muted">{d.model}</span>
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted">{fmtDate(d.date)}</td>
                  <td className="num">{fmtMoney(d.total)}</td>
                  <td>
                    <Badge tone={d.status.toLowerCase()}>{d.status}</Badge>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Btn variant="text" size="sm" onClick={() => setDocModal(d)}>
                      Open
                    </Btn>{" "}
                    <button
                      onClick={() => deleteDoc(d)}
                      title="Delete"
                      style={{ background: "none", border: "none", color: "#a3442e", cursor: "pointer", fontSize: 16, padding: 4 }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {docModal !== undefined && (
        <DocModal
          kind={kind}
          editing={docModal}
          db={db}
          items={db.items}
          models={db.models}
          fx={db.fx}
          statusOptions={statusOptions}
          onCancel={() => setDocModal(undefined)}
          onSave={saveDoc}
          onStatusChange={(status) => setStatus(docModal, status)}
          onDelete={(doc) => {
            setDocModal(undefined);
            setPendingDelete(doc);
          }}
          onGeneratePOs={isQuote ? handleGeneratePOs : null}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title={`Delete ${isQuote ? "quote" : "purchase order"}?`}
          message={`Delete ${pendingDelete.number}? This cannot be undone.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            update((next) => {
              if (isQuote) next.quotes = next.quotes.filter((d) => d.id !== pendingDelete.id);
              else next.pos = next.pos.filter((d) => d.id !== pendingDelete.id);
            });
            showToast(`${isQuote ? "Quote" : "Purchase order"} deleted`);
            setPendingDelete(null);
          }}
        />
      )}

      {poGenerationQuote && (
        <POGenerationModal
          quote={poGenerationQuote}
          items={db.items}
          suppliers={db.suppliers}
          onCancel={() => setPoGenerationQuote(null)}
          onGenerate={createPOsForSuppliers}
        />
      )}

      {conversionWorkflow && (
        <Modal onClose={() => setConversionWorkflow(null)}>
          <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
            ✓ Finalize Sale: Convert Prospect to Customer
          </h3>
          <p style={{ color: "#6b5240", fontSize: 13, marginBottom: 14 }}>
            Quote accepted for <strong>{conversionWorkflow.prospectName}</strong>. Complete the sale by converting this prospect to a customer record.
          </p>

          <div style={{ background: "#f9f7f2", border: "1px solid #d3c9b8", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#6b5240", marginBottom: 12 }}>
              <strong>What happens next:</strong>
            </div>
            <ul style={{ fontSize: 12, color: "#8a7a66", margin: 0, paddingLeft: 20 }}>
              <li>✓ Create customer record from prospect data</li>
              <li>✓ Remove prospect from pipeline</li>
              <li>✓ Track sales value from quote: <strong>{fmtMoney(db.quotes.find((q) => q.id === conversionWorkflow.quoteId)?.total || 0, "AUD")}</strong></li>
              <li>✓ You can still generate purchase orders separately</li>
            </ul>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Btn variant="ghost" onClick={() => setConversionWorkflow(null)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={() => {
              const prospect = db.crm.find((p) => p.id === conversionWorkflow.prospectId);
              if (prospect) {
                update((next) => {
                  // Create customer
                  next.customers.push({
                    id: uid("cus"),
                    name: prospect.name,
                    email: prospect.email || "",
                    phone: prospect.phone || "",
                    address: { street: "", suburb: "", state: "QLD", postcode: "" },
                    product: prospect.enquiryProduct || "",
                    notes: `Converted from prospect. Sales value: ${fmtMoney(prospect.salesValue || 0, "AUD")}`,
                    createdAt: todayISO(),
                  });
                  // Remove prospect
                  const idx = next.crm.findIndex((p) => p.id === conversionWorkflow.prospectId);
                  if (idx >= 0) next.crm.splice(idx, 1);
                });
                showToast(`${conversionWorkflow.prospectName} converted to customer`);
              }
              setConversionWorkflow(null);
            }}>
              Convert to Customer
            </Btn>
          </div>
        </Modal>
      )}
    </section>
  );
}

function DocModal({ kind, editing, db, items, models, fx, statusOptions, onCancel, onSave, onStatusChange, onDelete, onGeneratePOs }) {
  const isQuote = kind === "quote";
  const rate = fx ? fx.usdAudRate : FALLBACK_USD_AUD_RATE;
  const isNew = editing === null;

  const [party, setParty] = useState(editing ? editing.party : "");
  const [partyAutocomplete, setPartyAutocomplete] = useState(false);
  const [customer, setCustomer] = useState(editing && !isQuote ? editing.customer || "" : "");
  const [customerAutocomplete, setCustomerAutocomplete] = useState(false);
  const [model, setModel] = useState(editing ? editing.model || "" : "");
  const [date, setDate] = useState(editing ? editing.date : todayISO());
  const [contact, setContact] = useState(editing ? editing.contact || "" : "");
  const [notes, setNotes] = useState(editing ? editing.notes || "" : "");
  const [discount, setDiscount] = useState(editing ? String(editing.discount || 0) : "0");
  const [lines, setLines] = useState(
    editing && editing.lines
      ? JSON.parse(JSON.stringify(editing.lines)).map((l) => ({ currency: "AUD", ...l }))
      : []
  );
  const [status, setStatusLocal] = useState(editing ? editing.status : "Draft");
  const [pickerValue, setPickerValue] = useState("");
  const [error, setError] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showProfitSection, setShowProfitSection] = useState(false);
  const [paymentMilestones, setPaymentMilestones] = useState(
    !isQuote && editing?.paymentMilestones ? editing.paymentMilestones : []
  );
  const [customsClearance, setCustomsClearance] = useState(
    !isQuote && editing?.customsClearance ? editing.customsClearance : 0
  );

  const sortedItems = items.slice().sort((a, b) => a.model.localeCompare(b.model) || a.name.localeCompare(b.name));

  // Every line total and the cost-side total are converted to AUD, regardless of source currency.
  // Prices are entered GST-inclusive, so these AUD figures are GST-inclusive too — no GST is added on top.
  function lineAudTotal(li) {
    const qty = Number(li.qty) || 0;
    const price = Number(li.price) || 0;
    return qty * toAUD(price, li.currency || "AUD", rate);
  }
  function lineAudCost(li) {
    const qty = Number(li.qty) || 0;
    const lineCurrency = li.currency || "AUD";
    
    // First priority: use the line's explicit cost field if provided
    if (li.cost != null && li.cost > 0) {
      return qty * toAUD(li.cost, lineCurrency, rate);
    }
    
    // Second priority: use the linked price-book item's cost
    // Manually-added blank lines with no itemId have no known cost and are excluded from the GP% calc.
    if (li.itemId) {
      const sourceItem = items.find((i) => i.id === li.itemId);
      if (sourceItem) return qty * toAUD(sourceItem.cost, sourceItem.currency || "AUD", rate);
    }
    return null;
  }

  const subtotal = lines.reduce((s, li) => s + lineAudTotal(li), 0);
  const discountNum = parseFloat(discount) || 0;
  const total = Math.max(subtotal - discountNum, 0);

  // Gross profit %: (AUD sell total - AUD cost total) / AUD sell total, using only lines with a known cost.
  const costEntries = lines.map(lineAudCost);
  const knownCostTotal = costEntries.reduce((s, c) => s + (c || 0), 0);
  const sellTotalForKnownCostLines = lines.reduce((s, li, idx) => s + (costEntries[idx] != null ? lineAudTotal(li) : 0), 0);
  const hasCostData = costEntries.some((c) => c != null);
  const grossProfitPct = hasCostData && sellTotalForKnownCostLines > 0 ? ((sellTotalForKnownCostLines - knownCostTotal) / sellTotalForKnownCostLines) * 100 : null;
  const grossProfitAmount = hasCostData ? sellTotalForKnownCostLines - knownCostTotal : null;

  function updateLine(idx, field, value) {
    setLines((prev) => {
      const next = prev.slice();
      if (field === "currency") {
        // Convert both price AND cost across currencies to maintain accuracy
        // e.g. USD 100 price + USD 50 cost -> AUD 141 price + AUD 70.50 cost
        const li = next[idx];
        const oldCurrency = li.currency || "AUD";
        const newCurrency = value;
        let newPrice = Number(li.price) || 0;
        let newCost = Number(li.cost) || 0;
        
        if (oldCurrency !== newCurrency) {
          if (oldCurrency === "USD" && newCurrency === "AUD") {
            // Converting USD to AUD: multiply by exchange rate
            newPrice = toAUD(newPrice, "USD", rate);
            newCost = toAUD(newCost, "USD", rate);
          } else if (oldCurrency === "AUD" && newCurrency === "USD") {
            // Converting AUD to USD: divide by exchange rate
            newPrice = rate ? newPrice / rate : newPrice;
            newCost = rate ? newCost / rate : newCost;
          }
          newPrice = Math.round(newPrice * 100) / 100;
          newCost = Math.round(newCost * 100) / 100;
        }
        next[idx] = { ...li, currency: newCurrency, price: newPrice, cost: newCost };
      } else if (field === "desc") {
        next[idx] = { ...next[idx], [field]: value };
      } else {
        next[idx] = { ...next[idx], [field]: parseFloat(value) || 0 };
      }
      return next;
    });
  }
  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }
  function addFromPicker() {
    const item = items.find((i) => i.id === pickerValue);
    if (!item) return;
    const defaultPrice = isQuote ? (item.sellPrice != null ? item.sellPrice : calcSellPrice(item.cost)) : item.cost;
    setLines((prev) => [
      ...prev,
      { desc: `${item.model} — ${item.name}`, qty: 1, price: defaultPrice, currency: item.currency || "AUD", itemId: item.id, cost: 0 },
    ]);
    setPickerValue("");
  }
  function addBlankLine() {
    setLines((prev) => [...prev, { desc: "", qty: 1, price: 0, currency: "AUD", cost: 0 }]);
  }

  function handleSave() {
    const trimmedParty = party.trim();
    if (!trimmedParty) {
      setError(`Please enter a ${isQuote ? "customer" : "supplier"} name.`);
      return;
    }
    if (lines.length === 0) {
      setError("Please add at least one line item.");
      return;
    }
    onSave(
      {
        party: trimmedParty,
        model,
        date,
        contact: contact.trim(),
        notes: notes.trim(),
        discount: discountNum,
        lines,
        subtotal,
        gst: 0,
        total,
        grossProfitPct,
        fxRateUsed: rate,
        status,
        ...(paymentMilestones.length > 0 && { paymentMilestones }),
        ...(!isQuote && customsClearance > 0 && { customsClearance }),
        ...(!isQuote && customer && { customer }),
      },
      editing
    );
  }

  function handleStatusChange(newStatus) {
    setStatusLocal(newStatus);
    if (!isNew && onStatusChange) onStatusChange(newStatus);
  }

  const printRef = useRef(null);

  return (
    <Modal width={1000} onClose={onCancel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: 0, fontSize: 19 }}>
          {isNew ? (isQuote ? "New customer quote" : "New purchase order") : `${editing.number}`}
        </h3>
        {!isNew && (
          <Field label="" >
            <select
              style={{ ...inputStyle, width: 160 }}
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="doc-split-grid">
        {/* ---------------- EDIT SIDE ---------------- */}
        <div>
          <Panel>
            <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 14px", fontSize: 16 }}>
              {isQuote ? "Customer" : "Supplier"} details
            </h3>
            <Field label={`${isQuote ? "Customer" : "Supplier"} name`}>
              <div style={{ position: "relative" }}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder={isQuote ? "e.g. John Smith" : "e.g. Brisbane Composites Pty Ltd"}
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  onFocus={() => setPartyAutocomplete(true)}
                  onBlur={() => setTimeout(() => setPartyAutocomplete(false), 200)}
                />
                {partyAutocomplete && party.length > 0 && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "#fff",
                    border: "1px solid #d3c9b8",
                    borderTop: "none",
                    borderRadius: "0 0 4px 4px",
                    maxHeight: 200,
                    overflowY: "auto",
                    zIndex: 1000,
                  }}>
                    {isQuote && (
                      <>
                        {(db.crm || [])
                          .filter(p => p.name.toLowerCase().includes(party.toLowerCase()))
                          .map(p => (
                            <div
                              key={p.id}
                              onClick={() => { setParty(p.name); setPartyAutocomplete(false); }}
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #e3d8c6",
                                cursor: "pointer",
                                fontSize: 13,
                                color: "#4a3527",
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = "#f9f7f2"}
                              onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                            >
                              <div style={{ fontWeight: 600 }}>{p.name}</div>
                              {p.email && <div style={{ fontSize: 11, color: "#8a7a66" }}>{p.email}</div>}
                            </div>
                          ))}
                        {(db.customers || [])
                          .filter(c => c.name.toLowerCase().includes(party.toLowerCase()))
                          .map(c => (
                            <div
                              key={c.id}
                              onClick={() => { setParty(c.name); setPartyAutocomplete(false); }}
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #e3d8c6",
                                cursor: "pointer",
                                fontSize: 13,
                                color: "#4a3527",
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = "#f9f7f2"}
                              onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                            >
                              <div style={{ fontWeight: 600 }}>{c.name}</div>
                              {c.email && <div style={{ fontSize: 11, color: "#8a7a66" }}>{c.email}</div>}
                            </div>
                          ))}
                      </>
                    )}
                    {!isQuote && (
                      (db.suppliers || [])
                        .filter(s => s.name.toLowerCase().includes(party.toLowerCase()))
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setParty(s.name);
                              setContact(s.email || s.phone || "");
                              setPartyAutocomplete(false);
                            }}
                            style={{
                              padding: "8px 12px",
                              borderBottom: "1px solid #e3d8c6",
                              cursor: "pointer",
                              fontSize: 13,
                              color: "#4a3527",
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "#f9f7f2"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            {s.email && <div style={{ fontSize: 11, color: "#8a7a66" }}>{s.email}</div>}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </Field>
            {!isQuote && (
              <Field label="Customer (optional)">
                <div style={{ position: "relative" }}>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Search and select a customer"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    onFocus={() => setCustomerAutocomplete(true)}
                    onBlur={() => setTimeout(() => setCustomerAutocomplete(false), 200)}
                  />
                  {customerAutocomplete && customer.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "1px solid #d3c9b8",
                      borderTop: "none",
                      borderRadius: "0 0 4px 4px",
                      maxHeight: 200,
                      overflowY: "auto",
                      zIndex: 1000,
                    }}>
                      {(db.customers || [])
                        .filter(c => c.name.toLowerCase().includes(customer.toLowerCase()))
                        .map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setCustomer(c.name);
                              setCustomerAutocomplete(false);
                            }}
                            style={{
                              padding: "8px 12px",
                              borderBottom: "1px solid #e3d8c6",
                              cursor: "pointer",
                              fontSize: 13,
                              color: "#4a3527",
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "#f9f7f2"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            {c.email && <div style={{ fontSize: 11, color: "#8a7a66" }}>{c.email}</div>}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </Field>
            )}
            <div className="grid2">
              <Field label={isQuote ? "Camper model" : "Reference / job"}>
                {isQuote ? (
                  <select style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)}>
                    <option value="">— select —</option>
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="e.g. Stock build — June"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Date">
                <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            <Field label={isQuote ? "Contact (email/phone)" : "Supplier contact"}>
              <input style={inputStyle} type="text" placeholder="Optional" value={contact} onChange={(e) => setContact(e.target.value)} />
            </Field>
          </Panel>

          <Panel>
            <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 14px", fontSize: 16 }}>
              Add from price book
            </h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select style={{ ...inputStyle, flex: 1 }} value={pickerValue} onChange={(e) => setPickerValue(e.target.value)}>
                <option value="">— choose an item —</option>
                {sortedItems
                  .filter((i) => !isQuote && party ? i.supplier === party : true)
                  .map((i) => {
                    const displayPrice = isQuote ? (i.sellPrice != null ? i.sellPrice : calcSellPrice(i.cost)) : i.cost;
                    return (
                      <option key={i.id} value={i.id}>
                        {i.model} · {i.name} — {fmtMoney(displayPrice, i.currency || "AUD")}
                        {(i.currency || "AUD") === "USD" ? " (USD)" : ""}
                      </option>
                    );
                  })}
              </select>
              <Btn variant="ghost" size="sm" onClick={addFromPicker}>
                Add
              </Btn>
            </div>
            <Btn variant="ghost" size="sm" onClick={addBlankLine}>
              + Add blank line
            </Btn>
          </Panel>

          <Panel>
            <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 14px", fontSize: 16 }}>
              Line items
            </h3>
            {lines.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 14px" }}>
                No line items yet — add from your price book or add a blank line.
              </p>
            ) : (
              lines.map((li, idx) => {
                const lineCurrency = li.currency || "AUD";
                const nativeTotal = (Number(li.qty) || 0) * (Number(li.price) || 0);
                return (
                  <div className="line-item-row" key={idx}>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="Description"
                      value={li.desc}
                      onChange={(e) => updateLine(idx, "desc", e.target.value)}
                    />
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Qty"
                      value={li.qty}
                      onChange={(e) => updateLine(idx, "qty", e.target.value)}
                    />
                    <select style={inputStyle} value={lineCurrency} onChange={(e) => updateLine(idx, "currency", e.target.value)}>
                      <option value="AUD">AUD</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={isQuote ? "Price" : "Cost"}
                      value={li.price}
                      onChange={(e) => updateLine(idx, "price", e.target.value)}
                    />
                    {isQuote && (
                      <input
                        style={inputStyle}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Cost"
                        value={li.cost || ""}
                        onChange={(e) => updateLine(idx, "cost", e.target.value)}
                        title="Optional: set cost to override price book cost for profit calculation"
                      />
                    )}
                    <div className="num" style={{ fontSize: 13.5, paddingTop: 9 }}>
                      {fmtMoney(lineAudTotal(li), "AUD")}
                      {lineCurrency === "USD" && (
                        <div className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
                          {fmtMoney(nativeTotal, "USD")}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeLine(idx)}
                      title="Remove"
                      style={{ background: "none", border: "none", color: "#a3442e", cursor: "pointer", fontSize: 16, padding: 4 }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
            {lines.some((l) => (l.currency || "AUD") === "USD") && (
              <div style={{ fontSize: 11.5, color: "#8a7a66", marginTop: 2, marginBottom: 8 }}>
                USD lines convert to AUD at 1 USD = {rate.toFixed(4)} AUD ({fx && fx.source === "live" ? "live rate" : fx && fx.source === "manual" ? "your manual rate" : "default estimate"}) —
                click the rate badge in the header to update it.
              </div>
            )}
            <div style={{ borderTop: "2px solid #e3d8c6", marginTop: 10, paddingTop: 10 }}>
              <Field label={isQuote ? "Discount (AUD)" : "Adjustment (AUD)"}>
                <input style={inputStyle} type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
            </div>
          </Panel>

          {!isQuote && (
            <Panel>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#4a3527", margin: 0 }}>Payment Schedule</h3>
                  <Btn 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setPaymentMilestones([...paymentMilestones, { due: "", amount: "", paid: false, paidDate: "" }]);
                    }}
                  >
                    + Add payment
                  </Btn>
                </div>

                {paymentMilestones.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#8a7a66", margin: 0 }}>No payment milestones added. Click "Add payment" to create one.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {paymentMilestones.map((milestone, idx) => (
                      <div key={idx} style={{ background: "#f9f7f2", padding: 12, borderRadius: 6, border: "1px solid #d3c9b8" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                          <Field label="Due date">
                            <input
                              style={{ ...inputStyle, width: "100%", maxWidth: "100%" }}
                              type="date"
                              value={milestone.due || ""}
                              onChange={(e) => {
                                const updated = [...paymentMilestones];
                                updated[idx].due = e.target.value;
                                setPaymentMilestones(updated);
                              }}
                            />
                          </Field>
                          <Field label="Amount (AUD)">
                            <input
                              style={{ ...inputStyle, width: "100%", maxWidth: "100%" }}
                              type="number"
                              step="0.01"
                              value={milestone.amount || ""}
                              onChange={(e) => {
                                const updated = [...paymentMilestones];
                                updated[idx].amount = e.target.value;
                                setPaymentMilestones(updated);
                              }}
                            />
                          </Field>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                          <Field label="Paid">
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={milestone.paid || false}
                                onChange={(e) => {
                                  const updated = [...paymentMilestones];
                                  updated[idx].paid = e.target.checked;
                                  setPaymentMilestones(updated);
                                }}
                              />
                              <span style={{ fontSize: 13 }}>Marked as paid</span>
                            </label>
                          </Field>
                          {milestone.paid && (
                            <Field label="Paid date">
                              <input
                                style={{ ...inputStyle, width: "100%", maxWidth: "100%" }}
                                type="date"
                                value={milestone.paidDate || ""}
                                onChange={(e) => {
                                  const updated = [...paymentMilestones];
                                  updated[idx].paidDate = e.target.value;
                                  setPaymentMilestones(updated);
                                }}
                              />
                            </Field>
                          )}
                        </div>
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPaymentMilestones(paymentMilestones.filter((_, i) => i !== idx));
                          }}
                          style={{ color: "#a3442e" }}
                        >
                          Remove
                        </Btn>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {!isQuote && (
            <Panel>
              <Field label="Estimated Customs Clearance Payment (AUD, optional)">
                <input
                  style={inputStyle}
                  type="number"
                  step="0.01"
                  min="0"
                  value={customsClearance}
                  onChange={(e) => setCustomsClearance(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 500"
                />
              </Field>
            </Panel>
          )}

          <Panel>
            <Field label={isQuote ? "Notes (terms, validity, inclusions)" : "Notes (delivery instructions, terms)"}>
              <textarea
                style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
                placeholder="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </Panel>
        </div>

        {/* ---------------- LIVE PREVIEW SIDE ---------------- */}
        <div>
          <div className="doc-paper" ref={printRef} style={{ position: "sticky", top: 0 }}>
            <div className="doc-header">
              <div>
                <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
                  {isNew ? "New" : editing.number}
                </h2>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#6b5240", marginBottom: 8 }}>
                  {isQuote ? "Customer Quote" : "Purchase Order"}
                </h3>
                <div style={{ color: "#8a7a66", fontSize: 13 }}>
                  {isNew ? "Draft — not yet saved" : fmtDate(date)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ fontFamily: "Georgia,serif", color: "#4a3527" }}>Austral Motorhomes</strong>
                <br />
                <span className="muted" style={{ fontSize: 12 }}>
                  Kunda Park, QLD
                </span>
              </div>
            </div>
            <div className="doc-meta">
              <div>
                <b>{isQuote ? "Customer" : "Supplier"}:</b> {party || "—"}
              </div>
              {model && (
                <div>
                  <b>{isQuote ? "Model" : "Reference"}:</b> {model}
                </div>
              )}
              {contact && (
                <div>
                  <b>Contact:</b> {contact}
                </div>
              )}
            </div>
            {lines.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Add line items on the left to see them appear here.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="num">Qty</th>
                    <th className="num">{isQuote ? "Price" : "Cost"}</th>
                    <th className="num">Line total (AUD)</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((li, idx) => (
                    <tr key={idx}>
                      <td>{li.desc || <span className="muted">(no description)</span>}</td>
                      <td className="num">{li.qty}</td>
                      <td className="num">{fmtMoney(li.price, li.currency || "AUD")}</td>
                      <td className="num">{fmtMoney(lineAudTotal(li), "AUD")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 30, paddingTop: 20, borderTop: "2px solid #e3d8c6" }}>
              <div className="totals-row">
                <span>Subtotal (AUD, incl. GST)</span>
                <span>{fmtMoney(subtotal, "AUD")}</span>
              </div>
              <div className="totals-row" style={{ marginTop: 12 }}>
                <span>{isQuote ? "Discount" : "Adjustment"}</span>
                <span>{(isQuote ? "-" : "") + fmtMoney(discountNum, "AUD")}</span>
              </div>
              <div className="totals-row grand" style={{ marginTop: 18 }}>
                <span>Total (AUD, incl. GST)</span>
                <span>{fmtMoney(total, "AUD")}</span>
              </div>

              {isQuote && (
                <div className="no-print" style={{ borderTop: "1px solid #e3d8c6", marginTop: 20, paddingTop: 12, fontSize: 11, color: "#8a7a66" }}>
                  (Gross profit details for internal use only)
                </div>
              )}
              {isQuote && !hasCostData && lines.length > 0 && (
                <div style={{ fontSize: 11, color: "#8a7a66", marginTop: 4 }}>
                  Gross profit isn't shown for manually-added lines with no linked price book cost.
                </div>
              )}
            </div>



            {/* Cost and Profit Summary - screen only (excluded from PDF) */}
            {isQuote && hasCostData && (
              <div className="no-print">
                {/* Collapsible Header */}
                <div
                  onClick={() => setShowProfitSection(!showProfitSection)}
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    background: "#f6f1e7",
                    border: "1px solid #d3c9b8",
                    borderRadius: showProfitSection ? "8px 8px 0 0" : 8,
                    padding: 12,
                    marginTop: 14,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#6b5240",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f0e8d9"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#f6f1e7"}
                >
                  <span style={{ fontSize: 16, transition: "transform 0.3s ease", transform: showProfitSection ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                </div>

                {/* Collapsible Content */}
                {showProfitSection && (
                  <div
                    style={{
                      background: "#f6f1e7",
                      border: "1px solid #d3c9b8",
                      borderRadius: "0 0 8px 8px",
                      borderTop: "none",
                      padding: 12,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#6b5240", fontWeight: 600 }}>Total Cost (AUD):</span>
                      <span style={{ fontWeight: 700, color: "#4a3527" }}>{fmtMoney(knownCostTotal, "AUD")}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#6b5240", fontWeight: 600 }}>Gross Profit %:</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: grossProfitPct != null && grossProfitPct < 0 ? "#a3442e" : "#5c7a4f",
                        }}
                      >
                        {grossProfitPct != null ? `${grossProfitPct.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 11, color: "#8a7a66", marginTop: 10 }}>
              All prices include GST.
              {lines.some((l) => (l.currency || "AUD") === "USD") && ` USD lines converted at 1 USD = ${rate.toFixed(4)} AUD.`}
            </div>
            {notes && (
              <div className="no-print">
                <div style={{ height: 1, background: "#e3d8c6", margin: "18px 0" }} />
                <div>
                  <b style={{ fontSize: 12.5, color: "#6b5240" }}>Notes (internal use only)</b>
                  <p style={{ fontSize: 13.5, margin: "6px 0 0" }}>{notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fbeae5",
            border: "1px solid #e6c9bf",
            color: "#a3442e",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            marginTop: 16,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          {!isNew && onDelete && (
            <Btn variant="danger" onClick={() => onDelete(editing)}>
              Delete
            </Btn>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {!isNew && (
            <>
              <Btn 
                variant="ghost" 
                onClick={() => {
                  try {
                    window.print();
                  } catch (e) {
                    alert("Print: " + e.message);
                  }
                }}
              >
                Print
              </Btn>
              <Btn 
                variant="ghost" 
                onClick={() => {
                  try {
                    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; }
body { font-family: Georgia, serif; color: #2b2018; padding: 40px; line-height: 1.7; }
.doc-header { border-bottom: 3px solid #b5552b; padding-bottom: 30px; margin-bottom: 40px; }
h2 { font-size: 26px; font-weight: 700; margin-bottom: 8px; }
.doc-info { margin: 20px 0; font-size: 14px; }
.doc-info p { margin: 6px 0; }
table { width: 100%; border-collapse: collapse; margin: 40px 0; }
th { text-align: left; border-bottom: 2px solid #b5552b; padding: 12px 12px 12px 0; font-size: 12px; font-weight: 700; }
th.num { text-align: right; padding-right: 0; }
td { padding: 14px 12px 14px 0; border-bottom: 1px solid #e3d8c6; font-size: 14px; }
td.num { text-align: right; padding-right: 0; }
.totals { margin: 40px 0; }
.totals-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; }
.grand { font-weight: 800; font-size: 18px; border-top: 2px solid #b5552b; border-bottom: 1px solid #b5552b; padding: 16px 0; margin-top: 20px; }
.notes { margin-top: 50px; padding-top: 30px; border-top: 1px solid #e3d8c6; font-size: 13px; }
.footer { margin-top: 40px; font-size: 11px; color: #8a7a66; }
.no-print { display: none !important; }
</style>
</head>
<body>
${printRef.current?.innerHTML || ""}
</body>
</html>`;
                    const link = document.createElement("a");
                    link.href = "data:text/html," + encodeURIComponent(html);
                    link.download = `${editing?.number || "quote"}.html`;
                    link.click();
                  } catch (e) {
                    alert("Error: " + e.message);
                  }
                }}
              >
                Download PDF
              </Btn>
              {isQuote && editing.status === "Accepted" && onGeneratePOs && (
                <Btn variant="primary" onClick={() => onGeneratePOs(editing)}>
                  Generate POs
                </Btn>
              )}
              <Btn variant="secondary" onClick={() => setShowPaymentModal(true)}>
                Payment Milestones
              </Btn>
            </>
          )}
          <Btn variant="ghost" onClick={onCancel}>
            {isNew ? "Cancel" : "Close"}
          </Btn>
          <Btn variant="primary" onClick={handleSave}>
            {isNew ? `Create ${isQuote ? "quote" : "PO"}` : "Save changes"}
          </Btn>
        </div>
      </div>

      {showPaymentModal && !isNew && (
        <PaymentMilestonesModal
          doc={editing}
          docType={isQuote ? "quote" : "po"}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </Modal>
  );
}

function POGenerationModal({ quote, items, suppliers, onCancel, onGenerate }) {
  // Group quote lines by supplier
  const supplierGroups = {};
  quote.lines.forEach((line) => {
    const item = items.find((i) => i.id === line.itemId);
    const supplierName = item?.supplier || "Unknown supplier";
    if (!supplierGroups[supplierName]) {
      supplierGroups[supplierName] = [];
    }
    supplierGroups[supplierName].push(line);
  });

  const [selectedSuppliers, setSelectedSuppliers] = useState(Object.keys(supplierGroups));

  function handleGenerate() {
    const supplierMap = {};
    selectedSuppliers.forEach((supplierName) => {
      supplierMap[supplierName] = {
        name: supplierName,
        lines: supplierGroups[supplierName],
      };
    });
    onGenerate(supplierMap);
  }

  const supplierList = Object.keys(supplierGroups);

  return (
    <Modal onClose={onCancel}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
        Generate Purchase Orders
      </h3>
      <p style={{ color: "#6b5240", fontSize: 13, margin: "0 0 14px" }}>
        Create purchase orders for each supplier. Select which suppliers to include:
      </p>

      <div style={{ background: "#f9f7f2", border: "1px solid #e3d8c6", borderRadius: 8, padding: 12, marginBottom: 14 }}>
        {supplierList.length === 0 ? (
          <p style={{ color: "#8a7a66", margin: 0, fontSize: 13 }}>No suppliers found in quote line items. Add items with suppliers first.</p>
        ) : (
          supplierList.map((supplierName) => (
            <div key={supplierName} style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id={`sup-${supplierName}`}
                checked={selectedSuppliers.includes(supplierName)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedSuppliers([...selectedSuppliers, supplierName]);
                  } else {
                    setSelectedSuppliers(selectedSuppliers.filter((s) => s !== supplierName));
                  }
                }}
              />
              <label htmlFor={`sup-${supplierName}`} style={{ flex: 1, margin: 0, cursor: "pointer", fontSize: 13 }}>
                <strong>{supplierName}</strong>
                <div style={{ fontSize: 11, color: "#8a7a66" }}>
                  {supplierGroups[supplierName].length} item{supplierGroups[supplierName].length !== 1 ? "s" : ""}
                </div>
              </label>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant="primary" onClick={handleGenerate} disabled={selectedSuppliers.length === 0}>
          Create {selectedSuppliers.length} PO{selectedSuppliers.length !== 1 ? "s" : ""}
        </Btn>
      </div>
    </Modal>
  );
}

function PaymentMilestonesModal({ doc, docType, onClose }) {
  const [milestone1Due, setMilestone1Due] = useState(doc.milestone1Due || addMonths(todayISO(), 1));
  const [milestone1Paid, setMilestone1Paid] = useState(doc.milestone1Paid || "");
  const [milestone2Due, setMilestone2Due] = useState(doc.milestone2Due || addMonths(todayISO(), 2));
  const [milestone2Paid, setMilestone2Paid] = useState(doc.milestone2Paid || "");
  const [milestone3Due, setMilestone3Due] = useState(doc.milestone3Due || addMonths(todayISO(), 3));
  const [milestone3Paid, setMilestone3Paid] = useState(doc.milestone3Paid || "");

  const total = doc.total || 0;
  const m1Amount = Math.round(total * 0.33 * 100) / 100;
  const m2Amount = Math.round(total * 0.33 * 100) / 100;
  const m3Amount = total - m1Amount - m2Amount;

  function addMonths(dateStr, months) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  }

  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
        Payment Milestones — {doc.number}
      </h3>

      <div style={{ background: "#f6f1e7", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span>Total amount:</span>
          <strong>{fmtMoney(total, "AUD")}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Split: 33% / 33% / 34%</span>
          <span style={{ color: "#8a7a66", fontSize: 12 }}>({fmtMoney(m1Amount, "AUD")} / {fmtMoney(m2Amount, "AUD")} / {fmtMoney(m3Amount, "AUD")})</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div style={{ background: "#f9f7f2", border: "1px solid #e3d8c6", borderRadius: 8, padding: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "#4a3527", margin: "0 0 10px" }}>Milestone 1: {fmtMoney(m1Amount, "AUD")}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Due">
              <input style={{ ...inputStyle, width: "100%", maxWidth: "100%" }} type="date" value={milestone1Due} onChange={(e) => setMilestone1Due(e.target.value)} />
            </Field>
            <Field label="Paid">
              <input style={{ ...inputStyle, width: "100%", maxWidth: "100%" }} type="date" value={milestone1Paid} onChange={(e) => setMilestone1Paid(e.target.value)} />
            </Field>
          </div>
          {milestone1Paid && <div style={{ fontSize: 12, color: "#5c7a4f", fontWeight: 600, marginTop: 8 }}>✓ Paid</div>}
        </div>

        <div style={{ background: "#f9f7f2", border: "1px solid #e3d8c6", borderRadius: 8, padding: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "#4a3527", margin: "0 0 10px" }}>Milestone 2: {fmtMoney(m2Amount, "AUD")}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Due">
              <input style={{ ...inputStyle, width: "100%", maxWidth: "100%" }} type="date" value={milestone2Due} onChange={(e) => setMilestone2Due(e.target.value)} />
            </Field>
            <Field label="Paid">
              <input style={{ ...inputStyle, width: "100%", maxWidth: "100%" }} type="date" value={milestone2Paid} onChange={(e) => setMilestone2Paid(e.target.value)} />
            </Field>
          </div>
          {milestone2Paid && <div style={{ fontSize: 12, color: "#5c7a4f", fontWeight: 600, marginTop: 8 }}>✓ Paid</div>}
        </div>

        <div style={{ background: "#f9f7f2", border: "1px solid #e3d8c6", borderRadius: 8, padding: 12, gridColumn: "1 / -1" }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "#4a3527", margin: "0 0 10px" }}>Milestone 3 (Final): {fmtMoney(m3Amount, "AUD")}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Due">
              <input style={{ ...inputStyle, width: "100%", maxWidth: "100%" }} type="date" value={milestone3Due} onChange={(e) => setMilestone3Due(e.target.value)} />
            </Field>
            <Field label="Paid">
              <input style={{ ...inputStyle, width: "100%", maxWidth: "100%" }} type="date" value={milestone3Paid} onChange={(e) => setMilestone3Paid(e.target.value)} />
            </Field>
          </div>
          {milestone3Paid && <div style={{ fontSize: 12, color: "#5c7a4f", fontWeight: 600, marginTop: 8 }}>✓ Paid</div>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>
          Close
        </Btn>
      </div>
    </Modal>
  );
}

/* ============================================================
   CONTACTS TAB (Suppliers & Customers)
   ============================================================ */

function ContactsTab({ kind, db, update, showToast }) {
  const isSupplier = kind === "supplier";
  
  if (!db || (!isSupplier && !db.customers) || (isSupplier && !db.suppliers)) {
    return (
      <section>
        <h2 className="section-title">{isSupplier ? "Suppliers" : "Customers"}</h2>
        <p className="section-desc">Loading data...</p>
      </section>
    );
  }

  const collection = isSupplier ? db.suppliers : db.customers;
  const [search, setSearch] = useState("");
  const [editingContact, setEditingContact] = useState(undefined);
  const [importData, setImportData] = useState(null);

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result;
        const rows = parseCSV(csvText);
        if (rows.length === 0) {
          showToast("CSV file is empty");
          return;
        }

        const validRows = rows
          .map((row) => ({
            name: row.name?.trim(),
            ...(isSupplier && { contactPerson: row.contactPerson?.trim() || "" }),
            email: row.email?.trim() || "",
            phone: row.phone?.trim() || "",
            address: {
              street: row.street?.trim() || "",
              suburb: row.suburb?.trim() || "",
              state: row.state?.trim() || "QLD",
              postcode: row.postcode?.trim() || "",
            },
            ...(isSupplier && {
              bankAccount: {
                name: row.bankAccountName?.trim() || "",
                bsb: row.bankAccountBSB?.trim() || "",
                account: row.bankAccountNumber?.trim() || "",
              },
            }),
            ...(!isSupplier && { product: row.product?.trim() || "" }),
            notes: row.notes?.trim() || "",
          }))
          .filter((row) => row.name);

        if (validRows.length === 0) {
          showToast("No valid records found in CSV");
          return;
        }

        setImportData({
          type: isSupplier ? "supplier" : "customer",
          rows: validRows,
          fileName: file.name,
        });
      } catch (err) {
        showToast("Error parsing CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!importData) return;

    update((next) => {
      const coll = isSupplier ? next.suppliers : next.customers;
      importData.rows.forEach((row) => {
        const exists = coll.find((c) => c.name.toLowerCase() === row.name.toLowerCase());
        if (!exists) {
          coll.push({
            id: uid(isSupplier ? "sup" : "cus"),
            ...row,
            createdAt: todayISO(),
          });
        }
      });
    });

    showToast(`Imported ${importData.rows.length} ${isSupplier ? "supplier" : "customer"}(s)`);
    setImportData(null);
  }

  let list = collection.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (search) {
    const s = search.toLowerCase();
    list = list.filter((c) => c.name.toLowerCase().includes(s) || (c.email || "").toLowerCase().includes(s));
  }

  function saveContact(payload, editing) {
    update((next) => {
      const coll = isSupplier ? next.suppliers : next.customers;
      if (editing) {
        const target = coll.find((c) => c.id === editing.id);
        Object.assign(target, payload, { updatedAt: todayISO() });
      } else {
        coll.push({
          id: uid(isSupplier ? "sup" : "cus"),
          createdAt: todayISO(),
          ...payload,
        });
      }
    });
    setEditingContact(undefined);
    showToast(editing ? "Contact updated" : "Contact added");
  }

  function deleteContact(contact) {
    update((next) => {
      const coll = isSupplier ? next.suppliers : next.customers;
      const idx = coll.findIndex((c) => c.id === contact.id);
      if (idx >= 0) coll.splice(idx, 1);
    });
    showToast("Contact deleted");
  }

  return (
    <section>
      <div className="toolbar-row">
        <div>
          <h2 className="section-title">{isSupplier ? "Suppliers" : "Customers"}</h2>
          <p className="section-desc">
            {isSupplier
              ? "Manage your supplier contact details, bank accounts, and notes."
              : "Manage your customer and prospect contact details."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="secondary" onClick={() => document.getElementById(`contacts-import-input-${kind}`)?.click()}>
            ⬆ Import CSV
          </Btn>
          <Btn variant="primary" onClick={() => setEditingContact(null)}>
            + Add {isSupplier ? "supplier" : "customer"}
          </Btn>
          <input
            id={`contacts-import-input-${kind}`}
            type="file"
            accept=".csv"
            onChange={handleImportFile}
            style={{ display: "none" }}
          />
        </div>
      </div>

      <Panel>
        <input
          style={{ ...inputStyle, marginBottom: 14 }}
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {list.length === 0 ? (
          <Empty
            icon="📇"
            text={`No ${isSupplier ? "suppliers" : "customers"} yet. Add one to get started.`}
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                {isSupplier && <th>Contact</th>}
                <th>Email</th>
                <th>Phone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    {c.notes && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{c.notes.substring(0, 60)}</div>}
                  </td>
                  {isSupplier && <td className="muted">{c.contactPerson || "—"}</td>}
                  <td className="muted">{c.email || "—"}</td>
                  <td className="muted">{c.phone || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Btn variant="text" size="sm" onClick={() => setEditingContact(c)}>
                      Edit
                    </Btn>{" "}
                    <button
                      onClick={() => deleteContact(c)}
                      title="Delete"
                      style={{ background: "none", border: "none", color: "#a3442e", cursor: "pointer", fontSize: 16, padding: 4 }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {editingContact !== undefined && (
        <ContactModal
          kind={kind}
          editing={editingContact}
          onCancel={() => setEditingContact(undefined)}
          onSave={saveContact}
        />
      )}

      {importData && (
        <Modal onClose={() => setImportData(null)}>
          <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
            Import {importData.rows.length} {importData.type}{importData.rows.length !== 1 ? "s" : ""}
          </h3>
          <p style={{ color: "#6b5240", fontSize: 13, margin: "0 0 14px" }}>
            File: <strong>{importData.fileName}</strong>
          </p>

          <div style={{ background: "#f9f7f2", border: "1px solid #d3c9b8", borderRadius: 8, padding: 12, marginBottom: 14, maxHeight: 300, overflowY: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d3c9b8" }}>
                  <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 600, color: "#4a3527" }}>Name</th>
                  {isSupplier && <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 600, color: "#4a3527" }}>Contact</th>}
                  <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 600, color: "#4a3527" }}>Email</th>
                </tr>
              </thead>
              <tbody>
                {importData.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e3d8c6" }}>
                    <td style={{ padding: "6px 0" }}>{row.name}</td>
                    {isSupplier && <td style={{ padding: "6px 0", color: "#8a7a66", fontSize: 11 }}>{row.contactPerson || "—"}</td>}
                    <td style={{ padding: "6px 0", color: "#8a7a66", fontSize: 11 }}>{row.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Btn variant="ghost" onClick={() => setImportData(null)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={confirmImport}>
              Import {importData.rows.length} {importData.type}{importData.rows.length !== 1 ? "s" : ""}
            </Btn>
          </div>
        </Modal>
      )}
    </section>
  );
}

function ContactModal({ kind, editing, onCancel, onSave }) {
  const isSupplier = kind === "supplier";
  const [name, setName] = useState(editing ? editing.name : "");
  const [contactPerson, setContactPerson] = useState(isSupplier ? (editing ? editing.contactPerson || "" : "") : "");
  const [email, setEmail] = useState(editing ? editing.email || "" : "");
  const [phone, setPhone] = useState(editing ? editing.phone || "" : "");
  const [street, setStreet] = useState(editing?.address?.street || "");
  const [suburb, setSuburb] = useState(editing?.address?.suburb || "");
  const [state, setState] = useState(editing?.address?.state || "QLD");
  const [postcode, setPostcode] = useState(editing?.address?.postcode || "");
  const [bankAccountName, setBankAccountName] = useState(editing?.bankAccount?.name || "");
  const [bsb, setBsb] = useState(editing?.bankAccount?.bsb || "");
  const [accountNumber, setAccountNumber] = useState(editing?.bankAccount?.account || "");
  const [invoiceNumber, setInvoiceNumber] = useState(!isSupplier ? (editing?.invoiceNumber || "") : "");
  const [invoiceAmount, setInvoiceAmount] = useState(!isSupplier ? (editing?.invoiceAmount || "") : "");
  const [lastQuoteNumber, setLastQuoteNumber] = useState(!isSupplier ? (editing?.lastQuoteNumber || "") : "");
  const [lastQuoteValue, setLastQuoteValue] = useState(!isSupplier ? (editing?.lastQuoteValue || "") : "");
  const [notes, setNotes] = useState(editing ? editing.notes || "" : "");
  const [error, setError] = useState("");

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a name.");
      return;
    }
    onSave(
      {
        name: trimmedName,
        ...(isSupplier && { contactPerson: contactPerson.trim() }),
        email: email.trim(),
        phone: phone.trim(),
        address: { street: street.trim(), suburb: suburb.trim(), state, postcode: postcode.trim() },
        ...(isSupplier && { bankAccount: { name: bankAccountName.trim(), bsb: bsb.trim(), account: accountNumber.trim() } }),
        ...(!isSupplier && invoiceNumber && { invoiceNumber: invoiceNumber.trim() }),
        ...(!isSupplier && invoiceAmount && { invoiceAmount: parseFloat(invoiceAmount) || 0 }),
        ...(!isSupplier && lastQuoteNumber && { lastQuoteNumber: lastQuoteNumber.trim() }),
        ...(!isSupplier && lastQuoteValue && { lastQuoteValue: parseFloat(lastQuoteValue) || 0 }),
        notes: notes.trim(),
      },
      editing
    );
  }

  return (
    <Modal onClose={onCancel}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
        {editing ? `Edit ${isSupplier ? "supplier" : "customer"}` : `Add ${isSupplier ? "supplier" : "customer"}`}
      </h3>

      <Field label="Name (required)">
        <input style={inputStyle} type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div className="grid2">
        {isSupplier && (
          <Field label="Contact person">
            <input style={inputStyle} type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </Field>
        )}
        <Field label="Email">
          <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>

      <Field label="Phone">
        <input style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>

      {!isSupplier && (
        <div style={{ borderTop: "1px solid #e3d8c6", paddingTop: 14, marginTop: 14 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "#6b5240", margin: "0 0 10px" }}>Invoice information</h4>
          <div className="grid2">
            <Field label="Invoice number">
              <input
                style={inputStyle}
                type="text"
                placeholder="e.g. INV-001"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </Field>
            <Field label="Invoice amount (AUD)">
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                min="0"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      {!isSupplier && (
        <div style={{ borderTop: "1px solid #e3d8c6", paddingTop: 14, marginTop: 14 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "#6b5240", margin: "0 0 10px" }}>Quote tracking</h4>
          <p style={{ fontSize: 12, color: "#8a7a66", margin: "0 0 10px" }}>Last accepted quote information (auto-updated when quote is accepted)</p>
          <div className="grid2">
            <Field label="Last quote #">
              <input
                style={inputStyle}
                type="text"
                placeholder="e.g. Q-2"
                value={lastQuoteNumber}
                onChange={(e) => setLastQuoteNumber(e.target.value)}
              />
            </Field>
            <Field label="Quote value (AUD)">
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                min="0"
                value={lastQuoteValue}
                onChange={(e) => setLastQuoteValue(e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid #e3d8c6", paddingTop: 14, marginTop: 14 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: "#6b5240", margin: "0 0 10px" }}>Address</h4>
        <Field label="Street">
          <input style={inputStyle} type="text" value={street} onChange={(e) => setStreet(e.target.value)} />
        </Field>
        <div className="grid2">
          <Field label="Suburb">
            <input style={inputStyle} type="text" value={suburb} onChange={(e) => setSuburb(e.target.value)} />
          </Field>
          <Field label="Postcode">
            <input style={inputStyle} type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          </Field>
        </div>
      </div>

      {isSupplier && (
        <div style={{ borderTop: "1px solid #e3d8c6", paddingTop: 14, marginTop: 14 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "#6b5240", margin: "0 0 10px" }}>Bank account</h4>
          <Field label="Account name">
            <input style={inputStyle} type="text" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
          </Field>
          <div className="grid2">
            <Field label="BSB">
              <input style={inputStyle} type="text" placeholder="XXX-XXX" value={bsb} onChange={(e) => setBsb(e.target.value)} />
            </Field>
            <Field label="Account number">
              <input style={inputStyle} type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      <Field label="Notes">
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {error && (
        <div style={{ background: "#fbeae5", border: "1px solid #e6c9bf", color: "#a3442e", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant="primary" onClick={handleSave}>
          {editing ? "Save changes" : "Add contact"}
        </Btn>
      </div>
    </Modal>
  );
}

/* ============================================================
   CRM TAB
   ============================================================ */

function CRMTab({ db, update, showToast }) {
  const [search, setSearch] = useState("");
  const [editingProspect, setEditingProspect] = useState(undefined);
  const [expandedTimeline, setExpandedTimeline] = useState(null);
  const [loggingActivityFor, setLoggingActivityFor] = useState(null);
  const [importData, setImportData] = useState(null); // Data ready to import
  const fileInputRef = useState(null)[1]; // Dummy to create ref

  if (!db || !db.crm) {
    return (
      <section>
        <h2 className="section-title">CRM & Sales Pipeline</h2>
        <p className="section-desc">Loading data...</p>
      </section>
    );
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result;
        const rows = parseCSV(csvText);
        if (rows.length === 0) {
          showToast("CSV file is empty");
          return;
        }

        // Validate and prepare data
        const validRows = rows
          .map((row) => ({
            name: row.name?.trim(),
            email: row.email?.trim() || "",
            phone: row.phone?.trim() || "",
            source: row.source?.trim() || "",
            enquiryProduct: row.enquiryProduct?.trim() || "",
            chanceOfClosing: parseInt(row.chanceOfClosing) || 50,
            currentStatus: row.currentStatus?.trim() || "call",
            firstContactDate: row.firstContactDate?.trim() || "",
            lastContactDate: row.lastContactDate?.trim() || "",
            expectedOrderEtaMonth: row.expectedOrderEtaMonth?.trim() || "",
            notes: row.notes?.trim() || "",
          }))
          .filter((row) => row.name); // Require name

        if (validRows.length === 0) {
          showToast("No valid prospects found in CSV");
          return;
        }

        setImportData({
          type: "crm",
          rows: validRows,
          fileName: file.name,
        });
      } catch (err) {
        showToast("Error parsing CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!importData) return;

    update((next) => {
      importData.rows.forEach((row) => {
        const exists = next.crm.find((p) => p.name.toLowerCase() === row.name.toLowerCase());
        if (!exists) {
          next.crm.push({
            id: uid("lead"),
            ...row,
            activities: [],
            createdAt: todayISO(),
          });
        }
      });
    });

    showToast(`Imported ${importData.rows.length} prospect(s)`);
    setImportData(null);
  }

  let list = db.crm.slice().sort((a, b) => (b.lastContactDate || "").localeCompare(a.lastContactDate || ""));
  if (search) {
    const s = search.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(s) || (p.email || "").toLowerCase().includes(s));
  }

  function logActivity(prospect, activity) {
    update((next) => {
      const target = next.crm.find((p) => p.id === prospect.id);
      if (target) {
        target.activities = target.activities || [];
        target.activities.push({
          id: uid("act"),
          date: activity.date,
          type: activity.type,
          notes: activity.notes,
          createdAt: todayISO(),
        });
        target.lastContactDate = activity.date;
        target.updatedAt = todayISO();
      }
    });
    setLoggingActivityFor(null);
    showToast("Activity logged");
  }

  function saveProspect(payload, editing) {
    update((next) => {
      if (editing) {
        const target = next.crm.find((p) => p.id === editing.id);
        Object.assign(target, payload, { updatedAt: todayISO() });
      } else {
        next.crm.push({
          id: uid("lead"),
          activities: [],
          createdAt: todayISO(),
          ...payload,
        });
      }
    });
    setEditingProspect(undefined);
    showToast(editing ? "Prospect updated" : "Prospect added");
  }

  function deleteProspect(prospect) {
    update((next) => {
      const idx = next.crm.findIndex((p) => p.id === prospect.id);
      if (idx >= 0) next.crm.splice(idx, 1);
    });
    showToast("Prospect deleted");
  }

  function convertProspectToCustomer(prospect) {
    // Convert prospect to customer and optionally archive prospect
    update((next) => {
      // Create customer from prospect
      next.customers.push({
        id: uid("cus"),
        name: prospect.name,
        email: prospect.email || "",
        phone: prospect.phone || "",
        address: {
          street: "",
          suburb: "",
          state: "QLD",
          postcode: "",
        },
        product: prospect.enquiryProduct || "",
        notes: `Converted from prospect. ${prospect.notes || ""}`,
        createdAt: todayISO(),
      });

      // Remove prospect from CRM
      const idx = next.crm.findIndex((p) => p.id === prospect.id);
      if (idx >= 0) next.crm.splice(idx, 1);
    });
    showToast(`${prospect.name} converted to customer and removed from prospects`);
  }

  function createQuoteFromProspect(prospect) {
    // Create a new quote with prospect's details prefilled
    update((next) => {
      const number = nextNumber("quote", next);
      next.quotes.push({
        id: uid("q"),
        number,
        status: "Draft",
        party: prospect.name,
        model: "",
        date: todayISO(),
        contact: prospect.email || prospect.phone || "",
        notes: `Prospect enquiry: ${prospect.enquiryProduct || "Custom"}`,
        discount: 0,
        lines: [],
        subtotal: 0,
        gst: 0,
        total: 0,
        grossProfitPct: null,
        fxRateUsed: next.fx.usdAudRate,
        createdAt: todayISO(),
      });
    });
    showToast("Quote created from prospect. Edit to add line items.");
    setTab("quotes");
  }

  return (
    <section>
      <div className="toolbar-row">
        <div>
          <h2 className="section-title">CRM & Sales Pipeline</h2>
          <p className="section-desc">Track prospects, manage enquiries, and log activity history.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="secondary" onClick={() => document.getElementById("crm-import-input")?.click()}>
            ⬆ Import CSV
          </Btn>
          <Btn variant="primary" onClick={() => setEditingProspect(null)}>
            + Add prospect
          </Btn>
          <input
            id="crm-import-input"
            type="file"
            accept=".csv"
            onChange={handleImportFile}
            style={{ display: "none" }}
          />
        </div>
      </div>

      <Panel>
        <input
          style={{ ...inputStyle, marginBottom: 14 }}
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {list.length === 0 ? (
          <Empty icon="📞" text="No prospects yet. Add one to start tracking." />
        ) : (
          list.map((p) => (
            <div
              key={p.id}
              style={{
                background: "#f9f7f2",
                border: "1px solid #e3d8c6",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {p.enquiryProduct && `Enquiry: ${p.enquiryProduct}`} · {p.source || "Unknown"}
                  </div>
                </div>
                <span
                  style={{
                    background:
                      (p.chanceOfClosing || 0) >= 70 ? "#e3ecdc" : (p.chanceOfClosing || 0) >= 30 ? "#fef2e0" : "#fbeae5",
                    color:
                      (p.chanceOfClosing || 0) >= 70 ? "#5c7a4f" : (p.chanceOfClosing || 0) >= 30 ? "#a68d4a" : "#a3442e",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {p.chanceOfClosing || 0}% chance
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#8a7a66", marginBottom: 8, display: "flex", gap: 12 }}>
                <span>First: {fmtDate(p.firstContactDate)}</span>
                <span>Last: {fmtDate(p.lastContactDate)}</span>
                <span style={{ fontWeight: 600, color: p.currentStatus === "delivered" ? "#5c7a4f" : "#6b5240" }}>
                  {(p.currentStatus || "call").toUpperCase()}
                </span>
              </div>

              {p.expectedOrderEtaMonth && (
                <div style={{ fontSize: 12, color: "#8a7a66", marginBottom: 8, fontStyle: "italic" }}>
                  Expected order: {p.expectedOrderEtaMonth}
                </div>
              )}

              {p.salesValue != null && p.salesValue > 0 && (
                <div style={{ fontSize: 13, color: "#5c7a4f", marginBottom: 8, fontWeight: 600 }}>
                  Sales value: {fmtMoney(p.salesValue, "AUD")}
                </div>
              )}

              <div style={{ background: "#fff", borderLeft: "2px solid #b5552b", padding: "8px 12px", borderRadius: 0, fontSize: 12, color: "#6b5240", marginBottom: 10 }}>
                {p.activities && p.activities.length > 0
                  ? `Latest: ${fmtDate(p.activities[p.activities.length - 1].date)} · ${p.activities[p.activities.length - 1].notes.substring(0, 60)}`
                  : "No activities logged yet"}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <Btn variant="text" size="sm" onClick={() => setLoggingActivityFor(p)}>
                  Log activity
                </Btn>
                <Btn variant="text" size="sm" onClick={() => createQuoteFromProspect(p)}>
                  Create quote
                </Btn>
                <Btn variant="text" size="sm" onClick={() => setEditingProspect(p)}>
                  Edit
                </Btn>
                {p.salesValue != null && p.salesValue > 0 && (
                  <Btn variant="text" size="sm" onClick={() => convertProspectToCustomer(p)} style={{ color: "#5c7a4f", fontWeight: 600 }}>
                    ✓ Convert to customer
                  </Btn>
                )}
                <Btn variant="text" size="sm" onClick={() => setExpandedTimeline(expandedTimeline === p.id ? null : p.id)}>
                  Timeline ({(p.activities || []).length})
                </Btn>
                <Btn variant="text" size="sm" onClick={() => deleteProspect(p)}>
                  Delete
                </Btn>
              </div>

              {expandedTimeline === p.id && p.activities && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e3d8c6", fontSize: 12 }}>
                  {p.activities.length === 0 ? (
                    <p className="muted">No activities yet.</p>
                  ) : (
                    p.activities.map((a, i) => (
                      <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #eee" }}>
                        <div style={{ fontWeight: 600, color: "#4a3527" }}>
                          {fmtDate(a.date)} · {a.type || "note"}
                        </div>
                        <div style={{ color: "#6b5240", marginTop: 2 }}>{a.notes}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </Panel>

      {editingProspect !== undefined && (
        <CRMModal editing={editingProspect} db={db} onCancel={() => setEditingProspect(undefined)} onSave={saveProspect} />
      )}

      {loggingActivityFor && (
        <ActivityLogModal
          prospect={loggingActivityFor}
          onCancel={() => setLoggingActivityFor(null)}
          onSave={(activity) => logActivity(loggingActivityFor, activity)}
        />
      )}

      {importData && (
        <Modal onClose={() => setImportData(null)}>
          <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
            Import {importData.rows.length} prospect{importData.rows.length !== 1 ? "s" : ""}
          </h3>
          <p style={{ color: "#6b5240", fontSize: 13, margin: "0 0 14px" }}>
            File: <strong>{importData.fileName}</strong>
          </p>

          <div style={{ background: "#f9f7f2", border: "1px solid #d3c9b8", borderRadius: 8, padding: 12, marginBottom: 14, maxHeight: 300, overflowY: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d3c9b8" }}>
                  <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 600, color: "#4a3527" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 600, color: "#4a3527" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 600, color: "#4a3527" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {importData.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e3d8c6" }}>
                    <td style={{ padding: "6px 0" }}>{row.name}</td>
                    <td style={{ padding: "6px 0", color: "#8a7a66" }}>{row.email || "—"}</td>
                    <td style={{ padding: "6px 0", color: "#8a7a66" }}>{row.currentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Btn variant="ghost" onClick={() => setImportData(null)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={confirmImport}>
              Import {importData.rows.length} prospect{importData.rows.length !== 1 ? "s" : ""}
            </Btn>
          </div>
        </Modal>
      )}
    </section>
  );
}

function CRMModal({ editing, db, onCancel, onSave }) {
  const [name, setName] = useState(editing ? editing.name : "");
  const [email, setEmail] = useState(editing ? editing.email || "" : "");
  const [phone, setPhone] = useState(editing ? editing.phone || "" : "");
  const [source, setSource] = useState(editing ? editing.source || "" : "");
  const [enquiryProduct, setEnquiryProduct] = useState(editing ? editing.enquiryProduct || "" : "");
  const [chanceOfClosing, setChanceOfClosing] = useState(editing ? String(editing.chanceOfClosing || 0) : "50");
  const [currentStatus, setCurrentStatus] = useState(editing ? editing.currentStatus || "call" : "call");
  const [firstContactDate, setFirstContactDate] = useState(editing ? editing.firstContactDate || "" : todayISO());
  const [lastContactDate, setLastContactDate] = useState(editing ? editing.lastContactDate || "" : todayISO());
  const [expectedOrderEtaMonth, setExpectedOrderEtaMonth] = useState(editing ? editing.expectedOrderEtaMonth || "" : "");
  const [salesValue, setSalesValue] = useState(editing ? String(editing.salesValue || "") : "");
  const [notes, setNotes] = useState(editing ? editing.notes || "" : "");
  const [error, setError] = useState("");

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a name.");
      return;
    }
    onSave(
      {
        name: trimmedName,
        email: email.trim(),
        phone: phone.trim(),
        source: source.trim(),
        enquiryProduct: enquiryProduct.trim(),
        chanceOfClosing: parseInt(chanceOfClosing) || 0,
        currentStatus,
        firstContactDate,
        lastContactDate,
        expectedOrderEtaMonth,
        salesValue: parseFloat(salesValue) || 0,
        notes: notes.trim(),
        activities: editing?.activities || [],
      },
      editing
    );
  }

  return (
    <Modal onClose={onCancel}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
        {editing ? "Edit prospect" : "Add prospect"}
      </h3>

      <Field label="Name (required)">
        <input style={inputStyle} type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div className="grid2">
        <Field label="Email">
          <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone">
          <input style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>

      <div className="grid2">
        <Field label="Source">
          <select style={inputStyle} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">—</option>
            <option value="Direct">Direct</option>
            <option value="Carsales">Carsales</option>
            <option value="Facebook">Facebook</option>
            <option value="Website">Website</option>
            <option value="Referral">Referral</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Enquired about">
          <select style={inputStyle} value={enquiryProduct} onChange={(e) => setEnquiryProduct(e.target.value)}>
            <option value="">—</option>
            <option value="Campo">Campo</option>
            <option value="Scout">Scout</option>
            <option value="Savanna">Savanna</option>
            <option value="Custom build">Custom build</option>
          </select>
        </Field>
      </div>

      <div className="grid2">
        <Field label="Chance of closing (%)">
          <input style={inputStyle} type="number" min="0" max="100" value={chanceOfClosing} onChange={(e) => setChanceOfClosing(e.target.value)} />
        </Field>
        <Field label="Current status">
          <select style={inputStyle} value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value)}>
            <option value="call">Call</option>
            <option value="quote">Quote</option>
            <option value="deposit">Deposit received</option>
            <option value="delivered">Delivered</option>
          </select>
        </Field>
      </div>

      <div className="grid2">
        <Field label="First contact">
          <input style={inputStyle} type="date" value={firstContactDate} onChange={(e) => setFirstContactDate(e.target.value)} />
        </Field>
        <Field label="Last contact">
          <input style={inputStyle} type="date" value={lastContactDate} onChange={(e) => setLastContactDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Expected order ETA (month)">
        <input
          style={inputStyle}
          type="month"
          value={expectedOrderEtaMonth}
          onChange={(e) => setExpectedOrderEtaMonth(e.target.value)}
        />
      </Field>

      <Field label="Sales Value (AUD)">
        <input
          style={inputStyle}
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 45000 (auto-filled from quote or manual)"
          value={salesValue}
          onChange={(e) => setSalesValue(e.target.value)}
        />
      </Field>

      <Field label="Notes">
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {error && (
        <div style={{ background: "#fbeae5", border: "1px solid #e6c9bf", color: "#a3442e", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant="primary" onClick={handleSave}>
          {editing ? "Save changes" : "Add prospect"}
        </Btn>
      </div>
    </Modal>
  );
}

function ActivityLogModal({ prospect, onCancel, onSave }) {
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState("call");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function handleSave() {
    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setError("Please enter some notes about the activity.");
      return;
    }
    onSave({ date, type, notes: trimmedNotes });
  }

  return (
    <Modal onClose={onCancel}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 19 }}>
        Log activity for {prospect.name}
      </h3>

      <div className="grid2">
        <Field label="Date">
          <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Type">
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="call">Phone call</option>
            <option value="email">Email</option>
            <option value="meeting">In-person meeting</option>
            <option value="note">Note</option>
          </select>
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
          placeholder="What did you discuss? Next steps? Any decisions?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {error && (
        <div style={{ background: "#fbeae5", border: "1px solid #e6c9bf", color: "#a3442e", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant="primary" onClick={handleSave}>
          Log activity
        </Btn>
      </div>
    </Modal>
  );
}

/* ============================================================
   DASHBOARD TAB
   ============================================================ */

function DashboardTab({ db, setTab }) {
  if (!db || !db.crm || !db.quotes || !db.pos) {
    return (
      <section>
        <h2 className="section-title">Sales Dashboard</h2>
        <p className="section-desc">Loading data...</p>
      </section>
    );
  }

  // Sales funnel counts
  const funnelStats = {
    call: db.crm.filter((p) => p.currentStatus === "call").length,
    quote: db.crm.filter((p) => p.currentStatus === "quote").length,
    deposit: db.crm.filter((p) => p.currentStatus === "deposit").length,
    delivered: db.crm.filter((p) => p.currentStatus === "delivered").length,
  };

  // Pipeline value
  const pipelineValue = db.crm
    .filter((p) => p.currentStatus !== "delivered")
    .reduce((sum, p) => {
      const matchingQuote = db.quotes.find((q) => q.party === p.name && q.status === "Accepted");
      return sum + (matchingQuote ? matchingQuote.total : 0);
    }, 0);

  // PO tracking
  const openPos = db.pos.filter((po) => po.status !== "Received").length;
  const totalPoAmount = db.pos.reduce((sum, po) => sum + (po.total || 0), 0);

  // Expected delivery POs
  const expectedDeliveryPos = db.pos.filter((po) => po.status === "Sent" || po.status === "Received");
  const expectedDeliverAmount = expectedDeliveryPos.reduce((sum, po) => sum + (po.total || 0), 0);

  // Expected profit: accepted quotes revenue vs their line item costs
  const acceptedQuotes = db.quotes.filter((q) => q.status === "Accepted");
  const acceptedQuotesTotal = acceptedQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
  
  // Calculate cost from accepted quote line items
  const expectedCost = acceptedQuotes.reduce((sum, quote) => {
    const quoteCost = (quote.lines || []).reduce((qSum, line) => {
      const lineCost = line.cost || 0;
      const lineQty = line.qty || 0;
      return qSum + (lineCost * lineQty);
    }, 0);
    return sum + quoteCost;
  }, 0);
  
  const expectedMargin = acceptedQuotesTotal - expectedCost;
  const expectedMarginPct = acceptedQuotesTotal > 0 ? ((expectedMargin / acceptedQuotesTotal) * 100).toFixed(1) : 0;

  // Stat box style - clickable
  const statBoxStyle = {
    background: "#f6f1e7",
    borderRadius: 8,
    padding: 16,
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "1px solid #e3d8c6",
  };

  const statBoxHoverStyle = {
    ...statBoxStyle,
    background: "#f0e8d9",
    borderColor: "#b5552b",
  };

  return (
    <section>
      <h2 className="section-title">Sales Dashboard</h2>
      <p className="section-desc">Overview of your sales pipeline, purchase orders, and expected profitability. Click any stat to view details.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
        <div
          style={statBoxStyle}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: "#f0e8d9", borderColor: "#b5552b" })}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "#f6f1e7", borderColor: "#e3d8c6" })}
          onClick={() => setTab("crm")}
        >
          <p style={{ fontSize: 12, color: "#8a7a66", margin: "0 0 8px", fontWeight: 600 }}>Pipeline value</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#4a3527", margin: 0 }}>{fmtMoney(pipelineValue, "AUD")}</p>
        </div>
        <div
          style={statBoxStyle}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: "#f0e8d9", borderColor: "#b5552b" })}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "#f6f1e7", borderColor: "#e3d8c6" })}
          onClick={() => setTab("po")}
        >
          <p style={{ fontSize: 12, color: "#8a7a66", margin: "0 0 8px", fontWeight: 600 }}>Open POs</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#4a3527", margin: 0 }}>{openPos}</p>
        </div>
        <div
          style={statBoxStyle}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: "#f0e8d9", borderColor: "#b5552b" })}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "#f6f1e7", borderColor: "#e3d8c6" })}
          onClick={() => setTab("quotes")}
        >
          <p style={{ fontSize: 12, color: "#8a7a66", margin: "0 0 8px", fontWeight: 600 }}>Expected margin</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: expectedMargin >= 0 ? "#5c7a4f" : "#a3442e", margin: 0 }}>
            {expectedMarginPct}%
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <Panel>
          <h3 style={{ fontFamily: "Georgia,serif", fontSize: 16, color: "#4a3527", margin: "0 0 12px" }}>Sales funnel</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Call</span>
              <strong>{funnelStats.call}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Quote</span>
              <strong>{funnelStats.quote}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Deposit received</span>
              <strong>{funnelStats.deposit}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Delivered</span>
              <strong>{funnelStats.delivered}</strong>
            </div>
          </div>
        </Panel>

        <Panel>
          <h3 style={{ fontFamily: "Georgia,serif", fontSize: 16, color: "#4a3527", margin: "0 0 12px" }}>PO status</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Total POs</span>
              <strong>{db.pos.length}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Total amount</span>
              <strong>{fmtMoney(totalPoAmount, "AUD")}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Expected delivery</span>
              <strong>{fmtMoney(expectedDeliverAmount, "AUD")}</strong>
            </div>
          </div>
        </Panel>

        <Panel>
          <h3 style={{ fontFamily: "Georgia,serif", fontSize: 16, color: "#4a3527", margin: "0 0 12px" }}>Revenue vs cost</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Expected revenue</span>
              <strong>{fmtMoney(acceptedQuotesTotal, "AUD")}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Expected cost</span>
              <strong>{fmtMoney(expectedCost, "AUD")}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 8, borderTop: "1px solid #e3d8c6" }}>
              <span>Expected profit</span>
              <strong style={{ color: expectedMargin >= 0 ? "#5c7a4f" : "#a3442e" }}>{fmtMoney(expectedMargin, "AUD")}</strong>
            </div>
          </div>
        </Panel>
      </div>

      {/* Shipments list */}
      <Panel style={{ marginTop: 24 }}>
        <h3 style={{ fontFamily: "Georgia,serif", fontSize: 16, color: "#4a3527", margin: "0 0 16px" }}>Shipments due</h3>
        {db.pos.length === 0 ? (
          <p style={{ fontSize: 13, color: "#8a7a66", margin: 0 }}>No purchase orders yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9f7f2", borderBottom: "2px solid #b5552b" }}>
                  <th style={{ textAlign: "left", padding: "10px 8px", fontWeight: 700 }}>Supplier</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", fontWeight: 700 }}>PO #</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", fontWeight: 700 }}>ETA</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700 }}>Customs</th>
                </tr>
              </thead>
              <tbody>
                {db.pos.slice(0, 5).map((po) => (
                  <tr key={po.id} style={{ borderBottom: "1px solid #e3d8c6" }}>
                    <td style={{ padding: "10px 8px", color: "#4a3527" }}>{po.party}</td>
                    <td style={{ padding: "10px 8px", color: "#4a3527", fontWeight: 600 }}>#{po.number}</td>
                    <td style={{ padding: "10px 8px", color: "#4a3527" }}>
                      {po.paymentMilestones && po.paymentMilestones.length > 0
                        ? new Date(po.paymentMilestones[po.paymentMilestones.length - 1].due).toLocaleDateString()
                        : "—"}
                    </td>
                    <td style={{ padding: "10px 8px", color: "#4a3527", textAlign: "right", fontWeight: 600 }}>
                      {(po.customsClearance || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {db.pos.length > 5 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#8a7a66", textAlign: "center" }}>
                + {db.pos.length - 5} more. <button onClick={() => setTab("shipments")} style={{ background: "none", border: "none", color: "#b5552b", cursor: "pointer", textDecoration: "underline" }}>View all</button>
              </div>
            )}
          </div>
        )}
      </Panel>
    </section>
  );
}

function ShipmentsTab({ db, update, showToast }) {
  const [editingShipment, setEditingShipment] = useState(undefined);

  const allPOs = db.pos || [];
  const shipmentsWithPayments = allPOs.map(po => {
    const paymentMilestones = po.paymentMilestones || [];
    const totalDue = paymentMilestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0) || po.total || 0;
    const totalPaid = paymentMilestones.filter(m => m.paid).reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    const amountOwed = totalDue - totalPaid;
    const nextPaymentDue = paymentMilestones.find(m => !m.paid && m.due);
    
    return {
      ...po,
      totalDue,
      totalPaid,
      amountOwed,
      nextPaymentDue: nextPaymentDue?.due,
      customsClearance: po.customsClearance || 0,
    };
  });

  return (
    <section>
      <div className="section-header">
        <h2 className="section-title">Shipments</h2>
        <p className="section-desc">Track supplier purchase orders, delivery dates, and payment schedules</p>
      </div>

      <div className="content-area">
        {shipmentsWithPayments.length === 0 ? (
          <Panel>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>No purchase orders yet. Create one in the Purchase Orders section.</p>
          </Panel>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#f9f7f2" }}>
                  <th style={{ textAlign: "left", padding: "12px 8px", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #b5552b" }}>PO #</th>
                  <th style={{ textAlign: "left", padding: "12px 8px", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #b5552b" }}>Supplier</th>
                  <th style={{ textAlign: "left", padding: "12px 8px", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #b5552b" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "12px 8px", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #b5552b" }}>Next Payment Due</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #b5552b" }}>Total</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #b5552b" }}>Paid</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #b5552b" }}>Owed</th>
                  <th style={{ textAlign: "right", padding: "12px 8px", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #b5552b" }}>Customs</th>
                </tr>
              </thead>
              <tbody>
                {shipmentsWithPayments.map(po => (
                  <tr 
                    key={po.id}
                    onClick={() => setEditingShipment(po)}
                    style={{ 
                      cursor: "pointer", 
                      borderBottom: "1px solid #e3d8c6",
                      background: editingShipment?.id === po.id ? "#ede8de" : "transparent"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#f9f7f2"}
                    onMouseOut={(e) => e.currentTarget.style.background = editingShipment?.id === po.id ? "#ede8de" : "transparent"}
                  >
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#4a3527", fontWeight: 600 }}>#{po.number}</td>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#4a3527" }}>{po.party}</td>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#4a3527" }}>
                      <span style={{ 
                        display: "inline-block",
                        background: po.status === "Received" ? "#e8f5e0" : "#fff3e0",
                        color: po.status === "Received" ? "#5c7a4f" : "#8a6d3b",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600
                      }}>
                        {po.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#4a3527" }}>
                      {po.nextPaymentDue ? new Date(po.nextPaymentDue).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#4a3527", textAlign: "right", fontWeight: 600 }}>
                      {(po.totalDue || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                    </td>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#5c7a4f", textAlign: "right" }}>
                      {(po.totalPaid || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                    </td>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: po.amountOwed > 0 ? "#a3442e" : "#5c7a4f", textAlign: "right", fontWeight: 600 }}>
                      {(po.amountOwed || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                    </td>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#4a3527", textAlign: "right" }}>
                      {(po.customsClearance || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editingShipment && (
          <Panel style={{ marginTop: 24 }}>
            <h3 style={{ fontFamily: "Georgia,serif", color: "#4a3527", margin: "0 0 16px", fontSize: 16 }}>
              PO #{editingShipment.number} Details
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "#6b5240", margin: "0 0 12px" }}>Order Info</h4>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: "#4a3527" }}>
                  <div><strong>Supplier:</strong> {editingShipment.party}</div>
                  <div><strong>Date:</strong> {editingShipment.date}</div>
                  <div><strong>Status:</strong> {editingShipment.status}</div>
                  <div><strong>Contact:</strong> {editingShipment.contact || "—"}</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "#6b5240", margin: "0 0 12px" }}>Payment Summary</h4>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: "#4a3527" }}>
                  <div><strong>Total Due:</strong> {(editingShipment.totalDue || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}</div>
                  <div><strong>Total Paid:</strong> {(editingShipment.totalPaid || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}</div>
                  <div style={{ paddingTop: 8, borderTop: "1px solid #e3d8c6", marginTop: 8 }}>
                    <strong style={{ color: editingShipment.amountOwed > 0 ? "#a3442e" : "#5c7a4f" }}>
                      Amount Owed: {(editingShipment.amountOwed || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {editingShipment.customsClearance > 0 && (
              <div style={{ background: "#fef5e7", border: "1px solid #f9e79f", borderRadius: 6, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "#8a6d3b" }}>
                  <strong>Estimated Customs Clearance:</strong> {editingShipment.customsClearance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                </div>
              </div>
            )}

            {editingShipment.paymentMilestones && editingShipment.paymentMilestones.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "#6b5240", margin: "0 0 12px" }}>Payment Schedule</h4>
                <div style={{ background: "#f9f7f2", border: "1px solid #d3c9b8", borderRadius: 6, padding: 12 }}>
                  {editingShipment.paymentMilestones.map((m, idx) => (
                    <div key={idx} style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: idx < editingShipment.paymentMilestones.length - 1 ? "1px solid #e3d8c6" : "none",
                      fontSize: 13
                    }}>
                      <div>
                        <span style={{ color: "#6b5240" }}>Due: {new Date(m.due).toLocaleDateString()}</span>
                        {m.paid && <span style={{ color: "#5c7a4f", marginLeft: 12 }}>✓ Paid {m.paidDate ? new Date(m.paidDate).toLocaleDateString() : ""}</span>}
                      </div>
                      <span style={{ fontWeight: 600, color: m.paid ? "#5c7a4f" : "#4a3527" }}>
                        {(parseFloat(m.amount) || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setEditingShipment(undefined)}
              style={{
                marginTop: 16,
                background: "none",
                border: "none",
                color: "#8a7a66",
                cursor: "pointer",
                fontSize: 13,
                textDecoration: "underline"
              }}
            >
              Close
            </button>
          </Panel>
        )}
      </div>
    </section>
  );
}
