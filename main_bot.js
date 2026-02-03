import { tg, fsGet, fsUpdate, fsDelete } from './firebase.js';

const ADMIN_IDS = [6870403909, 8268582523];
const REF_BONUS = 100;

export async function handleMainBot(payload, env, accessToken) {
  const token = env.BOT_TOKEN;

  if (payload.callback_query) {
    const cbData = payload.callback_query.data;
    const cbChatId = payload.callback_query.message.chat.id;
    const msgId = payload.callback_query.message.message_id;

    if (cbData === "back_home") {
      await tg("editMessageText", {
        chat_id: cbChatId,
        message_id: msgId,
        text: "🏠 <b>Main Menu သို့ ပြန်ရောက်ပါပြီ။</b>",
        parse_mode: "HTML"
      }, token);
    }

    if (cbData === "confirm_buy_ads") {
      await tg("editMessageText", {
        chat_id: cbChatId,
        message_id: msgId,
        text: "⚠️ <b>အတည်ပြုချက်</b>\n\nAds ဖျောက်ရန်အတွက် သင့် Wallet ထဲမှ ငွေနှုတ်ယူပြီး Auto အသက်ဝင်မှာ ဖြစ်ပါသည်။ ဝယ်ယူမှာ သေချာပါသလား?",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Buy Now", callback_data: "execute_buy_ads" }],
            [{ text: "❌ Cancel", callback_data: "back_home" }]
          ]
        }
      }, token);
    }

    if (cbData === "set_price_removeads") {
      await tg("sendMessage", {
        chat_id: cbChatId,
        text: "🚫 <b>Remove Ads ဈေးနှုန်းပြင်ရန်</b>\n\n<code>PRICE_SAVE_REMOVEADS_ပမာဏ</code>\n\nဟု ရိုက်ပို့ပေးပါ။",
        parse_mode: "HTML"
      }, token);
    }

    if (cbData.startsWith("del_bot_")) {
      await tg("editMessageText", {
        chat_id: cbChatId,
        message_id: msgId,
        text: "⚠️ <b>သတိပေးချက်</b>\n\nသင်၏ Bot ကို တကယ်ဖျက်မှာလား? ဖျက်လိုက်ပါက Data များအားလုံး ပြန်ယူ၍ မရနိုင်တော့ပါ။",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Yes, delete it", callback_data: `confirm_del_${cbChatId}` }],
            [{ text: "❌ Cancel", callback_data: "back_home" }]
          ]
        }
      }, token);
    }

    if (cbData.startsWith("confirm_del_")) {
      await fsDelete(`child_bots/${cbChatId}`, env, accessToken);
      await fsDelete(`pending_deposits/${cbChatId}`, env, accessToken);

      await tg("editMessageText", {
        chat_id: cbChatId,
        message_id: msgId,
        text: "🗑 <b>Bot ကို အောင်မြင်စွာ ဖျက်လိုက်ပါပြီ။</b>\n\nနောက်ထပ် Bot အသစ်ကို /addbot ဖြင့် ပြန်ဆောက်နိုင်ပါသည်။",
        parse_mode: "HTML"
      }, token);
    }

    if (cbData.startsWith("dep_")) {
      const type = cbData.split("_")[1];
      const dbPath = type === "kbz" ? "settings/kbzpay" : "settings/wavepay";
      const doc = await fsGet(dbPath, env, accessToken);
      const info = doc.fields?.info?.stringValue || "Admin မှ နံပါတ် မသတ်မှတ်ရသေးပါ။";

      await tg("editMessageText", {
        chat_id: cbChatId,
        message_id: msgId,
        text: `⚠️ <b>${type.toUpperCase()} ဖြင့် ငွေဖြည့်ခြင်း</b>\n\nအောက်ပါနံပါတ်သို့ ငွေလွှဲပေးပါ -\n\n<code>${info}</code>\n\nငွေလွှဲပြီးပါက အောက်က ခလုတ်ကို နှိပ်ပြီး Amount နှင့် Screenshot ပို့ပေးပါ။`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📸 Amount & Screenshot ပို့မည်", callback_data: "start_pay_process" }],
            [{ text: "⬅️ Back", callback_data: "back_home" }]
          ]
        }
      }, token);
    }

    if (cbData === "start_pay_process") {
      await fsUpdate(`pending_deposits/${cbChatId}`, { status: { stringValue: "awaiting_amount" } }, env, accessToken);
      await tg("editMessageText", {
        chat_id: cbChatId, message_id: msgId,
        text: "💰 <b>အဆင့် (၁)</b>\n\nသင်လွှဲလိုက်သော <b>ပမာဏ (Amount)</b> ကို ဂဏန်းသီးသန့် ရိုက်ပို့ပေးပါ။",
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "back_home" }]] }
      }, token);
    }

    if (cbData.startsWith("set_price_")) {
      const type = cbData.replace("set_price_", "").toUpperCase();
      await tg("sendMessage", {
        chat_id: cbChatId,
        text: `သင်ပြင်ချင်သော ${type} အတွက် ဈေးနှုန်းကို အောက်ပါ Format အတိုင်း ရိုက်ပို့ပေးပါ -\n\n<code>PRICE_SAVE_${type}_ပမာဏ</code>`,
        parse_mode: "HTML"
      }, token);
    }

    if (cbData.startsWith("adm_app_") || cbData.startsWith("adm_rej_")) {
      const parts = cbData.split("_");
      const action = parts[1] === "app" ? "approve" : "reject";
      const targetUserId = parts[2];
      const amount = parseInt(parts[3] || 0);

      if (action === "approve") {
        const userRes = await fsGet(`users/${targetUserId}`, env, accessToken);
        const currentBal = parseInt(userRes.fields?.balance?.integerValue || 0);
        const newBal = currentBal + amount;
        await fsUpdate(`users/${targetUserId}`, { balance: { integerValue: newBal } }, env, accessToken);
        const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Yangon' });
        await fsUpdate(`users/${targetUserId}/deposits/${Date.now()}`, {
          date: { stringValue: now }, amount: { integerValue: amount }, status: { stringValue: "Succeeded" }
        }, env, accessToken);
        await tg("sendMessage", { chat_id: targetUserId, text: `✅ ငွေဖြည့်သွင်းမှု <b>${amount} Ks</b> အောင်မြင်ပါသည်။`, parse_mode: "HTML" }, token);
      } else {
        await tg("sendMessage", { chat_id: targetUserId, text: "❌ သင်၏ ငွေဖြည့်တောင်းဆိုမှုအား Admin မှ ငြင်းပယ်လိုက်ပါသည်။" }, token);
      }

      await fsDelete(`pending_deposits/${targetUserId}`, env, accessToken);
      await tg("editMessageText", {
        chat_id: cbChatId, message_id: msgId,
        text: `✅ User (${targetUserId}) ကို ${action} လုပ်ပြီးပါပြီ။`,
        reply_markup: { inline_keyboard: [[{ text: "➡️ Next Order", callback_data: "next_order" }], [{ text: "⬅️ Back to Admin", callback_data: "back_admin_panel" }]] }
      }, token);
    }

    if (cbData === "show_pending_orders" || cbData === "next_order") {
      const pendingRes = await fsGet("pending_deposits", env, accessToken);
      if (pendingRes.error || !pendingRes.documents || pendingRes.documents.length === 0) {
        if (cbData === "next_order") await tg("answerCallbackQuery", { callback_query_id: payload.callback_query.id, text: "📭 နောက်ထပ် အော်ဒါမရှိပါ။", show_alert: true }, token);
        else await tg("editMessageText", { chat_id: cbChatId, message_id: msgId, text: "📭 Pending Deposit မရှိပါ။" }, token);
      } else {
        let orders = pendingRes.documents.sort((a, b) => (parseInt(a.fields.timestamp?.integerValue || 0) - parseInt(b.fields.timestamp?.integerValue || 0)));
        if (cbData === "next_order") { const first = orders.shift(); orders.push(first); }

        const current = orders[0];
        const targetId = current.name.split("/").pop();
        const amt = current.fields.amount?.integerValue || 0;
        const uname = current.fields.username?.stringValue || "NoUser";

        await tg("editMessageText", {
          chat_id: cbChatId,
          message_id: msgId,
          text: `💰 <b>Pending Deposit</b>\n\nUser: @${uname}\nID: <code>${targetId}</code>\nAmount: <b>${amt} Ks</b>`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Approve", callback_data: `adm_app_${targetId}_${amt}` }, { text: "❌ Reject", callback_data: `adm_rej_${targetId}` }],
              [{ text: "➡️ Next Order", callback_data: "next_order" }],
              [{ text: "⬅️ Back to Admin", callback_data: "back_admin_panel" }]
            ]
          }
        }, token);
      }
    }

    if (cbData.startsWith("buy_")) {
      const type = cbData.replace("buy_", "").toUpperCase();
      const priceRes = await fsGet(`settings/prices`, env, accessToken);
      const userRes = await fsGet(`users/${cbChatId}`, env, accessToken);
      const botRes = await fsGet(`child_bots/${cbChatId}`, env, accessToken);

      if (botRes.error || !botRes.fields) {
        await tg("answerCallbackQuery", { callback_query_id: payload.callback_query.id, text: "❌ သင့်တွင် Bot မရှိသေးပါ။ /addbot ဖြင့် အရင်ဆောက်ပါ။", show_alert: true }, token);
      } else {
        const price = parseInt(priceRes.fields?.[type]?.integerValue || 0);
        const balance = parseInt(userRes.fields?.balance?.integerValue || 0);

        if (balance < price) {
          await tg("answerCallbackQuery", { callback_query_id: payload.callback_query.id, text: "❌ လက်ကျန်ငွေ မလုံလောက်ပါ။", show_alert: true }, token);
        } else {
          const daysToAdd = type === "1M" ? 30 : type === "3M" ? 90 : type === "6M" ? 180 : 365;
          let expiryDate = botRes.fields?.expiry?.timestampValue ? new Date(botRes.fields.expiry.timestampValue) : new Date();
          const now = new Date();
          let updateFields = { alert_sent: { booleanValue: false } };

          if (expiryDate < now) {
            expiryDate = now;
            updateFields.ads_disabled = { booleanValue: false };
          }
          expiryDate.setDate(expiryDate.getDate() + daysToAdd);
          updateFields.expiry = { timestampValue: expiryDate.toISOString() };

          await fsUpdate(`users/${cbChatId}`, { balance: { integerValue: balance - price } }, env, accessToken);
          await fsUpdate(`child_bots/${cbChatId}`, updateFields, env, accessToken);

          await tg("editMessageText", {
            chat_id: cbChatId,
            message_id: msgId,
            text: `✅ <b>ဝယ်ယူမှု အောင်မြင်ပါသည်။</b>\n\nသက်တမ်းကို ${daysToAdd} ရက် တိုးပေးလိုက်ပါပြီ။\nကုန်ဆုံးမည့်ရက်: ${expiryDate.toISOString().split('T')[0]}`,
            parse_mode: "HTML"
          }, token);
        }
      }
    }

    if (cbData === "execute_buy_ads") {
      const pDoc = await fsGet(`settings/prices`, env, accessToken);
      const adsPrice = parseInt(pDoc.fields?.REMOVEADS?.integerValue || 0);
      const userRes = await fsGet(`users/${cbChatId}`, env, accessToken);
      const balance = parseInt(userRes.fields?.balance?.integerValue || 0);

      if (balance < adsPrice) {
        await tg("answerCallbackQuery", { callback_query_id: payload.callback_query.id, text: "❌ လက်ကျန်ငွေ မလုံလောက်ပါ။", show_alert: true }, token);
      } else {
        const botRes = await fsGet(`child_bots/${cbChatId}`, env, accessToken);
        if (botRes.error || !botRes.fields) {
          await tg("answerCallbackQuery", { callback_query_id: payload.callback_query.id, text: "❌ သင့်တွင် Bot မရှိသေးပါ။ /addbot ဖြင့် အရင်ဆောက်ပါ။", show_alert: true }, token);
        } else {
          await fsUpdate(`users/${cbChatId}`, { balance: { integerValue: balance - adsPrice } }, env, accessToken);
          await fsUpdate(`child_bots/${cbChatId}`, { ads_disabled: { booleanValue: true } }, env, accessToken);

          await tg("editMessageText", {
            chat_id: cbChatId,
            message_id: msgId,
            text: "✅ <b>ဝယ်ယူမှု အောင်မြင်ပါသည်။</b>\n\nသင့် Bot တွင် ယခုမှစ၍ Branding Ads များ ပေါ်တော့မည် မဟုတ်ပါ။\n(မှတ်ချက် - Bot သက်တမ်းကုန်သွားပါက Ads ပြန်ပေါ်မည်ဖြစ်သည်)",
            parse_mode: "HTML"
          }, token);
        }
      }
    }
    return new Response("OK");
  }

  if (payload.message) {
    const chatId = payload.message.chat.id;
    const text = payload.message.text || "";
    const username = payload.message.from.username || "NoUser";
    const captionText = payload.message.caption || "";

    const mainKeyboard = {
      keyboard: [
        [{ text: "(a) My Wallet" }, { text: "(b) Deposit History" }],
        [{ text: "(c) Referral" }, { text: "(d) Help" }],
        ...(ADMIN_IDS.includes(chatId) ? [[{ text: "(e) Admin Panel" }]] : [])
      ],
      resize_keyboard: true
    };

    if (ADMIN_IDS.includes(chatId)) {
      if (text.startsWith("/start")) {
        const botDescription = "Welcome to Karo Factory! 🏭\n\nကျွန်ုပ်သည် သင်၏ကိုယ်ပိုင် TopUp Bot များကို အလွယ်တကူ ဖန်တီးစီမံနိုင်ရန် ကူညီပေးပါသည်။";
        await tg("setMyDescription", { description: botDescription }, token);
        await tg("setMyCommands", {
          commands: [
            { command: "start", description: "ပြန်လည်စတင်ရန်" },
            { command: "addbot", description: "Bot အသစ်ဆောက်ရန်" },
            { command: "mybot", description: "မိမိ Bot စစ်ဆေးရန်" },
            { command: "deposit", description: "ငွေဖြည့်သွင်းရန်" },
            { command: "updatedays", description: "သက်တမ်းတိုးရန်" },
            { command: "removeads", description: "Ads ဖျောက်ရန်" },
            { command: "botnews", description: "သတင်းများကြည့်ရန်" },
            { command: "help", description: "Bot အညွှန်းများ ကြည့်ရန်" }
          ]
        }, token);
        await tg("sendMessage", { chat_id: chatId, text: "✅ <b>Bot Setup Complete!</b>", parse_mode: "HTML", reply_markup: mainKeyboard }, token);
        return new Response("OK");
      }

      if (text === "(e) Admin Panel") {
        await tg("sendMessage", {
          chat_id: chatId,
          text: "🛠 <b>Admin Control Panel</b>",
          parse_mode: "HTML",
          reply_markup: {
            keyboard: [
              [{ text: "Update Prices" }, { text: "(a)Update KBZ Pay" }],
              [{ text: "(b)Update Wave Pay" }, { text: "(c)Broadcast" }],
              [{ text: "(d)Users stats" }, { text: "(f)Pending Orders" }],
              [{ text: "Back to Main Menu" }]
            ], resize_keyboard: true
          }
        }, token);
        return new Response("OK");
      }

      if (text === "(c) Broadcast") {
        await tg("sendMessage", { chat_id: chatId, text: "📢 <b>Broadcast ပြုလုပ်ရန်</b>\n\nရှေ့က <code>BC:</code> ခံရေးပါ။", parse_mode: "HTML" }, token);
        return new Response("OK");
      }

      if (text.startsWith("BC:") || captionText.startsWith("BC:")) {
        const bcContent = text.startsWith("BC:") ? text.replace("BC:", "") : captionText.replace("BC:", "");
        const photoId = payload.message.photo ? payload.message.photo[payload.message.photo.length - 1].file_id : null;
        await fsUpdate("settings/broadcast", {
          message: { stringValue: bcContent },
          photo_id: photoId ? { stringValue: photoId } : { nullValue: null },
          status: { stringValue: "pending" },
          last_index: { integerValue: 0 }
        }, env, accessToken);
        await tg("sendMessage", { chat_id: chatId, text: "✅ Broadcast Queue ထဲထည့်လိုက်ပါပြီ။", parse_mode: "HTML" }, token);
        return new Response("OK");
      }

      if (text === "(a)Update KBZ Pay") {
        await tg("sendMessage", { chat_id: chatId, text: "💳 <b>KBZ Update</b>\nFormat: <code>SET_KBZ:09...</code>", parse_mode: "HTML" }, token);
        return new Response("OK");
      }

      if (text === "(b)Update Wave Pay") {
        await tg("sendMessage", { chat_id: chatId, text: "💸 <b>Wave Update</b>\nFormat: <code>SET_WAVE:09...</code>", parse_mode: "HTML" }, token);
        return new Response("OK");
      }

      if (text === "(d)Users stats") {
        const userRes = await fsGet(`users`, env, accessToken);
        const botRes = await fsGet(`child_bots`, env, accessToken);
        const uCount = userRes.documents ? userRes.documents.length : 0;
        const bCount = botRes.documents ? botRes.documents.length : 0;
        await tg("sendMessage", { chat_id: chatId, text: `📊 Stats\nUsers: ${uCount}\nBots: ${bCount}`, parse_mode: "HTML" }, token);
        return new Response("OK");
      }

      if (text === "(f)Pending Orders") {
        const pendingRes = await fsGet("pending_deposits", env, accessToken);
        if (pendingRes.error || !pendingRes.documents || pendingRes.documents.length === 0) {
          await tg("sendMessage", { chat_id: chatId, text: "📭 Pending Deposit မရှိပါ။" }, token);
        } else {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "📥 <b>Deposit Orders စစ်ဆေးရန် အောက်ကခလုတ်ကို နှိပ်ပါ။</b>",
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📥 Start Checking", callback_data: "show_pending_orders" }]
              ]
            }
          }, token);
        }
        return new Response("OK");
      }

      if (text.startsWith("SET_KBZ:")) {
        const val = text.replace("SET_KBZ:", "").trim();
        await fsUpdate(`settings/kbzpay`, { info: { stringValue: val } }, env, accessToken);
        await tg("sendMessage", { chat_id: chatId, text: "✅ KBZ Saved" }, token);
        return new Response("OK");
      }

      if (text.startsWith("SET_WAVE:")) {
        const val = text.replace("SET_WAVE:", "").trim();
        await fsUpdate(`settings/wavepay`, { info: { stringValue: val } }, env, accessToken);
        await tg("sendMessage", { chat_id: chatId, text: "✅ Wave Saved" }, token);
        return new Response("OK");
      }

      if (text.startsWith("PRICE_SAVE_")) {
        const parts = text.split("_");
        const type = parts[2];
        const amount = parseInt(parts[3]);
        await fsUpdate(`settings/prices`, { [type]: { integerValue: amount } }, env, accessToken);
        await tg("sendMessage", { chat_id: chatId, text: `✅ ${type} Price Saved` }, token);
        return new Response("OK");
      }

      if (text === "Update Prices") {
        await tg("sendMessage", {
          chat_id: chatId,
          text: "Select Price Type:",
          reply_markup: {
            keyboard: [[{ text: "Update Days" }, { text: "Remove Ads" }], [{ text: "Back to Admin Panel" }]],
            resize_keyboard: true
          }
        }, token);
        return new Response("OK");
      }
    }

    if (text.startsWith("/start")) {
      const refId = text.split(" ")[1];
      const userRes = await fsGet(`users/${chatId}`, env, accessToken);

      if (userRes.error) {
        await fsUpdate(`users/${chatId}`, { balance: { integerValue: 0 }, username: { stringValue: username }, referrals: { integerValue: 0 } }, env, accessToken);
        if (refId && refId !== chatId.toString()) {
          const inviter = await fsGet(`users/${refId}`, env, accessToken);
          if (!inviter.error) {
            const curBal = parseInt(inviter.fields.balance.integerValue) || 0;
            const curRefs = parseInt(inviter.fields.referrals.integerValue) || 0;
            await fsUpdate(`users/${refId}`, { balance: { integerValue: curBal + REF_BONUS }, referrals: { integerValue: curRefs + 1 } }, env, accessToken);
            await tg("sendMessage", { chat_id: refId, text: `🎁 Referral Bonus +${REF_BONUS} Ks!` }, token);
          }
        }
      }
      const bal = !userRes.error ? (userRes.fields.balance.integerValue || 0) : 0;
      await tg("sendMessage", { chat_id: chatId, text: `<b>Karo Factory</b>\nလက်ကျန်ငွေ: <b>${bal} Ks</b>`, parse_mode: "HTML", reply_markup: mainKeyboard }, token);
      return new Response("OK");
    }

    if (!isNaN(text) && text !== "" && !text.startsWith("/")) {
      const amount = parseInt(text);
      if (amount >= 100) {
        const checkStep = await fsGet(`pending_deposits/${chatId}`, env, accessToken);

        if (!checkStep.error && checkStep.fields?.status?.stringValue === "awaiting_amount") {
          await fsUpdate(`pending_deposits/${chatId}`, {
            amount: { integerValue: amount },
            username: { stringValue: username },
            timestamp: { integerValue: Date.now() },
            status: { stringValue: "awaiting_screenshot" }
          }, env, accessToken);
          await tg("sendMessage", { chat_id: chatId, text: `💰 ပမာဏ: <b>${amount} Ks</b>\nScreenshot ပို့ပေးပါ။`, parse_mode: "HTML" }, token);
          return new Response("OK");
        }
      }
    }

    if (text === "/deposit") {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "💳 <b>ငွေဖြည့်သွင်းမည့် နည်းလမ်း</b>",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "KBZ Pay", callback_data: "dep_kbz" }, { text: "Wave Pay", callback_data: "dep_wave" }], [{ text: "⬅️ Back", callback_data: "back_home" }]]
        }
      }, token);
      return new Response("OK");
    }

    if (text === "/addbot") {
      const botData = await fsGet(`child_bots/${chatId}`, env, accessToken);
      if (!botData.error && botData.fields?.token?.stringValue) await tg("sendMessage", { chat_id: chatId, text: "❌ Bot ရှိနှင့်ပြီးသားပါ။" }, token);
      else await tg("sendMessage", { chat_id: chatId, text: "🤖 Token ပို့ပေးပါ။", reply_markup: { keyboard: [[{ text: "Cancel" }]], resize_keyboard: true } }, token);
      return new Response("OK");
    }

    if (text.includes(":") && text.length > 30) {
      const childToken = text.trim();
      const workerUrl = `https://karo-factory-bot.shinekook6.workers.dev/${childToken}`;
      try {
        const webhookRes = await tg("setWebhook", { url: workerUrl }, childToken);

        if (webhookRes.ok) {
          const exp = new Date(); exp.setDate(exp.getDate() + 7);
          await fsUpdate(`child_bots/${chatId}`, {
            token: { stringValue: childToken },
            expiry: { timestampValue: exp.toISOString() },
            status: { stringValue: "living" },
            alert_sent: { booleanValue: false },
            ads_disabled: { booleanValue: false }
          }, env, accessToken);

          await tg("sendMessage", { chat_id: chatId, text: "✅ Bot Created (7 Days Free)", parse_mode: "HTML", reply_markup: mainKeyboard }, token);
        } else {
          throw new Error("Invalid Token");
        }
      } catch (e) {
        await tg("sendMessage", { chat_id: chatId, text: "❌ Token မှားနေပါတယ်။ BotFather မှ Api Token ကို သေချာပြန်ကူးပေးပါ။" }, token);
      }
      return new Response("OK");
    }

    if (text === "/mybot") {
      const botRes = await fsGet(`child_bots/${chatId}`, env, accessToken);
      if (botRes.error || !botRes.fields?.token?.stringValue) await tg("sendMessage", { chat_id: chatId, text: "❌ Bot မရှိသေးပါ။" }, token);
      else {
        const expVal = botRes.fields?.expiry?.timestampValue;
        const diff = Math.max(0, Math.ceil((new Date(expVal) - new Date()) / (1000 * 60 * 60 * 24)));
        await tg("sendMessage", {
          chat_id: chatId,
          text: `🤖 <b>Bot Settings</b>\nStatus: living (${diff} days)`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🗑 Delete Bot", callback_data: `del_bot_${chatId}` }], [{ text: "⬅️ Back", callback_data: "back_home" }]] }
        }, token);
      }
      return new Response("OK");
    }

    if (text === "/updatedays") {
      const pDoc = await fsGet(`settings/prices`, env, accessToken);
      const p1m = pDoc.fields?.["1M"]?.integerValue || "0";
      await tg("sendMessage", {
        chat_id: chatId,
        text: "📅 <b>သက်တမ်းတိုးရန်</b>",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: `၁ လ = ${p1m} Ks`, callback_data: "buy_1m" }]]
        }
      }, token);
      return new Response("OK");
    }

    if (text === "/removeads") {
      const pDoc = await fsGet(`settings/prices`, env, accessToken);
      const adsPrice = pDoc.fields?.REMOVEADS?.integerValue || "0";

      await tg("sendMessage", {
        chat_id: chatId,
        text: `🚫 <b>Remove Ads (ကြော်ငြာဖျောက်ခြင်း)</b>\n\nသင့် Child Bot များတွင် "Powered by Karo Factory" စာသားကို ဖျောက်ထားလိုပါသလား?\n\nဈေးနှုန်း - <b>${adsPrice} Ks</b>`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: `🛒 ဝယ်ယူမည် (${adsPrice} Ks)`, callback_data: "confirm_buy_ads" }],
            [{ text: "❌ Cancel", callback_data: "back_home" }]
          ]
        }
      }, token);
      return new Response("OK");
    }

    if (text === "(a) My Wallet") {
      const userRes = await fsGet(`users/${chatId}`, env, accessToken);
      const bal = parseInt(userRes.fields?.balance?.integerValue || 0);
      await tg("sendMessage", { chat_id: chatId, text: `လက်ကျန်ငွေ = <b>${bal} Ks</b>`, parse_mode: "HTML" }, token);
      return new Response("OK");
    }

    if (text === "(b) Deposit History") {
      const res = await fsGet(`users/${chatId}/deposits`, env, accessToken);
      if (res.error || !res.documents) await tg("sendMessage", { chat_id: chatId, text: "📜 မှတ်တမ်းမရှိပါ။" }, token);
      else {
        let historyText = "📜 <b>ငွေဖြည့်သွင်းမှုမှတ်တမ်း</b>\n\n";
        res.documents.slice(-5).reverse().forEach((doc, i) => {
          historyText += `${i + 1}. 📅 ${doc.fields.date.stringValue} - ${doc.fields.amount.integerValue} Ks\n`;
        });
        await tg("sendMessage", { chat_id: chatId, text: historyText, parse_mode: "HTML" }, token);
      }
      return new Response("OK");
    }

    if (text === "(c) Referral") {
      await tg("sendMessage", { chat_id: chatId, text: `Link: <code>https://t.me/${env.BOT_USERNAME}?start=${chatId}</code>`, parse_mode: "HTML" }, token);
      return new Response("OK");
    }

    if (text === "/help" || text === "(d) Help") {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "❓ <b>အကူအညီနှင့် လမ်းညွှန်ချက်များ</b>\n\nအောက်ပါခလုတ်ကို နှိပ်ပြီး ကျွန်ုပ်တို့၏ Help Bot တွင် အသေးစိတ် လေ့လာနိုင်ပါသည်။",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🆘 Go to Help Bot", url: "https://t.me/HelpFactory_bot" }]
          ]
        }
      }, token);
      return new Response("OK");
    }

    if (payload.message.photo) {
      const photoId = payload.message.photo[payload.message.photo.length - 1].file_id;
      const pendingRes = await fsGet(`pending_deposits/${chatId}`, env, accessToken);

      if (!pendingRes.error && pendingRes.fields?.status?.stringValue === "awaiting_screenshot") {
        const amt = pendingRes.fields?.amount?.integerValue || "0";
        for (const adminId of ADMIN_IDS) {
          await tg("sendPhoto", {
            chat_id: adminId,
            photo: photoId,
            caption: `💰 Pending Deposit\nUser: @${username}\nID: ${chatId}\nAmt: ${amt} Ks`,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "✅ Approve", callback_data: `adm_app_${chatId}_${amt}` }, { text: "❌ Reject", callback_data: `adm_rej_${chatId}` }]] }
          }, token);
        }
        await fsUpdate(`pending_deposits/${chatId}`, { status: { stringValue: "submitted" } }, env, accessToken);
        await tg("sendMessage", { chat_id: chatId, text: "✅ Admin စစ်ဆေးနေပါပြီ။" }, token);
      } else {
        await tg("sendMessage", { chat_id: chatId, text: "❌ အရင်ဆုံး ပမာဏ (Amount) ကို အရင်ရိုက်ပို့ပေးပါ။" }, token);
      }
      return new Response("OK");
    }

    if (text === "Cancel" || text === "Back to Main Menu" || text === "Back to Admin Panel") {
      const menuText = text.includes("Admin") ? "Admin Panel သို့ ပြန်ရောက်ပါပြီ။" : "Main Menu သို့ ပြန်ရောက်ပါပြီ။";
      await tg("sendMessage", { chat_id: chatId, text: menuText, reply_markup: mainKeyboard }, token);
      return new Response("OK");
    }
  }

  return new Response("OK");
}
