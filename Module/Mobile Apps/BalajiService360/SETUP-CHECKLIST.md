# Balaji Service360 - Setup Checklist & Verification

**Complete checklist to deploy Service360 in production**

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### Step 1: Files Ready (5 min)
- [ ] Download `balajiservice360-production.html`
- [ ] Download `Code-Service360-Backend.gs`
- [ ] Download `manifest.json`
- [ ] Download `sw.js`
- [ ] Download all icon/logo images
- [ ] Verify all files are in outputs folder

### Step 2: Google Account Setup (5 min)
- [ ] Have Google Account ready
- [ ] Google Drive access verified
- [ ] Google Sheets enabled
- [ ] Google Apps Script enabled
- [ ] Gmail access working

### Step 3: Third-Party Accounts (15 min)
- [ ] Create Razorpay account
- [ ] Verify Razorpay business details
- [ ] Get Razorpay API keys
- [ ] Create Twilio account
- [ ] Verify phone number in Twilio
- [ ] Get Twilio credentials
- [ ] Create Google Cloud account
- [ ] Enable Google Maps API
- [ ] Get Google Maps API key

### Step 4: Database Setup (10 min)
- [ ] Create "Master Database" Google Sheet
- [ ] Copy Master Sheet ID
- [ ] Create "Users Database" Google Sheet
- [ ] Copy Users Sheet ID
- [ ] Create Google Drive folder for clients
- [ ] Copy folder ID

---

## 🔧 DEPLOYMENT STEPS

### Step 5: Create Google Apps Script Backend (15 min)

**Instructions:**
1. Go to [script.google.com](https://script.google.com)
2. Create new project: `Service360 Backend v1.0`
3. Open `Code-Service360-Backend.gs`
4. Copy entire content
5. Paste into Apps Script editor
6. Click Save (Ctrl+S)

**Add API Keys to Project Settings:**
1. Click gear icon (Settings)
2. Click "Script properties"
3. Add these properties:

```
Key: RAZORPAY_KEY
Value: rzp_live_YOUR_KEY

Key: RAZORPAY_SECRET
Value: YOUR_SECRET

Key: TWILIO_SID
Value: YOUR_TWILIO_SID

Key: TWILIO_TOKEN
Value: YOUR_TOKEN

Key: JWT_SECRET
Value: your-unique-secret-key-min-32-chars
```

4. Save properties

**Initialize Database:**
1. Select `setupDatabase` from dropdown
2. Click Run button
3. Authorize required permissions
4. Check execution log: "Database setup completed successfully!"

**Deploy as Web App:**
1. Click Deploy > New Deployment
2. Select "Web app" from dropdown
3. Execute as: Your Google Account
4. Who has access: Anyone
5. Click Deploy
6. Copy the deployment URL
7. **SAVE THIS URL** - needed for frontend

**URL Format:**
```
https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercallback
```

### Step 6: Update Frontend Configuration (10 min)

**Edit `balajiservice360-production.html`:**

Find the CONFIG section (around line 30-50):

```javascript
const CONFIG = {
  GAS_URL: 'PASTE_YOUR_DEPLOYMENT_URL_HERE',
  RAZORPAY_KEY: 'rzp_live_YOUR_KEY',
  GOOGLE_MAPS_KEY: 'YOUR_MAPS_KEY',
  OPENAI_KEY: 'YOUR_OPENAI_KEY',
};
```

Update with:
- [ ] `GAS_URL`: Deployment URL from Step 5
- [ ] `RAZORPAY_KEY`: From Razorpay dashboard
- [ ] `GOOGLE_MAPS_KEY`: From Google Cloud console
- [ ] `OPENAI_KEY`: From OpenAI (optional)

Also update sheet IDs around line 40:
```javascript
MASTER_SHEET: '1FuNJ_XejE2ekYTnk71w...', // Your master sheet ID
USERS_SHEET: '1VpsTwdULiaj-YeyllgB...',   // Your users sheet ID
```

### Step 7: Deploy Frontend (10 min)

**Option A: Netlify (Recommended)**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir .

# Get live URL like: https://service360-xxx.netlify.app
```

**Option B: GitHub Pages**
1. Create GitHub repository
2. Push all files to main branch
3. Go to Settings > Pages
4. Enable GitHub Pages
5. Get URL: https://username.github.io/service360

**Option C: Traditional Hosting**
1. Upload files via FTP/SFTP
2. Configure .htaccess for routing
3. Get live URL from your host

**Option D: Google Drive**
1. Upload HTML to Google Drive
2. Right-click > Share > Publish to web
3. Get link

- [ ] Frontend deployed and live
- [ ] Verified HTTPS working
- [ ] Images loading correctly
- [ ] No console errors (F12)

---

## 🧪 TESTING PHASE

### Step 8: Verify Backend Connection (5 min)

**In browser console (F12):**
```javascript
// Test API connection
api('sendOTP', { mobile: '9876543210', role: 'customer' })
  .then(r => console.log('✓ Backend connected:', r))
  .catch(e => console.log('✗ Backend error:', e));
```

Expected response:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "debug": "OTP: 123456"
}
```

- [ ] Backend connected successfully
- [ ] OTP sending working

### Step 9: Test Customer Registration (5 min)

1. Open deployed URL in browser
2. Click "I'm a Customer"
3. Enter mobile: `9876543210`
4. Click "Send OTP"
5. Enter OTP: `123456` (shown in backend logs)
6. Click "Verify OTP"
7. Fill profile:
   - Name: Test Customer
   - Email: test@email.com
   - City: Mumbai
   - Address: Test Address
8. Click "Continue"

Expected result:
- [ ] OTP verified
- [ ] Profile saved
- [ ] Redirected to customer dashboard
- [ ] User visible in CUSTOMERS sheet

### Step 10: Test Provider Registration (5 min)

1. Go back to home
2. Click "I'm a Provider"
3. Enter mobile: `9876543211`
4. Click "Send OTP"
5. Enter OTP: `123456`
6. Fill provider details:
   - Name: Test Provider
   - Category: Plumbing
   - City: Bangalore
   - Years: 5
   - Bio: Test bio
7. Click "Continue to KYC"
8. Upload sample documents
9. Click "Submit for Verification"

Expected result:
- [ ] Provider created
- [ ] KYC submitted
- [ ] Provider in PROVIDERS sheet with KYCStatus: pending

### Step 11: Test Admin Panel (5 min)

1. Look for Admin Login link (add if needed)
2. Enter:
   - Username: `admin@service360.com`
   - Password: `admin@123` (CHANGE THIS!)
3. Click Login

Expected result:
- [ ] Admin login successful
- [ ] Dashboard shows stats
- [ ] Pending KYC shows test provider

**Approve test provider:**
1. Click "Approve" next to test provider
2. Check PROVIDERS sheet - KYCStatus changed to approved

Expected result:
- [ ] Provider approval working
- [ ] Email sent to provider
- [ ] Provider now active

### Step 12: Test Booking Flow (10 min)

**As customer:**
1. Login as customer (mobile: 9876543210)
2. Click "Book a Service"
3. Select category: Plumbing
4. Enter description: Pipe leak
5. Select date (today or tomorrow)
6. Select time: 14:00
7. Enter location: Mumbai
8. Click "Find Providers"

Expected result:
- [ ] Search successful
- [ ] Test provider appears in list
- [ ] Provider details correct

### Step 13: Test Payment Flow (10 min)

1. Click on provider to select
2. System creates booking
3. Shows payment page
4. Click "Pay with Razorpay"

**Important:** Use Razorpay test mode
- [ ] Order created in backend
- [ ] Razorpay window opens
- [ ] Test payment succeeds
- [ ] Booking status updates to "confirmed"

### Step 14: Verify Database (5 min)

**Check Google Sheets:**

1. Open Master Sheet
2. Check BOOKINGS tab - new booking appears
3. Check PAYMENTS tab - payment recorded
4. Check INVOICES tab - invoice generated
5. Check CUSTOMERS tab - test customer updated
6. Check PROVIDERS tab - test provider updated
7. Check ADMINS tab - admin credentials secure

Expected result:
- [ ] All data properly recorded
- [ ] No data corruption
- [ ] Formulas working (if any)

---

## 🔒 SECURITY VERIFICATION

### Step 15: Security Checks (15 min)

- [ ] **Change Admin Password!**
  - Go to ADMINS sheet
  - Change password from `admin@123` to strong password
  - Delete this default account after creating real admin

- [ ] **HTTPS Enabled**
  - Check URL bar shows 🔒 padlock
  - Entire app uses HTTPS

- [ ] **Verify API Keys**
  - No API keys in frontend code
  - All keys in backend project settings
  - Production keys only (not test keys)

- [ ] **Check CORS Settings**
  - Verify frontend domain in Apps Script settings
  - Test cross-domain requests

- [ ] **Database Access**
  - Verify only backend can access sheets
  - Frontend never directly accesses Google Sheets

- [ ] **Password Hashing**
  - Admin password is hashed (not plaintext)
  - Verify in ADMINS sheet

### Step 16: Performance Checks (10 min)

- [ ] **Page Load Speed**
  - Open DevTools > Network
  - Check page loads < 3 seconds
  - No large unoptimized images
  - JavaScript bundled correctly

- [ ] **Mobile Performance**
  - Test on Android phone
  - Test on iPhone
  - Check touch interactions responsive
  - Check buttons not too small

- [ ] **API Performance**
  - Check API response times < 2 seconds
  - No timeout errors
  - Proper error handling

---

## 📋 PRE-PRODUCTION CHECKLIST

### Step 17: Final Checks (30 min)

#### Authentication
- [ ] Customer login/OTP working
- [ ] Provider login/OTP working
- [ ] Admin login working
- [ ] Session timeout after 1 hour
- [ ] Logout clears session

#### Bookings
- [ ] Can search providers
- [ ] Can create bookings
- [ ] Booking appears in both customer & provider
- [ ] Status updates working
- [ ] Cancellation working

#### Payments
- [ ] Payment gateway integration working
- [ ] Invoice generated automatically
- [ ] GST calculated correctly
- [ ] Refund flow working
- [ ] Wallet updates correctly

#### Notifications
- [ ] Email notifications sending
- [ ] SMS/OTP working
- [ ] In-app notifications showing
- [ ] Push notifications (if enabled)

#### Admin Features
- [ ] Admin dashboard stats correct
- [ ] KYC approval workflow working
- [ ] Report generation working
- [ ] Commission calculation correct
- [ ] User management functioning

#### Design & UX
- [ ] All pages mobile-responsive
- [ ] Dark mode working (if enabled)
- [ ] Icons/images loading correctly
- [ ] Fonts/typography correct
- [ ] Accessibility (alt text, contrast)

---

## 🚀 PRODUCTION DEPLOYMENT

### Step 18: Production Launch

- [ ] All testing passed
- [ ] Security audit completed
- [ ] Backups configured
- [ ] Monitoring enabled
- [ ] Support team trained
- [ ] Marketing materials ready
- [ ] Analytics setup (Google Analytics)
- [ ] User documentation prepared

**Go Live:**
1. Announce platform publicly
2. Share URL on social media
3. Send invites to early users
4. Monitor for issues
5. Have support team on standby

---

## 📊 POST-LAUNCH MONITORING

### Step 19: Monitor First Week

**Daily:**
- [ ] Check error logs
- [ ] Monitor API latency
- [ ] Check failed payments
- [ ] Review user feedback
- [ ] Monitor server load

**Weekly:**
- [ ] Review booking metrics
- [ ] Check revenue numbers
- [ ] Analyze user retention
- [ ] Review provider quality
- [ ] Check complaint ratio

**Metric Targets:**
```
✓ Booking success rate: 95%+
✓ Payment success rate: 98%+
✓ Customer satisfaction: 4.5+ stars
✓ Average response time: < 2 seconds
✓ Uptime: 99.9%
```

---

## 🎯 SUCCESS INDICATORS

### Launch Complete When:

- ✅ 10+ active customer users
- ✅ 5+ active provider users
- ✅ 5+ completed bookings
- ✅ 100% payment success rate
- ✅ Zero critical bugs
- ✅ All notifications working
- ✅ Analytics tracking correctly
- ✅ Support system functional

---

## 📞 TROUBLESHOOTING DURING SETUP

### Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "GAS_URL is not defined" | Update CONFIG in HTML with actual GAS URL |
| OTP not sending | Check Twilio credentials in Apps Script project settings |
| Backend 404 error | Verify deployment URL exactly matches CONFIG.GAS_URL |
| Razorpay checkout fails | Verify API key is production key (not test) |
| Images not loading | Check image paths match actual hosting URLs |
| Sheet not found error | Verify Sheet IDs in CONFIG match actual sheets |
| Admin login fails | Confirm ADMINS sheet exists with data |
| CORS error | Verify frontend domain is whitelisted in Apps Script |

---

## 📝 DOCUMENTATION BEFORE HANDOFF

Create these documents for your team:
- [ ] Admin Operations Manual
- [ ] Customer Support Guide
- [ ] Provider Onboarding Process
- [ ] Dispute Resolution Procedure
- [ ] Financial Settlement Process
- [ ] Emergency Contact Procedures

---

## 🎓 FINAL VERIFICATION TEST

Run this complete flow to verify everything:

1. **Customer Journey**
   - ✓ Login as customer
   - ✓ Search services
   - ✓ Create booking
   - ✓ Make payment
   - ✓ Rate provider

2. **Provider Journey**
   - ✓ Login as provider
   - ✓ Accept job
   - ✓ Complete service
   - ✓ Receive payment
   - ✓ View earnings

3. **Admin Journey**
   - ✓ Login as admin
   - ✓ Approve providers
   - ✓ View stats
   - ✓ Generate reports
   - ✓ Handle disputes

---

## ✨ LAUNCH READY!

When all checkboxes are ticked:

```
╔════════════════════════════════════╗
║  BALAJI SERVICE360 IS LIVE! 🚀     ║
║                                    ║
║  Platform: Production Ready        ║
║  Status: ✓ All Systems Go          ║
║  Users: Ready to onboard           ║
╚════════════════════════════════════╝
```

---

## 📱 SHARE WITH USERS

**Beta Link**: https://your-domain.com/service360
**Download App**: Install on home screen
**Support Email**: support@balajiservice360.com
**Feedback Form**: Available in app settings

---

## 🎊 Congratulations!

Your Balaji Service360 platform is now live and production-ready!

**Next Steps:**
1. Monitor metrics daily
2. Collect user feedback
3. Plan feature updates
4. Scale to new cities
5. Expand service categories

---

**Setup Completion Date**: ________________  
**Verified By**: ________________  
**Status**: ✅ PRODUCTION READY  

---

**Questions?** Contact: balajisoftware2013@gmail.com | +91-9832014403
