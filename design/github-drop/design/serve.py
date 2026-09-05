#!/usr/bin/env python3
"""靜態預覽用的小 server。
直接用 `python3 -m http.server` 在某些沙箱環境會在 argparse 階段
就呼叫 os.getcwd() 而失敗，所以這裡先 chdir 再起服務。"""
import os, sys, http.server, socketserver

root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8747
os.chdir(root)

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path))

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", port), H) as httpd:
    sys.stderr.write("serving %s on http://127.0.0.1:%d\n" % (root, port))
    httpd.serve_forever()
