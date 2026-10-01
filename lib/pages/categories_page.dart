import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../models.dart';
import '../utils.dart';
import '../widgets.dart';

class CategoriesPage extends StatelessWidget {
  const CategoriesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final expenses = s.cats.where((c) => c.kind == 'expense').toList();
    final incomes = s.cats.where((c) => c.kind == 'income').toList();

    return Scaffold(
      appBar: AppBar(title: const Text('دسته‌بندی‌ها')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showCategoryForm(context),
        icon: const Icon(Icons.add),
        label: const Text('دسته جدید'),
      ),
      body: ListView(
        children: [
          const _Header('دسته‌های هزینه'),
          for (final c in expenses) _CategoryTile(c: c),
          const _Header('دسته‌های درآمد'),
          for (final c in incomes) _CategoryTile(c: c),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'دسته‌ها کاملاً قابل ویرایش هستند؛ برای تغییر، روی دسته بزنید یا آن را نگه دارید.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(text,
          style: TextStyle(
              fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.c});

  final Category c;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final count = s.tx.where((t) => t.categoryId == c.id).length;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: Color(categoryColors[c.colorIdx % categoryColors.length]),
        child: Icon(_iconData(c.iconIdx), size: 20, color: Colors.white),
      ),
      title: Text(c.name),
      subtitle: Text('$count تراکنش', style: const TextStyle(fontSize: 11)),
      trailing: const Icon(Icons.chevron_left),
      onTap: () => showCategoryForm(context, existing: c),
      onLongPress: () => showCategoryForm(context, existing: c),
    );
  }
}

IconData _iconData(int idx) {
  const icons = [
    Icons.restaurant, Icons.directions_car, Icons.shopping_bag, Icons.receipt_long,
    Icons.local_hospital, Icons.sports_esports, Icons.home, Icons.more_horiz,
    Icons.work, Icons.card_giftcard, Icons.savings, Icons.school,
    Icons.flight, Icons.fitness_center, Icons.pets, Icons.local_cafe,
  ];
  return icons[idx % icons.length];
}

Future<void> showCategoryForm(BuildContext context, {Category? existing}) async {
  final s = context.read<AppState>();
  final nameCtrl = TextEditingController(text: existing?.name ?? '');
  var kind = existing?.kind ?? 'expense';
  var colorIdx = existing?.colorIdx ?? 0;
  var iconIdx = existing?.iconIdx ?? 0;

  await showFormSheet(
    context,
    StatefulBuilder(
      builder: (ctx, setState) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(existing == null ? 'دسته جدید' : 'ویرایش دسته',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          TextField(
            controller: nameCtrl,
            autofocus: existing == null,
            decoration: const InputDecoration(
                labelText: 'نام دسته', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'expense', label: Text('هزینه')),
              ButtonSegment(value: 'income', label: Text('درآمد')),
            ],
            selected: {kind},
            onSelectionChanged: (v) => setState(() => kind = v.first),
          ),
          const SizedBox(height: 12),
          const Text('رنگ:'),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            children: [
              for (var i = 0; i < categoryColors.length; i++)
                GestureDetector(
                  onTap: () => setState(() => colorIdx = i),
                  child: CircleAvatar(
                    radius: 14,
                    backgroundColor: Color(categoryColors[i]),
                    child: colorIdx == i
                        ? const Icon(Icons.check, size: 15, color: Colors.white)
                        : null,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          const Text('آیکون:'),
          const SizedBox(height: 6),
          Wrap(
            spacing: 4,
            children: [
              for (var i = 0; i < 16; i++)
                GestureDetector(
                  onTap: () => setState(() => iconIdx = i),
                  child: CircleAvatar(
                    radius: 16,
                    backgroundColor: iconIdx == i
                        ? Color(categoryColors[colorIdx % categoryColors.length])
                        : Colors.grey.withOpacity(.15),
                    child: Icon(_iconData(i),
                        size: 18,
                        color: iconIdx == i ? Colors.white : Colors.grey.shade700),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              await s.saveCategory(Category(
                id: existing?.id ?? genId(),
                name: name,
                colorIdx: colorIdx,
                iconIdx: iconIdx,
                kind: kind,
                order: existing?.order ?? s.cats.length,
              ));
              if (ctx.mounted) Navigator.pop(ctx);
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
                    title: const Text('حذف دسته'),
                    content: Text('«${existing.name}» حذف شود؟ تراکنش‌هایش بدون دسته می‌شوند.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('لغو')),
                      FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حذف')),
                    ],
                  ),
                );
                if (ok == true) {
                  await s.deleteCategory(existing.id);
                  if (ctx.mounted) Navigator.pop(ctx);
                }
              },
              icon: const Icon(Icons.delete_outline),
              label: const Text('حذف دسته'),
            ),
        ],
      ),
    ),
  );
}
