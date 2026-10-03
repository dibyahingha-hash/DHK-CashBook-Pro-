[app]
title = DHK CashBook Pro
package.name = dhkcashbookpro
package.domain = org.dhk.cashbook
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,ttf,json,db
source.exclude_dirs = tests, bin, .git, .github
version = 1.0.0

requirements = python3==3.10.11,hostpython3==3.10.11,kivy==2.2.0,pillow,sqlite3,pyjnius,reportlab


orientation = portrait
fullscreen = 0

android.archs = arm64-v8a
android.build_tools_version = 33.0.2
android.api = 33
android.minapi = 21
android.ndk = 25b
android.allow_backup = True

android.permissions = INTERNET,ACCESS_NETWORK_STATE,READ_EXTERNAL_STORAGE,WRITE_EXTERNAL_STORAGE
android.accept_sdk_license = True
entrypoint = main.py

[buildozer]
log_level = 2
warn_on_root = 1
