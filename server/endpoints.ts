export function apiRoot(baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, "");
  return /\/v\d+(?:beta\d*)?$/.test(new URL(root).pathname) ? root : `${root}/v1`;
}
