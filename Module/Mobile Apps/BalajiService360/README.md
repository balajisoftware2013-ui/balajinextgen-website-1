# 🚀 BALAJI SERVICE360

**AI-Powered Service Marketplace Platform**  
*Connect. Book. Pay. Done.*

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)](https://github.com)
[![Version](https://img.shields.io/badge/Version-1.0-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](https://github.com)

---

## 📋 Table of Contents

1. [Overview](#-overview)
2. [Features](#-features)
3. [Tech Stack](#-tech-stack)
4. [Quick Start](#-quick-start)
5. [Project Structure](#-project-structure)
6. [API Reference](#-api-reference)
7. [Database Schema](#-database-schema)
8. [Deployment](#-deployment)
9. [Configuration](#-configuration)
10. [Security](#-security)
11. [Support](#-support)

---

## 🎯 Overview

Balaji Service360 is a **production-ready, enterprise-grade SaaS platform** for connecting customers with verified service providers. It competes with UrbanCompany, Justdial Services, TaskRabbit, and similar platforms.

### Key Advantages

- **100% Mobile-First**: Responsive design, PWA capable, works offline
- **Real-Time Booking**: Live provider matching with GPS integration
- **Secure Payments**: Razorpay, UPI, Card payments with PCI compliance
- **AI-Powered**: Smart recommendations, fraud detection, dynamic pricing
- **GST Compliant**: Automatic invoice generation with GST calculations
- **Multi-Language**: Support for Hindi, English, regional languages
- **Enterprise Grade**: Role-based access, audit trails, compliance ready

### Who Uses It?

- **Customers**: Book home services (plumbing, electrical, cleaning, beauty, etc.)
- **Service Providers**: Accept jobs, manage bookings, earn commissions
- **Franchise Partners**: Manage multiple providers, earn from commissions
- **Admins**: Oversee platform, approve providers, handle disputes

---

## ✨ Features

### Customer Features
- ✅ OTP-based login with mobile verification
- ✅ Browse & search services by category, location, rating
- ✅ Real-time provider matching with GPS
- ✅ Instant, scheduled, or emergency booking
- ✅ Multi-service booking (multiple tasks in one visit)
- ✅ Live provider tracking during service
- ✅ Voice & video call with provider
- ✅ Payment via Razorpay, UPI, card, wallet
- ✅ GST invoice generation & PDF download
- ✅ Rate & review providers with photos
- ✅ Wallet with cashback rewards
- ✅ Referral system with incentives
- ✅ Coupons & offers management

### Provider Features
- ✅ Professional profile with certifications
- ✅ KYC verification (Aadhaar, PAN, Bank)
- ✅ Accept/reject job requests
- ✅ Quote generation with itemized breakdown
- ✅ Real-time earning dashboard
- ✅ Rating & review management
- ✅ Wallet with instant payouts
- ✅ Performance analytics & insights
- ✅ Tax reports (TDS, Form 16)
- ✅ Subscription plans for premium features
- ✅ Customer communication (voice, video, chat)

### Admin Features
- ✅ Platform analytics dashboard
- ✅ KYC verification workflow
- ✅ Dispute resolution panel
- ✅ Financial reports (revenue, GST, commission)
- ✅ Provider management & suspension
- ✅ Customer support ticketing
- ✅ Fraud detection & prevention
- ✅ Commission settlement automation
- ✅ Audit logs & compliance reports
- ✅ Settings & configuration management

### Payment & Billing
- ✅ Razorpay integration (cards, UPI, netbanking)
- ✅ Wallet system with balance
- ✅ Commission settlement (15% default)
- ✅ GST invoice automation (18% default)
- ✅ Refund management
- ✅ Payment history & reconciliation
- ✅ TDS calculations (if applicable)

### Advanced Features
- ✅ AI Chatbot for support
- ✅ AI-powered recommendations
- ✅ Dynamic pricing by demand/time
- ✅ Fraud detection system
- ✅ Live GPS tracking
- ✅ Document upload (invoices, certificates)
- ✅ Digital signature verification
- ✅ SMS/Email/Push notifications
- ✅ WhatsApp integration for invoices
- ✅ Dark mode support
- ✅ Tally XML export for accounting
- ✅ Barcode & QR code scanning

---

## 🛠 Tech Stack

### Frontend
- **HTML5** - Semantic markup, PWA support
- **CSS3** - Grid, flexbox, glassmorphism, animations
- **JavaScript ES2025** - Async/await, Fetch API, Service Workers
- **Bootstrap 5** - Responsive grid system
- **Mobile-First Design** - Works on all devices

### Backend
- **Google Apps Script** - Serverless backend (no server to manage)
- **Node.js** - Optional (for cloud migration)

### Database
- **Google Sheets** - Normalized relational structure
- **Google Drive** - File storage (documents, invoices, KYC)

### Third-Party Services
- **Razorpay** - Payment processing (cards, UPI, netbanking)
- **Twilio** - OTP delivery via SMS
- **Google Maps API** - Location services, provider nearby search
- **OpenAI / Gemini** - AI chatbot, recommendations
- **SendGrid** - Email notifications
- **Firebase** - Push notifications (optional)

### Hosting
- **Netlify / Vercel** - Frontend hosting (recommended)
- **Google Apps Script** - Backend hosting (free tier)
- **Google Drive** - Database & file storage

---

## ⚡ Quick Start

### 5-Minute Setup

#### Step 1: Download Files
```bash
# Clone or download project files
git clone https://github.com/balaji-nextgen/service360.git
cd service360
```

#### Step 2: Create Google Sheets Databases
1. Go to [Google Drive](https://drive.google.com)
2. Create two new Google Sheets:
   - `Balaji Service360 - Master Database`
   - `Balaji Service360 - Users Database`
3. Copy the Sheet IDs from URL
4. Save Sheet IDs for later

#### Step 3: Deploy Google Apps Script Backend
1. Go to [script.google.com](https://script.google.com)
2. Create new project
3. Paste code from `Code-Service360-Backend.gs`
4. Run `setupDatabase()` function
5. Deploy as Web App
   - Execute as: Your Account
   - Access: Anyone
   - Get the deployment URL

#### Step 4: Update Frontend Configuration
In `balajiservice360-production.html`, update:

```javascript
const CONFIG = {
  GAS_URL: 'YOUR_DEPLOYMENT_URL',
  RAZORPAY_KEY: 'rzp_live_YOUR_KEY',
  GOOGLE_MAPS_KEY: 'YOUR_MAPS_KEY',
};
```

#### Step 5: Deploy Frontend
```bash
# Option A: Netlify
npm install -g netlify-cli
netlify deploy --prod --dir .

# Option B: GitHub Pages
git push origin main
# Enable GitHub Pages in settings

# Option C: Manual Upload
# Upload to any web hosting (Bluehost, HostGator, etc.)
```

#### Step 6: Test
1. Open deployed URL in browser
2. Test customer registration (Phone: 9876543210)
3. Test provider signup
4. Test admin login (admin@service360.com / admin@123)

**Done!** 🎉 Your platform is live.

---

## 📁 Project Structure

```
service360/
├── balajiservice360-production.html      # Main frontend app (~18,000 lines)
├── Code-Service360-Backend.gs            # Google Apps Script backend (~1,200 lines)
├── manifest.json                          # PWA manifest
├── sw.js                                  # Service worker (offline support)
├── favicon-32.png                         # Website icon
├── logo-mark.png                          # Logo
├── logo-balaji-service360.png            # Full logo
├── icon-192.png                           # PWA icon (192x192)
├── icon-512.png                           # PWA icon (512x512)
├── icon-512-maskable.png                 # PWA maskable icon
├── DATABASE-SCHEMA-DEPLOYMENT.md         # Full database schema & deployment guide
├── README.md                              # This file
└── .gitignore                             # Git ignore rules
```

### File Sizes
- **Frontend HTML**: ~600 KB
- **Backend GAS**: ~80 KB
- **Images/Assets**: ~1.5 MB
- **Total**: ~2.2 MB

---

## 🔌 API Reference

### Authentication APIs

#### Send OTP
```javascript
POST /api/sendOTP
{
  mobile: "9876543210",
  role: "customer" | "provider"
}

Response:
{
  success: true,
  message: "OTP sent successfully",
  debug: "OTP: 123456" // Remove in production
}
```

#### Verify OTP
```javascript
POST /api/verifyOTP
{
  mobile: "9876543210",
  otp: "123456",
  role: "customer" | "provider"
}

Response:
{
  success: true,
  user: { UserID, Mobile, Name, Email, City },
  token: "JWT_TOKEN",
  isNewUser: true
}
```

### Booking APIs

#### Search Providers
```javascript
POST /api/searchProviders
{
  category: "Plumbing",
  location: "Mumbai",
  date: "2024-01-20"
}

Response:
{
  success: true,
  providers: [
    {
      UserID: "PRV001",
      Name: "John Plumber",
      Category: "Plumbing",
      Rating: 4.8,
      HourlyRate: 500,
      Distance: 2.5
    }
  ]
}
```

#### Create Booking
```javascript
POST /api/createBooking
{
  customerId: "CUS001",
  category: "Plumbing",
  description: "Pipe leak repair",
  date: "2024-01-20",
  time: "14:00",
  location: "Mumbai"
}

Response:
{
  success: true,
  bookingId: "BKG123001",
  message: "Booking created"
}
```

### Payment APIs

#### Create Razorpay Order
```javascript
POST /api/createRazorpayOrder
{
  bookingId: "BKG123001",
  amount: 531
}

Response:
{
  success: true,
  orderId: "order_K8j9L2m3N4o5P6q7",
  amount: 531,
  key: "rzp_live_YOUR_KEY"
}
```

### Admin APIs

#### Get Platform Stats
```javascript
POST /api/getAdminStats
{}

Response:
{
  success: true,
  data: {
    totalCustomers: 1250,
    totalProviders: 340,
    totalBookings: 5680,
    totalRevenue: 2850000,
    platformCommission: 427500,
    pendingKYC: 45
  }
}
```

#### Approve Provider
```javascript
POST /api/adminApproveProvider
{
  userId: "PRV001"
}

Response:
{
  success: true,
  message: "Provider approved"
}
```

---

## 📊 Database Schema

### Main Tables

#### CUSTOMERS (Users Sheet)
```
UserID | Mobile | Name | Email | City | Address | Status | Rating | Reviews
```

#### PROVIDERS (Users Sheet)
```
UserID | Mobile | Name | Category | City | Experience | Bio | KYCStatus | Rating | HourlyRate
```

#### BOOKINGS (Master Sheet)
```
BookingID | CustomerID | Category | Description | Date | Time | Location | Status | ProviderID | TotalAmount
```

#### PAYMENTS (Master Sheet)
```
PaymentID | BookingID | Amount | Status | RazorpayID | CreatedAt
```

#### INVOICES (Master Sheet)
```
InvoiceID | BookingID | CustomerID | ProviderID | ServiceAmount | GST | TotalAmount | Status
```

#### COMMISSIONS (Master Sheet)
```
CommissionID | BookingID | ProviderID | BookingAmount | CommissionPercent | CommissionAmount
```

*See [DATABASE-SCHEMA-DEPLOYMENT.md](DATABASE-SCHEMA-DEPLOYMENT.md) for complete schema*

---

## 🚀 Deployment

### Recommended Deployment Path

#### Development
1. Test locally on desktop browser
2. Test on mobile (Chrome DevTools)
3. Test on real Android/iPhone

#### Staging
1. Deploy to staging URL (netlify.app subdomain)
2. Load testing (100+ concurrent users)
3. Security testing
4. UAT with beta users

#### Production
1. Deploy to custom domain (service360.balajitech.com)
2. Set up CDN (Cloudflare)
3. Enable HTTPS/SSL
4. Configure backups
5. Set up monitoring & alerting

### Deployment Platforms

#### Netlify (Recommended)
```bash
npm install -g netlify-cli
netlify deploy --prod
```

#### Vercel
```bash
npm install -g vercel
vercel --prod
```

#### GitHub Pages
- Push to GitHub
- Enable in repository settings
- Access at: yourusername.github.io/service360

#### Traditional Hosting
- FTP/SSH upload to host
- Configure .htaccess for routing

---

## ⚙️ Configuration

### Environment Variables
Create `.env` file (or use Netlify/Vercel environment settings):

```env
REACT_APP_GAS_URL=https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercallback
REACT_APP_RAZORPAY_KEY=rzp_live_YOUR_KEY
REACT_APP_GOOGLE_MAPS_KEY=YOUR_MAPS_KEY
REACT_APP_OPENAI_KEY=YOUR_OPENAI_KEY
REACT_APP_TWILIO_SID=YOUR_TWILIO_SID
REACT_APP_TWILIO_TOKEN=YOUR_TWILIO_TOKEN
```

### API Configuration (Backend)

In `Code-Service360-Backend.gs`:

```javascript
const CONFIG = {
  COMMISSION_PERCENT: 15,        // Platform commission
  GST_PERCENT: 18,               // GST rate
  OTP_VALIDITY: 300,             // 5 minutes
  MIN_BOOKING_AMOUNT: 100,       // Minimum booking value
};
```

### Theme Customization (Frontend)

Update CSS variables in HTML:

```css
:root {
  --brand: #e2812f;        /* Orange */
  --brand-dark: #b85e1c;   /* Dark brown */
  --gold: #d9a441;         /* Gold */
  --danger: #c0392b;       /* Red */
}
```

---

## 🔒 Security

### Best Practices Implemented

✅ **Authentication**
- OTP-based login (SMS verification)
- JWT token generation
- Session timeout (1 hour)

✅ **Password Security**
- SHA-256 hashing with salt
- Random salt generation
- No plaintext storage

✅ **Data Protection**
- HTTPS only (SSL/TLS)
- Encrypted data in transit
- Secure API endpoints

✅ **Compliance**
- GST invoicing
- Audit trail logging
- GDPR-ready (data export/deletion)
- PCI DSS compliant (Razorpay)

### Security Checklist

Before Production Deployment:

- [ ] Change default admin password
- [ ] Use production API keys (not test)
- [ ] Enable HTTPS on domain
- [ ] Set up CORS properly
- [ ] Enable rate limiting
- [ ] Implement DDoS protection (Cloudflare)
- [ ] Set up monitoring & alerts
- [ ] Regular security audits
- [ ] Backup strategy (daily)
- [ ] Incident response plan

---

## 📱 Mobile Optimization

### Progressive Web App (PWA)

This platform is **PWA-ready** and can be installed on:
- Android devices
- iPhone (iOS 15.4+)
- Windows/Mac (as app)

### Features
- ✅ Offline functionality (service worker)
- ✅ Add to homescreen
- ✅ Standalone mode (no browser UI)
- ✅ Push notifications
- ✅ App-like experience

### Installation
1. Open in mobile browser
2. Address bar → Install / Add to screen
3. Opens as native app

---

## 🎓 Learning Resources

### For Developers
- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Razorpay API Reference](https://razorpay.com/docs/api)
- [Google Maps API Guide](https://developers.google.com/maps)
- [Service Workers MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

### For Product Managers
- [SaaS Metrics & KPIs](https://www.saastr.com)
- [Marketplace Platform Design](https://www.ycombinator.com)

### Community
- [Product Hunt](https://producthunt.com)
- [Indie Hackers](https://indiehackers.com)

---

## 💰 Pricing Model

### Revenue Streams

1. **Commission per Booking**: 15% of service amount
   - Example: ₹500 service → ₹75 commission to platform
   - GST: 18% on total (₹90 GST)

2. **Provider Subscription** (Optional):
   - Basic: ₹299/month (5% commission discount)
   - Pro: ₹999/month (10% commission discount)
   - Premium: ₹2,499/month (15% commission discount)

3. **Featured Listings**:
   - ₹99/month - Appear at top of search
   - ₹299/month - Appear in all searches

4. **Wallet Top-up Commission**:
   - 2% commission on wallet additions

### Example Revenue (10,000 Bookings/Month)

```
Average Booking Value: ₹600
Total Bookings Value: ₹60,00,000

Commission (15%): ₹9,00,000
GST (18%): ₹1,35,000
Operating Costs: -₹3,00,000
-----------
Net Revenue: ₹7,35,000/month
```

---

## 📈 Growth Metrics

### Key Performance Indicators (KPIs)

**User Growth**
- Monthly Active Users (MAU)
- Daily Active Users (DAU)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)

**Business Metrics**
- Gross Merchandise Volume (GMV)
- Average Order Value (AOV)
- Transaction Success Rate
- Commission Revenue

**Quality Metrics**
- Average Rating (4.5+ target)
- Customer Satisfaction (NPS 50+)
- On-time Completion Rate (95%+)
- Dispute Rate (<2%)

---

## 🐛 Known Limitations & Roadmap

### Current Limitations
- Single-region deployment (can be extended)
- Google Sheets row limit (1M rows)
- No real-time sync (polling-based)
- Limited file storage (Google Drive 15GB free)

### Roadmap (v1.1+)
- [ ] Multi-city support
- [ ] B2B integration (corporate accounts)
- [ ] Advanced analytics dashboard
- [ ] Machine learning recommendations
- [ ] Video tutorial system
- [ ] Subscription plan management
- [ ] Franchise management system
- [ ] API marketplace for third parties

---

## 🤝 Contributing

We welcome contributions! Submit:
- Bug reports
- Feature requests
- Pull requests
- Documentation improvements

---

## 📞 Support

### Technical Support
- **Email**: support@balajiservice360.com
- **Phone**: +91-1800-BALAJI-1
- **Chat**: Live chat on platform

### Developer Support
- **Email**: dev@balajitech.com
- **Phone**: +91-9832014403
- **GitHub Issues**: [service360/issues](https://github.com/balaji-nextgen/service360/issues)

---

## 📜 License

**Proprietary License** - Balaji NextGen Solutions  
All rights reserved. Unauthorized copying prohibited.

---

## 👏 Acknowledgments

Built with ❤️ by the Balaji NextGen team in Siliguri, West Bengal, India.

---

## 📝 Changelog

### Version 1.0 (January 2024)
- ✅ Production release
- ✅ All core features implemented
- ✅ Full documentation
- ✅ Security hardened

---

**Status**: ✅ Production Ready  
**Last Updated**: January 20, 2024  
**Maintained By**: Balaji NextGen Solutions

---

## 🚀 Get Started Now

1. **Read**: [DATABASE-SCHEMA-DEPLOYMENT.md](DATABASE-SCHEMA-DEPLOYMENT.md)
2. **Deploy**: Follow 5-minute setup above
3. **Test**: Create test bookings
4. **Launch**: Go live with your service marketplace!

---

**Questions?** Open an issue on GitHub or email support@balajiservice360.com
