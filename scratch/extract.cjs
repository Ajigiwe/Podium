const fs = require('fs');
const content = fs.readFileSync('scratch/pin_signin.html', 'utf8');
const match = content.match(/https:\/\/i\.pinimg\.com\/[^\s"']+\.jpg/g);
console.log(match ? match[0] : 'not found');
