from __future__ import annotations

import importlib
import json
import logging
import os
import socket
import sys
import tempfile
import threading
import time
import webbrowser
from pathlib import Path

APP_NAME = "StaffDeck"
APP_ID = "ai.staffdeck.desktop"
APP_VERSION = "0.1.0"
DEFAULT_PORT_RANGE_START = 5173
DEFAULT_PORT_RANGE_END = 5199
_MACOS_DELEGATE_REF = None
_MACOS_INSTANCE_LOCK_HANDLE = None
STAFFDECK_ICON_PNG = ("packaging", "assets", "staffdeck.png")


def build_server_config() -> dict:
    host = os.environ.get("ULTRARAG_HOST", "127.0.0.1")
    return {
        "app": "single_port_app:app",
        "host": host,
        "port": find_available_port(host),
    }


def _redirect_logs_when_frozen() -> None:
    if not getattr(sys, "frozen", False):
        return
    try:
        from app.runtime_logging import configure_runtime_logging

        configure_runtime_logging()
    except Exception:
        pass


def apply_runtime_env(cfg: dict | None = None) -> None:
    # 時序契約：必須在任何 app.config 被 import 之前調用；僅 frozen 態斷言，
    # 開發/測試進程通常已 import 過 app.config，無條件斷言會誤炸。
    if getattr(sys, "frozen", False):
        assert "app.config" not in sys.modules, "apply_runtime_env 必須在 import app.* 之前調用"

    cfg = cfg or build_server_config()
    origin = f"http://{cfg['host']}:{cfg['port']}"
    os.environ.setdefault("TOOL_BASE_URL", origin)
    existing_cors = os.environ.get("CORS_ORIGINS", "")
    if origin not in existing_cors:
        os.environ["CORS_ORIGINS"] = ",".join(filter(None, [existing_cors, origin]))

    # frozen 態把 .env 指向用戶數據目錄（不存在則 pydantic 不加載），避免誤加載啟動 cwd 的陌生 .env
    if getattr(sys, "frozen", False):
        from app import paths
        os.environ.setdefault("ULTRARAG_DOTENV", str(paths.user_data_dir() / ".env"))


def port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} 必須是整數，當前值：{raw!r}") from exc


def _port_candidates() -> list[int]:
    start = _env_int("ULTRARAG_PORT_RANGE_START", DEFAULT_PORT_RANGE_START)
    end = _env_int("ULTRARAG_PORT_RANGE_END", DEFAULT_PORT_RANGE_END)
    if start > end:
        start, end = end, start

    candidates = list(range(start, end + 1))
    explicit = os.environ.get("ULTRARAG_PORT")
    if explicit:
        port = _env_int("ULTRARAG_PORT", DEFAULT_PORT_RANGE_START)
        candidates = [port] + [candidate for candidate in candidates if candidate != port]
    return candidates


def find_available_port(host: str) -> int:
    for port in _port_candidates():
        if not port_in_use(host, port):
            return port
    first, last = _port_candidates()[0], _port_candidates()[-1]
    raise RuntimeError(f"{APP_NAME} 可用端口耗盡：{first}-{last} 都已被佔用")


def _resource_path(*parts: str) -> str | None:
    candidates: list[Path] = []
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(Path(meipass, *parts))

    if getattr(sys, "frozen", False):
        executable = Path(sys.executable).resolve()
        candidates.append(executable.parent.joinpath(*parts))
        if sys.platform == "darwin" and len(executable.parents) >= 2:
            candidates.append(executable.parents[1] / "Resources" / Path(*parts))

    candidates.append(Path(__file__).resolve().parent.parent.joinpath(*parts))
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


def _staffdeck_icon_png_path() -> str | None:
    return _resource_path(*STAFFDECK_ICON_PNG)


def _health_ok(url: str) -> bool:
    import urllib.request

    try:
        with urllib.request.urlopen(url + "/api/health", timeout=1) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload.get("status") == "ok" and payload.get("app") == APP_NAME
    except Exception:
        return False


def _find_existing_app_url(host: str) -> str | None:
    for port in _port_candidates():
        if not port_in_use(host, port):
            continue
        url = f"http://{host}:{port}"
        if _health_ok(url):
            return url
    return None


def _wait_for_existing_app_url(host: str, attempts: int = 20, delay: float = 0.3) -> str | None:
    for _ in range(attempts):
        url = _find_existing_app_url(host)
        if url:
            return url
        time.sleep(delay)
    return None


def _acquire_macos_instance_lock() -> bool:
    if not _use_macos_dock_app():
        return True

    try:
        import fcntl
    except Exception:
        return True

    global _MACOS_INSTANCE_LOCK_HANDLE
    lock_path = Path(tempfile.gettempdir()) / f"{APP_ID}.lock"
    lock_file = open(lock_path, "w", encoding="utf-8")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        return False
    lock_file.seek(0)
    lock_file.write(str(os.getpid()))
    lock_file.truncate()
    lock_file.flush()
    _MACOS_INSTANCE_LOCK_HANDLE = lock_file
    return True


def _open_browser_when_ready(url: str) -> None:
    for _ in range(120):
        if _health_ok(url):
            _open_browser(url + "/chat/")
            return
        time.sleep(0.5)


def _open_browser(target: str) -> None:
    """打開瀏覽器頁面。點 Dock 圖標每次都開一個新標籤——最穩定、跨瀏覽器一致、
    不依賴 macOS 自動化授權（adhoc 簽名下自動化授權彈窗不可靠）。"""
    webbrowser.open(target)


def _four_char_code(value: str) -> int:
    result = 0
    for byte in value.encode("macroman"):
        result = (result << 8) | byte
    return result


def _use_macos_dock_app() -> bool:
    # 僅 macOS 打包態用 Cocoa 殼（進 Dock + 點圖標開頁面）。
    # 開發態 / 其它平臺保持簡單主線程 uvicorn。
    return sys.platform == "darwin" and getattr(sys, "frozen", False)


def _use_windows_taskbar_app() -> bool:
    if _env_flag("STAFFDECK_HEADLESS"):
        return False
    return sys.platform == "win32" and getattr(sys, "frozen", False)


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _is_windows_restore_command(message: int, wparam: int) -> bool:
    wm_syscommand = 0x0112
    sc_restore = 0xF120
    return message == wm_syscommand and (wparam & 0xFFF0) == sc_restore


def _serve(cfg: dict) -> None:
    import uvicorn

    if getattr(sys, "frozen", False):
        logging.getLogger("staffdeck.runtime").info(
            "Server starting host=%s port=%s",
            cfg["host"],
            cfg["port"],
        )
        uvicorn.run(
            cfg["app"],
            host=cfg["host"],
            port=cfg["port"],
            log_level="info",
            log_config=None,
            access_log=False,
        )
        return
    uvicorn.run(cfg["app"], host=cfg["host"], port=cfg["port"], log_level="info")


def preload_server_app(cfg: dict) -> None:
    app_ref = cfg.get("app")
    if not isinstance(app_ref, str):
        return
    module_name, separator, attribute_name = app_ref.partition(":")
    if not separator or not module_name or not attribute_name:
        raise RuntimeError(f"Invalid ASGI application reference: {app_ref!r}")
    module = importlib.import_module(module_name)
    cfg["app"] = getattr(module, attribute_name)


def _run_macos_dock_app(cfg: dict, url: str) -> int:
    """macOS：NSApplication 主循環。進 Dock/菜單欄，點入口重新打開瀏覽器。"""
    import AppKit
    from PyObjCTools import AppHelper

    global _MACOS_DELEGATE_REF

    def load_app_icon(point_size: float | None = None):
        icon_path = _staffdeck_icon_png_path()
        if not icon_path:
            return None
        image = AppKit.NSImage.alloc().initWithContentsOfFile_(icon_path)
        if image is not None and point_size is not None:
            image.setSize_((point_size, point_size))
        return image

    class AppDelegate(AppKit.NSObject):
        def applicationDidFinishLaunching_(self, _notification):  # noqa: N802
            self.dock_visible = True
            self.server_started = False
            self._install_url_scheme_handler()
            self._install_status_menu()
            self._start_server()
            print(f"{APP_NAME} 啟動中，就緒後將打開：{url}/chat/")

        def handleGetURLEvent_withReplyEvent_(self, event, _reply_event):  # noqa: N802
            direct_object = event.descriptorForKeyword_(_four_char_code("----"))
            deep_link = direct_object.stringValue() if direct_object is not None else ""
            print(f"收到 {APP_NAME} URL Scheme 喚起：{deep_link or '<empty>'}")
            threading.Thread(target=_open_browser_when_ready, args=(url,), daemon=True).start()

        def applicationShouldHandleReopen_hasVisibleWindows_(self, _app, _flag):  # noqa: N802
            # 點 Dock 圖標（app 已在運行）→ 打開瀏覽器頁面（新標籤）
            _open_browser(url + "/chat/")
            return True

        def applicationShouldTerminate_(self, _app):  # noqa: N802
            return AppKit.NSTerminateNow

        def applicationDockMenu_(self, _sender):  # noqa: N802
            # 右鍵 Dock 圖標時展示同一套控制入口。
            self.dock_context_menu, self.dock_context_dock_item = self._build_control_menu()
            return self.dock_context_menu

        def openStaffDeck_(self, _sender):  # noqa: N802
            _open_browser(url + "/chat/")

        def restartStaffDeck_(self, _sender):  # noqa: N802
            os.execv(sys.executable, [sys.executable] + sys.argv[1:])

        def toggleDockIcon_(self, _sender):  # noqa: N802
            app = AppKit.NSApplication.sharedApplication()
            if self.dock_visible:
                app.setActivationPolicy_(AppKit.NSApplicationActivationPolicyAccessory)
                self.dock_visible = False
                if hasattr(self, "status_dock_item"):
                    self.status_dock_item.setTitle_("顯示 Dock 圖標")
            else:
                app.setActivationPolicy_(AppKit.NSApplicationActivationPolicyRegular)
                app.activateIgnoringOtherApps_(True)
                self.dock_visible = True
                if hasattr(self, "status_dock_item"):
                    self.status_dock_item.setTitle_("隱藏 Dock 圖標")

        def showAbout_(self, _sender):  # noqa: N802
            alert = AppKit.NSAlert.alloc().init()
            alert.setMessageText_(APP_NAME)
            alert.setInformativeText_(f"版本：{APP_VERSION}\n本地服務：{url}")
            alert.addButtonWithTitle_("好")
            alert.runModal()

        def quitStaffDeck_(self, _sender):  # noqa: N802
            AppKit.NSApplication.sharedApplication().terminate_(self)

        def _start_server(self) -> None:
            if self.server_started:
                return
            self.server_started = True
            # uvicorn 在後臺線程跑（主線程要留給 Cocoa 事件循環）。這裡必須等
            # NSApplication 完成註冊後再啟動，避免 LaunchServices 初始化競態導致 abort。
            threading.Thread(target=_serve, args=(cfg,), daemon=True).start()
            threading.Thread(target=_open_browser_when_ready, args=(url,), daemon=True).start()

        def _install_url_scheme_handler(self) -> None:
            manager = AppKit.NSAppleEventManager.sharedAppleEventManager()
            manager.setEventHandler_andSelector_forEventClass_andEventID_(
                self,
                "handleGetURLEvent:withReplyEvent:",
                _four_char_code("GURL"),
                _four_char_code("GURL"),
            )

        def _menu_item(self, title: str, action: str | None = None, enabled: bool = True):
            item = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(title, None, "")
            item.setEnabled_(enabled)
            if action:
                item.setTarget_(self)
                item.setAction_(action)
            return item

        def _dock_toggle_title(self) -> str:
            return "隱藏 Dock 圖標" if self.dock_visible else "顯示 Dock 圖標"

        def _build_control_menu(self):
            menu = AppKit.NSMenu.alloc().initWithTitle_(APP_NAME)
            menu.addItem_(self._menu_item("狀態：運行中", enabled=False))
            menu.addItem_(self._menu_item(f"版本：{APP_VERSION}", enabled=False))
            menu.addItem_(self._menu_item(f"端口：{cfg['port']}", enabled=False))
            menu.addItem_(AppKit.NSMenuItem.separatorItem())
            menu.addItem_(self._menu_item(f"打開 {APP_NAME}", "openStaffDeck:"))
            menu.addItem_(self._menu_item("重啟服務", "restartStaffDeck:"))
            dock_item = self._menu_item(self._dock_toggle_title(), "toggleDockIcon:")
            menu.addItem_(dock_item)
            menu.addItem_(AppKit.NSMenuItem.separatorItem())
            menu.addItem_(self._menu_item(f"關於 {APP_NAME}", "showAbout:"))
            menu.addItem_(self._menu_item(f"退出 {APP_NAME}", "quitStaffDeck:"))
            return menu, dock_item

        def _install_status_menu(self) -> None:
            self.status_item = AppKit.NSStatusBar.systemStatusBar().statusItemWithLength_(
                AppKit.NSSquareStatusItemLength
            )
            button = self.status_item.button()
            if button is not None:
                status_icon = load_app_icon(18)
                if status_icon is not None:
                    status_icon.setTemplate_(False)
                    button.setImage_(status_icon)
                    button.setImagePosition_(AppKit.NSImageOnly)
                else:
                    button.setTitle_(APP_NAME)
                button.setToolTip_(APP_NAME)

            menu, self.status_dock_item = self._build_control_menu()
            self.status_item.setMenu_(menu)
            self.status_menu = menu

    app = AppKit.NSApplication.sharedApplication()
    # Regular：常規 GUI app，進 Dock、可激活
    app.setActivationPolicy_(AppKit.NSApplicationActivationPolicyRegular)
    dock_icon = load_app_icon()
    if dock_icon is not None:
        app.setApplicationIconImage_(dock_icon)
    delegate = AppDelegate.alloc().init()
    # PyObjC 不總是按 Python 預期保留 delegate，模塊級引用保證菜單和事件代理常駐。
    _MACOS_DELEGATE_REF = delegate
    app.setDelegate_(delegate)
    app.activateIgnoringOtherApps_(True)
    AppHelper.runEventLoop()
    return 0


def _run_windows_taskbar_app(cfg: dict, url: str) -> int:
    """Run the server behind a native window so StaffDeck owns a taskbar icon."""
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    shell32 = ctypes.WinDLL("shell32", use_last_error=True)

    WM_DESTROY = 0x0002
    WM_SETICON = 0x0080
    ICON_SMALL = 0
    ICON_BIG = 1
    WS_OVERLAPPEDWINDOW = 0x00CF0000
    WS_EX_APPWINDOW = 0x00040000
    SW_SHOWMINIMIZED = 2
    SW_SHOWMINNOACTIVE = 7
    CW_USEDEFAULT = -2147483648
    COLOR_WINDOW = 5

    WNDPROC = ctypes.WINFUNCTYPE(
        wintypes.LPARAM,
        wintypes.HWND,
        wintypes.UINT,
        wintypes.WPARAM,
        wintypes.LPARAM,
    )

    class WNDCLASSW(ctypes.Structure):
        _fields_ = [
            ("style", wintypes.UINT),
            ("lpfnWndProc", WNDPROC),
            ("cbClsExtra", ctypes.c_int),
            ("cbWndExtra", ctypes.c_int),
            ("hInstance", wintypes.HINSTANCE),
            ("hIcon", wintypes.HICON),
            ("hCursor", wintypes.HANDLE),
            ("hbrBackground", wintypes.HBRUSH),
            ("lpszMenuName", wintypes.LPCWSTR),
            ("lpszClassName", wintypes.LPCWSTR),
        ]

    kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
    kernel32.GetModuleHandleW.restype = wintypes.HINSTANCE
    shell32.SetCurrentProcessExplicitAppUserModelID.argtypes = [wintypes.LPCWSTR]
    shell32.SetCurrentProcessExplicitAppUserModelID.restype = ctypes.c_long
    shell32.ExtractIconExW.argtypes = [
        wintypes.LPCWSTR,
        ctypes.c_int,
        ctypes.POINTER(wintypes.HICON),
        ctypes.POINTER(wintypes.HICON),
        wintypes.UINT,
    ]
    shell32.ExtractIconExW.restype = wintypes.UINT
    user32.RegisterClassW.argtypes = [ctypes.POINTER(WNDCLASSW)]
    user32.RegisterClassW.restype = wintypes.ATOM
    user32.CreateWindowExW.argtypes = [
        wintypes.DWORD,
        wintypes.LPCWSTR,
        wintypes.LPCWSTR,
        wintypes.DWORD,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_int,
        wintypes.HWND,
        wintypes.HMENU,
        wintypes.HINSTANCE,
        wintypes.LPVOID,
    ]
    user32.CreateWindowExW.restype = wintypes.HWND
    user32.DefWindowProcW.argtypes = [
        wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM,
    ]
    user32.DefWindowProcW.restype = wintypes.LPARAM
    user32.SendMessageW.argtypes = [
        wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM,
    ]
    user32.SendMessageW.restype = wintypes.LPARAM
    user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.ShowWindow.restype = wintypes.BOOL
    user32.UpdateWindow.argtypes = [wintypes.HWND]
    user32.UpdateWindow.restype = wintypes.BOOL
    user32.DestroyWindow.argtypes = [wintypes.HWND]
    user32.DestroyWindow.restype = wintypes.BOOL
    user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
    user32.GetMessageW.restype = wintypes.BOOL

    shell32.SetCurrentProcessExplicitAppUserModelID(APP_ID)
    large_icon = wintypes.HICON()
    small_icon = wintypes.HICON()
    shell32.ExtractIconExW(sys.executable, 0, ctypes.byref(large_icon), ctypes.byref(small_icon), 1)

    @WNDPROC
    def window_proc(hwnd, message, wparam, lparam):
        if _is_windows_restore_command(message, wparam):
            print(f"Taskbar activated; opening {APP_NAME} in the system default browser.")
            _open_browser(url + "/chat/")
            user32.ShowWindow(hwnd, SW_SHOWMINNOACTIVE)
            return 0
        if message == WM_DESTROY:
            user32.PostQuitMessage(0)
            return 0
        return user32.DefWindowProcW(hwnd, message, wparam, lparam)

    instance = kernel32.GetModuleHandleW(None)
    class_name = "StaffDeckDesktopWindow"
    window_class = WNDCLASSW()
    window_class.lpfnWndProc = window_proc
    window_class.hInstance = instance
    window_class.hIcon = large_icon
    window_class.hCursor = user32.LoadCursorW(None, 32512)
    window_class.hbrBackground = COLOR_WINDOW + 1
    window_class.lpszClassName = class_name
    if not user32.RegisterClassW(ctypes.byref(window_class)):
        error = ctypes.get_last_error()
        if error != 1410:  # ERROR_CLASS_ALREADY_EXISTS
            raise ctypes.WinError(error)

    hwnd = user32.CreateWindowExW(
        WS_EX_APPWINDOW,
        class_name,
        APP_NAME,
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        430,
        190,
        None,
        None,
        instance,
        None,
    )
    if not hwnd:
        raise ctypes.WinError(ctypes.get_last_error())

    if large_icon:
        user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, ctypes.cast(large_icon, ctypes.c_void_p).value)
    if small_icon:
        user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, ctypes.cast(small_icon, ctypes.c_void_p).value)

    print(
        f"Windows shell ready: hwnd={hwnd}, "
        f"large_icon={ctypes.cast(large_icon, ctypes.c_void_p).value or 0}, "
        f"small_icon={ctypes.cast(small_icon, ctypes.c_void_p).value or 0}"
    )

    threading.Thread(target=_serve, args=(cfg,), daemon=True).start()
    threading.Thread(target=_open_browser_when_ready, args=(url,), daemon=True).start()
    user32.ShowWindow(hwnd, SW_SHOWMINIMIZED)
    user32.UpdateWindow(hwnd)

    message = wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(message), None, 0, 0) > 0:
        user32.TranslateMessage(ctypes.byref(message))
        user32.DispatchMessageW(ctypes.byref(message))

    if large_icon:
        user32.DestroyIcon(large_icon)
    if small_icon:
        user32.DestroyIcon(small_icon)
    return 0


def main(argv: list[str] | None = None) -> int:
    _redirect_logs_when_frozen()

    host = os.environ.get("ULTRARAG_HOST", "127.0.0.1")
    existing_url = _find_existing_app_url(host)
    if existing_url:
        print(f"{APP_NAME} 已在運行：{existing_url}/chat/")
        _open_browser(existing_url + "/chat/")
        return 0

    if _use_macos_dock_app() and not _acquire_macos_instance_lock():
        existing_url = _wait_for_existing_app_url(host)
        if existing_url:
            print(f"{APP_NAME} 正在運行：{existing_url}/chat/")
            _open_browser(existing_url + "/chat/")
        else:
            print(f"{APP_NAME} 已有實例正在啟動，當前實例退出。")
        return 0

    # 時序：先選定端口並設 env，再 import uvicorn / 觸發 app.* import。
    cfg = build_server_config()
    apply_runtime_env(cfg)
    url = f"http://{cfg['host']}:{cfg['port']}"
    preload_server_app(cfg)

    if _use_macos_dock_app():
        return _run_macos_dock_app(cfg, url)

    if _use_windows_taskbar_app():
        return _run_windows_taskbar_app(cfg, url)

    if not _env_flag("STAFFDECK_HEADLESS"):
        print(f"{APP_NAME} 啟動中，就緒後將打開：{url}/chat/")
        threading.Thread(target=_open_browser_when_ready, args=(url,), daemon=True).start()
    else:
        print(f"{APP_NAME} headless 啟動中：{url}")
    _serve(cfg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
