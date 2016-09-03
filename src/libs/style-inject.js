let styles = [];
let dirty = false;

export function style(css) {
  if (!dirty) requestAnimationFrame(update);
  dirty = true;
  styles.push(css);
}

function update() {
  if (!dirty) return;
  dirty = false;
  let style = document.createElement("style");
  style.textContent = styles.join("\n")
  styles.length = 0;
  document.head.appendChild(style);
}
