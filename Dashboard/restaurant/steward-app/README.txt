HAPPYSERVE Steward Mobile — FINAL ERROR FIXED

Repairs:
- Restored corrupted KOT print template.
- Restored corrupted report print template.
- Fixed broken multiline WhatsApp KOT text strings.
- Fixed broken multiline logout confirmation string.
- Fixed reservation sync ReferenceError: calendarDate() was scoped inside another IIFE.
- Preserved common Balaji pre-login branding and Client 10 authenticated branding.
- Preserved install-card hiding after installation / standalone launch.
- Included PWA manifest, service worker, UI icons, Balaji assets and Client 10 assets.

No Master DB/backend schema change is required for these frontend fixes.

Deployment: upload the complete folder as one unit and use HTTPS for PWA/service-worker installation.
Do not use file:// to test PWA installation; browser security restrictions apply to service workers/local-origin frames.
