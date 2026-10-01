import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../models.dart';
import '../utils.dart';
import '../widgets.dart';

class TransactionsPage extends StatefulWidget {
  const TransactionsPage({super.key});

  @override
  State<TransactionsPage> createState() => _TransactionsPageState();
}

class _TransactionsPageState extends State<TransactionsPage> {
  String _search = '';
  TxType? _typeFilter;
  String? _accFilter;
  String? _catFilter;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    var list = s.tx.where((t) {
      if (_typeFilter != null && t.type != _typeFilter) return false;
      if (_accFilter != null && t.accountId != _accFilter) return false;
      if (_catFilter != null && t.categoryId != _catFilter) return false;
      if (_search.isNotEmpty) {
        final q = toEnDigits(_search).toLowerCase();
        final hay = [
          t.note,
          s.categoryOf(t.categoryId)?.name ?? '',
        ].join(' ').toLowerCase();
        if (!hay.contains(q) && !fmtMoney(t.amount, fa: false).contains(q)) {
          return false;
        }
      }
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('تراکنش‌ها')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showTxForm(context),
        child: const Icon(Icons.add),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'جستجو در توضیحات، دسته و مبلغ…',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: [
                FilterChip(
                  label: const Text('همه'),
                  selected: _typeFilter == null,
                  onSelected: (_) => setState(() => _typeFilter = null),
                ),
                const SizedBox(width: 6),
                FilterChip(
                  label: const Text('هزینه'),
                  selected: _typeFilter == TxType.expense,
                  onSelected: (_) => setState(() => _typeFilter = TxType.expense),
                ),
                const SizedBox(width: 6),
                FilterChip(
                  label: const Text('درآمد'),
                  selected: _typeFilter == TxType.income,
                  onSelected: (_) => setState(() => _typeFilter = TxType.income),
                ),
                const SizedBox(width: 6),
                PopupMenuButton<String>(
                  tooltip: 'فیلتر حساب',
                  child: Chip(
                    label: Text(_accFilter == null
                        ? 'همه حساب‌ها'
                        : s.accounts.where((a) => a.id == _accFilter).first.name),
                  ),
                  onSelected: (v) => setState(() => _accFilter = v == '' ? null : v),
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: '', child: Text('همه حساب‌ها')),
                    ...s.accounts.map((a) => PopupMenuItem(value: a.id, child: Text(a.name))),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: list.isEmpty
                ? emptyState(Icons.swap_horiz, 'تراکنشی یافت نشد.')
                : ListView.builder(
                    itemCount: list.length,
                    itemBuilder: (ctx, i) {
                      final t = list[i];
                      return Dismissible(
                        key: ValueKey(t.id),
                        direction: DismissDirection.endToStart,
                        background: Container(
                          color: Colors.red,
                          alignment: Alignment.centerLeft,
                          padding: const EdgeInsets.only(left: 20),
                          child: const Icon(Icons.delete, color: Colors.white),
                        ),
                        confirmDismiss: (_) async {
                          return await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: const Text('حذف تراکنش'),
                                  content: const Text('آیا مطمئن هستید؟'),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('لغو')),
                                    FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حذف')),
                                  ],
                                ),
                              ) ??
                              false;
                        },
                        onDismissed: (_) => s.deleteTx(t.id),
                        child: TxTileFull(t: t),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class TxTileFull extends StatelessWidget {
  const TxTileFull({super.key, required this.t});

  final Tx t;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final cat = s.categoryOf(t.categoryId);
    final isIncome = t.type == TxType.income;
    final color = isIncome ? Colors.green.shade600 : Colors.red.shade500;
    BankAccount? acc;
    for (final a in s.accounts) {
      if (a.id == t.accountId) acc = a;
    }

    return ListTile(
      onLongPress: () => showTxForm(context, existing: t),
      onTap: () => showTxForm(context, existing: t),
      leading: CircleAvatar(
        backgroundColor: cat != null
            ? Color(categoryColors[cat.colorIdx % categoryColors.length]).withOpacity(.15)
            : Colors.grey.withOpacity(.15),
        child: Icon(
          cat != null && categoryIconNames.length > cat.iconIdx ? _iconFor(cat.iconIdx) : (isIncome ? Icons.south_west : Icons.north_east),
          size: 20,
          color: color,
        ),
      ),
      title: Text(cat?.name ?? (t.source == TxSource.sms ? 'پیامک بانک' : 'بدون دسته'),
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      subtitle: Text(
        [
          fmtJalali(t.ts, withTime: true),
          if (acc != null) acc.name,
          if (t.source == TxSource.sms) 'ارسال: ${t.smsSender}',
        ].join(' • '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 11),
      ),
      isThreeLine: false,
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          MoneyText(t.amount, signed: true, style: TextStyle(color: color, fontWeight: FontWeight.w700)),
          if (t.note.isNotEmpty)
            Text(t.note, maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10)),
        ],
      ),
    );
  }
}

IconData _iconFor(int idx) {
  const icons = [
    Icons.restaurant, Icons.directions_car, Icons.shopping_bag, Icons.receipt_long,
    Icons.local_hospital, Icons.sports_esports, Icons.home, Icons.more_horiz,
    Icons.work, Icons.card_giftcard, Icons.savings, Icons.school,
    Icons.flight, Icons.fitness_center, Icons.pets, Icons.local_cafe,
  ];
  return icons[idx % icons.length];
}

// ---------- فرم ثبت/ویرایش تراکنش ----------
Future<void> showTxForm(BuildContext context, {Tx? existing}) async {
  final s = context.read<AppState>();
  var isIncome = existing?.type == TxType.income;
  final amountCtrl = TextEditingController(
      text: existing != null ? fmtMoney(existing.amount, fa: true) : '');
  var catId = existing?.categoryId ?? '';
  var accId = existing?.accountId ?? (s.accounts.isNotEmpty ? s.accounts.first.id : '');
  var date = existing != null
      ? DateTime.fromMillisecondsSinceEpoch(existing.ts)
      : DateTime.now();
  final noteCtrl = TextEditingController(text: existing?.note ?? '');
  final formKey = GlobalKey<FormState>();

  await showFormSheet(
    context,
    StatefulBuilder(
      builder: (ctx, setState) => Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('هزینه'), icon: Icon(Icons.north_east)),
                ButtonSegment(value: true, label: Text('درآمد'), icon: Icon(Icons.south_west)),
              ],
              selected: {isIncome},
              onSelectionChanged: (v) => setState(() {
                isIncome = v.first;
                // اگر دسته انتخابی با نوع جدید نمی‌خواند، پاک شود
                final cat = s.categoryOf(catId);
                if (cat != null && cat.kind != (isIncome ? 'income' : 'expense')) {
                  catId = '';
                }
              }),
            ),
            const SizedBox(height: 12),
            AmountField(controller: amountCtrl, label: 'مبلغ', autofocus: existing == null),
            const SizedBox(height: 12),
            // دسته
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: s.cats.where((c) => c.kind == (isIncome ? 'income' : 'expense')).map((c) {
                final selected = catId == c.id;
                return ChoiceChip(
                  label: Text(c.name),
                  selected: selected,
                  selectedColor: Color(categoryColors[c.colorIdx % categoryColors.length]).withOpacity(.3),
                  onSelected: (_) => setState(() => catId = c.id),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            // حساب
            DropdownButtonFormField<String>(
              value: accId.isEmpty ? null : accId,
              decoration: const InputDecoration(labelText: 'حساب بانکی (خالی = نقدی)'),
              items: [
                const DropdownMenuItem(value: '', child: Text('نقدی')),
                ...s.accounts.map((a) => DropdownMenuItem(value: a.id, child: Text(a.name))),
              ],
              onChanged: (v) => setState(() => accId = v ?? ''),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () async {
                final d = await pickJalaliDate(context, date);
                if (d != null) setState(() => date = d);
              },
              icon: const Icon(Icons.calendar_month),
              label: Text('تاریخ: ${fmtJalali(date.millisecondsSinceEpoch)}'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteCtrl,
              decoration: const InputDecoration(
                labelText: 'توضیح — این پول برای چه چیزی بود؟',
                hintText: 'مثلاً: خرید ماهانه خواروبار',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () async {
                final amount = parseMoneyInput(amountCtrl.text);
                if (amount <= 0) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('مبلغ را وارد کنید')));
                  return;
                }
                final tx = Tx(
                  id: existing?.id ?? genId(),
                  type: isIncome ? TxType.income : TxType.expense,
                  amount: amount,
                  categoryId: catId,
                  accountId: accId,
                  ts: date.millisecondsSinceEpoch,
                  note: noteCtrl.text.trim(),
                  source: existing?.source ?? TxSource.manual,
                  smsSender: existing?.smsSender ?? '',
                );
                await s.saveTx(tx);
                if (ctx.mounted) Navigator.pop(ctx);
              },
              icon: const Icon(Icons.check),
              label: Text(existing == null ? 'ثبت تراکنش' : 'ذخیره تغییرات'),
            ),
          ],
        ),
      ),
    ),
  );
}
