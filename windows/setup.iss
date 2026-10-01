; فایل نصب ویندوز «مدیریت حساب» — Inno Setup
[Setup]
AppId={{8F3E1A2B-4C5D-4E6F-9A0B-1C2D3E4F5A6B}
AppName=مدیریت حساب
AppVersion=1.0.0
AppPublisher=Modiriat Hesab
DefaultDirName={autopf}\ModiriatHesab
DefaultGroupName=مدیریت حساب
OutputBaseFilename=Modiriat-Hesab-Windows-Setup
OutputDir=..
Compression=lzma2/max
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
UninstallDisplayIcon={app}\modiriat_hesab.exe
SetupIconFile=runner\resources\app_icon.ico
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create desktop shortcut"; GroupDescription: "Shortcuts:"

[Files]
Source: "..\build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\مدیریت حساب"; Filename: "{app}\modiriat_hesab.exe"
Name: "{group}\Uninstall Modiriat Hesab"; Filename: "{uninstallexe}"
Name: "{autodesktop}\مدیریت حساب"; Filename: "{app}\modiriat_hesab.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\modiriat_hesab.exe"; Description: "Run Modiriat Hesab"; Flags: nowait postinstall skipifsilent
