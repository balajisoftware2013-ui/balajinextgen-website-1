HAPPYSERVE Steward Mobile - Final opening/branding fix

Opening flow:
1. Branded HAPPYSERVE loading/splash is shown for about 1.35 seconds.
2. It fades into the SAME Steward Login page.
3. Login scroll position is reset to the top.
4. No separate install popup is shown.
5. The inline Install HAPPYSERVE App card remains on Login and is hidden after successful installation.
6. Client branding is auto-captured from the existing ERP/localStorage branding records.
7. Client 10 / CL00010 has bundled fallback assets under assets/ so it shows HASHTAG A Restro Pub if live branding has not yet synced.
8. The client banner is used as the login brand background when available.

Replace the existing steward-mobile.html with this file and keep the assets folder beside it.
