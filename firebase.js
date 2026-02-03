/**
 * KARO FACTORY - Firebase & Telegram Helper Module (Optimized for Cloudflare)
 */

// JWT အတွက် Base64URL Encoding Helper
function base64url(source) {
  let encoded = btoa(source);
  return encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function arrayBufferToBase64Url(buffer) {
  let binary = "";
  let bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64url(binary);
}

// Google Firestore Access Token ယူရန်
export async function getAccessToken(env) {
  // မင်းရဲ့ Variable နာမည်တွေဖြစ်တဲ့ CLIENT_EMAIL နဲ့ PRIVATE_KEY ကို သုံးပေးထားတယ်
  const email = env.CLIENT_EMAIL;
  const privateKey = env.PRIVATE_KEY;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claim = base64url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  }));

  // Private Key ပြင်ဆင်ခြင်း
  const pemContents = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
    
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", 
    key, 
    new TextEncoder().encode(header + "." + claim)
  );

  const jwt = header + "." + claim + "." + arrayBufferToBase64Url(signature);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  const data = await res.json();
  if (data.error) throw new Error("Google Auth Failed: " + data.error_description);
  return data.access_token;
}

// Telegram Bot API Helper
export async function tg(method, params, token) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return await res.json();
}

// Firebase Firestore - GET
export async function fsGet(path, env, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  return await res.json();
}

// Firebase Firestore - Update (PATCH)
export async function fsUpdate(path, fields, env, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { 
      "Authorization": `Bearer ${accessToken}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({ fields })
  });
  return await res.json();
}

// Firebase Firestore - DELETE
export async function fsDelete(path, env, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/(default)/documents/${path}`;
  return await fetch(url, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
}
// Firebase Firestore - SEARCH (Structured Query)
export async function fsSearch(collection, field, operator, value, env, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/(default)/documents:runQuery`;
  
  // Filter logic (equal, greater than, etc.)
  const opMap = { "==": "EQUAL", ">=": "GREATER_THAN_OR_EQUAL", ">": "GREATER_THAN" };
  
  const query = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: opMap[operator] || "EQUAL",
          value: { stringValue: value } // string မဟုတ်ရင် value type ပြောင်းပေးဖို့ လိုနိုင်တယ်
        }
      }
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(query)
  });
  
  return await res.json();
}
