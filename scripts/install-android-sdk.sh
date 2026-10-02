#!/bin/bash
# نصب Android SDK (commandline tools + platform 35 + build-tools)
set -e
SDK=/home/z/my-project/.android-sdk
mkdir -p $SDK/cmdline-tools
cd /tmp
echo "downloading cmdline-tools..."
curl -sSLo cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -oq cmdtools.zip -d $SDK/cmdline-tools
mv $SDK/cmdline-tools/cmdline-tools $SDK/cmdline-tools/latest
export ANDROID_HOME=$SDK
export PATH=$SDK/cmdline-tools/latest/bin:$PATH
echo "accepting licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true
echo "installing platform + build-tools..."
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" > /dev/null 2>&1
echo "SDK-INSTALL-DONE"
ls $SDK
