import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../models.dart';
import '../utils.dart';
import '../widgets.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final byCat = s.expenseByCategory();
    final entries = byCat.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final totalExp = entries.fold<double>(0, (a, e) => a + e.value);

    return Scaffold(
      appBar: AppBar(title: const Text('مدیریت حساب')),
      body: ListView(
        children: [
          // موجودی کل
          Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.tertiary,
                ],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('موجودی کل',
                    style: TextStyle(color: Colors.white.withOpacity(.85))),
                const SizedBox(height: 4),
                MoneyText(s.totalBalance,
                    withCurrency: true,
                    style: const TextStyle(
                        fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white)),
              ],
            ),
          ),
          Row(
            children: [
              _StatCard(
                title: 'بدهکار به من',
                value: s.totalTheyOweMe,
                color: Colors.red.shade400,
                icon: Icons.call_received,
              ),
              _StatCard(
                title: 'بدهی من',
                value: s.totalIOwe,
                color: Colors.orange.shade400,
                icon: Icons.call_made,
              ),
            ],
          ),
          _StatCardWide(
            title: 'هزینه این ماه',
            value: s.monthExpense,
            icon: Icons.trending_down,
            color: Theme.of(context).colorScheme.primary,
          ),
          // نمودار دسته‌بندی
          if (entries.isNotEmpty)
            SectionCard(
              title: 'هزینه‌ها بر اساس دسته (کل)',
              child: SizedBox(
                height: 180,
                child: PieChart(
                  PieChartData(
                    sectionsSpace: 2,
                    centerSpaceRadius: 34,
                    sections: entries.take(8).map((e) {
                      final color = Color(categoryColors[e.key.colorIdx % categoryColors.length]);
                      return PieChartSectionData(
                        value: e.value,
                        color: color,
                        radius: 42,
                        title: '${(e.value / totalExp * 100).toStringAsFixed(0)}٪',
                        titleStyle: const TextStyle(
                            fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
                      );
                    }).toList(),
                  ),
                ),
              ),
            ),
          if (entries.isNotEmpty)
            ...entries.take(5).map((e) => ListTile(
                  dense: true,
                  leading: CircleAvatar(
                      radius: 10,
                      backgroundColor: Color(categoryColors[e.key.colorIdx % categoryColors.length])),
                  title: Text(e.key.name),
                  trailing: MoneyText(e.value),
                )),
          SectionCard(
            title: 'آخرین تراکنش‌ها',
            child: s.tx.isEmpty
                ? const Text('هنوز تراکنشی ثبت نشده است.')
                : Column(
                    children: s.tx.take(5).map((t) => TxTile(t: t)).toList(),
                  ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.title, required this.value, required this.color, required this.icon});

  final String title;
  final double value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 6),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Row(
                children: [
                  Icon(icon, size: 18, color: color),
                  const SizedBox(width: 6),
                  Expanded(child: Text(title, style: Theme.of(context).textTheme.bodySmall)),
                ],
              ),
              const SizedBox(height: 6),
              MoneyText(value, style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatCardWide extends StatelessWidget {
  const _StatCardWide({required this.title, required this.value, required this.color, required this.icon});

  final String title;
  final double value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(width: 10),
            Expanded(child: Text(title, style: Theme.of(context).textTheme.bodyMedium)),
            MoneyText(value, withCurrency: true, style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}

class TxTile extends StatelessWidget {
  const TxTile({super.key, required this.t});

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
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        radius: 18,
        backgroundColor: cat != null
            ? Color(categoryColors[cat.colorIdx % categoryColors.length]).withOpacity(.15)
            : Colors.grey.withOpacity(.15),
        child: Icon(
          isIncome ? Icons.south_west : Icons.north_east,
          size: 18,
          color: color,
        ),
      ),
      title: Text(cat?.name ?? (t.source == TxSource.sms ? 'پیامک بانک' : 'بدون دسته'),
          style: const TextStyle(fontSize: 14)),
      subtitle: Text(
        [
          fmtJalali(t.ts, withTime: true),
          if (acc != null) acc.name,
          if (t.note.isNotEmpty) t.note,
        ].join(' • '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 11),
      ),
      trailing: MoneyText(t.amount, signed: true, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
    );
  }
}
