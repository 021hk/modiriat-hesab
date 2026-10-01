/// مدل‌های داده برنامه «مدیریت حساب»
/// هر مدل با toMap/fromMap به Hive (به‌صورت Map) و پشتیبان‌گیری JSON تبدیل می‌شود.

enum TxType { expense, income }

enum DebtDir { theyOwe, iOwe }

enum TxSource { manual, sms }

enum AttachKind { file, embedded }

class Tx {
  String id;
  TxType type;
  double amount;
  String categoryId; // خالی = بدون دسته
  String accountId; // خالی = نقدی
  int ts; // milliseconds
  String note;
  TxSource source;
  String smsSender;

  Tx({
    required this.id,
    required this.type,
    required this.amount,
    this.categoryId = '',
    this.accountId = '',
    required this.ts,
    this.note = '',
    this.source = TxSource.manual,
    this.smsSender = '',
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'type': type.name,
        'amount': amount,
        'categoryId': categoryId,
        'accountId': accountId,
        'ts': ts,
        'note': note,
        'source': source.name,
        'smsSender': smsSender,
      };

  static Tx fromMap(Map<dynamic, dynamic> m) => Tx(
        id: m['id'] as String,
        type: TxType.values.firstWhere((e) => e.name == m['type'],
            orElse: () => TxType.expense),
        amount: (m['amount'] as num?)?.toDouble() ?? 0,
        categoryId: (m['categoryId'] as String?) ?? '',
        accountId: (m['accountId'] as String?) ?? '',
        ts: (m['ts'] as num?)?.toInt() ?? 0,
        note: (m['note'] as String?) ?? '',
        source: TxSource.values.firstWhere((e) => e.name == m['source'],
            orElse: () => TxSource.manual),
        smsSender: (m['smsSender'] as String?) ?? '',
      );
}

class Category {
  String id;
  String name;
  int colorIdx;
  int iconIdx;
  String kind; // 'expense' | 'income'
  int order;

  Category({
    required this.id,
    required this.name,
    this.colorIdx = 0,
    this.iconIdx = 0,
    this.kind = 'expense',
    this.order = 0,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'colorIdx': colorIdx,
        'iconIdx': iconIdx,
        'kind': kind,
        'order': order,
      };

  static Category fromMap(Map<dynamic, dynamic> m) => Category(
        id: m['id'] as String,
        name: (m['name'] as String?) ?? '',
        colorIdx: (m['colorIdx'] as num?)?.toInt() ?? 0,
        iconIdx: (m['iconIdx'] as num?)?.toInt() ?? 0,
        kind: (m['kind'] as String?) ?? 'expense',
        order: (m['order'] as num?)?.toInt() ?? 0,
      );
}

class Person {
  String id;
  String name;
  String phone;
  String note;

  Person({required this.id, required this.name, this.phone = '', this.note = ''});

  Map<String, dynamic> toMap() =>
      {'id': id, 'name': name, 'phone': phone, 'note': note};

  static Person fromMap(Map<dynamic, dynamic> m) => Person(
        id: m['id'] as String,
        name: (m['name'] as String?) ?? '',
        phone: (m['phone'] as String?) ?? '',
        note: (m['note'] as String?) ?? '',
      );
}

class PhotoRef {
  String id;
  String name;
  String path; // مسیر نسبی داخل پوشه داده برنامه (خالی برای embedded)
  String? base64; // برای embedded (وب) — در پشتیبان‌گیری هم استفاده می‌شود
  AttachKind kind;

  PhotoRef({
    required this.id,
    required this.name,
    this.path = '',
    this.base64,
    this.kind = AttachKind.file,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'path': path,
        'base64': base64,
        'kind': kind.name,
      };

  static PhotoRef fromMap(Map<dynamic, dynamic> m) => PhotoRef(
        id: m['id'] as String,
        name: (m['name'] as String?) ?? '',
        path: (m['path'] as String?) ?? '',
        base64: m['base64'] as String?,
        kind: AttachKind.values.firstWhere((e) => e.name == m['kind'],
            orElse: () => AttachKind.file),
      );
}

class Debt {
  String id;
  String personId;
  DebtDir dir; // theyOwe: او به من بدهکار است | iOwe: من بدهکارم
  double amount;
  double settled; // مبلغ تسویه‌شده
  int ts;
  String note;
  List<PhotoRef> photos;

  Debt({
    required this.id,
    required this.personId,
    required this.dir,
    required this.amount,
    this.settled = 0,
    required this.ts,
    this.note = '',
    List<PhotoRef>? photos,
  }) : photos = photos ?? [];

  double get outstanding {
    final r = amount - settled;
    return r < 0 ? 0 : r;
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'personId': personId,
        'dir': dir.name,
        'amount': amount,
        'settled': settled,
        'ts': ts,
        'note': note,
        'photos': photos.map((p) => p.toMap()).toList(),
      };

  static Debt fromMap(Map<dynamic, dynamic> m) => Debt(
        id: m['id'] as String,
        personId: (m['personId'] as String?) ?? '',
        dir: DebtDir.values.firstWhere((e) => e.name == m['dir'],
            orElse: () => DebtDir.theyOwe),
        amount: (m['amount'] as num?)?.toDouble() ?? 0,
        settled: (m['settled'] as num?)?.toDouble() ?? 0,
        ts: (m['ts'] as num?)?.toInt() ?? 0,
        note: (m['note'] as String?) ?? '',
        photos: ((m['photos'] as List?) ?? [])
            .map((p) => PhotoRef.fromMap(Map<dynamic, dynamic>.from(p)))
            .toList(),
      );
}

class BankAccount {
  String id;
  String name; // نام حساب، مثل «ملی — جاری»
  String bank; // نام بانک
  List<String> senders; // شماره فرستنده پیامک‌ها
  double initialBalance;
  String note;
  int colorIdx;
  int ts;

  BankAccount({
    required this.id,
    required this.name,
    this.bank = '',
    List<String>? senders,
    this.initialBalance = 0,
    this.note = '',
    this.colorIdx = 0,
    required this.ts,
  }) : senders = senders ?? [];

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'bank': bank,
        'senders': senders,
        'initialBalance': initialBalance,
        'note': note,
        'colorIdx': colorIdx,
        'ts': ts,
      };

  static BankAccount fromMap(Map<dynamic, dynamic> m) => BankAccount(
        id: m['id'] as String,
        name: (m['name'] as String?) ?? '',
        bank: (m['bank'] as String?) ?? '',
        senders: ((m['senders'] as List?) ?? [])
            .map((e) => e.toString())
            .toList(),
        initialBalance: (m['initialBalance'] as num?)?.toDouble() ?? 0,
        note: (m['note'] as String?) ?? '',
        colorIdx: (m['colorIdx'] as num?)?.toInt() ?? 0,
        ts: (m['ts'] as num?)?.toInt() ?? 0,
      );
}

class AppSettings {
  String currency;
  bool autoSms;
  bool persianDigits;
  String themeMode; // 'system' | 'light' | 'dark'
  List<String> processedSms; // کلیدهای پیامک‌های پردازش‌شده برای جلوگیری از ثبت تکراری

  AppSettings({
    this.currency = 'تومان',
    this.autoSms = true,
    this.persianDigits = true,
    this.themeMode = 'system',
    List<String>? processedSms,
  }) : processedSms = processedSms ?? [];

  Map<String, dynamic> toMap() => {
        'currency': currency,
        'autoSms': autoSms,
        'persianDigits': persianDigits,
        'themeMode': themeMode,
        'processedSms': processedSms,
      };

  static AppSettings fromMap(Map<dynamic, dynamic> m) => AppSettings(
        currency: (m['currency'] as String?) ?? 'تومان',
        autoSms: (m['autoSms'] as bool?) ?? true,
        persianDigits: (m['persianDigits'] as bool?) ?? true,
        themeMode: (m['themeMode'] as String?) ?? 'system',
        processedSms: ((m['processedSms'] as List?) ?? [])
            .map((e) => e.toString())
            .toList(),
      );
}
