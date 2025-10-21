// Decode JWT tokens to compare

const oldKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MTk4NzYsImV4cCI6MjA1MDA5NTg3Nn0.SEwdRmb-d68UtqmP2A4HuNkOMEbRhKDvzOXLDhz75fQ';
const newKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

function decodeJWT(token) {
  const [header, payload, signature] = token.split('.');

  const decodedHeader = JSON.parse(Buffer.from(header, 'base64').toString());
  const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());

  return {
    header: decodedHeader,
    payload: decodedPayload,
    signature: signature
  };
}

console.log('🔑 OLD KEY (used in test):');
console.log(JSON.stringify(decodeJWT(oldKey), null, 2));

console.log('\n🔑 NEW KEY (used in .env):');
console.log(JSON.stringify(decodeJWT(newKey), null, 2));

console.log('\n📊 COMPARISON:');
const old = decodeJWT(oldKey);
const newK = decodeJWT(newKey);

console.log('Same ref?', old.payload.ref === newK.payload.ref);
console.log('Same role?', old.payload.role === newK.payload.role);
console.log('Old IAT:', new Date(old.payload.iat * 1000).toISOString());
console.log('New IAT:', new Date(newK.payload.iat * 1000).toISOString());
console.log('Old EXP:', new Date(old.payload.exp * 1000).toISOString());
console.log('New EXP:', new Date(newK.payload.exp * 1000).toISOString());
console.log('\n⚠️  OLD KEY IS EXPIRED!' , Date.now() > old.payload.exp * 1000);
console.log('⚠️  NEW KEY IS EXPIRED!' , Date.now() > newK.payload.exp * 1000);