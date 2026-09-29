[app]
title = DHK CashBook Pro
package.name = dhkcashbookpro
package.domain = org.dhk.cashbook
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,ttf,json,db
version = 1.0.0

requirements = python3,kivy==2.2.0,reportlab,requests,urllib3,certifi

orientation = portrait
fullscreen = 0

android.archs = arm64-v8a, armeabi-v7a
android.build_tools_version = 33.0.2

android.minapi = 21
android.ndk = 25b
android.allow_backup = True

android.permissions = INTERNET,ACCESS_NETWORK_STATE,WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE

[buildozer]
log_level = 2
warn_on_root = 1

