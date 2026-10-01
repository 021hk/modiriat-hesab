import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'app_state.dart';
import 'pages/accounts_page.dart';
import 'pages/home_page.dart';
import 'pages/more_page.dart';
import 'pages/people_page.dart';
import 'pages/transactions_page.dart';
import 'sms_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final state = AppState();
  await state.init();
  runApp(ModiriatApp(state: state));
}

class ModiriatApp extends StatelessWidget {
  const ModiriatApp({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: state,
      child: Consumer<AppState>(
        builder: (context, s, _) => MaterialApp(
          title: 'مدیریت حساب',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF00695C)),
            useMaterial3: true,
            fontFamily: 'Vazirmatn',
          ),
          darkTheme: ThemeData(
            colorScheme: ColorScheme.fromSeed(
                seedColor: const Color(0xFF00695C), brightness: Brightness.dark),
            useMaterial3: true,
            fontFamily: 'Vazirmatn',
          ),
          themeMode: s.themeMode,
          locale: const Locale('fa'),
          supportedLocales: const [Locale('fa'), Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: const RootShell(),
        ),
      ),
    );
  }
}

class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _setupSms();
  }

  Future<void> _setupSms() async {
    if (!SmsService.isAndroid) return;
    final state = context.read<AppState>();
    if (await SmsService.hasPermission()) {
      SmsService.listen((sender, body, ts) async {
        final msg = await state.processSms(sender, body, ts);
        if (msg != null && mounted) {
          _showSmsToast(msg);
        }
      });
      // پیامک‌هایی که وقتی اپ بسته بود آمده‌اند
      for (final m in await SmsService.drainQueue()) {
        final msg = await state.processSms(
          (m['sender'] as String?) ?? '',
          (m['body'] as String?) ?? '',
          (m['ts'] as num?)?.toInt() ?? 0,
        );
        if (msg != null && mounted) _showSmsToast(msg);
      }
    }
  }

  void _showSmsToast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        duration: const Duration(seconds: 4),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _tab,
        children: const [
          HomePage(),
          TransactionsPage(),
          PeoplePage(),
          AccountsPage(),
          MorePage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'خانه'),
          NavigationDestination(icon: Icon(Icons.swap_horiz_outlined), selectedIcon: Icon(Icons.swap_horiz), label: 'تراکنش‌ها'),
          NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'اشخاص'),
          NavigationDestination(icon: Icon(Icons.account_balance_outlined), selectedIcon: Icon(Icons.account_balance), label: 'حساب‌ها'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'بیشتر'),
        ],
      ),
    );
  }
}
