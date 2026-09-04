import fs from 'fs';

const css = fs.readFileSync('public/css/podium.css', 'utf8');

// The stylesheet escapes special chars: .bg-\[\#1845D4\]
const checks = [
	'bg-\\[\\#1845D4\\]',
	'from-\\[\\#1845D4\\]',
	'to-\\[\\#0F2FA8\\]',
	'from-\\[\\#0F2FA8\\]',
	'text-\\[\\#1845D4\\]',
	'bg-\\[\\#E8EEFF\\]',
	'text-\\[9px\\]',
	'w-\\[1\\.5px\\]',
	// named utilities as fallbacks
	'from-indigo-500',
	'to-purple-500',
	'bg-blue-600',
	'bg-indigo-600',
];

for (const c of checks) {
	console.log(css.includes(c) ? 'YES' : 'NO ', ' ', c);
}
