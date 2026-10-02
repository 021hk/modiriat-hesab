package ir.hesabyar.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.telephony.SmsMessage;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * HesabSmsPlugin — خواندن خودکار پیامک‌های بانکی
 * - readInbox: پیامک‌های صندوق ورودی از تاریخ مشخص (sync هنگام باز شدن برنامه)
 * - smsReceived: رویداد زنده هنگام رسیدن پیامک جدید (وقتی برنامه باز است)
 * هیچ داده‌ای از گوشی خارج نمی‌شود؛ فقط داخل برنامه پردازش می‌شود.
 */
@CapacitorPlugin(name = "HesabSms", permissions = {
    @Permission(strings = { Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS }, alias = "sms")
})
public class HesabSmsPlugin extends Plugin {

    private static final String SMS_RECEIVED_ACTION = "android.provider.Telephony.SMS_RECEIVED";
    private BroadcastReceiver incomingReceiver;

    @Override
    public void load() {
        try {
            if (hasRequiredPermissions()) {
                registerIncomingReceiver();
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (incomingReceiver != null) {
                bridge.getContext().unregisterReceiver(incomingReceiver);
                incomingReceiver = null;
            }
        } catch (Exception ignored) {
        }
    }

    private void registerIncomingReceiver() {
        if (incomingReceiver != null) return;
        incomingReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                try {
                    if (!SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
                    Bundle bundle = intent.getExtras();
                    if (bundle == null) return;
                    Object[] pdus = (Object[]) bundle.get("pdus");
                    if (pdus == null) return;
                    String format = bundle.getString("format");
                    for (Object pdu : pdus) {
                        SmsMessage msg = SmsMessage.createFromPdu((byte[]) pdu, format);
                        if (msg == null) continue;
                        JSObject data = new JSObject();
                        data.put("id", "live:" + System.currentTimeMillis());
                        data.put("sender", msg.getOriginatingAddress() == null ? "" : msg.getOriginatingAddress());
                        data.put("body", msg.getMessageBody() == null ? "" : msg.getMessageBody());
                        data.put("date", msg.getTimestampMillis());
                        notifyListeners("smsReceived", data);
                    }
                } catch (Exception ignored) {
                }
            }
        };
        IntentFilter filter = new IntentFilter(SMS_RECEIVED_ACTION);
        try {
            ContextCompat.registerReceiver(
                bridge.getContext(), incomingReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        } catch (Exception e) {
            // fallback برای نسخه‌های قدیمی‌تر
            try {
                bridge.getContext().registerReceiver(incomingReceiver, filter);
            } catch (Exception ignored) {
            }
        }
    }

    // checkPermissions و requestPermissions به‌صورت خودکار توسط Capacitor
    // از روی @CapacitorPlugin(permissions=...) فراهم می‌شوند (alias = "sms")

    @PluginMethod
    public void readInbox(PluginCall call) {
        if (!hasRequiredPermissions()) {
            call.reject("PERMISSION_DENIED", "دسترسی خواندن پیامک داده نشده است");
            return;
        }
        long since = 0L;
        Double sinceD = call.getDouble("since");
        if (sinceD != null && sinceD > 0) since = sinceD.longValue();
        int limit = 400;
        Integer limitI = call.getInt("limit");
        if (limitI != null && limitI > 0 && limitI <= 2000) limit = limitI;

        JSArray messages = new JSArray();
        int added = 0;
        Cursor cursor = null;
        try {
            Uri inbox = Uri.parse("content://sms/inbox");
            String[] projection = { "_id", "address", "body", "date" };
            cursor = bridge.getContext().getContentResolver().query(
                inbox, projection, "date >= ?", new String[] { String.valueOf(since) }, "date DESC");
            if (cursor != null) {
                while (cursor.moveToNext() && added < limit) {
                    JSObject item = new JSObject();
                    item.put("id", String.valueOf(cursor.getLong(0)));
                    String sender = cursor.getString(1);
                    item.put("sender", sender == null ? "" : sender);
                    String body = cursor.getString(2);
                    item.put("body", body == null ? "" : body);
                    item.put("date", cursor.getLong(3));
                    messages.put(item);
                    added++;
                }
            }
        } catch (Exception e) {
            call.reject("SMS_READ_ERROR", e.getMessage());
            return;
        } finally {
            if (cursor != null) cursor.close();
        }

        JSObject result = new JSObject();
        result.put("messages", messages);
        call.resolve(result);
    }
}
