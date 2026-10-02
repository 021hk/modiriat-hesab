package ir.hesabyar.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ثبت پلاگین محلی خواندن پیامک بانکی
        registerPlugin(HesabSmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
