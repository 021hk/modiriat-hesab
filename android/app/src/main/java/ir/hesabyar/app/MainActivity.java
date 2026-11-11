package ir.hesabyar.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity — v2.16: مقصد Share اندروید
 * کاربر از برنامهٔ پیامک/بلوبانک روی پیام «Share» می‌زند و «حساب‌یار» را انتخاب می‌کند؛
 * متن پیام با رویداد window «hesabShareText» به جاوااسکریپت می‌رسد و در کادر
 * «ورود پیام بانکی» باز می‌شود — بدون هیچ مجوزی (سازگار با اسکن گوگل‌پلی).
 * اگر برنامه سرد باز شده باشد (جاوااسکریپت هنوز آماده نیست)، متن در HesabSmsPlugin
 * نگه داشته می‌شود و با consumeSharedText خوانده می‌شود.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ثبت پلاگین محلی پیام بانک + Share
        registerPlugin(HesabSmsPlugin.class);
        super.onCreate(savedInstanceState);
        handleSendIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleSendIntent(intent);
    }

    private void handleSendIntent(Intent intent) {
        try {
            if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text == null || text.isEmpty()) return;
            HesabSmsPlugin.setPendingShareText(text);
            if (bridge != null) {
                // نسخهٔ Bridge این Capacitor فقط triggerJSEvent(String,String,String) دارد —
                // JSON رشته‌ای به‌عنوان detail در رویداد تزریق می‌شود
                String payload = new org.json.JSONObject().put("text", text).toString();
                bridge.triggerJSEvent("hesabShareText", "window", payload);
            }
        } catch (Exception ignored) {
            // خطای Share نباید برنامه را ببندد
        }
    }
}
