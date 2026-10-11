#!/usr/bin/env python3
"""Static dev server for NXTFRM with caching disabled.

Usage: python3 tasks/vnext/devserver.py [port] [root]

The app versions its assets with ?v=RELEASE, so a plain http.server would keep
serving stale CSS/JS while they are being edited. This sends no-store on every
response and nothing else; it is development tooling only and is not deployed.
"""
import sys, os, socket
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8761
root = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=root, **kw)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()
    def log_message(self, fmt, *args):
        if self.path.endswith(('.html', '.js', '.css')) and '?' not in self.path:
            super().log_message(fmt, *args)

class DualStackServer(ThreadingHTTPServer):
    # Chrome may resolve localhost to ::1 before 127.0.0.1; listen on both.
    address_family = socket.AF_INET6
    allow_reuse_address = True
    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()

if __name__ == '__main__':
    with DualStackServer(('::', port), Handler) as httpd:
        print(f'NXTFRM dev server on http://localhost:{port}/ serving {root}', flush=True)
        httpd.serve_forever()
