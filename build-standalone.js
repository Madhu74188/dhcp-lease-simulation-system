/**
 * Build Script: Generates standalone.html by inlining CSS and JS
 */
const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const css = fs.readFileSync(path.join(baseDir, 'src/css/styles.css'), 'utf8');

const jsFiles = [
    'src/js/regex-validator.js',
    'src/js/packet.js',
    'src/js/fsm.js',
    'src/js/dhcp-server.js',
    'src/js/client.js',
    'src/js/simulation.js',
    'src/js/ui/simple-ui.js'
];

let bundleJs = jsFiles.map(file => {
    const code = fs.readFileSync(path.join(baseDir, file), 'utf8');
    return `/* --- File: ${file} --- */\n${code}\n`;
}).join('\n');

// Add bootstrap code
bundleJs += `
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SimpleUI();
    window.app.init();
});
`;

let html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

// Replace CSS link with inline style
html = html.replace('<link rel="stylesheet" href="src/css/styles.css">', `<style>\n${css}\n</style>`);

// Replace external script tags with bundled script
const scriptRegex = /<script src="src\/js\/.*?"><\/script>\s*/g;
html = html.replace(scriptRegex, '');
const inlineScriptRegex = /<script>[\s\S]*?<\/script>\s*/g;
html = html.replace(inlineScriptRegex, '');
html = html.replace('</body>', `<script>\n${bundleJs}\n</script>\n</body>`);

fs.writeFileSync(path.join(baseDir, 'standalone.html'), html, 'utf8');
console.log('standalone.html successfully generated.');
