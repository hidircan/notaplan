/**
 * Evraklar — şablon `bodyHtml`'i için sunucu tarafı, allowlist tabanlı
 * minimal HTML sanitizasyonu. Yeni ağır bağımlılık (DOMPurify, jsdom, vb.)
 * EKLENMEDİ — bilinçli olarak; yönetici tarafından girilen sınırlı bir
 * belge-şablonu alt kümesi için (üçüncü şahıs zengin metin editörü değil)
 * bu kapsamda regex tabanlı bir yaklaşım yeterli ve savunulabilir.
 *
 * Strateji üç geçiş:
 * 1) Tehlikeli elemanlar İÇERİKLERİYLE BİRLİKTE tamamen kaldırılır
 *    (script/style/iframe/object/embed/form/svg/noscript/...).
 * 2) Kalan etiketler ALLOWLIST'e göre süzülür — izinli olmayan etiket
 *    kaldırılır ama iç metni KORUNUR (biçimlendirme kaybolur, içerik kalır).
 * 3) İzinli etiketlerde bile yalnız izinli özellikler (attribute) tutulur —
 *    bu tek başına TÜM `on*` event handler'ları (onclick, onerror, ...) ve
 *    `style` tabanlı enjeksiyonu eler. `href`/`src` değerleri ayrıca
 *    `javascript:`/`vbscript:`/`data:text/html` şemalarına karşı kontrol
 *    edilir; şüpheli değerler `#` ile değiştirilir.
 */

const DANGEROUS_ELEMENTS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "link",
  "meta",
  "base",
  "frame",
  "frameset",
  "noscript",
  "svg",
  "math",
  "template",
];

const ALLOWED_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "div",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "br",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "a",
  "img",
  "small",
  "blockquote",
]);

/** Etiket başına izinli özellik allowlist'i — bunların dışındaki HER özellik (dolayısıyla tüm `on*` handler'lar ve `style`) kaldırılır. */
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href", "title"],
  img: ["src", "alt", "title"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
};

const DANGEROUS_URL_RE = /^\s*(javascript|vbscript|data:text\/html)\s*:/i;

function stripDangerousElements(html: string): string {
  let out = html;
  for (const tag of DANGEROUS_ELEMENTS) {
    // Açılış+kapanış arası (içerik dahil) kaldır.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
    // Kendi kendine kapanan veya kapanışsız kalan varyantlar.
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");
  }
  return out;
}

function sanitizeAttributes(tag: string, attrsRaw: string): string {
  const allowed = ALLOWED_ATTRS[tag] ?? [];
  if (allowed.length === 0) return "";
  const attrRe = /([a-zA-Z][\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(attrsRaw))) {
    const name = m[1]!.toLowerCase();
    if (!allowed.includes(name)) continue; // on*, style, class, id, vb. hepsi burada elenir
    let value = m[3] ?? m[4] ?? m[5] ?? "";
    if ((name === "href" || name === "src") && DANGEROUS_URL_RE.test(value)) {
      value = "#";
    }
    out += ` ${name}="${value.replace(/"/g, "&quot;")}"`;
  }
  return out;
}

function filterTagsAndAttributes(html: string): string {
  return html.replace(/<\/?([a-zA-Z][\w-]*)((?:\s+[^<>]*)?)\/?>/g, (full, tagRaw: string, attrsRaw: string) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ""; // izinsiz etiket kaldırılır, iç metin (bu replace dışında) korunur
    const isClosing = full.startsWith("</");
    if (isClosing) return `</${tag}>`;
    const attrs = sanitizeAttributes(tag, attrsRaw ?? "");
    const selfClosing = tag === "br" || tag === "hr" || tag === "img";
    return `<${tag}${attrs}${selfClosing ? " /" : ""}>`;
  });
}

/**
 * Şablon `bodyHtml`'ini temizler. Template create/update tool'unda YAZMADAN
 * ÖNCE çağrılır; ayrıca (savunma katmanı) render anında da uygulanabilir —
 * bkz. renderTemplate çağıran taraf. Girdi boşsa boş döner, asla hata
 * fırlatmaz (kural: eksik/bozuk içerik güvenli davranır).
 */
export function sanitizeTemplateHtml(html: string | undefined | null): string {
  if (!html) return "";
  const withoutDangerous = stripDangerousElements(html);
  const withoutComments = withoutDangerous.replace(/<!--[\s\S]*?-->/g, "");
  return filterTagsAndAttributes(withoutComments);
}
