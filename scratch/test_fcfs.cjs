const http = require('http');

async function test() {
  const numRequests = 10;
  console.log(`Firing ${numRequests} concurrent requests to test endpoint...`);
  
  // Clear first
  await fetch('http://localhost:3000/api/test-fcfs', { method: 'DELETE' });

  const promises = [];
  for (let i = 0; i < numRequests; i++) {
    // each request acts as a different user claiming the SAME problem statement
    promises.push(
      fetch('http://localhost:3000/api/test-fcfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ psNumber: 'SIH_TEST_123', userId: `user_${i}` })
      }).then(async r => {
        return { status: r.status, data: await r.json() };
      }).catch(e => {
        return { status: 'error', error: e.message };
      })
    );
  }
  
  const results = await Promise.all(promises);
  let successCount = 0;
  let failCount = 0;
  
  results.forEach((r, idx) => {
    if (r.status === 200 && r.data.success) {
      successCount++;
      console.log(`Request ${idx}: SUCCESS`);
    } else {
      failCount++;
      console.log(`Request ${idx}: FAILED (${r.data?.error || r.error})`);
    }
  });
  
  console.log(`\nResults: ${successCount} succeeded, ${failCount} failed. (Should be exactly 2 successes!)`);
}

test();
