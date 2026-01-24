/**
 * loadTest.js — MGR CAPITAL ASSISTANCE
 * Load testing stub for API stress testing
 *
 * Usage with k6 (recommended):
 *   k6 run loadTest.js
 *
 * Usage with Artillery:
 *   artillery run loadTest.yml
 *
 * Configuration via environment variables:
 *   - BASE_URL: API base URL (default: http://localhost:4000)
 *   - VU_COUNT: Number of virtual users (default: 50)
 *   - DURATION: Test duration in seconds (default: 60)
 *   - AUTH_TOKEN: JWT token for authenticated tests
 */

// =============================================================================
// K6 LOAD TEST SCRIPT
// =============================================================================

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const casesListDuration = new Trend('cases_list_duration');
const commsMessageDuration = new Trend('comms_message_duration');

// Configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    errors: ['rate<0.1'],              // Error rate < 10%
    login_duration: ['p(95)<1000'],    // Login < 1s
    cases_list_duration: ['p(95)<500'], // Cases list < 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// =============================================================================
// TEST SCENARIOS
// =============================================================================

export default function () {
  // Group: Health Check
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
      'health status is 200': (r) => r.status === 200,
      'health response is ok': (r) => JSON.parse(r.body).status === 'ok',
    }) || errorRate.add(1);
  });

  sleep(1);

  // Group: Authentication
  group('Authentication', function () {
    const loginStart = Date.now();
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: 'load-test@mgrcapital.com',
        password: 'LoadTest123!',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    loginDuration.add(Date.now() - loginStart);

    const loginSuccess = check(loginRes, {
      'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    });
    if (!loginSuccess) errorRate.add(1);

    // If login successful, use token for subsequent requests
    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      if (body.accessToken) {
        // Token refresh test
        const refreshRes = http.post(`${BASE_URL}/api/auth/refresh`, null, {
          headers: {
            Authorization: `Bearer ${body.accessToken}`,
          },
        });
        check(refreshRes, {
          'refresh returns valid response': (r) => r.status === 200 || r.status === 401,
        });
      }
    }
  });

  sleep(1);

  // Group: Cases API (requires auth)
  if (AUTH_TOKEN) {
    group('Cases API', function () {
      const headers = {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      };

      // List cases
      const listStart = Date.now();
      const listRes = http.get(`${BASE_URL}/api/cases?page=1&limit=20`, { headers });
      casesListDuration.add(Date.now() - listStart);

      check(listRes, {
        'cases list status is 200': (r) => r.status === 200,
        'cases list has data': (r) => {
          const body = JSON.parse(r.body);
          return body.success === true;
        },
      }) || errorRate.add(1);

      // Get single case (if list returned results)
      if (listRes.status === 200) {
        const cases = JSON.parse(listRes.body).data?.cases;
        if (cases && cases.length > 0) {
          const caseRes = http.get(`${BASE_URL}/api/cases/${cases[0].id}`, { headers });
          check(caseRes, {
            'single case status is 200': (r) => r.status === 200,
          }) || errorRate.add(1);
        }
      }
    });
  }

  sleep(1);

  // Group: Comms API (requires auth)
  if (AUTH_TOKEN) {
    group('Comms Chamber', function () {
      const headers = {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      };

      // List rooms
      const roomsRes = http.get(`${BASE_URL}/api/comms/rooms`, { headers });
      check(roomsRes, {
        'rooms list status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);

      // Send message (if rooms exist)
      if (roomsRes.status === 200) {
        const rooms = JSON.parse(roomsRes.body).data?.rooms;
        if (rooms && rooms.length > 0) {
          const msgStart = Date.now();
          const msgRes = http.post(
            `${BASE_URL}/api/comms/messages`,
            JSON.stringify({
              roomId: rooms[0].id,
              content: `Load test message ${Date.now()}`,
            }),
            { headers }
          );
          commsMessageDuration.add(Date.now() - msgStart);

          check(msgRes, {
            'send message status is 200 or 201': (r) => r.status === 200 || r.status === 201,
          }) || errorRate.add(1);
        }
      }
    });
  }

  sleep(2);

  // Group: Analytics (Founder only)
  if (AUTH_TOKEN) {
    group('Analytics', function () {
      const headers = {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      };

      const forecastRes = http.get(`${BASE_URL}/api/analytics/forecast`, { headers });
      check(forecastRes, {
        'forecast status is 200 or 403': (r) => r.status === 200 || r.status === 403,
      });

      const reportsRes = http.get(`${BASE_URL}/api/analytics/reports?type=cases`, { headers });
      check(reportsRes, {
        'reports status is 200 or 403': (r) => r.status === 200 || r.status === 403,
      });
    });
  }

  sleep(1);
}

// =============================================================================
// SETUP & TEARDOWN
// =============================================================================

export function setup() {
  console.log(`Load test starting against ${BASE_URL}`);
  console.log(`Auth token provided: ${AUTH_TOKEN ? 'Yes' : 'No'}`);

  // Verify API is reachable
  const healthRes = http.get(`${BASE_URL}/api/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API health check failed: ${healthRes.status}`);
  }

  return {
    startTime: Date.now(),
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration}s`);
}

// =============================================================================
// ARTILLERY CONFIGURATION (loadTest.yml)
// =============================================================================

/*
# Save as loadTest.yml for Artillery

config:
  target: "http://localhost:4000"
  phases:
    - duration: 30
      arrivalRate: 5
      name: "Warm up"
    - duration: 60
      arrivalRate: 20
      name: "Sustained load"
    - duration: 30
      arrivalRate: 50
      name: "Spike"
  defaults:
    headers:
      Content-Type: "application/json"

scenarios:
  - name: "Health check"
    weight: 3
    flow:
      - get:
          url: "/api/health"
          expect:
            - statusCode: 200

  - name: "Login flow"
    weight: 2
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "load-test@mgrcapital.com"
            password: "LoadTest123!"
          capture:
            - json: "$.accessToken"
              as: "token"
      - get:
          url: "/api/auth/me"
          headers:
            Authorization: "Bearer {{ token }}"

  - name: "Cases browse"
    weight: 5
    flow:
      - get:
          url: "/api/cases?page=1&limit=20"
          headers:
            Authorization: "Bearer {{ $env.AUTH_TOKEN }}"
          expect:
            - statusCode: 200
*/

// =============================================================================
// JMETER STUB (loadTest.jmx)
// =============================================================================

/*
JMeter Test Plan Structure:

1. Thread Group: "API Load Test"
   - Number of Threads: 50
   - Ramp-Up Period: 30s
   - Loop Count: Forever
   - Duration: 300s (5 min)

2. HTTP Request Defaults
   - Server: localhost
   - Port: 4000
   - Protocol: http

3. HTTP Cookie Manager
   - Clear cookies each iteration: true

4. HTTP Header Manager
   - Content-Type: application/json
   - Authorization: Bearer ${ACCESS_TOKEN}

5. Samplers:
   a. Health Check (GET /api/health)
   b. Login (POST /api/auth/login)
      - Extract: accessToken -> ACCESS_TOKEN
   c. Cases List (GET /api/cases)
   d. Comms Rooms (GET /api/comms/rooms)

6. Listeners:
   - View Results Tree
   - Summary Report
   - Response Time Graph
   - Aggregate Report

7. Assertions:
   - Response Code: 200
   - Response Time: < 500ms

Export JMX file or use JMeter GUI to create full test plan.
*/
