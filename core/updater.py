import os
import requests
from typing import Optional, Tuple

CURRENT_VERSION = "1.0.0"
VERSION_CHECK_URL = "https://raw.githubusercontent.com/dibyahingha-hash/dhk-cashbook-pro/main/version.json"


class AppUpdater:
    @staticmethod
    def check_for_updates() -> Tuple[bool, Optional[str], Optional[str]]:
        try:
            resp = requests.get(VERSION_CHECK_URL, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                remote_version = data.get("version", CURRENT_VERSION)
                download_url = data.get("apk_url")
                if remote_version > CURRENT_VERSION:
                    return True, remote_version, download_url
        except Exception:
            pass
        return False, None, None

    @staticmethod
    def trigger_android_install(apk_path: str):
        try:
            from jnius import autoclass
            PythonActivity = autoclass('org.kivy.android.PythonActivity')
            Intent = autoclass('android.content.Intent')
            Uri = autoclass('android.net.Uri')
            File = autoclass('java.io.File')

            current_activity = PythonActivity.mActivity
            file_obj = File(apk_path)

            intent = Intent(Intent.ACTION_VIEW)
            intent.setDataAndType(Uri.fromFile(file_obj), "application/vnd.android.package-archive")
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION)
            current_activity.startActivity(intent)
        except Exception as e:
            print(f"Update installer error: {e}")
          
