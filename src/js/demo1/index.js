import Menu from "./menu";
import * as dat from "dat.gui";

// Ensure the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Instantiate the Menu class
  const menu = new Menu(document.querySelector("nav.menu"));

  // Get the SVG element and the canvas elements
  const svgElement = document.getElementById("menuSVG");
  const outputCanvas = document.getElementById("outputCanvas");
  const sandCanvas = document.getElementById("sandCanvas");

  if (!svgElement) {
    console.error("SVG element not found!");
    return;
  }

  if (!outputCanvas || !sandCanvas) {
    console.error("Canvas element not found!");
    return;
  }

  const ctx = outputCanvas.getContext("2d");
  const gl = sandCanvas.getContext("webgl");

  const settings = {
    randomness: 0.05,
    color: [194, 178, 128], // RGB color for sand
    saveAsPNG: () => saveCanvasAsPNG(),
  };

  const gui = new dat.GUI();
  gui
    .add(settings, "randomness", 0, 0.2)
    .step(0.01)
    .name("Randomness")
    .onChange(initializeParticles);
  gui.addColor(settings, "color").name("Sand Color").onChange(initializeParticles);
  gui.add(settings, "saveAsPNG").name("Save as PNG");

  // Ensure the sandCanvas has the same size as outputCanvas
  function resizeCanvas() {
    sandCanvas.width = outputCanvas.width;
    sandCanvas.height = outputCanvas.height;
    gl.viewport(0, 0, sandCanvas.width, sandCanvas.height);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // Function to render SVG to canvas
  function renderSVGToCanvas(svgElement, canvas, ctx) {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      // After drawing the SVG to the canvas, copy it to the sandCanvas and initialize the particles
      copyCanvasToWebGLTexture();
      initializeParticles();
    };
    img.src = url;
  }

  // Render the SVG onto the canvas initially
  renderSVGToCanvas(svgElement, outputCanvas, ctx);

  // Create an observer to watch for changes in the SVG
  const observer = new MutationObserver(() => {
    renderSVGToCanvas(svgElement, outputCanvas, ctx);
  });

  // Configure the observer to watch for changes in the subtree and attributes
  observer.observe(svgElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  // Function to copy the outputCanvas to sandCanvas as a texture
  function copyCanvasToWebGLTexture() {
    // Create a texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Define the texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Upload the canvas content to the texture
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      outputCanvas
    );

    // Use the texture
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  // Declare shader and buffer locations globally
  let positionLocation,
    pointSizeLocation,
    colorLocation,
    positionBuffer,
    pointSizeBuffer,
    particlePositions;

  // Initialize WebGL and particle system
  function initializeParticles() {
    const vertexShaderSource = `
            attribute vec2 a_position;
            attribute float a_pointSize;
            void main() {
                gl_PointSize = a_pointSize;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

    const fragmentShaderSource = `
            precision mediump float;
            uniform vec3 u_color;
            void main() {
                gl_FragColor = vec4(u_color, 1.0);
            }
        `;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );
    const program = createProgram(gl, vertexShader, fragmentShader);

    gl.useProgram(program);

    positionLocation = gl.getAttribLocation(program, "a_position");
    pointSizeLocation = gl.getAttribLocation(program, "a_pointSize");
    colorLocation = gl.getUniformLocation(program, "u_color");

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    function createParticles(width, height) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const particles = [];
      const numParticles = 500000;
      const positions = [];
      const sizes = [];

      // Collect pixel positions
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const alpha = data[index + 3];

          // Only consider non-transparent pixels
          if (alpha > 0) {
            particles.push({ x: x, y: y });
          }
        }
      }

      // Log number of particles found
      console.log(`Found ${particles.length} particles`);

      // Distribute particles with added randomness
      const particlesToDistribute = Math.min(numParticles, particles.length);
      for (let i = 0; i < particlesToDistribute; i++) {
        const pixel = particles[Math.floor(Math.random() * particles.length)];
        const nx =
          (pixel.x / width) * 2 -
          1 +
          (Math.random() - 0.5) * settings.randomness; // Adding more randomness
        const ny =
          1 -
          (pixel.y / height) * 2 +
          (Math.random() - 0.5) * settings.randomness; // Adding more randomness
        positions.push(nx, ny);
        sizes.push(Math.random() * 3 + 1); // Random size between 1 and 4
      }

      // Log particle positions for debugging
      console.log("Particle positions:", positions);

      return {
        positions: new Float32Array(positions),
        sizes: new Float32Array(sizes),
      };
    }

    const particles = createParticles(outputCanvas.width, outputCanvas.height);
    particlePositions = particles.positions;
    const particleSizes = particles.sizes;

    gl.bufferData(gl.ARRAY_BUFFER, particlePositions, gl.STATIC_DRAW);

    pointSizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointSizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particleSizes, gl.STATIC_DRAW);

    // Render particles once after copying canvas
    renderParticles();
  }

  function renderParticles() {
    // Ensure the WebGL canvas is cleared before drawing
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set the particle color
    gl.uniform3f(colorLocation, settings.color[0] / 255, settings.color[1] / 255, settings.color[2] / 255);

    // Enable vertex attributes and draw the particles
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(pointSizeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, pointSizeBuffer);
    gl.vertexAttribPointer(pointSizeLocation, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, particlePositions.length / 2);
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function saveCanvasAsPNG() {
    // Log the canvas size to ensure it's correct
    console.log(`Canvas size: ${sandCanvas.width}x${sandCanvas.height}`);

    // Render particles to ensure the canvas is up to date
    renderParticles();

    // Log a message before rendering
    console.log('Saving canvas as PNG...');

    // Ensure WebGL rendering is complete
    gl.finish();

    // Convert canvas to Blob and save as PNG
    sandCanvas.toBlob((blob) => {
        if (!blob) {
            console.error('Failed to create blob from canvas');
            return;
        }

        // Log the blob size to ensure it has content
        console.log(`Blob size: ${blob.size}`);

        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = 'sand_canvas.png';
        link.click();

        // Clean up
        URL.revokeObjectURL(url);
    }, 'image/png');
}

});
