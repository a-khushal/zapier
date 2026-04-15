function resolvePayloadPath(payload: unknown, path: string) {
  const keys = path.split(".");
  let value: any = payload;

  for (const key of keys) {
    if (value === null || value === undefined) {
      return "";
    }
    value = value[key];
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function renderBodyTemplate(template: string, payload: unknown) {
  return template.replace(/\{\{\s*payload\.([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, path) => {
    return resolvePayloadPath(payload, path);
  });
}
