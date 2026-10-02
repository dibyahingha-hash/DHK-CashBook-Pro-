[app]

# (str) Title of your application
title = DHK CashBook Pro

# (str) Package name
package.name = dhkcashbookpro

# (str) Package domain (needed for android/ios packaging)
package.domain = org.dhk.cashbook

# (str) Source code where the main.py lives
source.dir = .

# (list) Source files to include (let empty to include all the files)
source.include_exts = py,png,jpg,kv,atlas,ttf,json,db

# (list) List of inclusions using pattern matching
# source.include_patterns = assets/*,images/*.png

# (list) Source files to exclude (let empty to not exclude anything)
# source.exclude_exts = spec

# (list) List of directory to exclude (let empty to not exclude anything)
source.exclude_dirs = tests, bin, .git, .github

# (list) List of exclusions using pattern matching
# source.exclude_patterns = license,data/audio/*.wav

# (str) Application versioning
version = 1.0.0

# (list) Application requirements
# comma separated e.g. requirements = sqlite3,kivy
requirements = python3==3.10.11,hostpython3==3.10.11,kivy==2.2.0,pillow,sqlite3,pyjnius,reportlab

# (str) Presplash of the application
# presplash.filename = %(source.dir)s/data/presplash.png

# (str) Icon of the application
# icon.filename = %(source.dir)s/data/icon.png

# (str) Supported orientation (one of landscape, sensorLandscape, portrait or all)
orientation = portrait

# (bool) Indicate if the application should be fullscreen
fullscreen = 0


# ===================================================================
# Android specific
# ===================================================================

# (list) Permissions
android.permissions = INTERNET,ACCESS_NETWORK_STATE,READ_EXTERNAL_STORAGE,WRITE_EXTERNAL_STORAGE

# (int) Target Android API, should be as high as possible.
android.api = 33

# (int) Minimum API your APK will support.
android.minapi = 21

# (str) Android NDK version to use
android.ndk = 25b

# (str) Android Build Tools version to use
android.build_tools_version = 33.0.2

# (bool) If True, then skip trying to update the Android sdk
# This can be useful to avoid excess Internet downloads or save time
# when an update is due and you justHere is the complete, self-contained `buildozer.spec` file configured for your project:

```ini
[app]

# Title and package metadata
title = DHK CashBook Pro
package.name = dhkcashbookpro
package.domain = org.dhk.cashbook

# Source inclusions
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,ttf,json,db
source.exclude_dirs = tests, bin, .git, .github

# Version control
version = 1.0.0

# Application dependencies (including PDF engine and database drivers)
requirements = python3==3.10.11,hostpython3==3.10.11,kivy==2.2.0,pillow,sqlite3,pyjnius,reportlab

# Display settings
orientation = portrait
fullscreen = 0

# Android SDK / NDK configurations
android.archs = arm64-v8a
android.build_tools_version = 33.0.2
android.api = 33
android.minapi = 21
android.ndk = 25b
android.allow_backup = True

# Device permissions for internet fallback and PDF storage
android.permissions = INTERNET,ACCESS_NETWORK_STATE,READ_EXTERNAL_STORAGE,WRITE_EXTERNAL_STORAGE

# Automatic accept of SDK licenses
android.accept_sdk_license = True

# Entry point
entrypoint = main.py

[buildozer]

# Build logging verbosity
log_level = 2
warn_on_root = 1
