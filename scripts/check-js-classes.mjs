import fs from 'fs';

const js = fs.readFileSync('public/js/communities.js', 'utf8');
const css = fs.readFileSync('public/css/podium.css', 'utf8');

// Grab class="..." tokens; strip surrounding quotes and stray braces from
// template-literal fragments like `${isDead ? 'bg-[#E8EEFF]' : 'bg-[#1845D4]'}`
const classes = new Set();
const re = /class="([^"]+)"/g;
let m;
while ((m = re.exec(js))) {
	for (const c of m[1].split(/\s+/)) {
		const clean = c
			.replace(/\$\{[^}]*\}/g, ' ')
			.replace(/[`'"}{]/g, ' ')
			.trim();
		for (const token of clean.split(/\s+/)) {
			if (token && token.includes('[')) classes.add(token);
		}
	}
}

// CSS selectors escape [ ] # . : / with backslashes
function cssEscaped(token) {
	const colonIdx = token.indexOf(':');
	const variant = colonIdx >= 0 ? token.slice(0, colonIdx + 1) : '';
	const utility = colonIdx >= 0 ? token.slice(colonIdx + 1) : token;
	const escUtility = utility.replace(/([[\]#./():])/g, '\\$1');
	return variant.replace(/:/g, '\\:') + escUtility;
}

const missing = [];
for (const c of classes) {
	if (!css.includes(cssEscaped(c))) missing.push(c);
}

console.log('checked:', classes.size, 'arbitrary classes');
if (missing.length) {
	console.log('MISSING FROM CSS:');
	for (const c of missing) console.log(' -', c);
} else {
	console.log('ALL PRESENT IN COMPILED CSS');
}
