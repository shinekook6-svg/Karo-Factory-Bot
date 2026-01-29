/**
 * KARO FACTORY MASTER SCRIPT - PART 1 (ကကြီး)
 * INFRASTRUCTURE & AUTHENTICATION
 */

// --- 1. GOOGLE JWT AUTHENTICATION (FOR FIREBASE) ---
async function getAccessToken(email, privateKey) {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload = btoa(JSON.stringify({
    iss: email, sub: email,
    aud: 'https://firestore.googleapis.com/google.firestore.v1.Firestore',
    iat: iat, exp: exp,
    scope: 'https://www.googleapis.com/auth/datastore'
  }));

  const key = await binaryStringToArrayBuffer(atob(privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, "")));
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    await crypto.subtle.importKey("pkcs8", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]),
    new TextEncoder().encode(header + "." + payload)
  );
  
  const token = header + "." + payload + "." + btoa(String.fromCharCode(...new Uint8Array(signature)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
  });
  const data = await res.json();
  return data.access_token;
}

function binaryStringToArrayBuffer(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// --- 2. TELEGRAM API UTILITIES ---
async function sendMessage(chatId, text, token, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = { chat_id: chatId, text: text, parse_mode: "HTML", disable_web_page_preview: true };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function sendPhoto(chatId, photoUrl, caption, token, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;
  const body = { chat_id: chatId, photo: photoUrl, caption: caption, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

// --- 3. FIRESTORE DATABASE HELPERS ---
async function fsGet(path, env, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  return await res.json();
}

async function fsUpdate(path, fields, env, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/(default)/documents/${path}`;
  return await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields })
  });
}

// --- 4. CLOUDFLARE FETCH HANDLER (ROUTER) ---
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");
    const payload = await request.json();
    if (!payload.message) return new Response("OK");

    const chatId = payload.message.chat.id;
    const text = payload.message.text || "";
    const username = payload.message.from.username || "User";
    
    // Webhook URL မှ Token ကို စစ်ဆေးခြင်း (Main or Child)
    const urlParams = new URL(request.url).searchParams;
    const currentBotToken = urlParams.get('token') || env.BOT_TOKEN;

    const accessToken = await getAccessToken(env.CLIENT_EMAIL, env.PRIVATE_KEY);
    const ADMIN_ID = [6870403909,8268582523];

    if (currentBotToken === env.BOT_TOKEN) {
      return await handleMainBot(chatId, text, username, env, accessToken, ADMIN_ID, payload);
    } else {
      return await handleChildBot(chatId, text, username, env, accessToken, currentBotToken, payload);
    }
  }
};
/**
 * PART 2 (ခခွေး): MAIN BOT LOGIC (REVISED)
 * Admin ID Error ကို Fix လုပ်ထားပြီး PDF Page 1, 2, 9, 10 Logic များ အကုန်ပါဝင်သည်။
 */
async function handleMainBot(chatId, text, username, env, accessToken, ADMIN_ID, payload) {
  // ADMIN_ID သည် ယခု Array ဖြစ်သွားပါပြီ [ID1, ID2]
  const userPath = `users/${chatId}`;

  // 1. /start Command & Registration (PDF Page 1)
  if (text === "/start" || text.startsWith("/start")) {
    let referredBy = null;
    if (text.includes(" ")) {
      referredBy = text.split(" ")[1];
    }

    const userData = await fsGet(userPath, env, accessToken);
    if (userData.error) {
      await fsUpdate(userPath, {
        username: { stringValue: username },
        balance: { integerValue: "0" },
        referrals: { integerValue: "0" },
        joinedAt: { timestampValue: new Date().toISOString() }
      }, env, accessToken);

      if (referredBy && referredBy !== chatId.toString()) {
        const refPath = `users/${referredBy}`;
        const refData = await fsGet(refPath, env, accessToken);
        if (!refData.error) {
          const currentRefs = parseInt(refData.fields.referrals.integerValue || "0");
          await fsUpdate(refPath, { referrals: { integerValue: (currentRefs + 1).toString() } }, env, accessToken);
        }
      }
    }

    const welcomeMsg = `<b>Welcome to Karo Factory! 🏭</b>\n\n/addbot - Create your bot\n/mybot - Edit your bot\n/deposit - Please TopUp your Wallet\n/updatedays - Update your bot's expire days\n/updatefeatures - Update your bot's features\n/channels - Please join to know about of Bots`;
    
    let mainButtons = [
      [{ text: "💳 My Wallet" }, { text: "📜 History" }],
      [{ text: "👥 Referral" }, { text: "❓ Help" }]
    ];

    // Admin စစ်ဆေးပုံ ပြောင်းလဲခြင်း (Array includes)
    if (Array.isArray(ADMIN_ID) ? ADMIN_ID.includes(chatId) : chatId === ADMIN_ID) {
      mainButtons.push([{ text: "⚙️ Admin Panel" }]);
    }

    return await sendMessage(chatId, welcomeMsg, env.BOT_TOKEN, {
      keyboard: mainButtons,
      resize_keyboard: true
    });
  }

  // 2. /addbot Logic (PDF Page 2)
  if (text === "/addbot") {
    return await sendMessage(chatId, "🤖 မင်းရဲ့ Bot API Token ကို ပေးပါ။\n\n@BotFather မှာ Bot ဆောက်ပြီး Token ကို Copy ယူလာခဲ့ပါ။", env.BOT_TOKEN, {
      keyboard: [[{ text: "I've copied the Api Token" }], [{ text: "Cancel" }]],
      resize_keyboard: true
    });
  }

  if (text === "I've copied the Api Token") {
    return await sendMessage(chatId, "ဟုတ်ပြီ။ သင့် Api Token ကို Paste ၍ Send ပါ။", env.BOT_TOKEN);
  }

  // API Token လက်ခံခြင်း (PDF Page 2)
  if (text.includes(":") && text.length > 30) {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 7);

    await fsUpdate(`bots/${chatId}`, {
      ownerId: { stringValue: chatId.toString() },
      botToken: { stringValue: text },
      status: { stringValue: "pending" },
      expireAt: { timestampValue: expireDate.toISOString() },
      features: { stringValue: "free" },
      removeSignal: { booleanValue: false }
    }, env, accessToken);

    return await sendMessage(chatId, "✅ Token လက်ခံရရှိပါသည်။ Api Token မှန်ရင် Setup ပြီးသား Bot ကိုထုတ်ပေးမည်။\n\nFree Tier 7Days Auto run ရရှိပါမည်။", env.BOT_TOKEN);
  }

  // 3. My Wallet (PDF Page 9)
  if (text === "💳 My Wallet") {
    const userData = await fsGet(userPath, env, accessToken);
    const balance = userData.fields?.balance?.integerValue || "0";
    return await sendMessage(chatId, `သင်၏ စုစုပေါင်းလက်ကျန်ငွေမှာ\n<b>${balance} Ks</b> ဖြစ်ပါသည်။`, env.BOT_TOKEN);
  }

  // 4. Referral (PDF Page 10)
  if (text === "👥 Referral") {
    const userData = await fsGet(userPath, env, accessToken);
    const refCount = userData.fields?.referrals?.integerValue || "0";
    const refLink = `https://t.me/KaroFactoryBot?start=${chatId}`;
    return await sendMessage(chatId, `သင်၏ Referral Link မှာ အောက်တွင်ဖြစ်သည်\n<code>${refLink}</code>\n\nသင်ဖိတ်ခေါ်ခဲ့သော လူဦးရေ = ${refCount} ယောက်`, env.BOT_TOKEN);
  }

  // 5. Admin Panel (PDF Page 1)
  if (text === "⚙️ Admin Panel" && (Array.isArray(ADMIN_ID) ? ADMIN_ID.includes(chatId) : chatId === ADMIN_ID)) {
    return await sendMessage(chatId, "Welcome Admin! သင်လုပ်ဆောင်လိုသည်ကို ရွေးချယ်ပါ။", env.BOT_TOKEN, {
      keyboard: [[{ text: "📊 Total Users" }, { text: "🤖 Bot Requests" }], [{ text: "<<< Back" }]],
      resize_keyboard: true
    });
  }

  // 6. Cancel / Back
  if (text === "Cancel" || text === "<<< Back") {
    return await sendMessage(chatId, "Main Menu သို့ပြန်ရောက်မည်။", env.BOT_TOKEN, {
      keyboard: [
        [{ text: "💳 My Wallet" }, { text: "📜 History" }],
        [{ text: "👥 Referral" }, { text: "❓ Help" }]
      ],
      resize_keyboard: true
    });
  }

  return new Response("OK");
}
