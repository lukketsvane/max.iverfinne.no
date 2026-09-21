// The supplied bitmap alphabet, with a real text fallback and accessible label.
const font = new Image();
font.src = 'assets/results-native/sprites/font-5x7.png';
export function pixelText(node, text, scale = 3, spacing = 1) {
  const copy = document.createElement('span'); copy.className = 'pixel-copy'; copy.textContent = text;
  const canvas = document.createElement('canvas'); canvas.className = 'pixel-label'; canvas.setAttribute('aria-hidden', 'true');
  node.append(canvas, copy);
  const paint = () => {
    if (!font.complete || !font.naturalWidth) return;
    const str = text.toUpperCase(); canvas.width = str.length * (6 + spacing) - 1 - spacing; canvas.height = 7;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    for (let i = 0; i < str.length; i++) {
      const n = Math.max(0, Math.min(63, str.charCodeAt(i) - 32));
      ctx.drawImage(font, n % 16 * 6, Math.floor(n / 16) * 8, 5, 7, i * (6 + spacing), 0, 5, 7);
    }
    canvas.style.width = canvas.width * scale + 'px'; canvas.style.height = 7 * scale + 'px';
    node.classList.add('pixel-ready');
  };
  if (font.complete) paint(); else font.addEventListener('load', paint, { once: true });
  return node;
}
