import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'utils.dart';

/// مبلغ با رقم‌های فارسی
class MoneyText extends StatelessWidget {
  const MoneyText(this.value,
      {super.key, this.style, this.withCurrency = false, this.signed = false});

  final num value;
  final TextStyle? style;
  final bool withCurrency;
  final bool signed;

  @override
  Widget build(BuildContext context) {
    final s = fmtMoney(value.abs(), fa: true);
    final sign = signed
        ? (value < 0 ? '−' : '+')
        : (value < 0 ? '−' : '');
    final text = '$sign$s';
    return Text(
      withCurrency ? '$text تومان' : text,
      style: style,
      textDirection: TextDirection.ltr,
    );
  }
}

/// فیلد ورودی مبلغ با جداکننده زنده
class AmountField extends StatelessWidget {
  const AmountField(
      {super.key, required this.controller, required this.label, this.autofocus = false});

  final TextEditingController controller;
  final String label;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      autofocus: autofocus,
      keyboardType: const TextInputType.numberWithOptions(decimal: false),
      inputFormatters: [_ThousandsInputFormatter()],
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        suffixText: 'تومان',
      ),
    );
  }
}

class _ThousandsInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    var digits = toEnDigits(newValue.text).replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) {
      return const TextEditingValue(text: '');
    }
    digits = digits.replaceFirst(RegExp(r'^0+(?=\d)'), '');
    final b = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      b.write(digits[digits.length - 1 - i]);
      final left = digits.length - 1 - i;
      if (left > 0 && left % 3 == 0) b.write('٬');
    }
    final formatted = b.toString().split('').reversed.join();
    final fa = toFaDigits(formatted);
    return TextEditingValue(
      text: fa,
      selection: TextSelection.collapsed(offset: fa.length),
    );
  }
}

/// انتخاب‌گر تاریخ شمسی ساده (سه فهرست بازشو)
Future<DateTime?> pickJalaliDate(BuildContext context, DateTime initial) async {
  final now = DateTime.now();
  final j = g2j(initial.year, initial.month, initial.day);
  var y = j[0], m = j[1], d = j[2];
  final years = List<int>.generate(20, (i) => g2j(now.year, now.month, now.day)[0] - 15 + i);

  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        title: const Text('انتخاب تاریخ'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(children: [
              Expanded(
                child: DropdownButtonFormField<int>(
                  value: m,
                  decoration: const InputDecoration(labelText: 'ماه'),
                  items: List.generate(12, (i) => DropdownMenuItem(value: i + 1, child: Text(jMonths[i]))),
                  onChanged: (v) => setState(() { m = v!; if (d > jMonthLen(y, m)) d = jMonthLen(y, m); }),
                ),
              ),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: DropdownButtonFormField<int>(
                  value: d,
                  decoration: const InputDecoration(labelText: 'روز'),
                  items: List.generate(jMonthLen(y, m), (i) => DropdownMenuItem(value: i + 1, child: Text(toFaDigits('${i + 1}')))),
                  onChanged: (v) => setState(() => d = v!),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<int>(
                  value: y,
                  decoration: const InputDecoration(labelText: 'سال'),
                  items: years.map((v) => DropdownMenuItem(value: v, child: Text(toFaDigits('$v')))).toList(),
                  onChanged: (v) => setState(() { y = v!; if (d > jMonthLen(y, m)) d = jMonthLen(y, m); }),
                ),
              ),
            ]),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              setState(() {
                final jn = g2j(now.year, now.month, now.day);
                y = jn[0]; m = jn[1]; d = jn[2];
              });
            },
            child: const Text('امروز'),
          ),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('تأیید')),
        ],
      ),
    ),
  );
  if (ok != true) return null;
  final g = j2g(y, m, d);
  return DateTime(g[0], g[1], g[2], initial.hour, initial.minute);
}

/// برگه پایانی فرم
Future<T?> showFormSheet<T>(BuildContext context, Widget child) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(ctx).viewInsets.bottom,
        top: 12,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: child,
      ),
    ),
  );
}

Widget emptyState(IconData icon, String text) {
  return Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 56, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600)),
        ],
      ),
    ),
  );
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                ?trailing,
              ],
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}
