import 'package:flutter_test/flutter_test.dart';

import 'package:modiriat_hesab/models.dart';
import 'package:modiriat_hesab/utils.dart';

void main() {
  test('تبدیل میلادی به شمسی', () {
    final j = g2j(2026, 10, 2);
    expect(j, [1405, 7, 10]);
  });

  test('تبدیل شمسی به میلادی', () {
    final g = j2g(1405, 7, 10);
    expect(g, [2026, 10, 2]);
  });

  test('قالب‌بندی مبلغ', () {
    expect(fmtMoney(1250000), '۱٬۲۵۰٬۰۰۰');
    expect(toFaDigits('1250'), '۱۲۵۰');
    expect(toEnDigits('۱۲۵۰'), '1250');
  });

  test('تحلیل پیامک واریز', () {
    final p = SmsParser.parse('واریز وجه: مبلغ 1,250,000 ریال از حساب شماره 1234');
    expect(p, isNotNull);
    expect(p!.deposit, true);
    expect(p.amount, 1250000);
  });

  test('تحلیل پیامک برداشت', () {
    final p = SmsParser.parse('برداشت به مبلغ ۵۰۰٬۰۰۰ تومان از حساب جاری');
    expect(p, isNotNull);
    expect(p!.deposit, false);
    expect(p.amount, 500000);
  });

  test('مدل تراکنش', () {
    final t = Tx(id: '1', type: TxType.expense, amount: 100, ts: 0, note: 'آزمون');
    expect(Tx.fromMap(t.toMap()).note, 'آزمون');
  });
}
