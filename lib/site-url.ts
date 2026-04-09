export function displaySiteUrl(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) {
    return siteUrl.slice("sc-domain:".length).replace(/\/$/, "");
  }
  try {
    const u = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
    const host = u.hostname;
    const path = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "";
    return `${host}${path}`;
  } catch {
    return siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function faviconDomain(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) {
    return siteUrl.slice("sc-domain:".length).replace(/\/$/, "");
  }
  try {
    return new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname;
  } catch {
    return siteUrl.replace(/^https?:\/\//, "").split("/")[0] || siteUrl;
  }
}

