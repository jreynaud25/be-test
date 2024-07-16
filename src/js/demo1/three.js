import { gsap } from "gsap";
import * as dat from "dat.gui";
import MenuItem from "./MenuItem.js"; // Assuming your MenuItem class is in this file

document.addEventListener('DOMContentLoaded', () => {
    const svgElement = document.getElementById('menuSVG');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const particleCanvas = document.getElementById('particleCanvas');

    // Ensure MenuItem is properly instantiated
    new MenuItem(document.querySelector('.menu__item'));

    // Render SVG to Canvas
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        initThreeJS(imageData);
    };
    img.src = url;

    // Initialize Three.js
    function initThreeJS(imageData) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: particleCanvas, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        // Particle system
        const particles = [];
        const colors = [];

        for (let y = 0; y < imageData.height; y++) {
            for (let x = 0; x < imageData.width; x++) {
                const index = (y * imageData.width + x) * 4;
                const r = imageData.data[index];
                const g = imageData.data[index + 1];
                const b = imageData.data[index + 2];

                // Check if the pixel is black
                if (r === 0 && g === 0 && b === 0) {
                    particles.push(x - imageData.width / 2, -y + imageData.height / 2, 0);
                    colors.push(1, 1, 1);
                }
            }
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3));
        particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            vertexColors: true,
            size: 1
        });

        const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particleSystem);

        camera.position.z = 500;

        const animate = () => {
            requestAnimationFrame(animate);
            particleSystem.rotation.y += 0.01;
            renderer.render(scene, camera);
        };

        animate();
    }
});