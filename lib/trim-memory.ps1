Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Mem {
    [DllImport("psapi.dll")]
    public static extern int EmptyWorkingSet(IntPtr hwProc);
}
"@ -ErrorAction SilentlyContinue

Get-Process -Name "Kcomunitywhats*" -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        [Win32Mem]::EmptyWorkingSet($_.Handle) | Out-Null
    } catch {}
}
