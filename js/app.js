// js/app.js
import { createSampleSchematic } from './model/schematic.js';
import { SchematicRenderer } from './renderer.js';

// Elements
const modal = document.getElementById('onboarding-modal');
const btnCloseModal = document.getElementById('btn-close-onboarding');
const btnTheme = document.getElementById('btn-theme-toggle');
const htmlEl = document.documentElement;

// State
let currentThemeIndex = 0;
const themes = ['dark', 'light', 'high-contrast'];
let schematic, renderer;

// Security: Use strict ES module patterns, avoid eval/innerHTML
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    registerPWA();
});

function initApp() {
    // 1. Storage: Load Settings
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && themes.includes(savedTheme)) {
        htmlEl.setAttribute('data-theme', savedTheme);
        currentThemeIndex = themes.indexOf(savedTheme);
    }
    
    // 2. Onboarding Modal (localStorage check)
    if (!localStorage.getItem('onboarding_done')) {
        modal.showModal();
    }

    btnCloseModal.addEventListener('click', () => {
        modal.close();
        localStorage.setItem('onboarding_done', 'true');
    });

    btnTheme.addEventListener('click', () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        htmlEl.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        if (renderer) renderer.draw(); // Redraw colors
    });

    // 3. Initialize Data & Renderer
    schematic = createSampleSchematic();
    const canvas = document.getElementById('schematic-canvas');
    renderer = new SchematicRenderer(canvas, schematic);

    // Wire up Layer Slider & Buttons
    const slider = document.getElementById('layer-slider');
    slider.max = schematic.height - 1;
    
    const updateLayer = (y) => {
        y = Math.max(0, Math.min(y, schematic.height - 1));
        slider.value = y;
        renderer.setLayer(y);
    };

    document.getElementById('btn-layer-up').addEventListener('click', () => updateLayer(renderer.currentLayer + 1));
    document.getElementById('btn-layer-down').addEventListener('click', () => updateLayer(renderer.currentLayer - 1));
    slider.addEventListener('input', (e) => updateLayer(parseInt(e.target.value, 10)));

    // Wire up Grid & Ghost Toggles
    const btnGrid = document.getElementById('btn-toggle-grid');
    btnGrid.addEventListener('click', () => {
        renderer.showGrid = !renderer.showGrid;
        btnGrid.setAttribute('aria-pressed', renderer.showGrid);
        renderer.draw();
    });

    const btnGhost = document.getElementById('btn-toggle-ghost');
    btnGhost.addEventListener('click', () => {
        renderer.showGhost = !renderer.showGhost;
        btnGhost.setAttribute('aria-pressed', renderer.showGhost);
        renderer.draw();
    });
}

function registerPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Update available
                        showUpdateBanner(newWorker);
                    }
                });
            });
        }).catch(err => console.error("SW Registration failed:", err));
    }
}

function showUpdateBanner(worker) {
    const banner = document.getElementById('status-banner');
    banner.textContent = "New update available! Tap to reload.";
    banner.classList.remove('hidden');
    // Security: textContent only
    banner.style.background = "var(--emerald)";
    banner.style.color = "#111";
    banner.style.padding = "10px";
    banner.style.textAlign = "center";
    
    banner.addEventListener('click', () => {
        worker.postMessage('SKIP_WAITING');
        window.location.reload();
    });
}
