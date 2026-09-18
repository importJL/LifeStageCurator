export function cleanEditorHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/ on[a-z]+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
}
