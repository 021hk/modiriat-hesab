import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../app_state.dart';
import '../sms_service.dart';
import '../utils.dart';
import '../widgets.dart';
import 'categories_page.dart';

class MorePage extends StatelessWidget {
  const MorePage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();

    return Scaffold(
      appBar: AppBar(title: const Text('بیشتر')),
      body: ListView(
        children: [
          // پشتیبان‌گیری
          const SectionCard(
            title: 'پشتیبان‌گیری و انتقال داده',
            child: _BackupSection(),
          ),
          // تنظیمات
          SectionCard(
            title: 'تنظیمات',
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('ثبت خودکار پیامک بانکی'),
                  subtitle: const Text('واریز و برداشت حساب‌های تعریف‌شده خودکار ثبت شود'),
                  value: s.settings.autoSms,
                  onChanged: (v) => s.updateSettings(autoSms: v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('اعداد فارسی'),
                  value: s.settings.persianDigits,
                  onChanged: (v) => s.updateSettings(persianDigits: v),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('واحد پول'),
                  trailing: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'تومان', label: Text('تومان')),
                      ButtonSegment(value: 'ریال', label: Text('ریال')),
                    ],
                    selected: {s.settings.currency},
                    onSelectionChanged: (v) => s.updateSettings(currency: v.first),
                  ),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('حالت نمایش'),
                  trailing: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'system', label: Text('خودکار')),
                      ButtonSegment(value: 'light', label: Text('روشن')),
                      ButtonSegment(value: 'dark', label: Text('تیره')),
                    ],
                    selected: {s.settings.themeMode},
                    onSelectionChanged: (v) => s.updateSettings(themeMode: v.first),
                  ),
                ),
              ],
            ),
          ),
          // پیامک
          if (SmsService.isAndroid)
            SectionCard(
              title: 'پیامک بانکی',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'برای ثبت خودکار، اجازه خواندن پیامک لازم است. شماره فرستنده هر حساب را در صفحه «حساب‌ها» وارد کنید.',
                    style: TextStyle(fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final ok = await SmsService.requestPermission();
                      if (!ok && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                            content: Text('اجازه داده نشد؛ از تنظیمات گوشی فعال کنید.')));
                      }
                    },
                    icon: const Icon(Icons.verified_user_outlined),
                    label: const Text('درخواست دسترسی پیامک'),
                  ),
                ],
              ),
            ),
          // لینک‌ها
          ListTile(
            leading: const Icon(Icons.category_outlined),
            title: const Text('مدیریت دسته‌بندی‌ها'),
            trailing: const Icon(Icons.chevron_left),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const CategoriesPage()),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('درباره برنامه'),
            subtitle: const Text('مدیریت حساب — نسخه 1.0.0'),
            onTap: () => showAboutDialog(
              context: context,
              applicationName: 'مدیریت حساب',
              applicationVersion: '1.0.0',
              applicationLegalese: 'برنامه شخصی حساب‌داری — بدهکاران، طلبکاران، حساب‌های بانکی و ثبت خودکار پیامک',
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _BackupSection extends StatefulWidget {
  const _BackupSection();

  @override
  State<_BackupSection> createState() => _BackupSectionState();
}

class _BackupSectionState extends State<_BackupSection> {
  bool _busy = false;
  bool _includePhotos = true;

  Future<void> _export() async {
    final s = context.read<AppState>();
    setState(() => _busy = true);
    try {
      final json = await s.exportBackup(includePhotos: _includePhotos);
      final fileName =
          'modiriat-hesab-backup-${DateTime.now().toIso8601String().substring(0, 10)}.json';
      final bytes = utf8.encode(json);

      if (kIsWeb) {
        await FilePicker.platform.saveFile(fileName: fileName, bytes: bytes);
      } else if (Platform.isAndroid || Platform.isIOS) {
        // موبایل: ذخیره در حافظه و اشتراک‌گذاری (تلگرام، واتساپ، فایل‌ها…)
        final dir = await FilePicker.platform.getDirectoryPath();
        if (dir != null) {
          final f = File('$dir/$fileName');
          await f.writeAsBytes(bytes);
          await Share.shareXFiles([XFile(f.path)]);
        }
      } else {
        // دسکتاپ: پنجره ذخیره فایل
        final path = await FilePicker.platform.saveFile(fileName: fileName);
        if (path != null) {
          await File(path).writeAsBytes(bytes);
        }
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('پشتیبان ساخته شد ✓ — در دستگاه دیگر همان فایل را «بازگردانی» کنید.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('خطا در ساخت پشتیبان: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _import() async {
    final s = context.read<AppState>();
    final replace = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('بازگردانی پشتیبان'),
        content: const Text(
            'داده‌های فعلی با محتوای فایل پشتیبان جایگزین می‌شود.\n(روش دوم: ادغام با داده‌های فعلی)'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('لغو')),
          OutlinedButton(
              onPressed: () => Navigator.pop(ctx, false), child: const Text('ادغام')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true), child: const Text('جایگزینی کامل')),
        ],
      ),
    );
    if (replace == null) return;

    final res = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['json'],
      withData: kIsWeb,
    );
    if (res == null || res.files.isEmpty) return;
    setState(() => _busy = true);
    try {
      String raw;
      if (kIsWeb) {
        raw = utf8.decode(res.files.first.bytes!);
      } else {
        raw = await File(res.files.first.path!).readAsString();
      }
      final n = await s.importBackup(raw, replace: replace);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('بازگردانی انجام شد — ${fmtMoney(n)} رکورد بازیابی شد ✓')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('خطا در بازگردانی: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'فایل پشتیبان همه داده‌ها (حساب‌ها، تراکنش‌ها، بدهی‌ها و عکس رسیدها) را شامل می‌شود و روی هر دستگاهی — اندروید، ویندوز، مک، لینوکس — قابل بازگردانی است.',
          style: TextStyle(fontSize: 12),
        ),
        const SizedBox(height: 8),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('شامل عکس‌های رسید'),
          value: _includePhotos,
          onChanged: (v) => setState(() => _includePhotos = v ?? true),
        ),
        Row(
          children: [
            Expanded(
              child: FilledButton.tonalIcon(
                onPressed: _busy ? null : _export,
                icon: const Icon(Icons.file_upload_outlined),
                label: const Text('ساخت پشتیبان'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.tonalIcon(
                onPressed: _busy ? null : _import,
                icon: const Icon(Icons.file_download_outlined),
                label: const Text('بازگردانی'),
              ),
            ),
          ],
        ),
        if (_busy) const Padding(
          padding: EdgeInsets.only(top: 10),
          child: LinearProgressIndicator(),
        ),
      ],
    );
  }
}
