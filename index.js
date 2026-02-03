/**
 * KARO FACTORY - Main Entry Point (Gateway)
 */
import { getAccessToken } from './firebase.js';
import { handleMainBot } from './main_bot.js';
import { handleChildBot } from './child_bot.js';
import { handleScheduled } from './cron.js';

export default {
  // --- HTTP Requests Handling (Webhooks) ---
  async fetch(request, env) {
    // POST request မဟုတ်ရင် ပယ်ချမယ်
    if (request.method !== "POST") return new Response("OK");

    try {
      const payload = await request.json();
      const accessToken = await getAccessToken(env.CLIENT_EMAIL, env.PRIVATE_KEY);
      
      // URL ကနေ Token ကို ဆွဲထုတ်မယ် (ဥပမာ- https://worker.dev/TOKEN)
      const url = new URL(request.url);
      const pathToken = url.pathname.split("/").pop();

      /**
       * Logic လမ်းကြောင်းခွဲခြင်း
       * 1. Path က Main Bot Token မဟုတ်ဘူး၊ ဒါပေမဲ့ Token Format (:) ပါနေရင် Child Bot ဆီသွားမယ်
       */
      if (pathToken !== env.BOT_TOKEN && pathToken.includes(":")) {
        return await handleChildBot(payload, pathToken, env, accessToken);
      } 
      
      /**
       * 2. မဟုတ်ရင် Main Bot (Factory Bot) logic ဆီ သွားမယ်
       */
      return await handleMainBot(payload, env, accessToken);

    } catch (error) {
      console.error("Worker Error:", error);
      return new Response("Internal Error", { status: 500 });
    }
  },

  // --- Background Tasks (Cron Triggers) ---
  async scheduled(event, env, ctx) {
    // Cron အလုပ်လုပ်တဲ့အခါ Access Token ကြိုယူထားမယ်
    const accessToken = await getAccessToken(env.CLIENT_EMAIL, env.PRIVATE_KEY);
    
    // Background မှာ အလုပ်လုပ်ခိုင်းမယ် (Response ပြန်ဖို့ စောင့်စရာမလို)
    ctx.waitUntil(handleScheduled(event, env, accessToken));
  }
};

