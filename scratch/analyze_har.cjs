const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/localhost.har', 'utf8'));
const entries = data.log.entries;

console.log(`Total Requests: ${entries.length}`);

// Sort by time
const byTime = [...entries].sort((a, b) => b.time - a.time);
console.log('\n--- Top 10 Longest Requests ---');
byTime.slice(0, 10).forEach(e => {
  console.log(`${e.time.toFixed(2)}ms - ${e.request.method} ${e.request.url.split('?')[0]}`);
});

// Sort by size
const bySize = [...entries].sort((a, b) => Math.max(0, b.response.bodySize) - Math.max(0, a.response.bodySize));
console.log('\n--- Top 10 Largest Responses ---');
bySize.slice(0, 10).forEach(e => {
  console.log(`${(Math.max(0, e.response.bodySize) / 1024).toFixed(2)} KB - ${e.request.method} ${e.request.url.split('?')[0]}`);
});

// Detect duplicate requests (N+1)
const counts = {};
entries.forEach(e => {
  if (e.request.method === 'GET') {
    counts[e.request.url] = (counts[e.request.url] || 0) + 1;
  }
});
console.log('\n--- Repeated GET Requests (Possible N+1) ---');
Object.entries(counts)
  .filter(([_, count]) => count > 1)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([url, count]) => {
    console.log(`${count}x - ${url.split('?')[0]}`);
  });

// Types breakdown
const types = {};
entries.forEach(e => {
  const t = e._resourceType || 'unknown';
  types[t] = (types[t] || 0) + 1;
});
console.log('\n--- Resource Types ---');
console.log(types);
