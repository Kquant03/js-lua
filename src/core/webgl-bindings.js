// Optimized WebGL bindings for WASM
class WebGLBindings {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.posColorBuffer = null;
        this.memory = null;
        
        // Pre-compiled shaders for instant initialization
        this.vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec4 a_color;
            varying vec4 v_color;
            uniform vec2 u_resolution;
            
            void main() {
                vec2 clipSpace = ((a_position / u_resolution) * 2.0) - 1.0;
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                v_color = a_color;
            }
        `;
        
        this.fragmentShaderSource = `
            precision mediump float;
            varying vec4 v_color;
            
            void main() {
                gl_FragColor = v_color;
            }
        `;
    }
    
    createContext(width, height) {
        try {
            // Get WebGL context with optimized settings
            this.gl = this.canvas.getContext('webgl', {
                alpha: false,
                depth: false,
                stencil: false,
                antialias: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false
            });
            
            if (!this.gl) {
                console.error('WebGL not supported');
                return -1;
            }
            
            const gl = this.gl;
            
            // Create and compile shaders
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, this.vertexShaderSource);
            gl.compileShader(vertexShader);
            
            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, this.fragmentShaderSource);
            gl.compileShader(fragmentShader);
            
            // Create program
            this.program = gl.createProgram();
            gl.attachShader(this.program, vertexShader);
            gl.attachShader(this.program, fragmentShader);
            gl.linkProgram(this.program);
            
            // Clean up shaders
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            
            // Use program
            gl.useProgram(this.program);
            
            // Get attribute locations
            this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
            this.colorLocation = gl.getAttribLocation(this.program, 'a_color');
            this.resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
            
            // Enable attributes
            gl.enableVertexAttribArray(this.positionLocation);
            gl.enableVertexAttribArray(this.colorLocation);
            
            // Set resolution
            gl.uniform2f(this.resolutionLocation, width, height);
            
            // Set viewport
            gl.viewport(0, 0, width, height);
            
            // Enable blending for transparency
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            
            // Create a single buffer for all geometry
            this.posColorBuffer = gl.createBuffer();
            
            return 0;
        } catch (e) {
            console.error('WebGL initialization failed:', e);
            return -1;
        }
    }
    
    createExports(memory) {
        this.memory = memory;
        const self = this;
        
        return {
            webgl_create_context: (width, height) => {
                return self.createContext(width, height);
            },
            
            webgl_clear: (r, g, b, a) => {
                const gl = self.gl;
                if (!gl) return;
                
                gl.clearColor(r, g, b, a);
                gl.clear(gl.COLOR_BUFFER_BIT);
            },
            
            webgl_present: () => {
                // WebGL automatically presents on next frame
                // This is a no-op but kept for API compatibility
            },
            
            webgl_create_buffer: () => {
                // Return a dummy ID since we use a single buffer
                return 1;
            },
            
            webgl_bind_buffer: (target, buffer) => {
                // No-op - we always use the same buffer
            },
            
            webgl_buffer_data: (target, dataPtr, size, usage) => {
                const gl = self.gl;
                if (!gl) return;
                
                // Direct memory view - no copying!
                const data = new Float32Array(memory.buffer, dataPtr, size / 4);
                
                gl.bindBuffer(gl.ARRAY_BUFFER, self.posColorBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
            },
            
            webgl_draw_arrays: (mode, first, count) => {
                const gl = self.gl;
                if (!gl) return;
                
                // Set up vertex attributes
                const stride = 6 * 4; // 6 floats per vertex
                gl.vertexAttribPointer(self.positionLocation, 2, gl.FLOAT, false, stride, 0);
                gl.vertexAttribPointer(self.colorLocation, 4, gl.FLOAT, false, stride, 2 * 4);
                
                // Draw
                gl.drawArrays(mode, first, count);
            },
            
            // Stub functions for compatibility
            webgl_create_shader: (type) => 1,
            webgl_shader_source: (shader, source, length) => {},
            webgl_compile_shader: (shader) => {},
            webgl_create_program: () => 1,
            webgl_attach_shader: (program, shader) => {},
            webgl_link_program: (program) => {},
            webgl_use_program: (program) => {},
            webgl_get_attrib_location: (program, name, length) => 0,
            webgl_enable_vertex_attrib: (location) => {},
            webgl_vertex_attrib_pointer: (location, size, type, normalized, stride, offset) => {},
            webgl_get_uniform_location: (program, name, length) => 0,
            webgl_uniform1f: (location, v) => {},
            webgl_uniform2f: (location, v0, v1) => {},
            webgl_uniform3f: (location, v0, v1, v2) => {},
            webgl_uniform4f: (location, v0, v1, v2, v3) => {},
            webgl_uniform_matrix4fv: (location, transpose, data) => {},
            webgl_create_texture: () => 1,
            webgl_bind_texture: (target, texture) => {},
            webgl_tex_parameter: (target, pname, param) => {},
            webgl_tex_image2d: (target, level, internalFormat, width, height, border, format, type, pixels) => {},
            webgl_draw_elements: (mode, count, type, offset) => {}
        };
    }
}

// Make it globally available
window.WebGLBindings = WebGLBindings;