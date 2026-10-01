import 'dart:convert';

import 'package:flutter/foundation.dart' hide Category;
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../models.dart';
import '../utils.dart';
import '../widgets.dart';

class PeoplePage extends StatelessWidget {
  const PeoplePage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();

    return Scaffold(
      appBar: AppBar(title: const Text('بدهکاران و طلبکاران')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showPersonForm(context),
        icon: const Icon(Icons.person_add),
        label: const Text('شخص جدید'),
      ),
      body: s.people.isEmpty
          ? emptyState(Icons.people_outline,
              'هنوز کسی اضافه نشده.\nبا دکمه «شخص جدید» بدهکار یا طلبکار اضافه کنید.')
          : ListView.builder(
              itemCount: s.people.length,
              itemBuilder: (ctx, i) {
                final p = s.people[i];
                final bal = s.personBalance(p.id);
                final debts = s.debtsOf(p.id);
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: bal > 0
                        ? Colors.red.shade100
                        : bal < 0
                            ? Colors.orange.shade100
                            : Colors.grey.shade200,
                    child: Text(
                      p.name.isNotEmpty ? p.name.characters.first : '؟',
                      style: TextStyle(
                        color: bal > 0
                            ? Colors.red.shade800
                            : bal < 0
                                ? Colors.orange.shade800
                                : Colors.grey.shade700,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    '${debts.length} فقره • ${p.phone.isEmpty ? 'بدون شماره' : toFaDigits(p.phone)}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      MoneyText(bal.abs(),
                          withCurrency: true,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: bal > 0
                                ? Colors.red.shade700
                                : bal < 0
                                    ? Colors.orange.shade800
                                    : Colors.grey,
                          )),
                      Text(
                        bal > 0 ? 'به من بدهکار است' : bal < 0 ? 'من بدهکارم' : 'تسویه',
                        style: const TextStyle(fontSize: 10),
                      ),
                    ],
                  ),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => PersonDetailPage(personId: p.id)),
                  ),
                  onLongPress: () => showPersonForm(context, existing: p),
                );
              },
            ),
    );
  }
}

// ---------- فرم شخص ----------
Future<void> showPersonForm(BuildContext context, {Person? existing}) async {
  final s = context.read<AppState>();
  final nameCtrl = TextEditingController(text: existing?.name ?? '');
  final phoneCtrl = TextEditingController(text: existing?.phone ?? '');
  final noteCtrl = TextEditingController(text: existing?.note ?? '');

  await showFormSheet(
    context,
    Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(existing == null ? 'شخص جدید' : 'ویرایش شخص',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        TextField(
          controller: nameCtrl,
          autofocus: existing == null,
          decoration: const InputDecoration(labelText: 'نام', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: phoneCtrl,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'شماره تماس (اختیاری)', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: noteCtrl,
          decoration: const InputDecoration(labelText: 'یادداشت (اختیاری)', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: () async {
            final name = nameCtrl.text.trim();
            if (name.isEmpty) return;
            await s.savePerson(Person(
              id: existing?.id ?? genId(),
              name: name,
              phone: phoneCtrl.text.trim(),
              note: noteCtrl.text.trim(),
            ));
            if (context.mounted) Navigator.pop(context);
          },
          icon: const Icon(Icons.check),
          label: Text(existing == null ? 'افزودن' : 'ذخیره'),
        ),
        if (existing != null)
          TextButton.icon(
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('حذف شخص'),
                  content: Text('«${existing.name}» و همه بدهی‌های او حذف شود؟'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('لغو')),
                    FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حذف')),
                  ],
                ),
              );
              if (ok == true) {
                await s.deletePerson(existing.id);
                if (context.mounted) Navigator.pop(context);
              }
            },
            icon: const Icon(Icons.delete_outline),
            label: const Text('حذف این شخص'),
          ),
      ],
    ),
  );
}

// ---------- جزئیات شخص ----------
class PersonDetailPage extends StatelessWidget {
  const PersonDetailPage({super.key, required this.personId});

  final String personId;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final p = s.personOf(personId);
    if (p == null) {
      return const Scaffold(body: Center(child: Text('یافت نشد')));
    }
    final debts = s.debtsOf(personId);
    final bal = s.personBalance(personId);

    return Scaffold(
      appBar: AppBar(
        title: Text(p.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => showPersonForm(context, existing: p),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showDebtForm(context, personId: personId),
        icon: const Icon(Icons.add),
        label: const Text('ثبت بدهی'),
      ),
      body: ListView(
        children: [
          Card(
            margin: const EdgeInsets.all(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(bal > 0
                      ? '${p.name} به شما بدهکار است:'
                      : bal < 0
                          ? 'شما به ${p.name} بدهکارید:'
                          : 'حساب تسویه است'),
                  const SizedBox(height: 6),
                  MoneyText(bal.abs(),
                      withCurrency: true,
                      style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: bal > 0
                              ? Colors.red.shade700
                              : bal < 0
                                  ? Colors.orange.shade800
                                  : Colors.green.shade700)),
                  if (p.note.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(p.note, style: const TextStyle(fontSize: 12)),
                  ],
                ],
              ),
            ),
          ),
          if (debts.isEmpty)
            emptyState(Icons.receipt_long, 'بدهی‌ای ثبت نشده است.')
          else
            ...debts.map((d) => _DebtTile(d: d)),
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}

class _DebtTile extends StatelessWidget {
  const _DebtTile({required this.d});

  final Debt d;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final theyOwe = d.dir == DebtDir.theyOwe;
    final color = theyOwe ? Colors.red.shade600 : Colors.orange.shade700;
    final fullySettled = d.outstanding <= 0;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(theyOwe ? Icons.call_received : Icons.call_made, size: 18, color: color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(theyOwe ? 'او به من بدهکار است' : 'من به او بدهکارم',
                      style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13)),
                ),
                Text(fmtJalali(d.ts), style: const TextStyle(fontSize: 11)),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, size: 18),
                  onSelected: (v) {
                    if (v == 'edit') showDebtForm(context, existing: d);
                    if (v == 'pay') showSettleDialog(context, d);
                    if (v == 'delete') {
                      showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('حذف بدهی'),
                          content: const Text('این بدهی حذف شود؟'),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('لغو')),
                            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حذف')),
                          ],
                        ),
                      ).then((ok) {
                        if (ok == true) s.deleteDebt(d.id);
                      });
                    }
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'edit', child: Text('ویرایش')),
                    if (!fullySettled)
                      const PopupMenuItem(value: 'pay', child: Text('ثبت بازپرداخت')),
                    const PopupMenuItem(value: 'delete', child: Text('حذف')),
                  ],
                ),
              ],
            ),
            MoneyText(d.amount, withCurrency: true,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            if (d.settled > 0)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'تسویه‌شده: ${s.money(d.settled)} — باقی‌مانده: ${s.money(d.outstanding)}',
                  style: TextStyle(
                      fontSize: 11,
                      color: fullySettled ? Colors.green.shade700 : Colors.grey.shade600),
                ),
              ),
            LinearProgressIndicator(
              value: d.amount > 0 ? (d.settled / d.amount).clamp(0.0, 1.0) : 0,
              color: fullySettled ? Colors.green : color,
              backgroundColor: Colors.grey.withOpacity(.2),
              minHeight: 4,
            ),
            if (d.note.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(d.note, style: const TextStyle(fontSize: 12)),
              ),
            if (d.photos.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: SizedBox(
                  height: 64,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: d.photos.map((ph) => _PhotoThumb(photo: ph)).toList(),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _PhotoThumb extends StatelessWidget {
  const _PhotoThumb({required this.photo});

  final PhotoRef photo;

  @override
  Widget build(BuildContext context) {
    final s = context.read<AppState>();
    Widget child;
    if (photo.kind == AttachKind.file && photo.path.isNotEmpty) {
      final f = s.store.receiptFile(photo);
      child = f.existsSync()
          ? Image.file(f, fit: BoxFit.cover, width: 64, height: 64)
          : const Icon(Icons.broken_image);
    } else {
      child = const Icon(Icons.image_outlined);
    }
    return GestureDetector(
      onTap: () {
        if (photo.kind == AttachKind.file && photo.path.isNotEmpty) {
          final f = s.store.receiptFile(photo);
          if (f.existsSync()) {
            showDialog(
              context: context,
              builder: (ctx) => Dialog(
                child: InteractiveViewer(
                  child: Image.file(f, fit: BoxFit.contain),
                ),
              ),
            );
          }
        }
      },
      child: Container(
        width: 64,
        height: 64,
        margin: const EdgeInsets.only(left: 6),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: Colors.grey.shade200,
        ),
        child: child,
      ),
    );
  }
}

// ---------- فرم بدهی (با عکس رسید) ----------
Future<void> showDebtForm(BuildContext context, {String? personId, Debt? existing}) async {
  final s = context.read<AppState>();
  final pid = existing?.personId ?? personId ?? '';
  var dir = existing?.dir ?? DebtDir.theyOwe;
  final amountCtrl =
      TextEditingController(text: existing != null ? fmtMoney(existing.amount, fa: true) : '');
  final noteCtrl = TextEditingController(text: existing?.note ?? '');
  var settledCtrl = TextEditingController(
      text: existing != null && existing.settled > 0 ? fmtMoney(existing.settled, fa: true) : '');
  var date = existing != null ? DateTime.fromMillisecondsSinceEpoch(existing.ts) : DateTime.now();
  final photos = List<PhotoRef>.from(existing?.photos ?? []);

  await showFormSheet(
    context,
    StatefulBuilder(
      builder: (ctx, setState) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(existing == null ? 'ثبت بدهی جدید' : 'ویرایش بدهی',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          SegmentedButton<DebtDir>(
            segments: const [
              ButtonSegment(value: DebtDir.theyOwe, label: Text('او به من بدهکار است')),
              ButtonSegment(value: DebtDir.iOwe, label: Text('من به او بدهکارم')),
            ],
            selected: {dir},
            onSelectionChanged: (v) => setState(() => dir = v.first),
          ),
          const SizedBox(height: 12),
          AmountField(controller: amountCtrl, label: 'مبلغ', autofocus: existing == null),
          const SizedBox(height: 12),
          TextField(
            controller: noteCtrl,
            decoration: const InputDecoration(
              labelText: 'توضیح — بابت چیست؟',
              hintText: 'مثلاً: قرض خرید لپ‌تاپ',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: settledCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'مبلغ تسویه‌شده تا الان (اختیاری)',
              border: OutlineInputBorder(),
            ),
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
          // عکس‌های رسید
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: () async {
                  final res = await FilePicker.platform.pickFiles(
                    type: FileType.image,
                    withData: kIsWeb,
                  );
                  if (res != null && res.files.isNotEmpty) {
                    for (final f in res.files) {
                      if (kIsWeb) {
                        if (f.bytes != null) {
                          final b64 = base64OfBytes(f.bytes!);
                          photos.add(PhotoRef(
                              id: genId(),
                              name: f.name,
                              base64: b64,
                              kind: AttachKind.embedded));
                        }
                      } else if (f.path != null) {
                        final ref = await s.addReceiptPhoto(f.path!, f.name);
                        photos.add(ref);
                      }
                    }
                    setState(() {});
                  }
                },
                icon: const Icon(Icons.add_a_photo_outlined),
                label: const Text('افزودن عکس رسید'),
              ),
              const SizedBox(width: 8),
              Text('${photos.length} عکس',
                  style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
          if (photos.isNotEmpty)
            SizedBox(
              height: 72,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (var i = 0; i < photos.length; i++)
                    Stack(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          margin: const EdgeInsets.only(left: 6, top: 4),
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            color: Colors.grey.shade300,
                          ),
                          child: photos[i].kind == AttachKind.file
                              ? Image.file(s.store.receiptFile(photos[i]),
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const Icon(Icons.image))
                              : const Icon(Icons.image_outlined),
                        ),
                        Positioned(
                          top: 0,
                          left: 0,
                          child: GestureDetector(
                            onTap: () => setState(() => photos.removeAt(i)),
                            child: Container(
                              decoration: const BoxDecoration(
                                  color: Colors.red, shape: BoxShape.circle),
                              padding: const EdgeInsets.all(2),
                              child: const Icon(Icons.close,
                                  size: 12, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () async {
              final amount = parseMoneyInput(amountCtrl.text);
              if (amount <= 0) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(const SnackBar(content: Text('مبلغ را وارد کنید')));
                return;
              }
              await s.saveDebt(Debt(
                id: existing?.id ?? genId(),
                personId: pid,
                dir: dir,
                amount: amount,
                settled: parseMoneyInput(settledCtrl.text),
                ts: date.millisecondsSinceEpoch,
                note: noteCtrl.text.trim(),
                photos: photos,
              ));
              if (ctx.mounted) Navigator.pop(ctx);
            },
            icon: const Icon(Icons.check),
            label: Text(existing == null ? 'ثبت بدهی' : 'ذخیره تغییرات'),
          ),
        ],
      ),
    ),
  );
}

// ---------- ثبت بازپرداخت ----------
Future<void> showSettleDialog(BuildContext context, Debt d) async {
  final s = context.read<AppState>();
  final ctrl = TextEditingController();
  await showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('ثبت بازپرداخت'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('باقی‌مانده: ${s.money(d.outstanding, withCurrency: true)}'),
          const SizedBox(height: 10),
          AmountField(controller: ctrl, label: 'مبلغ بازپرداخت', autofocus: true),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('لغو')),
        FilledButton(
          onPressed: () async {
            final v = parseMoneyInput(ctrl.text);
            if (v > 0) {
              final newSettled = (d.settled + v).clamp(0, d.amount).toDouble();
              await s.saveDebt(Debt(
                id: d.id,
                personId: d.personId,
                dir: d.dir,
                amount: d.amount,
                settled: newSettled,
                ts: d.ts,
                note: d.note,
                photos: d.photos,
              ));
            }
            if (ctx.mounted) Navigator.pop(ctx);
          },
          child: const Text('ثبت'),
        ),
      ],
    ),
  );
}

String base64OfBytes(List<int> bytes) => base64Encode(bytes);
