import http.server
import urllib.request
import urllib.error
import json
import os
import socket

PORT = 8000
API_HOST = 'https://api.deepseek.com'

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self._set_cors_headers()
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        # 转发到 DeepSeek API
        if self.path.startswith('/anthropic'):
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)

            target_url = API_HOST + self.path

            # 构建转发请求
            headers = {
                'Content-Type': 'application/json',
                'Authorization': self.headers.get('Authorization', ''),
                'anthropic-version': '2023-06-01',
            }

            try:
                req = urllib.request.Request(
                    target_url,
                    data=body,
                    headers=headers,
                    method='POST'
                )

                with urllib.request.urlopen(req, timeout=120) as response:
                    data = response.read()
                    self._set_cors_headers()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(data)

            except urllib.error.HTTPError as e:
                self._set_cors_headers()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(e.read())
            except urllib.error.URLError as e:
                self._set_cors_headers()
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e.reason)}).encode())
            except socket.timeout:
                self._set_cors_headers()
                self.send_response(504)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'API request timeout'}).encode())
        else:
            # 非 API 请求，正常响应 404
            self._set_cors_headers()
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        # 静态文件服务
        if self.path.startswith('/anthropic'):
            self._set_cors_headers()
            self.send_response(404)
            self.end_headers()
            return
        super().do_GET()

    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version')

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.HTTPServer(('0.0.0.0', PORT), ProxyHandler)
    print(f'Server running at http://localhost:{PORT}')
    print('API proxy: /anthropic -> https://api.deepseek.com/anthropic')
    server.serve_forever()
