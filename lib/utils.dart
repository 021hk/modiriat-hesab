import 'dart:math';

// ---------- شناسه ----------
String genId() {
  final r = Random();
  return DateTime.now().microsecondsSinceEpoch.toRadixString(36) +
      r.nextInt(46656).toRadixString(36).padLeft(3, '0');
}

// ---------- اعداد و پول ----------
const _faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

String toFaDigits(String s) {
  final b = StringBuffer();
  for (final ch in s.runes) {
    if (ch >= 0x30 && ch <= 0x39) {
      b.write(_faDigits[ch - 0x30]);
    } else {
      b.writeCharCode(ch);
    }
  }
  return b.toString();
}

String toEnDigits(String s) {
  final b = StringBuffer();
  for (final ch in s.runes) {
    if (ch >= 0x6F0 && ch <= 0x6F9) {
      b.writeCharCode(ch - 0x6F0 + 0x30); // فارسی ۰-۹
    } else if (ch >= 0x660 && ch <= 0x669) {
      b.writeCharCode(ch - 0x660 + 0x30); // عربی ٠-٩
    } else {
      b.writeCharCode(ch);
    }
  }
  return b.toString();
}

/// جداکننده هزارگان + تبدیل به رقم فارسی در صورت نیاز
String fmtMoney(num v, {bool fa = true}) {
  final neg = v < 0;
  var s = v.abs().toStringAsFixed(0);
  final parts = <String>[];
  while (s.length > 3) {
    parts.insert(0, s.substring(s.length - 3));
    s = s.substring(0, s.length - 3);
  }
  parts.insert(0, s);
  var out = parts.join('٬');
  if (neg) out = '-$out';
  return fa ? toFaDigits(out) : out;
}

/// متن ورودی مبلغ را به عدد تبدیل می‌کند (پذیرش رقم فارسی و جداکننده)
double parseMoneyInput(String input) {
  final s = toEnDigits(input).replaceAll(RegExp(r'[٬,،\s]'), '');
  return double.tryParse(s) ?? 0;
}

bool get isFaDigits => true;

// ---------- تاریخ شمسی ----------
const jMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

/// میلادی → جلالی (الگوریتم jalaali)
List<int> g2j(int gy, int gm, int gd) {
  const gDm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var jy = gy <= 1600 ? 0 : 979;
  var g = gy <= 1600 ? gy - 621 : gy - 1600;
  final gy2 = gm > 2 ? g + 1 : g;
  var days = 365 * g +
      (gy2 + 3) ~/ 4 -
      (gy2 + 99) ~/ 100 +
      (gy2 + 399) ~/ 400 -
      80 +
      gd +
      gDm[gm - 1];
  jy += 33 * (days ~/ 12053);
  days %= 12053;
  jy += 4 * (days ~/ 1461);
  days %= 1461;
  if (days > 365) {
    jy += (days - 1) ~/ 365;
    days = (days - 1) % 365;
  }
  final jm = days < 186 ? 1 + days ~/ 31 : 7 + (days - 186) ~/ 30;
  final jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

int jMonthLen(int jy, int jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // اسفند: بررسی کبیسه
  return isJalaliLeap(jy) ? 30 : 29;
}

bool isJalaliLeap(int jy) {
  final mods = jy % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].contains(mods);
}

/// جلالی → میلادی (الگوریتم jalaali)
List<int> j2g(int jy, int jm, int jd) {
  jy += 1595;
  var days = -355668 +
      365 * jy +
      (jy ~/ 33) * 8 +
      ((jy % 33) + 3) ~/ 4 +
      jd +
      (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  var gy = 400 * (days ~/ 146097);
  days %= 146097;
  if (days > 36524) {
    days--;
    gy += 100 * (days ~/ 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * (days ~/ 1461);
  days %= 1461;
  if (days > 365) {
    gy += (days - 1) ~/ 365;
    days = (days - 1) % 365;
  }
  var gd = days + 1;
  final leap = (gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0);
  final salA = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var gm = 0;
  for (gm = 1; gm <= 12 && gd > salA[gm]; gm++) {
    gd -= salA[gm];
  }
  return [gy, gm, gd];
}

String fmtJalali(int ts, {bool fa = true, bool withTime = false}) {
  final d = DateTime.fromMillisecondsSinceEpoch(ts);
  final j = g2j(d.year, d.month, d.day);
  var out =
      '${j[2].toString().padLeft(2, '0')} ${jMonths[j[1] - 1]} ${j[0]}';
  if (fa) out = toFaDigits(out);
  if (withTime) {
    final hh = d.hour.toString().padLeft(2, '0');
    final mm = d.minute.toString().padLeft(2, '0');
    final t = toFaDigits('$hh:$mm');
    out = '$out • $t';
  }
  return out;
}

// ---------- تبدیل‌گر پیامک بانکی ----------
class ParsedSms {
  final bool deposit; // true=واریز، false=برداشت
  final double amount;
  final double? balance;
  ParsedSms({required this.deposit, required this.amount, this.balance});
}

const _depositWords = ['واریز', 'افزایش موجودی', 'شارژ', 'وصول '];
const _withdrawWords = ['برداشت', 'خرید', 'پرداخت', 'کسر', 'انتقال وجه', 'کارمزد'];

class SmsParser {
  /// بدنه پیامک را تحلیل می‌کند؛ در صورت نبود کلیدواژه یا مبلغ، null برمی‌گرداند.
  static ParsedSms? parse(String body) {
    final text = toEnDigits(body).replaceAll('‌', ' ');

    var depIdx = -1;
    var withIdx = -1;
    for (final w in _depositWords) {
      final i = text.indexOf(w);
      if (i >= 0 && (depIdx == -1 || i < depIdx)) depIdx = i;
    }
    for (final w in _withdrawWords) {
      final i = text.indexOf(w);
      if (i >= 0 && (withIdx == -1 || i < withIdx)) withIdx = i;
    }
    if (depIdx == -1 && withIdx == -1) return null;
    final isDeposit = withIdx == -1 || (depIdx != -1 && depIdx < withIdx);

    final amount = _extractAmount(text, isDeposit ? depIdx : withIdx);
    if (amount == null || amount <= 0) return null;

    final balance = _extractBalance(text);
    return ParsedSms(deposit: isDeposit, amount: amount, balance: balance);
  }

  static double? _extractAmount(String text, int fromIdx) {
    // اگر «مبلغ» یا «به مبلغ» وجود دارد، عدد بعد از آن اولویت دارد
    final mIdx = text.indexOf('مبلغ');
    int searchFrom;
    if (mIdx >= 0 && mIdx >= fromIdx && mIdx - fromIdx < 80) {
      searchFrom = mIdx + 4;
    } else {
      searchFrom = fromIdx;
    }
    if (searchFrom >= text.length) searchFrom = fromIdx;
    return _firstNumber(text.substring(searchFrom.clamp(0, text.length)));
  }

  static double? _extractBalance(String text) {
    final bIdx = text.indexOf('موجودی');
    if (bIdx < 0) return null;
    return _firstNumber(text.substring(bIdx + 6));
  }

  static double? _firstNumber(String s) {
    final m = RegExp(r'(\d[\d,،٬.]*\d|\d)').firstMatch(s);
    if (m == null) return null;
    final cleaned = m.group(1)!.replaceAll(RegExp(r'[,،٬]'), '');
    final v = double.tryParse(cleaned);
    if (v == null) return null;
    // اعداد خیلی کوچک (مثل شماره حساب) را رد کن
    if (v < 100) return null;
    return v;
  }
}

// ---------- رنگ‌ها و آیکون‌های دسته‌بندی ----------
const categoryColors = [
  0xFF00695C, 0xFF1565C0, 0xFF6A1B9A, 0xFFC62828, 0xFFEF6C00,
  0xFF2E7D32, 0xFF00838F, 0xFFAD1457, 0xFF5D4037, 0xFF4527A0,
  0xFF9E9D24, 0xFF37474F,
];

const categoryIconNames = [
  'restaurant', 'directions_car', 'shopping_bag', 'receipt_long', 'local_hospital',
  'sports_esports', 'home', 'more_horiz', 'work', 'card_giftcard',
  'savings', 'school', 'flight', 'fitness_center', 'pets', 'local_cafe',
];
