package ir.hesab.modiriat_hesab

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        SmsReceiver.channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "modiriat_hesab/sms")
        SmsReceiver.channel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "hasPermission" -> result.success(hasSmsPermission())
                "requestPermission" -> {
                    pendingRequestResult = result
                    ActivityCompat.requestPermissions(
                        this,
                        arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS),
                        SMS_PERMISSION_CODE
                    )
                }
                "drainSmsQueue" -> {
                    val arr = SmsReceiver.drain(this)
                    val list = ArrayList<Map<String, Any>>()
                    for (i in 0 until arr.length()) {
                        val o = arr.getJSONObject(i)
                        val m = HashMap<String, Any>()
                        m["sender"] = o.getString("sender")
                        m["body"] = o.getString("body")
                        m["ts"] = o.getLong("ts")
                        list.add(m)
                    }
                    result.success(list)
                }
                "readInbox" -> {
                    if (!hasSmsPermission()) {
                        result.success(emptyList<Map<String, Any>>())
                    } else {
                        try {
                            val limit = (call.argument<Int>("limit") ?: 30)
                            val list = ArrayList<Map<String, Any>>()
                            val cursor = contentResolver.query(
                                Telephony.Sms.Inbox.CONTENT_URI,
                                arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                                null, null,
                                "${Telephony.Sms.DATE} DESC"
                            )
                            cursor?.use { c ->
                                var count = 0
                                while (c.moveToNext() && count < limit) {
                                    val m = HashMap<String, Any>()
                                    m["sender"] = c.getString(0) ?: ""
                                    m["body"] = c.getString(1) ?: ""
                                    m["ts"] = if (!c.isNull(2)) c.getLong(2) else 0L
                                    list.add(m)
                                    count++
                                }
                            }
                            result.success(list)
                        } catch (e: Exception) {
                            result.success(emptyList<Map<String, Any>>())
                        }
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == SMS_PERMISSION_CODE) {
            val granted = grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED
            pendingRequestResult?.success(granted)
            pendingRequestResult = null
        }
    }

    private fun hasSmsPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) ==
            PackageManager.PERMISSION_GRANTED &&
        ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED

    companion object {
        const val SMS_PERMISSION_CODE = 4711
        var pendingRequestResult: MethodChannel.Result? = null
    }
}
