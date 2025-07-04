#!/usr/bin/env node

/**
 * External script to process automations
 * Can be run as a cron job every minute
 * 
 * Usage: node scripts/process-automations.js
 * 
 * Cron example (runs every minute):
 * * * * * * cd /path/to/hpms && node scripts/process-automations.js >> /var/log/hpms-automations.log 2>&1
 */

const https = require('https');

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY_HERE';

async function processAutomations() {
  try {
    console.log(`[${new Date().toISOString()}] Starting automation processing...`);
    
    // First, call the RPC function to process pending automations
    const rpcResponse = await makeSupabaseRequest('/rest/v1/rpc/process_automations_scheduled', 'POST', {});
    console.log(`[${new Date().toISOString()}] RPC Response:`, rpcResponse);
    
    // Then try to call the edge function
    if (rpcResponse.pending_count > 0) {
      try {
        const edgeResponse = await makeSupabaseRequest('/functions/v1/automation-engine', 'POST', {});
        console.log(`[${new Date().toISOString()}] Edge function response:`, edgeResponse);
      } catch (edgeError) {
        console.error(`[${new Date().toISOString()}] Edge function error (non-critical):`, edgeError.message);
      }
    }
    
    console.log(`[${new Date().toISOString()}] Automation processing completed`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error processing automations:`, error);
  }
}

function makeSupabaseRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'jjxlfunlbyayxwvlpgwt.supabase.co',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(jsonData)}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Run the script
processAutomations();