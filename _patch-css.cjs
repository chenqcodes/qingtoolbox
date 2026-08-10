const fs = require('fs');
const p = 'src/styles/global.css';
let c = fs.readFileSync(p, 'utf8');
const start = c.indexOf('.tool-layout {');
const end = c.indexOf('.visually-hidden {');
if (start < 0 || end < 0) throw new Error('markers missing ' + start + ' ' + end);
const neu = `.tool-layout {
  display: block;
  width: 100%;
}

.tool-switcher {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  flex-wrap: wrap;
}

.tool-switcher-home {
  flex-shrink: 0;
  font-size: 0.82rem;
  color: var(--primary);
  text-decoration: none;
  padding: 6px 0;
}

.tool-switcher-home:hover {
  text-decoration: underline;
}

.tool-switcher-label {
  flex: 1;
  min-width: 160px;
  max-width: 280px;
  margin: 0;
}

.tool-switch-select {
  width: 100%;
  margin: 0;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  font-size: 0.88rem;
  cursor: pointer;
}

.tool-main {
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

`;
c = c.slice(0, start) + neu + c.slice(end);
fs.writeFileSync(p, c);
console.log('ok');
