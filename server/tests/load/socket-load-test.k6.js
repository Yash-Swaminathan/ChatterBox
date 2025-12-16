// k6 run tests/load/socket-load-test.k6.js
// npm run test:socket:load

import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Counter, Trend } from 'k6/metrics';
// Custom metrics
const connectionErrors = new Counter('connection_errors');
const connectionSuccesses = new Counter('connection_successes');
const connectionDuration = new Trend('connection_duration');
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');

// Configuration
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

// Test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Baseline - 10 concurrent users for 30 seconds
    baseline: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      gracefulStop: '5s',
      tags: { scenario: 'baseline' },
    },

    // Scenario 2: Load Test - Ramp up to 100 users
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },  // Ramp up to 50 users
        { duration: '1m', target: 100 },  // Ramp up to 100 users
        { duration: '1m', target: 100 },  // Stay at 100 users
        { duration: '30s', target: 0 },   // Ramp down
      ],
      gracefulStop: '10s',
      tags: { scenario: 'load_test' },
      startTime: '35s', // Start after baseline
    },

    // Scenario 3: Stress Test - Push to limits (500 users)
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 },  // Ramp to 200
        { duration: '1m', target: 500 },  // Ramp to 500
        { duration: '2m', target: 500 },  // Hold at 500
        { duration: '1m', target: 0 },    // Ramp down
      ],
      gracefulStop: '15s',
      tags: { scenario: 'stress_test' },
      startTime: '4m', // Start after load test
    },

    // Scenario 4: Spike Test - Sudden load spike
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 1000 }, // Sudden spike to 1000
        { duration: '30s', target: 1000 }, // Hold spike
        { duration: '10s', target: 0 },    // Drop to 0
      ],
      gracefulStop: '10s',
      tags: { scenario: 'spike_test' },
      startTime: '10m', // Start after stress test
    },
  },

  // Thresholds - Define success criteria
  thresholds: {
    'connection_successes': ['count > 0'],
    'connection_errors': ['count < 10'], // Less than 10 connection errors
    'connection_duration': ['p(95) < 1000'], // 95% of connections under 1 second
    'ws_connecting': ['p(95) < 1000'],
    'ws_msgs_sent': ['count > 0'],
    'ws_msgs_received': ['count > 0'],
  },
};

export default function () {
  const startTime = Date.now();

  // Socket.io connection URL (with engine.io protocol)
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;

  const res = ws.connect(url, function (socket) {
    const connTime = Date.now() - startTime;
    connectionDuration.add(connTime);

    // Connection opened
    socket.on('open', function () {
      console.log(`VU ${__VU}: Connected (took ${connTime}ms)`);
      connectionSuccesses.add(1);

      // Send initial Socket.io handshake
      socket.send('40'); // Socket.io CONNECT packet

      // Send periodic ping
      socket.setInterval(function () {
        socket.send('2'); // Socket.io PING packet
        messagesSent.add(1);
      }, 5000);

      // Send test message every 10 seconds
      socket.setInterval(function () {
        const message = JSON.stringify({
          type: 'test:message',
          data: { userId: __VU, timestamp: Date.now() },
        });
        socket.send(`42${message}`); // Socket.io EVENT packet
        messagesSent.add(1);
      }, 10000);
    });

    // Message received
    socket.on('message', function (data) {
      messagesReceived.add(1);

      // Handle Socket.io PONG
      if (data === '3') {
        console.log(`VU ${__VU}: Received PONG`);
      }
      // Handle Socket.io CONNECT acknowledgment
      else if (data.startsWith('40')) {
        console.log(`VU ${__VU}: Connected to server`);
      }
    });

    // Connection closed
    socket.on('close', function () {
      console.log(`VU ${__VU}: Disconnected`);
    });

    // Error handler
    socket.on('error', function (e) {
      console.log(`VU ${__VU}: Error - ${e.error()}`);
      connectionErrors.add(1);
    });

    // Keep connection alive for scenario duration
    socket.setTimeout(function () {
      console.log(`VU ${__VU}: Closing connection after timeout`);
      socket.close();
    }, 60000); // 60 seconds
  });

  // Check connection success
  check(res, {
    'WebSocket connection established': (r) => r && r.status === 101,
  });

  // Small sleep between iterations
  sleep(1);
}

/**
 * Setup function - runs once before test
 */
export function setup() {
  console.log('=== Socket.io Load Test Starting ===');
  console.log(`Target URL: ${WS_URL}`);
  console.log('Scenarios:');
  console.log('  1. Baseline: 10 users for 30s');
  console.log('  2. Load Test: Ramp to 100 users');
  console.log('  3. Stress Test: Ramp to 500 users');
  console.log('  4. Spike Test: Spike to 1000 users');
  console.log('=====================================');
}

/**
 * Teardown function - runs once after test
 */
export function teardown() {
  console.log('=== Socket.io Load Test Complete ===');
  console.log('====================================');
}
