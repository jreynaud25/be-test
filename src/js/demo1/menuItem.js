import { gsap } from "gsap";
import * as dat from "dat.gui";

class MenuItem {
  constructor(el) {
    this.DOM = { el: el };
    this.DOM.textsGroupEl = this.DOM.el.querySelector("svg > g");
    this.filterId = this.DOM.el.querySelector("svg filter").id;

    this.DOM.wrapper1 = this.DOM.textsGroupEl.querySelector("#wrapper-1");
    this.DOM.wrapper2 = this.DOM.textsGroupEl.querySelector("#wrapper-2");

    this.DOM.feBlur = document.querySelector(
      `#${this.filterId} > feGaussianBlur`
    );
    this.DOM.feColorMatrix = document.getElementById("colorMatrix");
    this.primitiveValues = { stdDeviation: 15 };

    this.settings = {
      playPause: () => this.onPlayPauseClick(),
      duration: 1.6,
      stdDeviation: 1,
      loop: false,
      text1: "Be.",
      text2: "كن",
      colorMatrix: {
        r: [1, 0, 0, 0, 0],
        g: [0, 3, 0, 0, 0],
        b: [1, 0, 1, 0, 0],
        a: [0, 0, 0, 18, -5],
      },
      timeline: 0,
      uploadSVG1: () => this.uploadSVG(this.DOM.wrapper1, "one"),
      uploadSVG2: () => this.uploadSVG(this.DOM.wrapper2, "two"),
      saveJSON: () => this.saveJSON(),
      loadJSON: () => this.loadJSON(),
    };

    this.initGUI();
    this.createTimeline();
    this.initEvents();
  }

  initGUI() {
    const gui = new dat.GUI();
    gui.add(this.settings, "playPause").name("Play/Pause");
    gui
      .add(this.settings, "duration", 0.1, 10, 0.1)
      .onChange(() => this.onDurationChange());
    gui
      .add(this.settings, "stdDeviation", 0, 50, 0.1)
      .onChange(() => this.onStdDeviationChange());
    gui.add(this.settings, "loop").onChange(() => this.onLoopChange());
    gui.add(this.settings, "text1").onChange(() => this.onText1Change());
    gui.add(this.settings, "text2").onChange(() => this.onText2Change());
    gui
      .add(this.settings, "timeline", 0, 1, 0.01)
      .onChange(() => this.onTimelineChange());

    const colorMatrixFolder = gui.addFolder("Color Matrix");
    for (let channel of ["r", "g", "b", "a"]) {
      this.settings.colorMatrix[channel].forEach((val, i) => {
        colorMatrixFolder
          .add(this.settings.colorMatrix[channel], `${i}`, -10, 50, 0.1)
          .onChange(() => this.onColorMatrixChange());
      });
    }

    gui.add(this.settings, "uploadSVG1").name("Upload SVG 1");
    gui.add(this.settings, "uploadSVG2").name("Upload SVG 2");
    gui.add(this.settings, "saveJSON").name("Save Settings");
    gui.add(this.settings, "loadJSON").name("Load Settings");
  }

  initEvents() {
    this.DOM.textsGroupEl.style.filter = `url(#${this.filterId})`;
  }

  onPlayPauseClick() {
    if (this.tl.paused()) {
      this.tl.play();
    } else {
      this.tl.pause();
    }
  }

  onTimelineChange() {
    this.tl.pause();
    this.tl.progress(this.settings.timeline);
  }

  onDurationChange() {
    this.tl.duration(this.settings.duration);
  }

  onStdDeviationChange() {
    this.DOM.feBlur.setAttribute("stdDeviation", this.settings.stdDeviation);
    this.primitiveValues.stdDeviation = this.settings.stdDeviation;
  }

  onColorMatrixChange() {
    const { r, g, b, a } = this.settings.colorMatrix;
    const values = [...r, ...g, ...b, ...a].join(" ");
    this.DOM.feColorMatrix.setAttribute("values", values);
  }

  onLoopChange() {
    this.tl.repeat(this.settings.loop ? -1 : 0);
    this.tl.yoyo(this.settings.loop);
}

  onText1Change() {
    this.DOM.wrapper1.innerHTML = `<text  x="960" y="540" text-anchor="middle" dominant-baseline="middle" font-size="100" class="one">${this.settings.text1}</text>`;
    this.updateTextElements();
  }

  onText2Change() {
    this.DOM.wrapper2.innerHTML = `<text x="960" y="540"  text-anchor="middle" dominant-baseline="middle" font-size="100"  class="two">${this.settings.text2}</text>`;
    this.updateTextElements();
  }

  uploadSVG(target, className) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/svg+xml";
    input.onchange = (event) => {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (svg) {
          const viewBox = svg.viewBox.baseVal;
          const aspectRatio = viewBox.width / viewBox.height;
  
          // Set max height to 1080 and calculate width based on aspect ratio
          const maxHeight = 1080;
          const maxWidth = maxHeight * aspectRatio;
  
          // Update SVG attributes
          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
          svg.classList.add(className);
  
          // Center SVG
          svg.style.maxHeight = `${maxHeight}px`;
          svg.style.maxWidth = `${maxWidth}px`;
          svg.style.display = "block";
          svg.style.margin = "0 auto";
  
          // Clear any existing content and append the new SVG
          target.innerHTML = "";
          target.appendChild(svg);
  
          this.updateTextElements();
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  updateTextElements() {
    this.DOM.wrapper1 = this.DOM.textsGroupEl.querySelector("#wrapper-1");
    this.DOM.wrapper2 = this.DOM.textsGroupEl.querySelector("#wrapper-2");

    // Ensure the newly updated elements have their initial states set correctly.
    this.DOM.wrapper1.style.opacity = 1;
    this.DOM.wrapper2.style.opacity = 0;
  }

  saveJSON() {
    const settings = JSON.stringify(this.settings);
    const blob = new Blob([settings], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "settings.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  loadJSON() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (event) => {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const loadedSettings = JSON.parse(e.target.result);
        Object.assign(this.settings, loadedSettings);
        this.onDurationChange();
        this.onStdDeviationChange();
        this.onColorMatrixChange();
        this.onLoopChange();
        this.onText1Change();
        this.onText2Change();
      };
      reader.readAsText(file);
    };
    input.click();
  }

  createTimeline() {
    const { duration } = this.settings;

    this.tl = gsap
      .timeline({
        paused: true,
        repeat: this.settings.loop ? -1 : 0,
        onUpdate: () => {
          this.DOM.feBlur.setAttribute(
            "stdDeviation",
            this.primitiveValues.stdDeviation
          );
          this.settings.timeline = this.tl.progress();
        },
      })
      .to(
        this.primitiveValues,
        {
          duration: duration / 2,
          ease: "none",
          startAt: { stdDeviation: 0 },
          stdDeviation: () => this.settings.stdDeviation * 10,
        },
        0
      )
      .to(this.primitiveValues, {
        duration: duration / 2,
        ease: "none",
        stdDeviation: 0,
      })
      .to(
        this.DOM.wrapper1,
        {
          duration: duration,
          ease: "none",
          opacity: 0,
        },
        0
      )
      .to(
        this.DOM.wrapper2,
        {
          duration: duration,
          ease: "none",
          opacity: 1,
        },
        0
      );
  }
}

export default MenuItem;
