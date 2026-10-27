"""Probe the real application Nginx image with trusted and direct HTTP peers.

Usage: python3 tests/smoke_proxy_scheme.py <locally-built-application-image>
All containers and the network are disposable; no host ports are published.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import uuid


def run(*args):
    return subprocess.check_output(args, text=True).strip()


backend = '''from http.server import BaseHTTPRequestHandler, HTTPServer
import json
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        scheme = self.headers.get('X-Forwarded-Proto')
        redirect = self.path.endswith('/redirect')
        self.send_response(307 if redirect else 200)
        if redirect:
            self.send_header('Location', scheme + '://store.test/destination/')
        self.end_headers()
        self.wfile.write(json.dumps({'scheme': scheme, 'path': self.path}).encode())
HTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
'''
client = '''import http.client,json,sys
c=http.client.HTTPConnection('app',8080,timeout=5)
c.putrequest('GET',sys.argv[1])
for value in json.loads(sys.argv[2]): c.putheader('X-Forwarded-Proto',value)
c.endheaders()
r=c.getresponse(); body=r.read()
print(json.dumps({'status':r.status,'location':r.getheader('Location'),'body':body.decode()}))
'''


def main():
    image = sys.argv[1]
    prefix = 'scheme-' + uuid.uuid4().hex[:10]
    names = [prefix + suffix for suffix in ('-backend', '-outsider', '-app')]
    network = prefix + '-net'
    with tempfile.TemporaryDirectory() as directory:
        server = Path(directory) / 'server.py'
        server.write_text(backend)
        try:
            run('docker', 'network', 'create', network)
            run('docker', 'run', '-d', '--name', names[0], '--network', network,
                '--network-alias', 'backend', '-v', str(server) + ':/server.py:ro',
                'python:3.11-slim', 'python', '/server.py')
            trusted = run('docker', 'inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', names[0])
            run('docker', 'run', '-d', '--name', names[1], '--network', network,
                'python:3.11-slim', 'sleep', 'infinity')
            # Non-default edge address proves that the runtime template is rendered.
            run('docker', 'run', '-d', '--name', names[2], '--network', network,
                '--network-alias', 'app', '-e', 'EDGE_PROXY_IP=' + trusted, image)
            for _ in range(30):
                probe = subprocess.run(['docker', 'exec', names[2], 'wget', '-qO-', 'http://127.0.0.1:8080/healthz'], capture_output=True)
                if probe.returncode == 0:
                    break
                time.sleep(1)
            else:
                raise AssertionError('Application Nginx did not become ready')
            run('docker', 'exec', names[2], 'nginx', '-t')
            routes = ('/api/scheme', '/api/v1/me', '/api/v1/admin/users', '/static/scheme')
            for peer, expected_https in ((names[0], True), (names[1], False)):
                for values in ([], ['https'], ['http'], ['garbage'], ['https', 'http']):
                    expected = 'https' if expected_https and values == ['https'] else 'http'
                    for route in routes + ('/api/redirect',):
                        result = json.loads(run('docker', 'exec', peer, 'python', '-c', client, route, json.dumps(values)))
                        body = json.loads(result['body'])
                        assert body['scheme'] == expected, (peer, values, route, result)
                        if route.endswith('redirect'):
                            assert result['status'] == 307 and result['location'] == expected + '://store.test/destination/', result
            print('PASS: trusted edge retains HTTPS; direct, invalid and duplicate headers stay HTTP; redirects and all proxy routes checked')
        finally:
            for name in reversed(names):
                subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['docker', 'network', 'rm', network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
