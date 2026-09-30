[app]
title = DHK CashBook Pro
package.name = dhkcashbookpro
package.domain = org.dhk.cashbook
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,ttf,json,db
version = 1.0.0

# Pin python3 and hostpython3 to stable 3.10.11 to prevent Python 3.14 cgi deprecation
requirements = python3==3.10.11,hostpython3==3.10.11,kivy==2.2.0,pillow,requests,urllib3,certifi,https://files.pythonhosted.org/packages/py3/r/reportlab/reportlab-3.6.13-py3-none-any.whl

orientation = portrait
fullscreen = 0

android.archs = arm64-v8a
android.build_tools_version = 33.0.2
android.api = 33
android.minapi = 21
android.ndk = 25b
android.allow_backup = True

android.permissions = INTERNET,ACCESS_NETWORK_STATE,WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE

[buildozer]
log_level = 2
warn_on_root = 1
