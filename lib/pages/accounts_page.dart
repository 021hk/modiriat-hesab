import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../models.dart';
import '../sms_service.dart';
import '../utils.dart';
import '../widgets.dart';

const knownBanks = [
  'بانک ملی', 'بانک صادرات', 'بانک ملت', 'بانک تجارت', 'بانک سپه',
  'بانک رفاه', 'بانک مسکن', 'بانک کشاورزی', 'بانک پارسیان', 'بانک پاسارگاد',
  'بانک سامان', 'بانک آینده', 'بانک شهر', 'بانک دی', 'بانک ایران‌زمین',
  'مؤسسه اعتباری کوثر', 'بانک سرمایه', 'بانک خاورمیانه (کارآفرین)',
];

class AccountsPage extends StatelessWidget {
  const AccountsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();

    return Scaffold(
      appBar: AppBar(title: const Text('حساب‌های بانکی')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showAccountForm(context),
        icon: const Icon(Icons.add_card),
        label: const Text('حساب جدید'),
      ),
      body: s.accounts.isEmpty
          ? emptyState(Icons.account_balance_outlined,
              'حساب بانکی اضافه نشده است.\nبا افزودن حساب و شماره فرستنده پیامک،\nواریز و برداشت به‌صورت خودکار ثبت می‌شود.')
          : ListView(
              children: [
                ...s.accounts.map((a) {
                  final bal = s.accountBalance(a.id);
                  final smsCount =
                      s.tx.where((t) => t.accountId == a.id && t.source == TxSource.sms).length;
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                backgroundColor:
                                    Color(categoryColors[a.colorIdx % categoryColors.length])
                                        .withOpacity(.15),
                                child: const Icon(Icons.account_balance, size: 20),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(a.name,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold, fontSize: 15)),
                                    if (a.bank.isNotEmpty)
                                      Text(a.bank,
                                          style: TextStyle(
                                              fontSize: 12, color: Colors.grey.shade600)),
                                  ],
                                ),
                              ),
                              PopupMenuButton<String>(
                                onSelected: (v) {
                                  if (v == 'edit') showAccountForm(context, existing: a);
                                  if (v == 'test') showSmsTestDialog(context, a);
                                  if (v == 'delete') {
                                    showDialog<bool>(
                                      context: context,
                                      builder: (ctx) => AlertDialog(
                                        title: const Text('حذف حساب'),
                                        content: Text(
                                            '«${a.name}» حذف شود؟ تراکنش‌های ثبت‌شده‌اش باقی می‌مانند.'),
                                        actions: [
                                          TextButton(
                                              onPressed: () => Navigator.pop(ctx, false),
                                              child: const Text('لغو')),
                                          FilledButton(
                                              onPressed: () => Navigator.pop(ctx, true),
                                              child: const Text('حذف')),
                                        ],
                                      ),
                                    ).then((ok) {
                                      if (ok == true) s.deleteAccount(a.id);
                                    });
                                  }
                                },
                                itemBuilder: (_) => const [
                                  PopupMenuItem(value: 'edit', child: Text('ویرایش')),
                                  PopupMenuItem(value: 'test', child: Text('ثبت دستی از پیامک')),
                                  PopupMenuItem(value: 'delete', child: Text('حذف')),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('موجودی:',
                                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                              MoneyText(bal,
                                  withCurrency: true,
                                  style: const TextStyle(
                                      fontSize: 17, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'فرستنده‌های پیامک: ${a.senders.where((e) => e.isNotEmpty).isEmpty ? 'تنظیم نشده ⚠' : toFaDigits(a.senders.where((e) => e.isNotEmpty).join('، '))} • $smsCount تراکنش خودکار',
                            style: const TextStyle(fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                if (SmsService.isAndroid)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final ok = await SmsService.requestPermission();
                        if (!ok && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                              content: Text(
                                  'اجازه خواندن پیامک داده نشد. از تنظیمات برنامه قابل فعال‌سازی است.')));
                        } else if (ok && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('دسترسی پیامک فعال شد ✓')));
                        }
                      },
                      icon: const Icon(Icons.sms_outlined),
                      label: const Text('مدیریت دسترسی پیامک'),
                    ),
                  ),
              ],
            ),
    );
  }
}

// ---------- فرم حساب ----------
Future<void> showAccountForm(BuildContext context, {BankAccount? existing}) async {
  final s = context.read<AppState>();
  final nameCtrl = TextEditingController(text: existing?.name ?? '');
  final initCtrl = TextEditingController(
      text: existing != null && existing.initialBalance != 0
          ? fmtMoney(existing.initialBalance, fa: true)
          : '');
  final sendersCtrl = TextEditingController(text: existing?.senders.join('، ') ?? '');
  var bank = existing?.bank ?? knownBanks.first;
  var colorIdx = existing?.colorIdx ?? 0;

  await showFormSheet(
    context,
    StatefulBuilder(
      builder: (ctx, setState) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(existing == null ? 'حساب بانکی جدید' : 'ویرایش حساب',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          TextField(
            controller: nameCtrl,
            autofocus: existing == null,
            decoration: const InputDecoration(
              labelText: 'نام حساب',
              hintText: 'مثلاً: ملی — حساب جاری',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: bank,
            decoration: const InputDecoration(labelText: 'بانک', border: OutlineInputBorder()),
            items: knownBanks
                .map((b) => DropdownMenuItem(value: b, child: Text(b)))
                .toList(),
            onChanged: (v) => setState(() => bank = v ?? bank),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: initCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'موجودی اولیه (اختیاری)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: sendersCtrl,
            decoration: const InputDecoration(
              labelText: 'شماره فرستنده پیامک‌ها',
              hintText: 'مثلاً: 98700077، 50001234',
              helperText: 'با ویرگول جدا کنید؛ پیامک‌های واریز/برداشت از این شماره‌ها خودکار ثبت می‌شوند',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          // انتخاب رنگ
          Wrap(
            spacing: 6,
            children: [
              for (var i = 0; i < categoryColors.length; i++)
                GestureDetector(
                  onTap: () => setState(() => colorIdx = i),
                  child: CircleAvatar(
                    radius: 13,
                    backgroundColor: Color(categoryColors[i]),
                    child: colorIdx == i
                        ? const Icon(Icons.check, size: 14, color: Colors.white)
                        : null,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              await s.saveAccount(BankAccount(
                id: existing?.id ?? genId(),
                name: name,
                bank: bank,
                senders: sendersCtrl.text
                    .split(RegExp(r'[،,،\s]+'))
                    .map((e) => toEnDigits(e.trim()))
                    .where((e) => e.isNotEmpty)
                    .toList(),
                initialBalance: parseMoneyInput(initCtrl.text),
                note: existing?.note ?? '',
                colorIdx: colorIdx,
                ts: existing?.ts ?? DateTime.now().millisecondsSinceEpoch,
              ));
              if (ctx.mounted) Navigator.pop(ctx);
            },
            icon: const Icon(Icons.check),
            label: Text(existing == null ? 'افزودن حساب' : 'ذخیره تغییرات'),
          ),
        ],
      ),
    ),
  );
}

// ---------- ثبت دستی از متن پیامک ----------
Future<void> showSmsTestDialog(BuildContext context, BankAccount account) async {
  final s = context.read<AppState>();
  final ctrl = TextEditingController();

  await showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) {
        ParsedSms? parsed;
        final body = ctrl.text;
        if (body.trim().isNotEmpty) parsed = SmsParser.parse(body);

        return AlertDialog(
          title: Text('ثبت دستی از پیامک — ${account.name}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: ctrl,
                  maxLines: 4,
                  autofocus: true,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'متن پیامک بانکی را اینجا بچسبانید',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                if (parsed != null)
                  Card(
                    color: parsed.deposit ? Colors.green.shade50 : Colors.red.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Text(
                        'شناسایی شد: ${parsed.deposit ? 'واریز' : 'برداشت'} ${s.money(parsed.amount, withCurrency: true)}',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: parsed.deposit ? Colors.green.shade800 : Colors.red.shade800),
                      ),
                    ),
                  )
                else if (body.trim().isNotEmpty)
                  const Text('کلیدواژه واریز/برداشت یا مبلغ پیدا نشد ✗',
                      style: TextStyle(color: Colors.red)),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('لغو')),
            FilledButton(
              onPressed: parsed == null
                  ? null
                  : () async {
                      final msg = await s.processSmsManually(
                        account,
                        deposit: parsed!.deposit,
                        amount: parsed.amount,
                        body: body,
                      );
                      if (ctx.mounted) {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context)
                            .showSnackBar(SnackBar(content: Text(msg)));
                      }
                    },
              child: const Text('ثبت تراکنش'),
            ),
          ],
        );
      },
    ),
  );
}
