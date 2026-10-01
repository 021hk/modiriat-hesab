import 'dart:io';

import 'package:flutter/services.dart';

/// ارتباط با گیرنده پیامک اندروید (SmsReceiver.ktt)
class SmsService {
  static const _ch = MethodChannel('modiriat_hesab/sms');

  static bool get isAndroid => Platform.isAndroid;

  static Future<bool> hasPermission() async {
    if (!isAndroid) return false;
    try {
      return await _ch.invokeMethod('hasPermission') == true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> requestPermission() async {
    if (!isAndroid) return false;
    try {
      return await _ch.invokeMethod('requestPermission') == true;
    } catch (_) {
      return false;
    }
  }

  /// گوش دادن به پیامک‌های جدید (فقط وقتی اپ باز است)
  static void listen(void Function(String sender, String body, int ts) onSms) {
    if (!isAndroid) return;
    _ch.setMethodCallHandler((call) async {
      if (call.method == 'onSms') {
        final m = Map<String, dynamic>.from(call.arguments as Map);
        onSms(
          (m['sender'] as String?) ?? '',
          (m['body'] as String?) ?? '',
          (m['ts'] as num?)?.toInt() ?? 0,
        );
      }
      return null;
    });
  }

  /// پیامک‌هایی که وقتی اپ بسته بود دریافت شده‌اند (صف)
  static Future<List<Map<String, dynamic>>> drainQueue() async {
    if (!isAndroid) return [];
    try {
      final res = await _ch.invokeMethod('drainSmsQueue');
      if (res is List) {
        return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    } catch (_) {}
    return [];
  }

  /// خواندن آخرین پیامک‌های صندوق ورودی (پس از اجازه)
  static Future<List<Map<String, dynamic>>> readInbox({int limit = 30}) async {
    if (!isAndroid) return [];
    try {
      final res = await _ch.invokeMethod('readInbox', {'limit': limit});
      if (res is List) {
        return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    } catch (_) {}
    return [];
  }
}
