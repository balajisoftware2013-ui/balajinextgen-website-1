# Balaji NextGen ERP — Real Estate v1.0
## Complete Setup Guide & Documentation

**Powered by Balaji NextGen Solutions**  
Contact: 9832014403 | balajieducationhub12@gmail.com  
Website: https://balajinextgensolution.netlify.app/

---

## 🏗️ PRODUCT OVERVIEW

A full-stack Real Estate ERP Dashboard supporting:
- **Flat / Apartment** projects
- **Residence / Villa** projects  
- **Commercial** projects
- **Plotted Development** projects

Multi-client SaaS: Demo → Trial → Subscription lifecycle (10,000+ clients)

---

## 👤 USER ROLES & ACCESS

| Role | Access Level |
|------|-------------|
| SUPER_ADMIN | Full access — all clients, all data |
| DEVELOPER | System settings, DB, API config |
| OWNER | All modules for own company |
| ADMIN | All modules except system settings |
| SALES | Leads, Bookings, Customers, Inventory view |
| ACCOUNTS | Finance modules only (Receipts, Demands, Ledger) |

---

## 📦 MODULES INCLUDED

### Core
- **Dashboard** — KPIs, charts, activity feed, demand alerts
- **Projects** — Create/manage flat, villa, commercial, plotted projects (RERA tracking)
- **Unit Inventory** — Visual floor-plan with colour-coded unit status

### Sales
- **Leads & CRM** — Lead tracking, source, budget, follow-up scheduling, conversion
- **Bookings** — Unit booking, advance collection, allotment letters
- **Customers** — Master data, PAN, unit ownership, payment history

### Finance
- **Demand Letters** — Milestone-wise demand generation, SMS/email dispatch
- **Receipts & Advance** — All collections: NEFT, Cheque, Cash, UPI
- **Accounts Ledger** — Customer-wise Dr/Cr ledger
- **Outstanding** — Overdue tracking, day-aging, bulk reminders

### Operations
- **Construction Progress** — Milestone tracking, % completion per project
- **Documents & Drive** — Google Drive OAuth integration, file management
- **Reports** — 8 standard reports exportable as PDF/Excel

### System
- **Client Manager** — Onboard and manage 10,000+ SaaS clients
- **Settings** — DB config, Google Drive API, company profile, notifications, sidebar theme

---

## ☁️ GOOGLE DRIVE INTEGRATION

### Setup Steps:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Google Drive API**
3. Create OAuth 2.0 credentials:
   - Application type: **Web application**
   - Redirect URI: `https://balajinextgensolution.netlify.app/oauth/callback`
4. Copy **Client ID** and **Client Secret**
5. In Dashboard → **Settings** → **Google Drive API**:
   - Paste Client ID, Client Secret
   - Enter Drive Folder ID (root folder for documents)
6. Click **Authenticate Drive** — OAuth popup will open
7. Grant permission → Drive connected ✅

### What Gets Stored in Drive:
- Sale Agreements (PDF)
- Allotment Letters (PDF)  
- Floor Plans (PDF/DWG)
- Title Deeds (PDF)
- RERA Certificates (PDF)
- Site Progress Photos (ZIP/JPG)
- Demand Letters (PDF)
- Receipts (PDF)

---

## 🗄️ DATABASE CONFIGURATION

### Required Tables (PostgreSQL / MySQL):

```sql
-- Projects
CREATE TABLE projects (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  type ENUM('flat','villa','commercial','plotted'),
  location VARCHAR,
  rera_no VARCHAR,
  total_units INT,
  start_date DATE,
  possession_date DATE,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Units
CREATE TABLE units (
  id VARCHAR PRIMARY KEY,
  project_id VARCHAR REFERENCES projects(id),
  unit_no VARCHAR NOT NULL,
  floor INT,
  type VARCHAR,
  area_sqft DECIMAL,
  rate_per_sqft DECIMAL,
  total_price DECIMAL,
  status ENUM('available','booked','sold','held') DEFAULT 'available',
  customer_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  mobile VARCHAR,
  email VARCHAR,
  pan VARCHAR,
  aadhaar VARCHAR,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bookings
CREATE TABLE bookings (
  id VARCHAR PRIMARY KEY,
  booking_no VARCHAR UNIQUE,
  booking_date DATE,
  customer_id VARCHAR REFERENCES customers(id),
  unit_id VARCHAR REFERENCES units(id),
  sale_price DECIMAL,
  advance_amount DECIMAL,
  payment_mode VARCHAR,
  reference_no VARCHAR,
  status ENUM('active','agreement_done','registered','cancelled'),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Demand Letters
CREATE TABLE demand_letters (
  id VARCHAR PRIMARY KEY,
  demand_no VARCHAR UNIQUE,
  demand_date DATE,
  customer_id VARCHAR REFERENCES customers(id),
  unit_id VARCHAR REFERENCES units(id),
  milestone VARCHAR,
  amount DECIMAL,
  due_date DATE,
  status ENUM('pending','sent','overdue','cleared'),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Receipts
CREATE TABLE receipts (
  id VARCHAR PRIMARY KEY,
  receipt_no VARCHAR UNIQUE,
  receipt_date DATE,
  customer_id VARCHAR REFERENCES customers(id),
  unit_id VARCHAR REFERENCES units(id),
  demand_id VARCHAR REFERENCES demand_letters(id),
  amount DECIMAL,
  payment_mode ENUM('cash','cheque','neft','rtgs','upi'),
  reference_no VARCHAR,
  receipt_type VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  mobile VARCHAR,
  email VARCHAR,
  project_interest VARCHAR,
  source VARCHAR,
  budget_range VARCHAR,
  status ENUM('new','warm','hot','converted','lost'),
  next_followup DATE,
  assigned_to VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 DEMO → TRIAL → SUBSCRIPTION FLOW

```
DEMO (Free)
  ↓  Signup
TRIAL (14 days)
  ↓  Payment
SUBSCRIPTION
  ├── Basic: ₹3,500/mo (1 project, 100 units)
  ├── Pro: ₹8,000/mo (5 projects, 500 units)
  └── Enterprise: ₹15,000/mo (Unlimited, white-label)
```

---

## 📱 NOTIFICATIONS SUPPORTED

- SMS via MSG91 / Textlocal
- Email via SMTP / SendGrid
- WhatsApp via WhatsApp Business API
- In-app toast notifications

---

## 📞 SUPPORT

- **Phone:** 9832014403
- **Email:** balajieducationhub12@gmail.com  
- **Website:** https://balajinextgensolution.netlify.app/
- **Location:** Siliguri, West Bengal — 734001

---

*Balaji NextGen ERP Real Estate v1.0 — © 2025 Balaji NextGen Solutions. All rights reserved.*
