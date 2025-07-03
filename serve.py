#!/usr/bin/env python3
import http.server
import socketserver
import mimetypes
import os
import gzip

# Configure MIME types for WASM
mimetypes.add_type('application/wasm', '.wasm')

class UltraFastHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Check for compressed versions
        if self.path.endswith('.wasm'):
            brotli_path = self.path + '.br'
            gzip_path = self.path + '.gz'
            
            accept_encoding = self.headers.get('Accept-Encoding', '')
            
            # Serve Brotli if available and supported
            if 'br' in accept_encoding and os.path.exists('.' + brotli_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/wasm')
                self.send_header('Content-Encoding', 'br')
                self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
                self.end_headers()
                
                with open('.' + brotli_path, 'rb') as f:
                    self.wfile.write(f.read())
                return
            
            # Serve Gzip if available and supported
            elif 'gzip' in accept_encoding and os.path.exists('.' + gzip_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/wasm')
                self.send_header('Content-Encoding', 'gzip')
                self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
                self.end_headers()
                
                with open('.' + gzip_path, 'rb') as f:
                    self.wfile.write(f.read())
                return
        
        # Fall back to normal serving
        super().do_GET()
    
    def end_headers(self):
        # Enable CORS for local development
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        
        # Cache WASM files aggressively
        if self.path.endswith('.wasm'):
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        
        super().end_headers()

PORT = 8081
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), UltraFastHandler) as httpd:
    # Check for WASM files safely
    wasm_size = 0
    compressed_size = 0
    compression_type = ""
    
    if os.path.exists('game.wasm'):
        wasm_size = os.path.getsize('game.wasm') / 1024
        
        if os.path.exists('game.wasm.br'):
            compressed_size = os.path.getsize('game.wasm.br') / 1024
            compression_type = "Brotli"
        elif os.path.exists('game.wasm.gz'):
            compressed_size = os.path.getsize('game.wasm.gz') / 1024
            compression_type = "Gzip"
    
    print(f"🚀 DreamEmulator Ultra-Fast Server")
    print(f"📡 Running at: http://localhost:{PORT}")
    
    if wasm_size > 0:
        print(f"📦 WASM size: {wasm_size:.1f}KB")
        if compressed_size > 0:
            ratio = (1 - compressed_size/wasm_size) * 100
            print(f"📦 {compression_type}: {compressed_size:.1f}KB ({ratio:.0f}% compression)")
        print(f"🎯 Target: Sub-100ms initialization")
        print(f"⚡ Expected: 30-80ms on desktop")
    else:
        print(f"📦 Mode: JavaScript fallback (no WASM)")
        print(f"⚡ Ultra-fast JavaScript Lua runtime")
        print(f"🎯 Instant initialization")
    
    print()
    print("Features enabled:")
    if wasm_size > 0:
        print("  • WebAssembly with streaming compilation")
        print("  • Automatic compression detection")
        print("  • Performance monitoring dashboard")
        print("  • Real-time load time metrics")
    else:
        print("  • Pure JavaScript Lua runtime")
        print("  • Full Lua syntax support")
        print("  • Instant startup (no WASM loading)")
        print("  • 15+ working exported functions")
        print("  • Math, string, and graphics operations")
    print()
    print("Press Ctrl+C to stop")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")