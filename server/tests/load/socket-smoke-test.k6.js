// k6 run tests/load/socket-smoke-test.k6.js
// npm run test:socket:smoke

import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Counter } from 'k6/metrics';

const connectionErrors = new Counter('connection_errors');
const connectionSuccesses = new Counter('connection_successes');

const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

export const options = {
  vus: 5,           // 5 concurrent users
  duration: '30s',  // Run for 30 seconds
  thresholds: {
    'connection_errors': ['count < 1'], // Zero connection errors
    'ws_connecting': ['p(95) < 500'],   // 95% connect under 500ms
  },
};

export default function () {
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;

  const res = ws.connect(url, function (socket) {
    socket.on('open', function () {
      console.log(`✓ VU ${__VU}: Connected successfully`);
      connectionSuccesses.add(1);

      // Send Socket.io CONNECT packet
      socket.send('40');

      // Send a test ping
      socket.setTimeout(function () {
        socket.send('2'); // PING
      }, 1000);

      // Close after 5 seconds
      socket.setTimeout(function () {
        socket.close();
      }, 5000);
    });

    socket.on('message', function (data) {
      if (data === '3') {
        console.log(`✓ VU ${__VU}: Received PONG`);
      }
    });

    socket.on('close', function () {
      console.log(`✓ VU ${__VU}: Disconnected cleanly`);
    });

    socket.on('error', function (e) {
      console.log(`✗ VU ${__VU}: Error - ${e.error()}`);
      connectionErrors.add(1);
    });
  });

  check(res, {
    'Connected successfully': (r) => r && r.status === 101,
  });

  sleep(1);
}

export function setup() {
  console.log('🔌 Socket.io Smoke Test');
  console.log(`   Target: ${WS_URL}`);
  console.log('   VUs: 5, Duration: 30s');
}

export function teardown() {
  console.log('✅ Smoke test complete');
}
