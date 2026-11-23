// Quelles sources sont configurées (variables d'environnement Vercel présentes) ?
export function configured() {
  const google = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return {
    ga4: google && Boolean(process.env.GA4_PROPERTY_ID),
    gsc: google && Boolean(process.env.GSC_SITE_URL),
    shopify: Boolean(process.env.SHOPIFY_STORE_DOMAIN)
      && Boolean(process.env.SHOPIFY_ADMIN_TOKEN || (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET)),
  };
}
