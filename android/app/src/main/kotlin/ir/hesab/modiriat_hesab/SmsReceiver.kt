package ir.hesab.modiriat_hesab

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.provider.Telephony
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray
import org.json.JSONObject

/**
 * گیرنده پیامک: پیامک‌های جدید را به Flutter می‌فرستد و اگر اپ بسته بود،
 * در صف (SharedPreferences) ذخیره می‌کند تا در اجرای بعدی پردازش شوند.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        for (sm in messages) {
            val sender = sm.originatingAddress ?: continue
            val body = sm.displayMessageBody ?: continue
            val ts = sm.timestampMillis

            val map = hashMapOf<String, Any>(
                "sender" to sender,
                "body" to body,
                "ts" to ts
            )

            val ch = channel
            if (ch != null) {
                ch.invokeMethod("onSms", map, object : MethodChannel.Result {
                    override fun success(p0: Any?) {}
                    override fun error(p0: String?, p1: String?, p2: Any?) {}
                    override fun notImplemented() {}
                })
            } else {
                enqueue(context, sender, body, ts)
            }
        }
    }

    companion object {
        @JvmStatic
        var channel: MethodChannel? = null

        private const val PREFS = "sms_queue"
        private const val KEY = "items"

        fun enqueue(context: Context, sender: String, body: String, ts: Long) {
            try {
                val sp: SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val arr = JSONArray(sp.getString(KEY, "[]") ?: "[]")
                val obj = JSONObject()
                obj.put("sender", sender)
                obj.put("body", body)
                obj.put("ts", ts)
                arr.put(obj)
                // حداکثر ۵۰ پیامک در صف
                while (arr.length() > 50) arr.remove(0)
                sp.edit().putString(KEY, arr.toString()).apply()
            } catch (_: Exception) {
            }
        }

        fun drain(context: Context): JSONArray {
            val sp: SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val arr = JSONArray(sp.getString(KEY, "[]") ?: "[]")
            sp.edit().putString(KEY, "[]").apply()
            return arr
        }
    }
}
