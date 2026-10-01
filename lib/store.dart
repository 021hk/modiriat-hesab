import 'dart:convert';
import 'dart:io';

import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';

import 'models.dart';
import 'utils.dart';

/// لایه ذخیره‌سازی: هر رکورد به‌صورت Map در باکس‌های Hive.
/// پشتیبان‌گیری = خروجی JSON از تمام باکس‌ها (+ عکس‌ها به‌صورت base64)
class Store {
  late Box txBox;
  late Box catBox;
  late Box personBox;
  late Box debtBox;
  late Box accBox;
  late Box setBox;

  late Directory dataDir;

  Future<void> open() async {
    final support = await getApplicationSupportDirectory();
    dataDir = Directory('${support.path}/receipts');
    if (!dataDir.existsSync()) dataDir.createSync(recursive: true);

    txBox = await Hive.openBox('transactions');
    catBox = await Hive.openBox('categories');
    personBox = await Hive.openBox('people');
    debtBox = await Hive.openBox('debts');
    accBox = await Hive.openBox('accounts');
    setBox = await Hive.openBox('settings');
  }

  // ---------- خواندن ----------
  List<Tx> allTx() => txBox.values
      .map((m) => Tx.fromMap(Map<dynamic, dynamic>.from(m)))
      .toList();

  List<Category> allCategories() => catBox.values
      .map((m) => Category.fromMap(Map<dynamic, dynamic>.from(m)))
      .toList();

  List<Person> allPeople() => personBox.values
      .map((m) => Person.fromMap(Map<dynamic, dynamic>.from(m)))
      .toList();

  List<Debt> allDebts() => debtBox.values
      .map((m) => Debt.fromMap(Map<dynamic, dynamic>.from(m)))
      .toList();

  List<BankAccount> allAccounts() => accBox.values
      .map((m) => BankAccount.fromMap(Map<dynamic, dynamic>.from(m)))
      .toList();

  AppSettings settings() =>
      AppSettings.fromMap(Map<dynamic, dynamic>.from(setBox.get('main', defaultValue: {})));

  Future<void> saveSettings(AppSettings s) => setBox.put('main', s.toMap());

  // ---------- نوشتن ----------
  Future<void> putTx(Tx t) => txBox.put(t.id, t.toMap());
  Future<void> deleteTx(String id) => txBox.delete(id);

  Future<void> putCategory(Category c) => catBox.put(c.id, c.toMap());
  Future<void> deleteCategory(String id) => catBox.delete(id);

  Future<void> putPerson(Person p) => personBox.put(p.id, p.toMap());
  Future<void> deletePerson(String id) => personBox.delete(id);

  Future<void> putDebt(Debt d) => debtBox.put(d.id, d.toMap());
  Future<void> deleteDebt(String id) => debtBox.delete(id);

  Future<void> putAccount(BankAccount a) => accBox.put(a.id, a.toMap());
  Future<void> deleteAccount(String id) => accBox.delete(id);

  /// ذخیره عکس رسید داخل پوشه داده برنامه؛ مسیر نسبی برمی‌گردد
  Future<PhotoRef> saveReceiptPhoto(String sourcePath, String originalName) async {
    final id = genId();
    final ext = originalName.contains('.')
        ? originalName.substring(originalName.lastIndexOf('.'))
        : '.jpg';
    final f = File('${dataDir.path}/$id$ext');
    await File(sourcePath).copy(f.path);
    return PhotoRef(id: id, name: originalName, path: '$id$ext', kind: AttachKind.file);
  }

  File receiptFile(PhotoRef p) => File('${dataDir.path}/${p.path}');

  // ---------- پشتیبان‌گیری ----------
  Future<String> exportBackup({bool includePhotos = true}) async {
    final photosCache = <String, String?>{};
    if (includePhotos) {
      for (final d in allDebts()) {
        for (final p in d.photos) {
          if (p.kind == AttachKind.file && p.path.isNotEmpty && !photosCache.containsKey(p.path)) {
            final f = receiptFile(p);
            photosCache[p.path] = f.existsSync()
                ? base64Encode(await f.readAsBytes())
                : null;
          }
        }
      }
    }
    final map = {
      'app': 'modiriat-hesab',
      'version': 1,
      'exportedAt': DateTime.now().toIso8601String(),
      'transactions': txBox.values.map((e) => Map<String, dynamic>.from(e)).toList(),
      'categories': catBox.values.map((e) => Map<String, dynamic>.from(e)).toList(),
      'people': personBox.values.map((e) => Map<String, dynamic>.from(e)).toList(),
      'debts': debtBox.values.map((e) => Map<String, dynamic>.from(e)).toList(),
      'accounts': accBox.values.map((e) => Map<String, dynamic>.from(e)).toList(),
      'settings': Map<String, dynamic>.from(settings().toMap()),
    };
    if (includePhotos) {
      map['photos'] = photosCache.entries
          .where((e) => e.value != null)
          .map((e) => {'path': e.key, 'b64': e.value})
          .toList();
    }
    return const JsonEncoder.withIndent('  ').convert(map);
  }

  /// بازگردانی؛ اگر replace=true اول همه پاک می‌شود
  Future<int> importBackup(String raw, {bool replace = true}) async {
    final data = jsonDecode(raw);
    if (data is! Map || data['app'] != 'modiriat-hesab') {
      throw const FormatException('این فایل پشتیبان «مدیریت حساب» نیست.');
    }
    int count = 0;

    Future<void> fill(Box box, List list, bool rep) async {
      if (rep) await box.clear();
      for (final item in list) {
        final m = Map<dynamic, dynamic>.from(item);
        await box.put(m['id'] as String, m);
        count++;
      }
    }

    await fill(txBox, (data['transactions'] as List?) ?? [], replace);
    await fill(catBox, (data['categories'] as List?) ?? [], replace);
    await fill(personBox, (data['people'] as List?) ?? [], replace);
    await fill(accBox, (data['accounts'] as List?) ?? [], replace);

    // عکس‌ها را بازگردانی کن و مسیرها را اصلاح کن
    final photoFiles = <String, String>{};
    for (final p in (data['photos'] as List?) ?? []) {
      final pm = Map<String, dynamic>.from(p);
      final path = pm['path'] as String? ?? '';
      final b64 = pm['b64'] as String?;
      if (path.isEmpty || b64 == null) continue;
      final f = File('${dataDir.path}/$path');
      try {
        await f.writeAsBytes(base64Decode(b64));
        photoFiles[path] = path;
      } catch (_) {}
    }

    final debtsRaw = ((data['debts'] as List?) ?? []).map((e) {
      final m = Map<dynamic, dynamic>.from(e);
      final photos = ((m['photos'] as List?) ?? []).map((pp) {
        final p = PhotoRef.fromMap(Map<dynamic, dynamic>.from(pp));
        if (p.kind == AttachKind.embedded && (p.base64 != null)) {
          // عکسِ embed شده (از وب) را به فایل تبدیل کن
          final id = genId();
          final ext = p.name.contains('.')
              ? p.name.substring(p.name.lastIndexOf('.'))
              : '.jpg';
          final newPath = '$id$ext';
          try {
            File('${dataDir.path}/$newPath')
                .writeAsBytesSync(base64Decode(p.base64!));
            p.kind = AttachKind.file;
            p.path = newPath;
            p.base64 = null;
          } catch (_) {}
        } else if (p.path.isNotEmpty && !photoFiles.containsKey(p.path)) {
          // فایل موجود نبود — نشانگر نبودن عکس
        }
        return p;
      }).toList();
      m['photos'] = photos.map((p) => p.toMap()).toList();
      return m;
    }).toList();
    await fill(debtBox, debtsRaw, replace);

    final s = data['settings'];
    if (s is Map) {
      final cur = settings();
      final imported = AppSettings.fromMap(Map<dynamic, dynamic>.from(s));
      imported.processedSms = cur.processedSms; // سابقه پیامک‌ها حفظ شود
      await saveSettings(imported);
    }
    return count;
  }
}
