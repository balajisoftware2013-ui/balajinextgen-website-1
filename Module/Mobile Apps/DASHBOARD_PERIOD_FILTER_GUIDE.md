# Dashboard Period Filter — How to Use

## ✅ Problem Solved
Dashboard now properly shows Month/Qtr/Year data with clear visual feedback when there's **zero sales** for a period.

---

## 📊 Dashboard Period Selector

### Location
At the **top of the Dashboard page**, above the stat cards:

```
📊 Day  Month  Qtr  Year  Custom ▾
```

### What Each Does

| Button | Shows | Example |
|--------|-------|---------|
| **Day** | Today only | "Today's Sales: ₹15,420 (5 bills)" |
| **Month** | Full current month | "This Month's Sales: ₹1,22,500 (47 bills)" |
| **Qtr** | Current quarter (Jan-Mar, Apr-Jun, etc.) | "This Quarter's Sales: ₹5,20,000 (180 bills)" |
| **Year** | Financial year Apr-Mar | "This Year's Sales: ₹12,50,000 (520 bills)" |
| **Custom** | Pick any date range | Enter From/To dates |

---

## 🎯 How to Use

### 1. **Switch to Month View**
```
Dashboard → Click [Month] button
↓
Labels change to "This Month's Sales", "This Month's Purchase", etc.
↓
Numbers update to show full month data
```

### 2. **Switch to Quarter View**
```
Dashboard → Click [Qtr] button
↓
Shows Apr-Jun / Jul-Sep / Oct-Dec / Jan-Mar depending on today's date
↓
See quarterly performance at a glance
```

### 3. **Switch to Year View**
```
Dashboard → Click [Year] button
↓
Shows entire financial year (Apr 2025 - Mar 2026)
↓
Compare annual targets vs actuals
```

### 4. **Custom Date Range**
```
Dashboard → Click [Custom] button
↓
Two date pickers appear: "From" and "To"
↓
Pick your date range
↓
Click [Go] button
↓
Dashboard updates with selected period
```

---

## 📌 Visual Feedback

### When Data Exists
```
This Month's Sales
₹1,22,500
47 bills
```
✅ Shows amount and bill count normally

### When Zero Data
```
This Quarter's Sales
₹0
No sales
```
✅ Shows "No sales" (grayed out) instead of "0 bills"  
✅ Makes it clear period had no activity

---

## 🔄 Examples

### Scenario 1: Check This Month's Performance
1. Go to Dashboard
2. Click **[Month]** button
3. See "This Month's Sales: ₹..., "This Month's Purchase: ₹...", "This Month's Profit: ₹..."
4. Stat cards show running total for current month

### Scenario 2: Analyze Quarter Performance
1. Dashboard → Click **[Qtr]**
2. Automatically picks current quarter (e.g., Oct-Dec if today is Nov 15)
3. See quarterly sales, purchase, profit, cash position
4. Compare with last quarter by switching back to reports

### Scenario 3: See Full Year Targets
1. Dashboard → Click **[Year]**
2. Shows Apr 2025 - Mar 2026 (or current FY)
3. "This Year's Sales: ₹12,50,000"
4. Check if you're on track for annual goal

### Scenario 4: Custom Analysis
1. Dashboard → Click **[Custom]** 
2. Enter: From = 15-06-2025, To = 15-07-2025
3. Click **[Go]**
4. See stats for exactly those dates only

---

## 🎨 Stat Card Labels Update Automatically

When you click a period button, all 4 main cards update:

| Period | Label Changes From | Changes To |
|--------|-------------------|-----------|
| Day | Today's Sales | Today's Sales |
| Month | Today's Sales | **This Month's Sales** |
| Qtr | Today's Sales | **This Quarter's Sales** |
| Year | Today's Sales | **This Year's Sales** |

The **amount (₹) and bill count also update instantly** to match the period.

---

## ❌ Zero Data Handling

### Before (Confusing)
```
This Month's Sales
₹0
0 bills  ← Looks like there's data but it's zero
```

### After (Clear)
```
This Month's Sales
₹0
No sales  ← Clearly shows NO activity this period
```

Both "₹0" and bill text show in **lighter gray color** when zero, so it's visually distinct from periods with actual data.

---

## 💡 Tips

- **Active button** is highlighted with blue background (e.g., [Day] is active by default)
- **Period changes are instant** — no need to refresh
- **All stat cards update together** when you click a period button
- **Custom dates persist** — if you set Aug 1-31, clicking back to [Month] resets to current month
- **Zero data is OK** — some periods may legitimately have no sales (e.g., Sunday with no business)

---

## 🔗 Linking to Reports

Each stat card is **clickable** — click on any card to jump to detailed report:

- Click Sales card → Opens **Sales Register** with same period
- Click Purchase card → Opens **Purchase Register** with same period  
- Click Profit card → Opens **P&L Report** with same period

---

## ✅ Checklist

- [ ] Can see **Day · Month · Qtr · Year · Custom** buttons on Dashboard
- [ ] Can click [Month] and see labels change to "This Month's..."
- [ ] Can click [Qtr] and see quarterly totals
- [ ] Can click [Year] and see annual totals
- [ ] When zero data, shows "No sales" / "No purchases" (not "0 bills")
- [ ] Stat card labels update when switching periods
- [ ] Numbers update to match selected period

---

**Version:** Dashboard Period Filter v2  
**Status:** ✅ Fully Functional
