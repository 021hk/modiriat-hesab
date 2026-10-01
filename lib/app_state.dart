import 'package:flutter/foundation.dart' hide Category;
import 'package:flutter/material.dart';

import 'models.dart';
import 'store.dart';
import 'utils.dart';

class AppState extends ChangeNotifier {
  final Store store = Store();

  List<Tx> _tx = [];
  List<Category> _cats = [];
  List<Person> _people = [];
  List<Debt> _debts = [];
  List<BankAccount> _accounts = [];
  AppSettings _settings = AppSettings();

  List<Tx> get tx => _tx;
  List<Category> get cats => _cats;
  List<Person> get people => _people;
  List<Debt> get debts => _debts;
  List<BankAccount> get accounts => _accounts;
  AppSettings get settings => _settings;

  bool get faDigits => _settings.persianDigits;

  Future<void> init() async {
    await store.open();
    await seedDefaults();
    reload();
  }

  Future<void> reload() async {
    _tx = store.allTx()..sort((a, b) => b.ts.compareTo(a.ts));
    _cats = store.allCategories()..sort((a, b) => a.order.compareTo(b.order));
    _people = store.allPeople()..sort((a, b) => a.name.compareTo(b.name));
    _debts = store.allDebts()..sort((a, b) => b.ts.compareTo(a.ts));
    _accounts = store.allAccounts()..sort((a, b) => a.name.compareTo(b.name));
    _settings = store.settings();
    notifyListeners();
  }

  Future<void> seedDefaults() async {
    if (store.catBox.isEmpty) {
      final expenseSeeds = [
        ('خوراک', 0, 0), ('حمل‌ونقل', 1, 1), ('خرید', 2, 2),
        ('قبض‌ها', 3, 3), ('سلامت', 4, 4), ('تفریح', 5, 5),
        ('اجاره', 6, 6), ('متفرقه', 7, 7),
      ];
      final incomeSeeds = [
        ('حقوق', 8, 8), ('فروش', 9, 9), ('هدیه', 10, 10), ('سایر درآمد', 7, 11),
      ];
      var i = 0;
      for (final s in expenseSeeds) {
        await store.putCategory(Category(
            id: genId(), name: s.$1, iconIdx: s.$2, colorIdx: s.$3, kind: 'expense', order: i++));
      }
      for (final s in incomeSeeds) {
        await store.putCategory(Category(
            id: genId(), name: s.$1, iconIdx: s.$2, colorIdx: s.$3, kind: 'income', order: i++));
      }
    }
  }

  // ---------- دسته‌بندی ----------
  Future<void> saveCategory(Category c) async {
    await store.putCategory(c);
    await reload();
  }

  Future<void> deleteCategory(String id) async {
    await store.deleteCategory(id);
    await reload();
  }

  Category? categoryOf(String id) {
    for (final c in _cats) {
      if (c.id == id) return c;
    }
    return null;
  }

  // ---------- تراکنش ----------
  Future<void> saveTx(Tx t) async {
    await store.putTx(t);
    await reload();
  }

  Future<void> deleteTx(String id) async {
    await store.deleteTx(id);
    await reload();
  }

  // ---------- اشخاص و بدهی‌ها ----------
  Future<void> savePerson(Person p) async {
    await store.putPerson(p);
    await reload();
  }

  Future<void> deletePerson(String id) async {
    for (final d in _debts.where((d) => d.personId == id)) {
      await store.deleteDebt(d.id);
    }
    await store.deletePerson(id);
    await reload();
  }

  Future<void> saveDebt(Debt d) async {
    await store.putDebt(d);
    await reload();
  }

  Future<void> deleteDebt(String id) async {
    await store.deleteDebt(id);
    await reload();
  }

  Future<PhotoRef> addReceiptPhoto(String sourcePath, String name) =>
      store.saveReceiptPhoto(sourcePath, name);

  Person? personOf(String id) {
    for (final p in _people) {
      if (p.id == id) return p;
    }
    return null;
  }

  List<Debt> debtsOf(String personId) =>
      _debts.where((d) => d.personId == personId).toList();

  /// مثبت = به من بدهکارند | منفی = من بدهکارم
  double personBalance(String personId) {
    var sum = 0.0;
    for (final d in debtsOf(personId)) {
      final out = d.outstanding;
      sum += d.dir == DebtDir.theyOwe ? out : -out;
    }
    return sum;
  }

  // ---------- حساب بانکی ----------
  Future<void> saveAccount(BankAccount a) async {
    await store.putAccount(a);
    await reload();
  }

  Future<void> deleteAccount(String id) async {
    await store.deleteAccount(id);
    await reload();
  }

  double accountBalance(String accountId) {
    var sum = 0.0;
    for (final a in _accounts) {
      if (a.id == accountId) sum = a.initialBalance;
    }
    for (final t in _tx) {
      if (t.accountId != accountId) continue;
      sum += t.type == TxType.income ? t.amount : -t.amount;
    }
    return sum;
  }

  double get totalBalance {
    var sum = 0.0;
    for (final a in _accounts) {
      sum += accountBalance(a.id);
    }
    return sum;
  }

  double get totalTheyOweMe {
    var sum = 0.0;
    for (final p in _people) {
      final b = personBalance(p.id);
      if (b > 0) sum += b;
    }
    return sum;
  }

  double get totalIOwe {
    var sum = 0.0;
    for (final p in _people) {
      final b = personBalance(p.id);
      if (b < 0) sum += -b;
    }
    return sum;
  }

  double get monthExpense {
    final now = DateTime.now();
    var sum = 0.0;
    for (final t in _tx) {
      final d = DateTime.fromMillisecondsSinceEpoch(t.ts);
      if (t.type == TxType.expense && d.year == now.year && d.month == now.month) {
        sum += t.amount;
      }
    }
    return sum;
  }

  Map<Category, double> expenseByCategory() {
    final map = <Category, double>{};
    for (final t in _tx) {
      if (t.type != TxType.expense) continue;
      final c = categoryOf(t.categoryId);
      if (c != null) map[c] = (map[c] ?? 0) + t.amount;
    }
    return map;
  }

  String money(num v, {bool withCurrency = false}) {
    final s = fmtMoney(v, fa: _settings.persianDigits);
    return withCurrency ? '$s ${_settings.currency}' : s;
  }

  // ---------- پیامک بانکی ----------
  String _smsKey(String sender, String body, int ts) =>
      '$sender|$ts|${body.length}';

  /// پیامک را تحلیل و در صورت تطابق با یک حساب، تراکنش ثبت می‌کند.
  /// خروجی: پیام وضعیت برای نمایش به کاربر (null = مرتبط با هیچ حسابی نبود)
  Future<String?> processSms(String sender, String body, int ts) async {
    if (!_settings.autoSms) return null;
    final key = _smsKey(sender, body, ts);
    if (_settings.processedSms.contains(key)) return null;

    BankAccount? target;
    for (final a in _accounts) {
      for (final s in a.senders) {
        final sn = s.trim();
        if (sn.isEmpty) continue;
        if (sender.trim().contains(sn) || body.contains(sn)) {
          target = a;
          break;
        }
      }
      if (target != null) break;
    }
    if (target == null) return null;

    final parsed = SmsParser.parse(body);
    if (parsed == null) {
      _rememberSms(key);
      return 'پیامک از ${target.name} شناسایی شد اما مبلغ تشخیص داده نشد.';
    }

    final cat = _findOrCreateSmsCategory(parsed.deposit);
    final tx = Tx(
      id: genId(),
      type: parsed.deposit ? TxType.income : TxType.expense,
      amount: parsed.amount,
      categoryId: cat.id,
      accountId: target.id,
      ts: ts == 0 ? DateTime.now().millisecondsSinceEpoch : ts,
      note: 'پیامک بانک — ${_shortBody(body)}',
      source: TxSource.sms,
      smsSender: sender,
    );
    await store.putTx(tx);
    _rememberSms(key);
    await reload();
    final kind = parsed.deposit ? 'واریز' : 'برداشت';
    return '$kind ${money(parsed.amount, withCurrency: true)} در «${target.name}» ثبت شد.';
  }

  /// ثبت دستی تراکنش از متن پیامک (برای وب/دسکتاپ یا اطمینان کاربر)
  Future<String> processSmsManually(
    BankAccount account, {
    required bool deposit,
    required double amount,
    required String body,
  }) async {
    final cat = _findOrCreateSmsCategory(deposit);
    await store.putTx(Tx(
      id: genId(),
      type: deposit ? TxType.income : TxType.expense,
      amount: amount,
      categoryId: cat.id,
      accountId: account.id,
      ts: DateTime.now().millisecondsSinceEpoch,
      note: 'پیامک بانک — ${_shortBody(body)}',
      source: TxSource.sms,
      smsSender: account.name,
    ));
    await reload();
    final kind = deposit ? 'واریز' : 'برداشت';
    return '$kind ${money(amount, withCurrency: true)} در «${account.name}» ثبت شد.';
  }

  String _shortBody(String body) {
    final b = body.replaceAll('\n', ' ').trim();
    return b.length > 80 ? '${b.substring(0, 80)}…' : b;
  }

  void _rememberSms(String key) {
    _settings.processedSms.add(key);
    if (_settings.processedSms.length > 300) {
      _settings.processedSms.removeRange(0, _settings.processedSms.length - 300);
    }
    store.saveSettings(_settings);
  }

  Category _findOrCreateSmsCategory(bool deposit) {
    final name = deposit ? 'سایر درآمد' : 'متفرقه';
    final kind = deposit ? 'income' : 'expense';
    for (final c in _cats) {
      if (c.name == name && c.kind == kind) return c;
    }
    final c = Category(id: genId(), name: name, kind: kind, iconIdx: 7, order: 99);
    store.putCategory(c);
    return c;
  }

  // ---------- تنظیمات ----------
  Future<void> updateSettings({
    String? currency,
    bool? autoSms,
    bool? persianDigits,
    String? themeMode,
  }) async {
    _settings = AppSettings(
      currency: currency ?? _settings.currency,
      autoSms: autoSms ?? _settings.autoSms,
      persianDigits: persianDigits ?? _settings.persianDigits,
      themeMode: themeMode ?? _settings.themeMode,
      processedSms: _settings.processedSms,
    );
    await store.saveSettings(_settings);
    notifyListeners();
  }

  ThemeMode get themeMode {
    switch (_settings.themeMode) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  // ---------- پشتیبان‌گیری ----------
  Future<String> exportBackup({bool includePhotos = true}) =>
      store.exportBackup(includePhotos: includePhotos);

  Future<int> importBackup(String raw, {bool replace = true}) async {
    final n = await store.importBackup(raw, replace: replace);
    await reload();
    return n;
  }
}
