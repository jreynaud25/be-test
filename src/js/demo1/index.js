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
  const circleCanvas = document.getElementById("circleCanvas");

  if (!svgElement) {
    console.error("SVG element not found!");
    return;
  }

  if (!outputCanvas || !sandCanvas || !circleCanvas) {
    console.error("Canvas element not found!");
    return;
  }

  const ctx = outputCanvas.getContext("2d");
  const gl = sandCanvas.getContext("webgl");
  const circleCtx = circleCanvas.getContext("2d");

  if (!ctx) {
    console.error("Failed to get 2D context for outputCanvas!");
    return;
  }

  if (!gl) {
    console.error("Failed to get WebGL context for sandCanvas!");
    return;
  }

  if (!circleCtx) {
    console.error("Failed to get 2D context for circleCanvas!");
    return;
  }

  const settings = {
    randomness: 0.05,
    color: [194, 178, 128], // RGB color for sand
    zoneRadius: 50,
    circleRadius: 30, // Initial circle radius
    particleCount: 500000, // Number of particles
    particleSize: 4, // Size of particles
    shaderRandomness: 0.1,
    showCircleCanvas: true,
    strokeWidth: 10,
    strokeHardness: 0.5,
    strokeOpacity: 1,
    saveAsPNG: () => saveCanvasAsPNG(),
  };

  const gui = new dat.GUI();
  gui.add(settings, "randomness", 0, 0.2)
    .step(0.01)
    .name("Randomness")
    .onChange(initializeParticles);
  gui.addColor(settings, "color")
    .name("Sand Color")
    .onChange(initializeParticles);
  gui.add(settings, "zoneRadius", 10, 100)
    .name("Zone Radius");
  gui.add(settings, "circleRadius", 10, 100)
    .name("Circle Radius");
  gui.add(settings, "particleCount", 1000, 1000000)
    .name("Particle Count")
    .onChange(initializeParticles);
  gui.add(settings, "particleSize", 1, 10)
    .name("Particle Size")
    .onChange(initializeParticles);
  gui.add(settings, "shaderRandomness", 0, 1)
    .name("Shader Randomness")
    .onChange(initializeParticles);
  gui.add(settings, "showCircleCanvas")
    .name("Show Circle Canvas")
    .onChange(toggleCircleCanvas);
  gui.add(settings, "strokeWidth", 1, 100)
    .name("Stroke Width")
    .onChange(updateStrokeSettings);
  gui.add(settings, "strokeHardness", 0, 1)
    .name("Stroke Hardness")
    .onChange(updateStrokeSettings);
  gui.add(settings, "strokeOpacity", 0, 1)
    .name("Stroke Opacity")
    .onChange(updateStrokeSettings);
  gui.add(settings, "saveAsPNG")
    .name("Save as PNG");

  // Create custom file input elements
  const shaderInput = document.createElement('input');
  shaderInput.type = 'file';
  shaderInput.accept = '.frag,.shader';
  shaderInput.style.display = 'none';
  shaderInput.addEventListener('change', (event) => handleShaderUpload(event.target.files[0]));

  const imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/*';
  imageInput.style.display = 'none';
  imageInput.addEventListener('change', (event) => handleImageUpload(event.target.files[0]));

  // Add buttons to the GUI to trigger file inputs
  gui.add({ uploadShader: () => shaderInput.click() }, 'uploadShader').name('Upload Shader');
  gui.add({ uploadImage: () => imageInput.click() }, 'uploadImage').name('Upload Image');

  // Append the file input elements to the body
  document.body.appendChild(shaderInput);
  document.body.appendChild(imageInput);

  function toggleCircleCanvas() {
    circleCanvas.style.display = settings.showCircleCanvas ? 'block' : 'none';
  }

  // Ensure the sandCanvas has the same size as outputCanvas
  function resizeCanvas() {
    sandCanvas.width = outputCanvas.width;
    sandCanvas.height = outputCanvas.height;
    circleCanvas.width = outputCanvas.width;
    circleCanvas.height = outputCanvas.height;
    gl.viewport(0, 0, sandCanvas.width, sandCanvas.height);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // Function to render SVG to canvas
  function renderSVGToCanvas(svgElement, canvas, ctx) {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, outputCanvas);

    // Use the texture
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  // Declare shader and buffer locations globally
  let positionLocation,
    pointSizeLocation,
    colorLocation,
    positionBuffer,
    pointSizeBuffer,
    particlePositions,
    particleSizes;

  // Initialize WebGL and particle system
  function initializeParticles() {
    let vertexShaderSource = `
            attribute vec2 a_position;
            attribute float a_pointSize;
            void main() {
                gl_PointSize = a_pointSize;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

    let fragmentShaderSource = `
            precision mediump float;
            uniform vec3 u_color;
            void main() {
                gl_FragColor = vec4(u_color, 1.0);
            }
        `;

    if (settings.shaderFile) {
      fragmentShaderSource = settings.shaderFile;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
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
      const circleImageData = circleCtx.getImageData(0, 0, width, height).data;

      const particles = [];
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

      // Distribute particles with added randomness
      const particlesToDistribute = Math.min(settings.particleCount, particles.length);
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

        // Apply shader randomness based on the black stroke
        const shaderIndex = (pixel.y * width + pixel.x) * 4;
        const shaderAlpha = circleImageData[shaderIndex + 3];
        const additionalRandomness = (shaderAlpha > 0 ? settings.shaderRandomness : 0) * (Math.random() - 0.5);

        positions.push(nx + additionalRandomness, ny + additionalRandomness); // POSITION SHADER
        sizes.push(Math.random() * settings.particleSize + 1); // Random size between 1 and particleSize
      }

      return {
        positions: new Float32Array(positions),
        sizes: new Float32Array(sizes),
      };
    }

    const particles = createParticles(outputCanvas.width, outputCanvas.height);
    particlePositions = particles.positions;
    particleSizes = particles.sizes;

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

  // Drawing on the circleCanvas
  let drawing = false;

  circleCanvas.addEventListener('mousedown', () => {
    drawing = true;
    circleCtx.beginPath();
  });
  circleCanvas.addEventListener('mouseup', () => drawing = false);
  circleCanvas.addEventListener('mouseout', () => drawing = false);

  circleCanvas.addEventListener('mousemove', (event) => {
    if (drawing) {
      const rect = circleCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      drawStroke(x, y);
    }
  });

  function drawStroke(x, y) {
    const hardness = settings.strokeHardness;
    const gradient = circleCtx.createRadialGradient(x, y, 0, x, y, settings.strokeWidth);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${settings.strokeOpacity})`);
    gradient.addColorStop(hardness, `rgba(0, 0, 0, ${settings.strokeOpacity})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, 0)`);

    circleCtx.fillStyle = gradient;
    circleCtx.fillRect(x - settings.strokeWidth, y - settings.strokeWidth, settings.strokeWidth * 2, settings.strokeWidth * 2);
  }

  function updateStrokeSettings() {
    // This function can be used to update any other settings or reset states if needed
    // For now, it's left empty as we only need to update the drawing settings directly
  }

  function handleShaderUpload(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      settings.shaderFile = event.target.result;
      initializeParticles();
    };
    reader.readAsText(file);
  }

  function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const blackAndAlphaCanvas = document.createElement('canvas');
        blackAndAlphaCanvas.width = img.width;
        blackAndAlphaCanvas.height = img.height;
        const blackAndAlphaCtx = blackAndAlphaCanvas.getContext('2d');
        blackAndAlphaCtx.drawImage(img, 0, 0);

        const imageData = blackAndAlphaCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const grayscale = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = 0; // Black
          data[i + 1] = 0; // Black
          data[i + 2] = 0; // Black
          data[i + 3] = grayscale; // Alpha
        }
        blackAndAlphaCtx.putImageData(imageData, 0, 0);

        ctx.drawImage(blackAndAlphaCanvas, 0, 0, outputCanvas.width, outputCanvas.height);
        copyCanvasToWebGLTexture();
        initializeParticles();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Initialize canvas and GUI settings
  resizeCanvas();
  toggleCircleCanvas();
});
