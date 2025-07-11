# Practice Setup Guide for OneHealth Automation Workflow

## What I Fixed
1. Connected the Centralized SMS Gateway output to all three collection nodes (NewCharm, OneHealth, and Unknown)
2. Added practice ID filtering to each collection node so they only process their own results
3. Added clear comments and constants for practice-specific configuration

## When Adding a New Practice

You need to update **5 locations** in the workflow:

### 1. Practice Credential Mapping (Line ~69)
In the "🏢 Group by Practice" node, update the `practiceCredentialMap`:
```javascript
const practiceCredentialMap = {
  'ffed1160-00ec-4c4f-8810-913a24348d90': 'uA0l39VD4cMHN9cC', // NewCharm
  'onehealth_practice_id': 'HrTrOqI74H5m5dyg', // OneHealth - REPLACE WITH ACTUAL PRACTICE ID
  // ADD NEW PRACTICE MAPPINGS HERE:
  'your-new-practice-id': 'your-gmail-credential-id', // Your Practice Name
};
```

### 2. Create New Practice Branch
1. Duplicate the OneHealth branch (all nodes from "Is OneHealth?" onwards)
2. Update the condition in your new "Is YourPractice?" node to check for your practice ID
3. Update all node names to reflect your practice name

### 3. Update Collection Node Practice ID
In your new "Collect YourPractice" node, update the practice ID constant:
```javascript
const YOURPRACTICE_PRACTICE_ID = 'your-new-practice-id'; // Your actual practice ID
```

### 4. Update Unknown Practice Filter
In the "Collect Unknown" node, add your practice ID to the known list:
```javascript
const KNOWN_PRACTICE_IDS = [
  'ffed1160-00ec-4c4f-8810-913a24348d90', // NewCharm
  'onehealth_practice_id', // OneHealth
  'your-new-practice-id' // Your Practice Name
];
```

### 5. Connect SMS Gateway Output
In the n8n UI, connect the SMS Gateway output to your new collection node:
- Click and drag from the SMS Gateway output port
- Connect to your "Collect YourPractice" node

## Important Notes

### OneHealth Practice ID
You need to replace `'onehealth_practice_id'` with the actual OneHealth practice ID in:
- Line ~69 (practiceCredentialMap)
- Line ~121 (Is OneHealth? condition)
- Line ~675 (Collect OneHealth node)
- Line ~766 (Collect Unknown node)

### Gmail Credentials
Each practice needs its own Gmail OAuth2 credentials configured in n8n. The credential IDs in the mapping must match the IDs from n8n's credentials page.

### SMS Gateway
The SMS gateway is centralized and works for all practices automatically. You don't need to configure anything specific for SMS per practice.

### Testing
After adding a new practice:
1. Test with a single automation first
2. Monitor the logs in each collection node
3. Verify that only the correct practice's results are being processed in each branch