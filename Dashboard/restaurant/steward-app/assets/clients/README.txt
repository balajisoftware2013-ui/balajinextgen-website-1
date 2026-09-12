HAPPYSERVE CLIENT BRANDING ASSET SLOTS (10 CLIENTS)
=====================================================

CLIENT-01 through CLIENT-10 are reserved branding slots.
Each folder contains branding.json. The Steward Mobile app does NOT require
these placeholder files to show branding: it auto-captures the same logo/banner
saved by Restaurant Dashboard in localStorage using the client ID.

Supported dashboard branding keys include:
  erp_restaurant_brand_<CLIENT_ID>
  erp_client_brand_<CLIENT_ID>
  bnx_restaurant_brand_<CLIENT_ID>
  restaurant_brand_<CLIENT_ID>
  restaurantBrand_<CLIENT_ID>
  client_brand_<CLIENT_ID>

Fields:
  restaurantName, logoDataUrl/logoUrl, bannerDataUrl/bannerUrl, tagline

If no client branding exists, HAPPYSERVE common branding is used automatically.
The splash screen is always the common Balaji HAPPYSERVE brand; client branding
appears on Login/Home surfaces after the client identity is known.
