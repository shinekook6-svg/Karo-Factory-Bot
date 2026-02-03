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
      
      // ပြင်ဆင်လိုက်သည့်နေရာ: env တစ်ခုလုံးကို ပို့ပေးရပါမယ်
      const accessToken = await getAccessToken(env);
      
      // URL ကနေ Token ကို ဆွဲထုတ်မယ်
      const url = new URL(request.url);
      const pathToken = url.pathname.split("/").pop();

      /**
       * 1. Child Bot Logic
       */
      if (pathToken !== env.BOT_TOKEN && pathToken.includes(":")) {
        return await handleChildBot(payload, pathToken, env, accessToken);
      } 
      
      /**
       * 2. Main Bot Logic
       */
      return await handleMainBot(payload, env, accessToken);

    } catch (error) {
      console.error("Worker Error:", error);
      return new Response("Internal Error", { status: 500 });
    }
  },

  // --- Background Tasks (Cron Triggers) ---
  async scheduled(event, env, ctx) {
    // ပြင်ဆင်လိုက်သည့်နေရာ: env တစ်ခုလုံးကို ပို့ပေးရပါမယ်
    const accessToken = await getAccessToken(env);
    
    ctx.waitUntil(handleScheduled(event, env, accessToken));
  }
};
