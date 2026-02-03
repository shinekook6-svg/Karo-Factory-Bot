/**
 * KARO FACTORY - Scheduled Tasks (Cron Jobs) Module
 */
import { tg, fsGet, fsUpdate } from './firebase.js';

export async function handleScheduled(event, env, accessToken) {
  const token = env.BOT_TOKEN;

  // --- 1. BROADCAST LOGIC (တစ်သုတ်လျှင် User ၅၀ စီ ပို့ခြင်း) ---
  const bcDoc = await fsGet("settings/broadcast", env, accessToken);
  
  if (bcDoc.fields && bcDoc.fields.status.stringValue === "pending") {
    const content = bcDoc.fields.message.stringValue;
    const photoId = bcDoc.fields.photo_id?.stringValue || null;
    const lastIndex = parseInt(bcDoc.fields.last_index.integerValue) || 0;

    // User အားလုံးကို ဆွဲထုတ်မယ် (Pagination Limit ကို သတိပြုရန်)
    const usersRes = await fsGet("users?pageSize=1000", env, accessToken);
    const allUsers = usersRes.documents || [];
    const batch = allUsers.slice(lastIndex, lastIndex + 50);

    for (const uDoc of batch) {
      const tId = uDoc.name.split("/").pop();
      try {
        if (photoId) {
          await tg("sendPhoto", { chat_id: tId, photo: photoId, caption: content, parse_mode: "HTML" }, token);
        } else {
          await tg("sendMessage", { chat_id: tId, text: content, parse_mode: "HTML" }, token);
        }
      } catch (e) {
        // User က Bot ကို Block ထားရင် Error တက်နိုင်လို့ skip လုပ်မယ်
      }
    }

    const nextIdx = lastIndex + 50;
    if (nextIdx >= allUsers.length) {
      // ပို့စရာကုန်သွားရင် status ကို completed ပြောင်းမယ်
      await fsUpdate("settings/broadcast", { status: { stringValue: "completed" } }, env, accessToken);
    } else {
      // ကျန်သေးရင် နောက်တစ်သုတ်အတွက် Index ကို update လုပ်မယ်
      await fsUpdate("settings/broadcast", { 
        last_index: { integerValue: nextIdx }, 
        status: { stringValue: "pending" },
        message: { stringValue: content }
      }, env, accessToken);
    }
  }

  // --- 2. EXPIRY ALERT LOGIC (၂၄ နာရီအလို သတိပေးခြင်း) ---
  const botsRes = await fsGet("child_bots?pageSize=1000", env, accessToken); 
  const allBots = botsRes.documents || [];
  const now = new Date();

  for (const botDoc of allBots) {
    const fields = botDoc.fields;
    const botChatId = botDoc.name.split("/").pop();
    
    if (!fields.expiry?.timestampValue) continue;

    const expiry = new Date(fields.expiry.timestampValue);
    const isAlerted = fields.alert_sent?.booleanValue || false;

    const diffTime = expiry - now;
    const diffHours = diffTime / (1000 * 60 * 60);

    // ၂၄ နာရီအလိုရောက်ပြီး Alert မပို့ရသေးရင် ပို့မယ်
    if (diffHours <= 24 && diffHours > 0 && !isAlerted) {
      try {
        await tg("sendMessage", { 
          chat_id: botChatId, 
          text: "⚠️ <b>သတိပေးချက်</b>\n\nသင်၏ Bot သက်တမ်းကုန်ဆုံးရန် <b>၂၄ နာရီ</b> သာ လိုပါတော့သည်။ အဆက်မပြတ် အသုံးပြုနိုင်ရန် သက်တမ်းတိုးထားပေးပါခင်ဗျာ။",
          parse_mode: "HTML"
        }, token);

        // Alert ပို့ပြီးကြောင်း Database မှာ မှတ်မယ်
        await fsUpdate(`child_bots/${botChatId}`, { 
          alert_sent: { booleanValue: true } 
        }, env, accessToken);
      } catch (e) {}
    }
  }
}
