using System;
using System.Runtime.InteropServices;
using System.Text.Json;

class InputSim
{
    [DllImport("user32.dll")] static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);
    [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, int dwFlags, IntPtr dwExtraInfo);

    const int MOUSEEVENTF_LEFTDOWN = 0x0002;
    const int MOUSEEVENTF_LEFTUP = 0x0004;
    const int MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const int MOUSEEVENTF_RIGHTUP = 0x0010;
    const int MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const int MOUSEEVENTF_MIDDLEUP = 0x0040;
    const int MOUSEEVENTF_WHEEL = 0x0800;
    const int KEYEVENTF_KEYUP = 0x0002;

    static void Main(string[] args)
    {
        if (args.Length == 0) return;
        var json = args[0];
        var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.TryGetProperty("mouse", out var mouse))
        {
            var type = mouse.GetProperty("type").GetString()!;
            int x = mouse.GetProperty("x").GetInt32();
            int y = mouse.GetProperty("y").GetInt32();
            string button = mouse.TryGetProperty("button", out var b) ? b.GetString()! : "left";

            SetCursorPos(x, y);

            int down = MOUSEEVENTF_LEFTDOWN, up = MOUSEEVENTF_LEFTUP;
            if (button == "right") { down = MOUSEEVENTF_RIGHTDOWN; up = MOUSEEVENTF_RIGHTUP; }
            else if (button == "middle") { down = MOUSEEVENTF_MIDDLEDOWN; up = MOUSEEVENTF_MIDDLEUP; }

            switch (type)
            {
                case "click":
                    mouse_event(down, 0, 0, 0, IntPtr.Zero);
                    System.Threading.Thread.Sleep(30);
                    mouse_event(up, 0, 0, 0, IntPtr.Zero);
                    break;
                case "dblclick":
                    mouse_event(down, 0, 0, 0, IntPtr.Zero);
                    System.Threading.Thread.Sleep(20);
                    mouse_event(up, 0, 0, 0, IntPtr.Zero);
                    System.Threading.Thread.Sleep(50);
                    mouse_event(down, 0, 0, 0, IntPtr.Zero);
                    System.Threading.Thread.Sleep(20);
                    mouse_event(up, 0, 0, 0, IntPtr.Zero);
                    break;
                case "down":
                    mouse_event(down, 0, 0, 0, IntPtr.Zero);
                    break;
                case "up":
                    mouse_event(up, 0, 0, 0, IntPtr.Zero);
                    break;
                case "scroll":
                    int delta = mouse.TryGetProperty("deltaY", out var dy) ? dy.GetInt32() : -3;
                    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta * 120, IntPtr.Zero);
                    break;
            }
        }
        else if (root.TryGetProperty("keyboard", out var kb))
        {
            var key = kb.GetProperty("key").GetString()!;
            byte vk = KeyToVk(key);
            if (vk == 0) return;

            bool ctrl = kb.TryGetProperty("ctrlKey", out var c) && c.GetBoolean();
            bool alt = kb.TryGetProperty("altKey", out var a) && a.GetBoolean();
            bool shift = kb.TryGetProperty("shiftKey", out var s) && s.GetBoolean();

            if (ctrl) keybd_event(0x11, 0, 0, IntPtr.Zero);
            if (alt) keybd_event(0x12, 0, 0, IntPtr.Zero);
            if (shift) keybd_event(0x10, 0, 0, IntPtr.Zero);

            keybd_event(vk, 0, 0, IntPtr.Zero);
            System.Threading.Thread.Sleep(20);
            keybd_event(vk, 0, KEYEVENTF_KEYUP, IntPtr.Zero);

            if (shift) keybd_event(0x10, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
            if (alt) keybd_event(0x12, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
            if (ctrl) keybd_event(0x11, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
        }
    }

    static byte KeyToVk(string key)
    {
        return key switch
        {
            "Enter" => 0x0D, "Tab" => 0x09, "Escape" => 0x1B, "Backspace" => 0x08,
            "Delete" => 0x2E, "Insert" => 0x2D, "Home" => 0x24, "End" => 0x23,
            "PageUp" => 0x21, "PageDown" => 0x22,
            "ArrowUp" => 0x26, "ArrowDown" => 0x28, "ArrowLeft" => 0x25, "ArrowRight" => 0x27,
            " " => 0x20,
            "F1" => 0x70, "F2" => 0x71, "F3" => 0x72, "F4" => 0x73,
            "F5" => 0x74, "F6" => 0x75, "F7" => 0x76, "F8" => 0x77,
            "F9" => 0x78, "F10" => 0x79, "F11" => 0x7A, "F12" => 0x7B,
            _ when key.Length == 1 => (byte)char.ToUpper(key[0]),
            _ => 0,
        };
    }
}
