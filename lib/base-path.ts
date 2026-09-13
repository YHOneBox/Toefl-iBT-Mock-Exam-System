export const BASE_PATH = "/toefl";

export function appPath(path = "/") {
  const raw = path.startsWith("/") ? path : `/${path}`;
  if (raw === BASE_PATH || raw.startsWith(`${BASE_PATH}/`)) return raw;
  if (raw === "/") return BASE_PATH;
  return `${BASE_PATH}${raw}`;
}
